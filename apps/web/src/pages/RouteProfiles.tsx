import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client.js"

interface Profile {
  id: string
  slug: string
  name: string
  description: string | null
  is_default: number
}

interface Expert {
  id: string
  name: string
  display_name: string | null
  system_prompt: string
  temperature: number | null
  max_tokens: number | null
  expose_as_model: number
  enabled: number
  provider_id: string
  provider_name: string
  model_id: string
  model_external_id: string
}

interface Keyword {
  id: string
  keyword: string
  description: string | null
  enabled: number
  expert_name: string
  expert_id: string
}

interface Override {
  id: string
  keyword: string
  priority: number
  enabled: number
  expert_name: string
  expert_id: string
  provider_id: string
  provider_name: string
  model_id: string
  model_external_id: string
}

interface Provider {
  id: string
  name: string
  type: string
}

interface ProviderModel {
  id: string
  provider_id: string
  model_id: string
  display_name: string | null
}

function useProfiles() {
  return useQuery({ queryKey: ["profiles"], queryFn: () => apiGet("/_opengate/route-profiles") })
}

function useResolved(slug: string | null) {
  return useQuery({
    queryKey: ["resolved", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/resolved`),
    enabled: !!slug,
  })
}

function useProviders(slug: string | null) {
  return useQuery({
    queryKey: ["providers", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/providers`),
    enabled: !!slug,
  })
}

