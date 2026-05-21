import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

export default function Logs() {
  const { data, isLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: () => apiGet("/_opengate/logs?limit=50"),
  })

  return (
    <div>
      <h1>Routing Logs</h1>
      {isLoading && <p>Loading…</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #374151" }}>
            <th>Time</th>
            <th>Expert</th>
            <th>Keywords</th>
            <th>Override</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((e: any) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #1f2937" }}>
              <td>{new Date(e.created_at).toLocaleTimeString()}</td>
              <td>{e.expert_name}</td>
              <td>{e.detected_keywords?.join(", ") || "-"}</td>
              <td>{e.override_keyword || "-"}</td>
              <td>{e.reason}</td>
              <td>{e.status}</td>
              <td>{e.latency_ms != null ? `${e.latency_ms}ms` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
