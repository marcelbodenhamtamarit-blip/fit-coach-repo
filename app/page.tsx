import { StoreProvider } from "@/lib/store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  )
}
