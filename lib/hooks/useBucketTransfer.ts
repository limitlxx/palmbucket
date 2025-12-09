import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { bucketVaultAbi, erc20Abi } from '@/lib/contracts/abis'
import { Address, parseEther, formatUnits } from 'viem'
import { BucketType } from '@/types'

interface TransferParams {
  sourceVault: Address
  destinationVault: Address
  amount: bigint
  sourceBucket: BucketType
  destinationBucket: BucketType
}

interface TransferStep {
  step: 'redeem' | 'approve' | 'deposit'
  status: 'pending' | 'processing' | 'complete' | 'error'
  hash?: string
  error?: string
}

interface ConversionInfo {
  expectedAssets: bigint
  conversionFee: bigint
  slippage: string
  netAmount: bigint
}

/**
 * Custom hook for transferring funds between bucket vaults
 * Handles the complete transfer flow:
 * 1. Redeem shares from source vault to get underlying assets
 * 2. Approve destination vault to spend assets (if needed)
 * 3. Deposit assets into destination vault
 */
export function useBucketTransfer() {
  const { address } = useAccount()
  const [transferState, setTransferState] = useState<'idle' | 'redeeming' | 'approving' | 'depositing' | 'complete' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentTransfer, setCurrentTransfer] = useState<TransferParams | null>(null)
  const [conversionInfo, setConversionInfo] = useState<ConversionInfo | null>(null)

  const { writeContract, data: hash, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError } = useWaitForTransactionReceipt({ hash })

  // Get the asset address from the source vault
  const { data: assetAddress } = useReadContract({
    address: currentTransfer?.sourceVault,
    abi: bucketVaultAbi,
    functionName: 'asset',
    query: {
      enabled: !!currentTransfer?.sourceVault,
    },
  })

  // Get user's asset balance to check redeemed amount
  const { data: assetBalance, refetch: refetchAssetBalance } = useReadContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!assetAddress && !!address,
    },
  })

  // Get current allowance for destination vault
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && currentTransfer?.destinationVault ? [address, currentTransfer.destinationVault] : undefined,
    query: {
      enabled: !!assetAddress && !!address && !!currentTransfer?.destinationVault,
    },
  })

  // Handle transaction confirmation and move to next step
  useEffect(() => {
    if (!isConfirmed || !currentTransfer) return

    const handleNextStep = async () => {
      if (transferState === 'redeeming') {
        // Redeem complete, now check if we need to approve
        await refetchAssetBalance()
        
        // Check if we have sufficient allowance
        await refetchAllowance()
        
        if (currentAllowance && assetBalance && currentAllowance >= assetBalance) {
          // Sufficient allowance, proceed to deposit
          setTransferState('depositing')
          executeDeposit(assetBalance)
        } else {
          // Need to approve first
          setTransferState('approving')
          executeApprove(assetBalance || 0n)
        }
      } else if (transferState === 'approving') {
        // Approval complete, now deposit
        setTransferState('depositing')
        executeDeposit(assetBalance || 0n)
      } else if (transferState === 'depositing') {
        // Transfer complete!
        setTransferState('complete')
        setCurrentTransfer(null)
      }
    }

    handleNextStep()
  }, [isConfirmed, transferState])

  // Handle transaction errors
  useEffect(() => {
    if (isTxError || writeError) {
      setError(writeError?.message || 'Transaction failed')
      setTransferState('error')
    }
  }, [isTxError, writeError])

  /**
   * Execute the redeem step
   */
  const executeRedeem = useCallback((params: TransferParams) => {
    if (!address) {
      setError('Wallet not connected')
      return
    }

    setCurrentTransfer(params)
    setTransferState('redeeming')
    setError(null)
    reset()

    try {
      // Step 1: Redeem shares from source vault
      // This converts shares to underlying assets and sends them to the user's wallet
      writeContract({
        address: params.sourceVault,
        abi: bucketVaultAbi,
        functionName: 'redeem',
        args: [params.amount, address, address],
      })
    } catch (err) {
      console.error('Redeem error:', err)
      setError(err instanceof Error ? err.message : 'Redeem failed')
      setTransferState('error')
    }
  }, [address, writeContract, reset])

  /**
   * Execute the approve step
   */
  const executeApprove = useCallback((amount: bigint) => {
    if (!address || !assetAddress || !currentTransfer) {
      setError('Missing required data for approval')
      return
    }

    reset()

    try {
      // Step 2: Approve destination vault to spend assets
      writeContract({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [currentTransfer.destinationVault, amount],
      })
    } catch (err) {
      console.error('Approve error:', err)
      setError(err instanceof Error ? err.message : 'Approval failed')
      setTransferState('error')
    }
  }, [address, assetAddress, currentTransfer, writeContract, reset])

  /**
   * Execute the deposit step
   */
  const executeDeposit = useCallback((amount: bigint) => {
    if (!address || !currentTransfer) {
      setError('Missing required data for deposit')
      return
    }

    reset()

    try {
      // Step 3: Deposit assets into destination vault
      writeContract({
        address: currentTransfer.destinationVault,
        abi: bucketVaultAbi,
        functionName: 'deposit',
        args: [amount, address],
      })
    } catch (err) {
      console.error('Deposit error:', err)
      setError(err instanceof Error ? err.message : 'Deposit failed')
      setTransferState('error')
    }
  }, [address, currentTransfer, writeContract, reset])

  /**
   * Calculate conversion info for asset conversion between yield-bearing buckets
   * This includes expected assets after redemption and conversion fees
   */
  const calculateConversion = useCallback(async (
    sourceBucket: BucketType,
    destinationBucket: BucketType,
    shares: bigint
  ): Promise<ConversionInfo> => {
    // Calculate expected assets from redeeming shares
    // For simplicity, we assume 1:1 share to asset ratio
    // In production, would call previewRedeem on the vault
    let expectedAssets = shares
    
    // Bills vault has a 2% withdrawal fee
    let conversionFee = 0n
    if (sourceBucket === 'bills') {
      conversionFee = (expectedAssets * 2n) / 100n
      expectedAssets = expectedAssets - conversionFee
    }
    
    // Yield-bearing buckets may have slippage during asset conversion
    // This happens when converting between different yield protocols
    const hasSlippage = ['bills', 'savings', 'growth'].includes(sourceBucket) || 
                       ['bills', 'savings', 'growth'].includes(destinationBucket)
    const slippage = hasSlippage ? '~0.5%' : '0%'
    
    // Apply estimated slippage to net amount
    let netAmount = expectedAssets
    if (hasSlippage) {
      // Reduce by 0.5% for slippage
      netAmount = (expectedAssets * 995n) / 1000n
    }

    return {
      expectedAssets,
      conversionFee,
      slippage,
      netAmount,
    }
  }, [])

  /**
   * Execute a transfer between two bucket vaults
   * This is a multi-step process:
   * 1. Calculate conversion info (fees, slippage)
   * 2. Redeem shares from source vault to get underlying assets
   * 3. Approve destination vault to spend assets (if needed)
   * 4. Deposit assets into destination vault
   */
  const executeTransfer = useCallback(async (params: TransferParams) => {
    // Calculate conversion info before starting transfer
    const conversion = await calculateConversion(
      params.sourceBucket,
      params.destinationBucket,
      params.amount
    )
    setConversionInfo(conversion)
    
    // Start the transfer process
    executeRedeem(params)
  }, [executeRedeem, calculateConversion])

  /**
   * Calculate estimated fees for a transfer
   * This includes conversion fees and slippage for yield-bearing buckets
   * 
   * Fee structure:
   * - Bills vault: 2% withdrawal fee (enforced by contract)
   * - Savings vault: No withdrawal fee, but may have conversion slippage
   * - Growth vault: No withdrawal fee, but may have conversion slippage
   * - Spendable vault: No fees
   */
  const estimateFees = useCallback((sourceBucket: BucketType, destinationBucket: BucketType, amount?: bigint) => {
    let conversionFee = '0%'
    let conversionFeeAmount = 0n
    
    // Bills vault has a 2% withdrawal fee
    if (sourceBucket === 'bills') {
      conversionFee = '2%'
      if (amount) {
        conversionFeeAmount = (amount * 2n) / 100n
      }
    }
    
    // Yield-bearing buckets may have slippage during asset conversion
    // This happens when converting between different yield protocols
    const hasSlippage = ['bills', 'savings', 'growth'].includes(sourceBucket) || 
                       ['bills', 'savings', 'growth'].includes(destinationBucket)
    const slippage = hasSlippage ? '~0.5%' : '0%'

    // Calculate net amount after fees
    const netAmount = amount ? amount - conversionFeeAmount : undefined

    return {
      conversionFee,
      conversionFeeAmount,
      slippage,
      netAmount,
    }
  }, [])

  /**
   * Validate if a transfer is possible
   * Checks minimum balance requirements and withdrawal restrictions
   * 
   * Validation rules:
   * - Amount must be positive
   * - Amount must not exceed source balance
   * - Bills vault has 7-day withdrawal delay (enforced by contract)
   * - Minimum balance requirements (if any)
   */
  const validateTransfer = useCallback((
    sourceBucket: BucketType,
    amount: bigint,
    sourceBalance: bigint
  ): { valid: boolean; error?: string; warning?: string } => {
    // Check if amount is positive
    if (amount <= 0n) {
      return { valid: false, error: 'Amount must be greater than zero' }
    }

    // Check if amount exceeds balance
    if (amount > sourceBalance) {
      return { valid: false, error: 'Insufficient balance' }
    }

    // Check for minimum balance (leave at least some dust to avoid rounding issues)
    const minBalance = parseEther('0.01') // Minimum 0.01 to keep in vault
    if (sourceBalance - amount < minBalance && sourceBalance - amount > 0n) {
      return { 
        valid: false, 
        error: 'Transfer would leave less than minimum balance. Transfer all or leave at least $0.01' 
      }
    }

    // Bills vault has a 7-day withdrawal delay
    // This is enforced by the smart contract, so we just show a warning
    if (sourceBucket === 'bills') {
      return { 
        valid: true, 
        warning: 'Bills vault has a 7-day withdrawal delay. Ensure your last deposit was more than 7 days ago.' 
      }
    }

    return { valid: true }
  }, [])

  /**
   * Reset transfer state
   */
  const resetTransfer = useCallback(() => {
    setTransferState('idle')
    setError(null)
    setCurrentTransfer(null)
    setConversionInfo(null)
    reset()
  }, [reset])

  /**
   * Get human-readable transfer status message
   */
  const getStatusMessage = useCallback((): string => {
    switch (transferState) {
      case 'idle':
        return 'Ready to transfer'
      case 'redeeming':
        return 'Withdrawing from source vault...'
      case 'approving':
        return 'Approving destination vault...'
      case 'depositing':
        return 'Depositing to destination vault...'
      case 'complete':
        return 'Transfer complete!'
      case 'error':
        return error || 'Transfer failed'
      default:
        return 'Processing...'
    }
  }, [transferState, error])

  return {
    // Core functions
    executeTransfer,
    estimateFees,
    validateTransfer,
    resetTransfer,
    
    // State
    transferState,
    currentTransfer,
    conversionInfo,
    
    // Status helpers
    isTransferring: transferState === 'redeeming' || transferState === 'approving' || transferState === 'depositing' || isConfirming,
    isComplete: transferState === 'complete' && isConfirmed,
    getStatusMessage,
    
    // Error handling
    error: error || (writeError ? writeError.message : null),
    
    // Transaction info
    hash,
  }
}