export default function RouteProfiles() {
  const qc = useQueryClient()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState<"base" | "model" | null>(null)

  const { data: profilesData } = useProfiles()
  const { data: resolvedData } = useResolved(selectedSlug)
  const { data: providersData } = useProviders(selectedSlug)

  const profiles: Profile[] = profilesData?.data ?? []
  const experts: Expert[] = resolvedData?.experts ?? []
  const keywords: Keyword[] = resolvedData?.keywords ?? []
  const overrides: Override[] = resolvedData?.overrides ?? []
  const providers: Provider[] = providersData?.providers ?? []
  const models: ProviderModel[] = providersData?.models ?? []

  const baseUrl = selectedSlug ? `http://localhost:18765/c/${selectedSlug}/v1` : ""

  const copyText = async (text: string, type: "base" | "model") => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 1500)
  }

  // Expert editor state
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null)
  const [draftExpert, setDraftExpert] = useState<Partial<Expert>>({})
  const [expertDirty, setExpertDirty] = useState(false)

  const updateExpertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/experts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resolved", selectedSlug] })
      setEditingExpert(null)
      setExpertDirty(false)
    },
  })

  const deleteExpertMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/experts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resolved", selectedSlug] }),
  })

  const startEditExpert = (expert: Expert) => {
    setEditingExpert(expert)
    setDraftExpert({ ...expert })
    setExpertDirty(false)
  }

  const saveExpert = () => {
    if (!editingExpert) return
    const body: Record<string, unknown> = {}
    if (draftExpert.display_name !== undefined) body.display_name = draftExpert.display_name
    if (draftExpert.provider_id !== undefined) body.provider_id = draftExpert.provider_id
    if (draftExpert.model_id !== undefined) body.model_id = draftExpert.model_id
    if (draftExpert.system_prompt !== undefined) body.system_prompt = draftExpert.system_prompt
    if (draftExpert.temperature !== undefined) body.temperature = draftExpert.temperature
    if (draftExpert.max_tokens !== undefined) body.max_tokens = draftExpert.max_tokens
    if (draftExpert.expose_as_model !== undefined) body.expose_as_model = draftExpert.expose_as_model === 1
    if (draftExpert.enabled !== undefined) body.enabled = draftExpert.enabled === 1
    updateExpertMut.mutate({ id: editingExpert.id, body })
  }

  const filteredModels = useMemo(
    () => models.filter((m) => m.provider_id === (draftExpert.provider_id ?? editingExpert?.provider_id)),
    [models, draftExpert.provider_id, editingExpert?.provider_id],
  )

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 48px)" }}>
      {/* Left sidebar - profiles */}
      <div style={{ width: 260, minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Route Profiles</h2>
          {profiles.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>No profiles found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {profiles.map((p) => (
                <li key={p.slug} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => {
                      setSelectedSlug(p.slug)
                      setEditingExpert(null)
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      background: selectedSlug === p.slug ? "#2563eb" : "#1f2937",
                      color: selectedSlug === p.slug ? "#fff" : "#e5e7eb",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>/{p.slug}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedSlug && (
          <div
            style={{
              padding: 12,
              background: "#1f2937",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <div style={{ color: "#9ca3af", marginBottom: 4 }}>Base URL</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {baseUrl}
              </code>
              <button
                onClick={() => copyText(baseUrl, "base")}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  borderRadius: 4,
                  border: "none",
                  background: "#374151",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                {copied === "base" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {!selectedSlug ? (
          <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>
            Select a route profile to view and edit experts.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>
                {resolvedData?.profile?.name ?? selectedSlug}
              </h2>
            </div>

            {/* Experts */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Experts</h3>
              {experts.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No experts configured.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {experts.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        padding: 12,
                        background: "#1f2937",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        border: editingExpert?.id === e.id ? "2px solid #2563eb" : "2px solid transparent",
                      }}
                      onClick={() => startEditExpert(e)}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {e.display_name ?? e.name}
                          {e.expose_as_model === 1 && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "#60a5fa" }}>exposed</span>
                          )}
                          {e.enabled !== 1 && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "#ef4444" }}>disabled</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                          {e.provider_name} / {e.model_external_id}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation()
                            copyText(e.name, "model")
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            borderRadius: 4,
                            border: "none",
                            background: "#374151",
                            color: "#e5e7eb",
                            cursor: "pointer",
                          }}
                        >
                          {copied === "model" && editingExpert?.id === e.id ? "Copied" : "Copy model"}
                        </button>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation()
                            if (confirm(`Delete expert "${e.name}"?`)) deleteExpertMut.mutate(e.id)
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            borderRadius: 4,
                            border: "none",
                            background: "#7f1d1d",
                            color: "#fecaca",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Keywords */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Keywords</h3>
              {keywords.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No keywords configured.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {keywords.map((k) => (
                    <span
                      key={k.id}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: k.enabled === 1 ? "#064e3b" : "#374151",
                        color: k.enabled === 1 ? "#6ee7b7" : "#9ca3af",
                        fontSize: 13,
                      }}
                    >
                      {k.keyword}
                      <span style={{ opacity: 0.6, marginLeft: 6 }}>({k.expert_name})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Overrides */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Overrides</h3>
              {overrides.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No keyword overrides configured.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {overrides.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        padding: 10,
                        background: "#1f2937",
                        borderRadius: 6,
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        <strong>{o.keyword}</strong> → {o.provider_name} / {o.model_external_id}
                        <span style={{ color: "#9ca3af", marginLeft: 8 }}>({o.expert_name})</span>
                      </span>
                      {o.enabled !== 1 && <span style={{ color: "#ef4444" }}>disabled</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Side panel editor */}
      {editingExpert && (
        <div
          style={{
            width: 380,
            minWidth: 380,
            background: "#111827",
            borderLeft: "1px solid #1f2937",
            padding: 16,
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Edit Expert</h3>
            {expertDirty && (
              <span style={{ fontSize: 12, color: "#fbbf24" }}>Unsaved changes</span>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Display name</div>
              <input
                value={draftExpert.display_name ?? ""}
                onChange={(e) => {
                  setDraftExpert((d) => ({ ...d, display_name: e.target.value }))
                  setExpertDirty(true)
                }}
                style={inputStyle}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Provider</div>
              <select
                value={draftExpert.provider_id ?? ""}
                onChange={(e) => {
                  setDraftExpert((d) => ({ ...d, provider_id: e.target.value, model_id: "" }))
                  setExpertDirty(true)
                }}
                style={inputStyle}
              >
                <option value="">Select provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Model</div>
              <select
                value={draftExpert.model_id ?? ""}
                onChange={(e) => {
                  setDraftExpert((d) => ({ ...d, model_id: e.target.value }))
                  setExpertDirty(true)
                }}
                style={inputStyle}
              >
                <option value="">Select model</option>
                {filteredModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? m.model_id}
                  </option>
                ))}
              </select>
              {filteredModels.length === 0 && draftExpert.provider_id && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>No models for this provider.</div>
              )}
            </label>

            <label>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>System prompt</div>
              <textarea
                value={draftExpert.system_prompt ?? ""}
                onChange={(e) => {
                  setDraftExpert((d) => ({ ...d, system_prompt: e.target.value }))
                  setExpertDirty(true)
                }}
                rows={6}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Temperature</div>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={2}
                  value={draftExpert.temperature ?? ""}
                  onChange={(e) => {
                    setDraftExpert((d) => ({ ...d, temperature: e.target.value === "" ? null : Number(e.target.value) }))
                    setExpertDirty(true)
                  }}
                  style={inputStyle}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Max tokens</div>
                <input
                  type="number"
                  min={1}
                  value={draftExpert.max_tokens ?? ""}
                  onChange={(e) => {
                    setDraftExpert((d) => ({ ...d, max_tokens: e.target.value === "" ? null : Number(e.target.value) }))
                    setExpertDirty(true)
                  }}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={(draftExpert.expose_as_model ?? 1) === 1}
                  onChange={(e) => {
                    setDraftExpert((d) => ({ ...d, expose_as_model: e.target.checked ? 1 : 0 }))
                    setExpertDirty(true)
                  }}
                />
                <span style={{ fontSize: 13 }}>Expose as model</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={(draftExpert.enabled ?? 1) === 1}
                  onChange={(e) => {
                    setDraftExpert((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 }))
                    setExpertDirty(true)
                  }}
                />
                <span style={{ fontSize: 13 }}>Enabled</span>
              </label>
            </div>

            {updateExpertMut.isError && (
              <div style={{ color: "#ef4444", fontSize: 13 }}>
                Error: {(updateExpertMut.error as Error)?.message}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={saveExpert}
                disabled={!expertDirty || updateExpertMut.isPending}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: expertDirty ? "#2563eb" : "#374151",
                  color: "#fff",
                  cursor: expertDirty ? "pointer" : "not-allowed",
                }}
              >
                {updateExpertMut.isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingExpert(null)
                  setExpertDirty(false)
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#374151",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  fontSize: 14,
  boxSizing: "border-box",
}
