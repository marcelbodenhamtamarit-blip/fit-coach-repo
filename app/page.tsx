import { StoreProvider } from "@/lib/store"
import { AutomationsProvider } from "@/lib/automations-store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <AutomationsProvider>
        <Dashboard />
      </AutomationsProvider>
    </StoreProvider>
  )
}
