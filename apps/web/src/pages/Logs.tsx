import { useQuery } from "@tanstack/react-query"
import { Column } from "primereact/column"
import { DataTable } from "primereact/datatable"
import { Tag } from "primereact/tag"
import { apiGet } from "../api/client.js"
import { RoutingTerminal } from "../studio/RoutingTerminal.js"

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

export default function Logs() {
  const logsQuery = useQuery({
    queryKey: ["logs"],
    queryFn: () => apiGet("/_opengate/logs?limit=80"),
    refetchInterval: 2500,
  })
  const events: RoutingEvent[] = logsQuery.data?.data ?? []

  return (
    <div className="studio-page studio-logs-page">
      <div className="studio-page-head">
        <div>
          <p className="studio-eyebrow">Observability</p>
          <h1>Routing logs</h1>
        </div>
        <Tag value={logsQuery.isFetching ? "refreshing" : "live"} severity={logsQuery.isFetching ? "info" : "success"} />
      </div>
      <section className="studio-panel log-terminal-focus">
        <RoutingTerminal height="248px" />
      </section>
      <section className="studio-panel">
        <div className="studio-panel-title">
          <strong>Recent routing events</strong>
          <span>Keyword detection, override selection and provider latency.</span>
        </div>
        <DataTable value={events} size="small" loading={logsQuery.isLoading} emptyMessage="No routed requests yet.">
          <Column header="Time" body={(event: RoutingEvent) => new Date(event.created_at).toLocaleTimeString()} />
          <Column field="expert_name" header="Expert" />
          <Column header="Keywords" body={(event: RoutingEvent) => event.detected_keywords?.join(", ") || "-"} />
          <Column field="override_keyword" header="Override" body={(event: RoutingEvent) => event.override_keyword || "-"} />
          <Column field="reason" header="Reason" />
          <Column header="Status" body={(event: RoutingEvent) => <Tag value={event.status || "pending"} severity={event.status === "completed" ? "success" : "secondary"} />} />
          <Column header="Latency" body={(event: RoutingEvent) => event.latency_ms != null ? `${event.latency_ms}ms` : "-"} />
        </DataTable>
      </section>
    </div>
  )
}
