import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import dynamic from "next/dynamic"
import TradeJournal from "@/components/trade-journal"
import { ThemeToggle } from "@/components/theme-toggle"

// Portfolio pulls in recharts (a heavy charting lib) but starts hidden behind
// the "Portfolio" tab — code-split it instead of bundling it into the initial load.
const Portfolio = dynamic(() => import("@/components/portfolio"), {
  loading: () => <div className="p-6 text-sm text-muted-foreground">Loading portfolio…</div>,
})

export default function Home() {
  return (
    <main className="container mx-auto min-h-screen p-4 pb-24 md:p-6 md:pb-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-center">Trading Journal</h1>
        <ThemeToggle />
      </div>

      <Tabs defaultValue="journal" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted dark:bg-secondary">
          <TabsTrigger
            value="journal"
            className="data-[state=active]:bg-background dark:data-[state=active]:bg-white dark:data-[state=active]:text-black data-[state=active]:text-foreground"
          >
            Journal
          </TabsTrigger>
          <TabsTrigger
            value="portfolio"
            className="data-[state=active]:bg-background dark:data-[state=active]:bg-white dark:data-[state=active]:text-black data-[state=active]:text-foreground"
          >
            Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <TradeJournal />
        </TabsContent>

        <TabsContent value="portfolio">
          <Portfolio />
        </TabsContent>
      </Tabs>
    </main>
  )
}
