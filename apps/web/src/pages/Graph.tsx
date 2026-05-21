import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
} from "reactflow"
import "reactflow/dist/style.css"
import { apiGet } from "../api/client.js"

export default function Graph() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const { data } = useQuery({
    queryKey: ["logs"],
    queryFn: () => apiGet("/_opengate/logs?limit=1"),
    refetchInterval: 3000,
  })

  useEffect(() => {
    const event = data?.data?.[0]
    if (!event) {
      setNodes([])
      setEdges([])
      return
    }

    const newNodes: Node[] = [
      { id: "req", data: { label: "Request" }, position: { x: 0, y: 0 } },
      { id: "profile", data: { label: "Route Profile" }, position: { x: 0, y: 80 } },
      { id: "expert", data: { label: event.expert_name }, position: { x: 0, y: 160 } },
      { id: "keywords", data: { label: event.detected_keywords?.join(", ") || "-" }, position: { x: 0, y: 240 } },
      { id: "provider", data: { label: event.provider_name || "provider" }, position: { x: 0, y: 320 } },
      { id: "response", data: { label: "Response" }, position: { x: 0, y: 400 } },
    ]

    const newEdges: Edge[] = [
      { id: "e1", source: "req", target: "profile" },
      { id: "e2", source: "profile", target: "expert" },
      { id: "e3", source: "expert", target: "keywords" },
      { id: "e4", source: "keywords", target: "provider" },
      { id: "e5", source: "provider", target: "response" },
    ]

    if (event.override_keyword) {
      newNodes.push({
        id: "override",
        data: { label: `Override: ${event.override_keyword}` },
        position: { x: 150, y: 240 },
        style: { background: "#dc2626", color: "#fff" },
      })
      newEdges.push({ id: "e6", source: "keywords", target: "override" })
      newEdges.push({ id: "e7", source: "override", target: "provider" })
    }

    setNodes(newNodes)
    setEdges(newEdges)
  }, [data])

  return (
    <div style={{ height: "80vh" }}>
      <h1>Routing Graph</h1>
      <p style={{ color: "#9ca3af" }}>Last routing event (auto-refreshes every 3s)</p>
      {nodes.length === 0 ? (
        <p>No routing events yet. Send a request to see the graph.</p>
      ) : (
        // @ts-ignore reactflow types mismatch in strict mode
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      )}
    </div>
  )
}
