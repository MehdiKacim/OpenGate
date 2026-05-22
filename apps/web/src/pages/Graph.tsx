import { useEffect, useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "reactflow"
// @ts-ignore reactflow CSS
import "reactflow/dist/style.css"
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client.js"
import {
  ExpertPanel,
  KeywordPanel,
  OverridePanel,
  ProviderPanel,
  ModelPanel,
  CreateExpertForm,
  CreateKeywordForm,
  CreateOverrideForm,
  CreateProviderForm,
} from "./GraphPanels.js"

/* ---------- Design Mode Node Types ---------- */

function ProfileNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "10px 16px", background: "#1e3a8a", borderRadius: 8, color: "#fff", minWidth: 160, textAlign: "center" }}>
      <Handle type="source" position={Position.Bottom} style={{ background: "#60a5fa" }} />
      <div style={{ fontWeight: 700 }}>{data.label}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>Route Profile</div>
    </div>
  )
}

function ExpertNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "10px 14px", background: data.enabled === 1 ? "#064e3b" : "#374151", borderRadius: 8, color: "#fff", minWidth: 140, textAlign: "center", border: data.selected ? "2px solid #fbbf24" : "2px solid transparent" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#60a5fa" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#60a5fa" }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: "#fbbf24" }} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{data.modelId}</div>
    </div>
  )
}

function ProviderNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "10px 14px", background: data.enabled === 1 ? "#4c1d95" : "#374151", borderRadius: 8, color: "#fff", minWidth: 120, textAlign: "center", border: data.selected ? "2px solid #fbbf24" : "2px solid transparent" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#a78bfa" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#a78bfa" }} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{data.type}</div>
    </div>
  )
}

function ModelNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "8px 12px", background: data.enabled === 1 ? "#312e81" : "#374151", borderRadius: 8, color: "#c7d2fe", minWidth: 100, textAlign: "center", fontSize: 13, border: data.selected ? "2px solid #fbbf24" : "2px solid transparent" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#818cf8" }} />
      {data.label}
    </div>
  )
}

function KeywordNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "8px 12px", background: data.enabled === 1 ? "#78350f" : "#374151", borderRadius: 8, color: "#fde68a", minWidth: 100, textAlign: "center", fontSize: 13 }}>
      <Handle type="target" position={Position.Left} style={{ background: "#fbbf24" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#fbbf24" }} />
      {data.label}
    </div>
  )
}

