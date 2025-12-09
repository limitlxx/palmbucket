import { SplitRatioSettings, AutoSplitToggle, SweepAuthorizationToggle, SweepKeeperAdminControls } from '@/components/settings'

export default function SettingsPage() {
  // Example: USDC on Mantle Sepolia - replace with actual token address
  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` || '0x'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 space-y-8">
        {/* Auto-Split Toggle Section */}
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Auto-Split Settings</h2>
          <p className="text-gray-600 mb-6">
            Enable or disable automatic payment splitting for your tokens
          </p>
          <AutoSplitToggle 
            tokenAddress={USDC_ADDRESS}
            tokenSymbol="USDC"
            tokenDecimals={6}
          />
        </div>

        {/* Split Ratio Configuration */}
        <div className="bg-white rounded-lg shadow">
          <SplitRatioSettings />
        </div>

        {/* Auto-Sweep Authorization Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Auto-Sweep Settings</h2>
          <p className="text-gray-600 mb-6">
            Automatically optimize your funds by moving leftover balances to the highest-yielding bucket at month-end
          </p>
          <SweepAuthorizationToggle tokenDecimals={6} />
        </div>

        {/* Admin Controls Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">SweepKeeper Admin Controls</h2>
          <p className="text-gray-600 mb-6">
            Administrative controls for the SweepKeeper contract (owner only)
          </p>
          <SweepKeeperAdminControls tokenDecimals={6} />
        </div>
      </div>
    </div>
  )
}
