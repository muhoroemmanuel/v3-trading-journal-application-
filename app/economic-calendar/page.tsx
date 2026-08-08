import ForexFactoryEvents from "@/components/forex-factory-events"
import TradingSessions from "@/components/trading-sessions"

export default function EconomicCalendarPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <TradingSessions />
      <ForexFactoryEvents />
    </div>
  )
}
