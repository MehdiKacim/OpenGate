import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "../api/client.js"

export default function Presets() {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["presets"],
    queryFn: () => apiGet("/_opengate/presets"),
  })

  const copyMutation = useMutation({
    mutationFn: ({ id, slug }: { id: string; slug: string }) =>
      apiPost(`/_opengate/presets/${id}/copy`, { slug }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  })

  return (
    <div>
      <h1>Presets</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {data?.data?.map((p: { id: string; name: string; description: string | null }) => (
          <li
            key={p.id}
            style={{
              background: "#1f2937",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>{p.name}</strong>
              <p style={{ margin: "4px 0 0", color: "#9ca3af" }}>{p.description || "No description"}</p>
            </div>
            <button
              onClick={() =>
                copyMutation.mutate({ id: p.id, slug: `${p.id}-profile` })
              }
              disabled={copyMutation.isPending}
            >
              {copyMutation.isPending ? "Copying…" : "Copy to Profile"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
