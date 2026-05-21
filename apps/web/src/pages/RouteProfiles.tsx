import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "../api/client.js"

export default function RouteProfiles() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiGet("/_opengate/route-profiles"),
  })

  const resolvedQ = useQuery({
    queryKey: ["resolved", selectedSlug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${selectedSlug}/resolved`),
    enabled: !!selectedSlug,
  })

  return (
    <div>
      <h1>Route Profiles</h1>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ minWidth: 200 }}>
          <h2>Profiles</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data?.data?.map((p: { slug: string; name: string }) => (
              <li key={p.slug} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setSelectedSlug(p.slug)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: selectedSlug === p.slug ? "#2563eb" : "#1f2937",
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          {selectedSlug && resolvedQ.data && (
            <div>
              <h2>{resolvedQ.data.profile.name}</h2>
              <p>{resolvedQ.data.profile.description || "No description"}</p>

              <h3>Experts</h3>
              <ul>
                {resolvedQ.data.experts.map((e: { name: string; provider_name: string; model_id: string }) => (
                  <li key={e.name}>
                    {e.name} → {e.provider_name} / {e.model_id}
                  </li>
                ))}
              </ul>

              <h3>Keywords</h3>
              <ul>
                {resolvedQ.data.keywords.map((k: { keyword: string; expert_name: string }) => (
                  <li key={k.keyword}>
                    {k.keyword} ({k.expert_name})
                  </li>
                ))}
              </ul>

              <h3>Overrides</h3>
              <ul>
                {resolvedQ.data.overrides.map((o: { keyword: string; expert_name: string; provider_name: string }) => (
                  <li key={o.keyword}>
                    {o.keyword} → {o.provider_name} ({o.expert_name})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
