import { StoreProvider } from "@/lib/store"
import { ShiftsProvider } from "@/lib/shifts-store"
import { AutomationsProvider } from "@/lib/automations-store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <ShiftsProvider>
        <AutomationsProvider>
          <Dashboard />
        </AutomationsProvider>
      </ShiftsProvider>
    </StoreProvider>
  )
}
