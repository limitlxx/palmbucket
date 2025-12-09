/**
 * Utility functions for retry logic with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: Error, attempt: number) => boolean
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options }
  let lastError: Error

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      if (attempt === opts.maxAttempts || !opts.shouldRetry(lastError, attempt)) {
        throw lastError
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      )

      console.log(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`, lastError)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Check if an error is retryable (network/RPC errors)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  return (
    message.includes('network') ||
    message.includes('rpc') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('rate limit')
  )
}

/**
 * Check if an error is a user rejection (should not retry)
 */
export function isUserRejection(error: Error): boolean {
  const message = error.message.toLowerCase()
  return message.includes('user rejected') || message.includes('user denied')
}

/**
 * Retry options specifically for wagmi calls
 */
export const wagmiRetryOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error, attempt) => {
    // Don't retry user rejections
    if (isUserRejection(error)) {
      return false
    }
    // Retry network errors
    return isRetryableError(error)
  },
}

/**
 * Retry options for RPC calls
 */
export const rpcRetryOptions: RetryOptions = {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 15000,
  backoffMultiplier: 2,
  shouldRetry: (error) => isRetryableError(error),
}
