import type { ComponentType } from "react"
import Terminal, { ColorMode, TerminalOutput, type Props as TerminalProps } from "react-terminal-ui"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

interface RoutingEvent {
  id: string
  created_at: string
  expert_name: string
  detected_keywords?: string[]
  override_keyword: string | null
  reason: string
  status: string | null
  latency_ms: number | null
}

export function RoutingTerminal({ height = "128px" }: { height?: string }) {
  const logsQuery = useQuery({
    queryKey: ["logs", "terminal"],
    queryFn: () => apiGet("/_opengate/logs?limit=14"),
    refetchInterval: 2500,
  })

  const events: RoutingEvent[] = logsQuery.data?.data ?? []
  const lines = events
    .slice()
    .reverse()
    .map((event) => {
      const time = new Date(event.created_at).toLocaleTimeString([], { hour12: false })
      const keywords = event.detected_keywords?.length ? event.detected_keywords.join(",") : "-"
      const override = event.override_keyword ? ` override=${event.override_keyword}` : ""
      const latency = event.latency_ms != null ? ` ${event.latency_ms}ms` : ""
      return (
        <TerminalOutput key={event.id}>
          {`${time} ${event.status ?? "pending"} expert=${event.expert_name} keywords=${keywords}${override}${latency} :: ${event.reason}`}
        </TerminalOutput>
      )
    })

  const TerminalView = Terminal as unknown as ComponentType<TerminalProps>

  return (
    <div className="studio-terminal">
      <TerminalView
        name="OpenGate routing"
        prompt=""
        height={height}
        colorMode={ColorMode.Dark}
        TopButtonsPanel={() => null}
      >
        {lines.length ? lines : <TerminalOutput>Waiting for routed requests...</TerminalOutput>}
      </TerminalView>
    </div>
  )
}
