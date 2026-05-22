import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost, apiPatch, apiDelete } from "../api/client.js"

interface Provider {
  id: string
  name: string
  type: string
  protocol: string
  base_url: string | null
  auth_type: string | null
  allow_invalid_certificates: number
  enabled: number
}

interface ProviderModel {
  id: string
  provider_id: string
  model_id: string
  display_name: string | null
  context_window: number | null
  enabled: number
}

export default function Providers() {
  const qc = useQueryClient()
  const [slug, setSlug] = useState("default")
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [draftProvider, setDraftProvider] = useState<Partial<Provider>>({})
  const [providerDirty, setProviderDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["providers", slug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${slug}/providers`),
  })

  const providers: Provider[] = data?.providers ?? []
  const models: ProviderModel[] = data?.models ?? []

  const updateProviderMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/providers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers", slug] })
      setEditingProvider(null)
      setProviderDirty(false)
    },
  })

  const deleteProviderMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers", slug] }),
  })

  const createProviderMut = useMutation({
    mutationFn: (body: unknown) => apiPost(`/_opengate/route-profiles/${slug}/providers`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers", slug] }),
  })

  const updateModelMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/provider-models/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers", slug] }),
  })

  const deleteModelMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/provider-models/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers", slug] }),
  })

  const createModelMut = useMutation({
    mutationFn: ({ providerId, body }: { providerId: string; body: unknown }) =>
      apiPost(`/providers/${providerId}/models`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers", slug] }),
  })

  const startEditProvider = (p: Provider) => {
    setEditingProvider(p)
    setDraftProvider({ ...p })
    setProviderDirty(false)
  }

  const saveProvider = () => {
    if (!editingProvider) return
    const body: Record<string, unknown> = {}
    if (draftProvider.name !== undefined) body.name = draftProvider.name
    if (draftProvider.type !== undefined) body.type = draftProvider.type
    if (draftProvider.base_url !== undefined) body.base_url = draftProvider.base_url
    if (draftProvider.auth_type !== undefined) body.auth_type = draftProvider.auth_type
    if (draftProvider.allow_invalid_certificates !== undefined)
      body.allow_invalid_certificates = draftProvider.allow_invalid_certificates === 1
    if (draftProvider.enabled !== undefined) body.enabled = draftProvider.enabled === 1
    updateProviderMut.mutate({ id: editingProvider.id, body })
  }

  const [newProviderOpen, setNewProviderOpen] = useState(false)
  const [newProviderDraft, setNewProviderDraft] = useState({ name: "", type: "proxy", base_url: "" })

  const [newModelOpenFor, setNewModelOpenFor] = useState<string | null>(null)
  const [newModelDraft, setNewModelDraft] = useState({ model_id: "", display_name: "" })

  return (
    <div>
      <h1 style={{ margin: "0 0 16px" }}>Providers</h1>

      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8, fontSize: 14 }}>Profile slug:</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #374151",
            background: "#1f2937",
            color: "#e5e7eb",
            fontSize: 14,
          }}
        />
      </div>

      {isLoading && <p style={{ color: "#9ca3af" }}>Loading…</p>}

      {!isLoading && providers.length === 0 && (
        <p style={{ color: "#9ca3af" }}>No providers found for this profile.</p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {providers.map((p) => {
          const providerModels = models.filter((m) => m.provider_id === p.id)
          const isEditing = editingProvider?.id === p.id

          return (
            <div key={p.id} style={{ background: "#1f2937", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <input
                        value={draftProvider.name ?? ""}
                        onChange={(e) => {
                          setDraftProvider((d) => ({ ...d, name: e.target.value }))
                          setProviderDirty(true)
                        }}
                        style={inputStyle}
                        placeholder="Provider name"
                      />
                      <select
                        value={draftProvider.type ?? "proxy"}
                        onChange={(e) => {
                          setDraftProvider((d) => ({ ...d, type: e.target.value }))
                          setProviderDirty(true)
                        }}
                        style={inputStyle}
                      >
                        <option value="static">static</option>
                        <option value="proxy">proxy</option>
                        <option value="oauth">oauth</option>
                      </select>
                      <input
                        value={draftProvider.base_url ?? ""}
                        onChange={(e) => {
                          setDraftProvider((d) => ({ ...d, base_url: e.target.value }))
                          setProviderDirty(true)
                        }}
                        style={inputStyle}
                        placeholder="Base URL"
                      />
                      <input
                        value={draftProvider.auth_type ?? ""}
                        onChange={(e) => {
                          setDraftProvider((d) => ({ ...d, auth_type: e.target.value }))
                          setProviderDirty(true)
                        }}
                        style={inputStyle}
                        placeholder="Auth type"
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={(draftProvider.allow_invalid_certificates ?? 0) === 1}
                          onChange={(e) => {
                            setDraftProvider((d) => ({
                              ...d,
                              allow_invalid_certificates: e.target.checked ? 1 : 0,
                            }))
                            setProviderDirty(true)
                          }}
                        />
                        <span style={{ fontSize: 13 }}>Allow invalid certificates</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={(draftProvider.enabled ?? 1) === 1}
                          onChange={(e) => {
                            setDraftProvider((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 }))
                            setProviderDirty(true)
                          }}
                        />
                        <span style={{ fontSize: 13 }}>Enabled</span>
                      </label>
                      {providerDirty && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={saveProvider}
                            disabled={updateProviderMut.isPending}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: 6,
                              border: "none",
                              background: "#2563eb",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            {updateProviderMut.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingProvider(null)
                              setProviderDirty(false)
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
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {p.name}{" "}
                        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>({p.type})</span>
                        {p.enabled !== 1 && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: "#ef4444" }}>disabled</span>
                        )}
                      </div>
                      {p.base_url && (
                        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{p.base_url}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        Protocol: {p.protocol}
                        {p.allow_invalid_certificates === 1 && " • Allow invalid certificates"}
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startEditProvider(p)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "none",
                        background: "#374151",
                        color: "#e5e7eb",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete provider "${p.name}"?`)) deleteProviderMut.mutate(p.id)
                      }}
                      style={{
                        padding: "4px 10px",
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
                )}
              </div>

              {/* Models section */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #374151" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: "#9ca3af" }}>Models</h4>
                  <button
                    onClick={() => {
                      setNewModelOpenFor(p.id)
                      setNewModelDraft({ model_id: "", display_name: "" })
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 4,
                      border: "none",
                      background: "#064e3b",
                      color: "#6ee7b7",
                      cursor: "pointer",
                    }}
                  >
                    + Add model
                  </button>
                </div>

                {providerModels.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: 13 }}>No models for this provider.</p>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {providerModels.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          background: "#111827",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <span>
                          {m.display_name ?? m.model_id}
                          <span style={{ color: "#6b7280", marginLeft: 8 }}>{m.model_id}</span>
                          {m.enabled !== 1 && <span style={{ color: "#ef4444", marginLeft: 8 }}>disabled</span>}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              const next = m.enabled === 1 ? 0 : 1
                              updateModelMut.mutate({ id: m.id, body: { enabled: next === 1 } })
                            }}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
                              borderRadius: 4,
                              border: "none",
                              background: "#374151",
                              color: "#e5e7eb",
                              cursor: "pointer",
                            }}
                          >
                            {m.enabled === 1 ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete model "${m.model_id}"?`)) deleteModelMut.mutate(m.id)
                            }}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
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

                {newModelOpenFor === p.id && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      placeholder="model_id"
                      value={newModelDraft.model_id}
                      onChange={(e) => setNewModelDraft((d) => ({ ...d, model_id: e.target.value }))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      placeholder="Display name (optional)"
                      value={newModelDraft.display_name}
                      onChange={(e) => setNewModelDraft((d) => ({ ...d, display_name: e.target.value }))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        if (!newModelDraft.model_id) return
                        createModelMut.mutate(
                          { providerId: p.id, body: newModelDraft },
                          {
                            onSuccess: () => {
                              setNewModelOpenFor(null)
                              setNewModelDraft({ model_id: "", display_name: "" })
                            },
                          },
                        )
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setNewModelOpenFor(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: "none",
                        background: "#374151",
                        color: "#e5e7eb",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        {!newProviderOpen ? (
          <button
            onClick={() => setNewProviderOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#064e3b",
              color: "#6ee7b7",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            + New provider
          </button>
        ) : (
          <div style={{ background: "#1f2937", borderRadius: 8, padding: 16, display: "grid", gap: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>New provider</h4>
            <input
              placeholder="Name"
              value={newProviderDraft.name}
              onChange={(e) => setNewProviderDraft((d) => ({ ...d, name: e.target.value }))}
              style={inputStyle}
            />
            <select
              value={newProviderDraft.type}
              onChange={(e) => setNewProviderDraft((d) => ({ ...d, type: e.target.value }))}
              style={inputStyle}
            >
              <option value="proxy">proxy</option>
              <option value="static">static</option>
              <option value="oauth">oauth</option>
            </select>
            <input
              placeholder="Base URL"
              value={newProviderDraft.base_url}
              onChange={(e) => setNewProviderDraft((d) => ({ ...d, base_url: e.target.value }))}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (!newProviderDraft.name) return
                  createProviderMut.mutate(newProviderDraft, {
                    onSuccess: () => {
                      setNewProviderOpen(false)
                      setNewProviderDraft({ name: "", type: "proxy", base_url: "" })
                    },
                  })
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setNewProviderOpen(false)
                  setNewProviderDraft({ name: "", type: "proxy", base_url: "" })
                }}
                style={{
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
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  fontSize: 14,
}
