import { StoreProvider } from "@/lib/store"
import { AutomationsProvider } from "@/lib/automations-store"
import { WinterArcProvider } from "@/lib/winter-arc-store"
import { InvestmentsProvider } from "@/lib/investments-store"
import { PartnerSavingsProvider } from "@/lib/partner-savings-store"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <StoreProvider>
      <AutomationsProvider>
        <WinterArcProvider>
          <InvestmentsProvider>
            {/* Se monta siempre, da igual el rol -- igual que el resto de
                providers de aquí arriba. Para la cuenta owner no hace nada
                visible (su pantalla no usa este provider); para la cuenta
                de la pareja es lo que alimenta su apartado de ahorro. */}
            <PartnerSavingsProvider>
              <Dashboard />
            </PartnerSavingsProvider>
          </InvestmentsProvider>
        </WinterArcProvider>
      </AutomationsProvider>
    </StoreProvider>
  )
}
