import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => apiGet("/_opengate/status"),
  })

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiGet("/_opengate/route-profiles"),
  })

  return (
    <div>
      <h1>Dashboard</h1>
      {isLoading && <p>Loading…</p>}
      {data && (
        <div style={{ background: "#1f2937", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <p><strong>Version:</strong> {data.version}</p>
          <p><strong>Status:</strong> {data.ok ? "OK" : "Error"}</p>
          <p><strong>Default Profile:</strong> {data.defaultProfile || "None"}</p>
        </div>
      )}
      <h2>Route Profiles</h2>
      {profilesQ.data?.data?.length === 0 && <p>No profiles yet.</p>}
      <ul>
        {profilesQ.data?.data?.map((p: { slug: string; name: string; is_default: number }) => (
          <li key={p.slug}>
            {p.name} ({p.slug}) {p.is_default ? "⭐" : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}
