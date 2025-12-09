import { Dashboard } from '@/components/dashboard/Dashboard'
import V0Dashboard from '@/components/v0/Dashboard'

// Feature flag for v0 UI - set to true to use new UI
const USE_V0_UI = process.env.NEXT_PUBLIC_USE_V0_UI === 'true'

export default function Home() {
  return USE_V0_UI ? <V0Dashboard /> : <Dashboard />
}
