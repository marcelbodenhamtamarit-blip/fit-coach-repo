import { StoreProvider } from "@/lib/store"
import { AutomationsProvider } from "@/lib/automations-store"
import { WinterArcProvider } from "@/lib/winter-arc-store"
import { InvestmentsProvider } from "@/lib/investments-store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <AutomationsProvider>
        <WinterArcProvider>
          <InvestmentsProvider>
            <Dashboard />
          </InvestmentsProvider>
        </WinterArcProvider>
      </AutomationsProvider>
    </StoreProvider>
  )
}