function OverrideNode({ data }: NodeProps) {
  return (
    <div style={{ padding: "8px 12px", background: "#7f1d1d", borderRadius: 8, color: "#fecaca", minWidth: 120, textAlign: "center", fontSize: 13 }}>
      <Handle type="target" position={Position.Top} style={{ background: "#f87171" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#f87171" }} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{data.modelId}</div>
    </div>
  )
}

const nodeTypes = {
  profile: ProfileNode,
  expert: ExpertNode,
  provider: ProviderNode,
  model: ModelNode,
  keyword: KeywordNode,
  override: OverrideNode,
}

/* ---------- Runtime Mode Node Types ---------- */

function RuntimeNode({ data }: NodeProps) {
  const color =
    data.kind === "error"
      ? "#7f1d1d"
      : data.kind === "success"
      ? "#064e3b"
      : data.kind === "override"
      ? "#7f1d1d"
      : "#1f2937"
  const textColor =
    data.kind === "error"
      ? "#fecaca"
      : data.kind === "success"
      ? "#6ee7b7"
      : data.kind === "override"
      ? "#fecaca"
      : "#e5e7eb"
  return (
    <div style={{ padding: "10px 14px", background: color, borderRadius: 8, color: textColor, minWidth: 140, textAlign: "center", fontSize: 13 }}>
      <Handle type="target" position={Position.Top} style={{ background: "#9ca3af" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#9ca3af" }} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      {data.sub && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{data.sub}</div>}
    </div>
  )
}

const runtimeNodeTypes = { runtime: RuntimeNode }

/* ---------- Main Component ---------- */

type Mode = "design" | "runtime"

export default function Graph() {
  const [mode, setMode] = useState<Mode>("design")
  const [slug, setSlug] = useState("default")
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [creatingExpert, setCreatingExpert] = useState(false)
  const [creatingKeywordFor, setCreatingKeywordFor] = useState<string | null>(null)
  const [creatingOverrideFor, setCreatingOverrideFor] = useState<string | null>(null)
  const [creatingProvider, setCreatingProvider] = useState(false)
  const qc = useQueryClient()

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiGet("/_opengate/route-profiles"),
  })

  const designQuery = useQuery({
    queryKey: ["graph-design", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/graph-design`),
    enabled: mode === "design",
  })

  const runtimeQuery = useQuery({
    queryKey: ["graph-runtime", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/graph-runtime`),
    enabled: mode === "runtime",
    refetchInterval: 3000,
  })

  const [designNodes, setDesignNodes] = useState<Node[]>([])
  const [designEdges, setDesignEdges] = useState<Edge[]>([])
  const [runtimeNodes, setRuntimeNodes] = useState<Node[]>([])
  const [runtimeEdges, setRuntimeEdges] = useState<Edge[]>([])

  // Build design graph
  useEffect(() => {
    if (!designQuery.data) return
    const d = designQuery.data
    const nodes: Node[] = []
    const edges: Edge[] = []

    if (d.profile) {
      nodes.push({
        id: "profile",
        type: "profile",
        data: { label: d.profile.name },
        position: { x: 400, y: 40 },
      })
    }

    d.experts?.forEach((e: any, i: number) => {
      const y = 160 + i * 140
      nodes.push({
        id: `expert-${e.id}`,
        type: "expert",
        data: { label: e.display_name || e.name, modelId: e.model_id, enabled: e.enabled, id: e.id },
        position: { x: 400, y },
      })
      edges.push({ id: `e-p-${e.id}`, source: "profile", target: `expert-${e.id}` })

      if (e.provider_id) {
        edges.push({ id: `e-edp-${e.id}`, source: `expert-${e.id}`, target: `provider-${e.provider_id}` })
      }
    })

    d.providers?.forEach((p: any, i: number) => {
      nodes.push({
        id: `provider-${p.id}`,
        type: "provider",
        data: { label: p.name, type: p.type, enabled: p.enabled, id: p.id },
        position: { x: 120, y: 160 + i * 120 },
      })
    })

    d.models?.forEach((m: any) => {
      const providerIndex = d.providers?.findIndex((p: any) => p.id === m.provider_id) ?? 0
      nodes.push({
        id: `model-${m.id}`,
        type: "model",
        data: { label: m.display_name || m.model_id, enabled: m.enabled, id: m.id },
        position: { x: 120, y: 280 + providerIndex * 120 + 40 },
      })
      edges.push({ id: `e-pm-${m.id}`, source: `provider-${m.provider_id}`, target: `model-${m.id}` })
    })

    d.keywords?.forEach((k: any, i: number) => {
      const expertIdx = d.experts?.findIndex((e: any) => e.id === k.expert_id) ?? 0
      const y = 160 + expertIdx * 140 + 60
      nodes.push({
        id: `keyword-${k.id}`,
        type: "keyword",
        data: { label: k.keyword, enabled: k.enabled, id: k.id },
        position: { x: 620, y: y + i * 50 },
      })
      edges.push({ id: `e-ek-${k.id}`, source: `expert-${k.expert_id}`, target: `keyword-${k.id}`, sourceHandle: "right" })
    })

    d.overrides?.forEach((o: any, i: number) => {
      const keywordIdx = d.keywords?.findIndex((k: any) => k.id === o.keyword && k.expert_id === o.expert_id)
      const baseY = 160 + (d.experts?.findIndex((e: any) => e.id === o.expert_id) ?? 0) * 140 + 60
      nodes.push({
        id: `override-${o.id}`,
        type: "override",
        data: { label: o.keyword, modelId: o.model_id, id: o.id },
        position: { x: 820, y: baseY + (keywordIdx >= 0 ? keywordIdx * 50 : 0) + 60 + i * 50 },
      })
      const sourceKeywordId = d.keywords?.find((k: any) => k.keyword === o.keyword && k.expert_id === o.expert_id)?.id ?? o.id
      edges.push({ id: `e-ko-${o.id}`, source: `keyword-${sourceKeywordId}`, target: `override-${o.id}` })
      if (o.provider_id) {
        edges.push({ id: `e-opp-${o.id}`, source: `override-${o.id}`, target: `provider-${o.provider_id}` })
      }
    })

    setDesignNodes(nodes)
    setDesignEdges(edges)
  }, [designQuery.data])

  // Build runtime graph
  useEffect(() => {
    if (!runtimeQuery.data?.data) return
    const requests = runtimeQuery.data.data
    const nodes: Node[] = []
    const edges: Edge[] = []

    requests.forEach((req: any, i: number) => {
      const baseX = 300
      const baseY = 40 + i * 220

      nodes.push({
        id: `req-${req.id}`,
        type: "runtime",
        data: { label: `Request`, sub: req.requested_model, kind: "request" },
        position: { x: baseX, y: baseY },
      })

      nodes.push({
        id: `profile-${req.id}`,
        type: "runtime",
        data: { label: "Route Profile", sub: slug, kind: "profile" },
        position: { x: baseX, y: baseY + 70 },
      })
      edges.push({ id: `e-rp-${req.id}`, source: `req-${req.id}`, target: `profile-${req.id}` })

      nodes.push({
        id: `expert-${req.id}`,
        type: "runtime",
        data: { label: req.expert_name || "Expert", kind: "expert" },
        position: { x: baseX, y: baseY + 140 },
      })
      edges.push({ id: `e-pe-${req.id}`, source: `profile-${req.id}`, target: `expert-${req.id}` })

      let lastId = `expert-${req.id}`
      let nextY = baseY + 210

      if (req.detected_keywords_json) {
        const kw = JSON.parse(req.detected_keywords_json || "[]")
        if (kw.length > 0) {
          nodes.push({
            id: `keywords-${req.id}`,
            type: "runtime",
            data: { label: "Keywords", sub: kw.join(", "), kind: "keywords" },
            position: { x: baseX, y: nextY },
          })
          edges.push({ id: `e-ekw-${req.id}`, source: lastId, target: `keywords-${req.id}` })
          lastId = `keywords-${req.id}`
          nextY += 70
        }
      }

      if (req.override_keyword) {
        nodes.push({
          id: `override-${req.id}`,
          type: "runtime",
          data: { label: `Override`, sub: req.override_keyword, kind: "override" },
          position: { x: baseX + 160, y: nextY - 35 },
        })
        edges.push({ id: `e-kwo-${req.id}`, source: lastId, target: `override-${req.id}` })
        lastId = `override-${req.id}`
      }

      if (req.selected_provider_id) {
        nodes.push({
          id: `provider-${req.id}`,
          type: "runtime",
          data: { label: "Provider", sub: req.final_provider_id || req.selected_provider_id, kind: "provider" },
          position: { x: baseX, y: nextY },
        })
        edges.push({ id: `e-lpr-${req.id}`, source: lastId, target: `provider-${req.id}` })
        lastId = `provider-${req.id}`
        nextY += 70
      }

      if (req.selected_model_id) {
        nodes.push({
          id: `model-${req.id}`,
          type: "runtime",
          data: { label: "Model", sub: req.final_model_id || req.selected_model_id, kind: "model" },
          position: { x: baseX, y: nextY },
        })
        edges.push({ id: `e-prm-${req.id}`, source: lastId, target: `model-${req.id}` })
        lastId = `model-${req.id}`
        nextY += 70
      }

      nodes.push({
        id: `response-${req.id}`,
        type: "runtime",
        data: {
          label: req.status === "error" ? "Error" : "Response",
          sub: req.status === "error" ? req.error : `${req.latency_ms ?? "-"}ms`,
          kind: req.status === "error" ? "error" : "success",
        },
        position: { x: baseX, y: nextY },
      })
      edges.push({ id: `e-mr-${req.id}`, source: lastId, target: `response-${req.id}` })
    })

    setRuntimeNodes(nodes)
    setRuntimeEdges(edges)
  }, [runtimeQuery.data, slug])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node)
  }, [])

  const updateExpertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/_opengate/experts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["graph-design", slug] })
      qc.invalidateQueries({ queryKey: ["resolved", slug] })
      setSelectedNode(null)
    },
  })
  const createExpertMut = useMutation({
    mutationFn: (body: unknown) => apiPost(`/_opengate/route-profiles/${slug}/experts`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); qc.invalidateQueries({ queryKey: ["resolved", slug] }); setSelectedNode(null) },
  })
  const deleteExpertMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/experts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); qc.invalidateQueries({ queryKey: ["resolved", slug] }); setSelectedNode(null) },
  })
  const createKeywordMut = useMutation({
    mutationFn: ({ expertId, body }: { expertId: string; body: unknown }) => apiPost(`/_opengate/experts/${expertId}/keywords`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); setSelectedNode(null) },
  })
  const updateKeywordMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/_opengate/expert-keywords/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["graph-design", slug] }),
  })
  const deleteKeywordMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/expert-keywords/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); setSelectedNode(null) },
  })
  const createOverrideMut = useMutation({
    mutationFn: ({ expertId, body }: { expertId: string; body: unknown }) => apiPost(`/_opengate/experts/${expertId}/overrides`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); setSelectedNode(null) },
  })
  const updateOverrideMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/_opengate/keyword-overrides/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["graph-design", slug] }),
  })
  const deleteOverrideMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/keyword-overrides/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); setSelectedNode(null) },
  })
  const updateProviderMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/_opengate/providers/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); qc.invalidateQueries({ queryKey: ["resolved", slug] }) },
  })
  const deleteProviderMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/providers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); qc.invalidateQueries({ queryKey: ["resolved", slug] }); setSelectedNode(null) },
  })
  const createProviderMut = useMutation({
    mutationFn: (body: unknown) => apiPost(`/_opengate/route-profiles/${slug}/providers`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); qc.invalidateQueries({ queryKey: ["resolved", slug] }); setCreatingProvider(false) },
  })
  const updateModelMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/_opengate/provider-models/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["graph-design", slug] }),
  })
  const deleteModelMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/provider-models/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["graph-design", slug] }); setSelectedNode(null) },
  })

  const isDesign = mode === "design"
  const nodes = isDesign ? designNodes : runtimeNodes
  const edges = isDesign ? designEdges : runtimeEdges
  const types = isDesign ? nodeTypes : runtimeNodeTypes

  return (
    <div style={{ height: "calc(100vh - 48px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Graph</h1>
          <div style={{ display: "flex", background: "#1f2937", borderRadius: 6, overflow: "hidden" }}>
            <button
              onClick={() => { setMode("design"); setSelectedNode(null) }}
              style={{
                padding: "6px 14px",
                border: "none",
                background: mode === "design" ? "#2563eb" : "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Design
            </button>
            <button
              onClick={() => { setMode("runtime"); setSelectedNode(null) }}
              style={{
                padding: "6px 14px",
                border: "none",
                background: mode === "runtime" ? "#2563eb" : "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Runtime
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>Profile:</label>
          <select
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSelectedNode(null) }}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "1px solid #374151",
              background: "#1f2937",
              color: "#e5e7eb",
              fontSize: 13,
            }}
          >
            {profilesQuery.data?.data?.map((p: any) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        <div style={{ flex: 1, borderRadius: 8, overflow: "hidden", background: "#0f1115" }}>
          {nodes.length === 0 ? (
            <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>
              {isDesign ? "No design data. Select a profile with data." : "No runtime events yet."}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={types}
              onNodeClick={onNodeClick}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap style={{ background: "#1f2937" }} nodeStrokeColor={() => "#60a5fa"} />
            </ReactFlow>
          )}
        </div>

        {isDesign && selectedNode && (
          <div style={{ width: 400, minWidth: 400, background: "#111827", borderRadius: 8, overflow: "hidden", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937", background: "#0b0f19", position: "sticky", top: 0, zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {selectedNode.type === "profile" && "Route Profile"}
                {selectedNode.type === "expert" && "Edit Expert"}
                {selectedNode.type === "provider" && "Edit Provider"}
                {selectedNode.type === "model" && "Edit Model"}
                {selectedNode.type === "keyword" && "Edit Keyword"}
                {selectedNode.type === "override" && "Edit Override"}
              </h3>
            </div>
            <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
              {selectedNode.type === "profile" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>Name: {designQuery.data?.profile?.name ?? "—"}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>Experts: {(designQuery.data?.experts ?? []).length}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>Providers: {(designQuery.data?.providers ?? []).length}</div>
                  {!creatingExpert ? (
                    <button onClick={() => setCreatingExpert(true)} style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 13 }}>+ Add Expert</button>
                  ) : (
                    <CreateExpertForm
                      providers={designQuery.data?.providers ?? []}
                      models={designQuery.data?.models ?? []}
                      onCreate={(body) => { createExpertMut.mutate(body, { onSuccess: () => setCreatingExpert(false) }) }}
                      onCancel={() => setCreatingExpert(false)}
                    />
                  )}
                  <div style={{ borderTop: "1px solid #374151", paddingTop: 12 }}>
                    {!creatingProvider ? (
                      <button onClick={() => setCreatingProvider(true)} style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "#4c1d95", color: "#e9d5ff", cursor: "pointer", fontSize: 13 }}>+ Add Provider</button>
                    ) : (
                      <CreateProviderForm
                        onCreate={(body) => createProviderMut.mutate(body)}
                        onCancel={() => setCreatingProvider(false)}
                        isPending={createProviderMut.isPending}
                      />
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type === "expert" && selectedNode.data?.id && (
                <ExpertPanel
                  expert={(designQuery.data?.experts ?? []).find((e: any) => e.id === selectedNode.data.id)!}
                  providers={designQuery.data?.providers ?? []}
                  models={designQuery.data?.models ?? []}
                  onSave={(body) => updateExpertMut.mutate({ id: selectedNode.data.id, body }, { onSuccess: () => setSelectedNode(null) })}
                  onDelete={(id) => { if (confirm("Delete this expert?")) deleteExpertMut.mutate(id) }}
                  onAddKeyword={(expertId) => setCreatingKeywordFor(expertId)}
                  onAddOverride={(expertId) => setCreatingOverrideFor(expertId)}
                  creatingKeyword={creatingKeywordFor === selectedNode.data.id}
                  creatingOverride={creatingOverrideFor === selectedNode.data.id}
                  onCreateKeyword={(expertId, body) => createKeywordMut.mutate({ expertId, body }, { onSuccess: () => setCreatingKeywordFor(null) })}
                  onCreateOverride={(expertId, body) => createOverrideMut.mutate({ expertId, body }, { onSuccess: () => setCreatingOverrideFor(null) })}
                  onCancelCreateKeyword={() => setCreatingKeywordFor(null)}
                  onCancelCreateOverride={() => setCreatingOverrideFor(null)}
                  isPending={updateExpertMut.isPending}
                />
              )}

              {selectedNode.type === "keyword" && selectedNode.data?.id && (
                <KeywordPanel
                  keyword={(designQuery.data?.keywords ?? []).find((k: any) => k.id === selectedNode.data.id)!}
                  onSave={(body) => updateKeywordMut.mutate({ id: selectedNode.data.id, body }, { onSuccess: () => setSelectedNode(null) })}
                  onDelete={(id) => { if (confirm("Delete this keyword?")) deleteKeywordMut.mutate(id) }}
                  isPending={updateKeywordMut.isPending}
                />
              )}

              {selectedNode.type === "override" && selectedNode.data?.id && (
                <OverridePanel
                  override={(designQuery.data?.overrides ?? []).find((o: any) => o.id === selectedNode.data.id)!}
                  providers={designQuery.data?.providers ?? []}
                  models={designQuery.data?.models ?? []}
                  onSave={(body) => updateOverrideMut.mutate({ id: selectedNode.data.id, body }, { onSuccess: () => setSelectedNode(null) })}
                  onDelete={(id) => { if (confirm("Delete this override?")) deleteOverrideMut.mutate(id) }}
                  isPending={updateOverrideMut.isPending}
                />
              )}

              {selectedNode.type === "provider" && selectedNode.data?.id && (
                <ProviderPanel
                  provider={(designQuery.data?.providers ?? []).find((p: any) => p.id === selectedNode.data.id)!}
                  onSave={(body) => updateProviderMut.mutate({ id: selectedNode.data.id, body }, { onSuccess: () => setSelectedNode(null) })}
                  onDelete={(id) => { if (confirm("Delete this provider?")) deleteProviderMut.mutate(id) }}
                  isPending={updateProviderMut.isPending}
                />
              )}

              {selectedNode.type === "model" && selectedNode.data?.id && (
                <ModelPanel
                  model={(designQuery.data?.models ?? []).find((m: any) => m.id === selectedNode.data.id)!}
                  onSave={(body) => updateModelMut.mutate({ id: selectedNode.data.id, body }, { onSuccess: () => setSelectedNode(null) })}
                  onDelete={(id) => { if (confirm("Delete this model?")) deleteModelMut.mutate(id) }}
                  isPending={updateModelMut.isPending}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
