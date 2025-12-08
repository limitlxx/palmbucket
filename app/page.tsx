import { WalletConnectButton } from '@/components/wallet/ConnectButton'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          PalmBudget
        </h1>
        <p className="text-center text-lg mb-8">
          Gesture-Controlled Budgeting on Mantle Network
        </p>
        <div className="flex justify-center">
          <WalletConnectButton />
        </div>
      </div>
    </main>
  );
}
