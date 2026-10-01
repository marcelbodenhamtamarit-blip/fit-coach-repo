import { StoreProvider } from "@/lib/store"
import { AutomationsProvider } from "@/lib/automations-store"
import { WinterArcProvider } from "@/lib/winter-arc-store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <AutomationsProvider>
        <WinterArcProvider>
          <Dashboard />
        </WinterArcProvider>
      </AutomationsProvider>
    </StoreProvider>
  )
}
