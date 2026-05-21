import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

export default function Providers() {
  const [slug, setSlug] = useState("default")

  const { data, isLoading } = useQuery({
    queryKey: ["providers", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/providers`),
  })

  return (
    <div>
      <h1>Providers</h1>
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8 }}>Profile slug:</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ padding: 6, borderRadius: 4, border: "1px solid #374151", background: "#1f2937", color: "#e5e7eb" }}
        />
      </div>
      {isLoading && <p>Loading…</p>}
      {data && (
        <div>
          <h2>Providers</h2>
          <ul>
            {data.providers.map((p: { id: string; name: string; type: string; base_url: string | null }) => (
              <li key={p.id}>
                {p.name} ({p.type}) {p.base_url ? `- ${p.base_url}` : ""}
              </li>
            ))}
          </ul>
          <h2>Models</h2>
          <ul>
            {data.models.map((m: { id: string; model_id: string; display_name: string | null }) => (
              <li key={m.id}>
                {m.display_name || m.model_id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
