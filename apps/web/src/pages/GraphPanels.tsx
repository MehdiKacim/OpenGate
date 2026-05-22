import { useState } from "react"

const inputS: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #374151", background: "#1f2937", color: "#e5e7eb", fontSize: 14, boxSizing: "border-box" }
const labelS: React.CSSProperties = { fontSize: 12, color: "#9ca3af", marginBottom: 4 }

export function ExpertPanel({ expert, providers, models, onSave, onDelete, onAddKeyword, onAddOverride, creatingKeyword, creatingOverride, onCreateKeyword, onCreateOverride, onCancelCreateKeyword, onCancelCreateOverride, isPending }: {
  expert: any; providers: any[]; models: any[]; onSave: (body: Record<string, unknown>) => void; onDelete: (id: string) => void; onAddKeyword: (id: string) => void; onAddOverride: (id: string) => void; creatingKeyword: boolean; creatingOverride: boolean; onCreateKeyword: (id: string, body: any) => void; onCreateOverride: (id: string, body: any) => void; onCancelCreateKeyword: () => void; onCancelCreateOverride: () => void; isPending: boolean
}) {
  const [draft, setDraft] = useState<Record<string, any>>({ ...expert })
  const [dirty, setDirty] = useState(false)
  const filteredModels = models.filter((m) => m.provider_id === (draft.provider_id ?? expert.provider_id))
  const canSave = dirty && draft.name && draft.provider_id && draft.model_id
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label><div style={labelS}>Name</div><input value={draft.name ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Display name</div><input value={draft.display_name ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, display_name: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Provider</div>
        <select value={draft.provider_id ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, provider_id: e.target.value, model_id: "" })); setDirty(true) }} style={inputS}>
          <option value="">Select provider</option>
          {providers.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.type})</option>))}
        </select>
      </label>
      <label><div style={labelS}>Model</div>
        <select value={draft.model_id ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, model_id: e.target.value })); setDirty(true) }} style={inputS}>
          <option value="">Select model</option>
          {filteredModels.map((m) => (<option key={m.id} value={m.id}>{m.display_name || m.model_id}</option>))}
        </select>
        {filteredModels.length === 0 && draft.provider_id && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>No models for this provider.</div>}
      </label>
      <label><div style={labelS}>System prompt</div><textarea value={draft.system_prompt ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, system_prompt: e.target.value })); setDirty(true) }} rows={4} style={{ ...inputS, resize: "vertical" }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label><div style={labelS}>Temperature</div><input type="number" step={0.1} min={0} max={2} value={draft.temperature ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, temperature: e.target.value === "" ? null : Number(e.target.value) })); setDirty(true) }} style={inputS} /></label>
        <label><div style={labelS}>Max tokens</div><input type="number" min={1} value={draft.max_tokens ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, max_tokens: e.target.value === "" ? null : Number(e.target.value) })); setDirty(true) }} style={inputS} /></label>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={(draft.expose_as_model ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, expose_as_model: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Expose as model
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={(draft.enabled ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Enabled
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ name: draft.name, display_name: draft.display_name, provider_id: draft.provider_id, model_id: draft.model_id, system_prompt: draft.system_prompt, temperature: draft.temperature, max_tokens: draft.max_tokens, expose_as_model: (draft.expose_as_model ?? 1) === 1, enabled: (draft.enabled ?? 1) === 1 })} disabled={!canSave || isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: canSave ? "#2563eb" : "#374151", color: "#fff", cursor: canSave ? "pointer" : "not-allowed" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={() => onDelete(expert.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer" }}>Delete</button>
      </div>
      {creatingKeyword && (
        <div style={{ borderTop: "1px solid #374151", paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>New Keyword</div>
          <CreateKeywordForm onCreate={(body) => onCreateKeyword(expert.id, body)} onCancel={onCancelCreateKeyword} />
        </div>
      )}
      {creatingOverride && (
        <div style={{ borderTop: "1px solid #374151", paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>New Override</div>
          <CreateOverrideForm providers={providers} models={models} onCreate={(body) => onCreateOverride(expert.id, body)} onCancel={onCancelCreateOverride} />
        </div>
      )}
      <div style={{ borderTop: "1px solid #374151", paddingTop: 12, display: "flex", gap: 8 }}>
        <button onClick={() => onAddKeyword(expert.id)} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "none", background: "#064e3b", color: "#6ee7b7", cursor: "pointer", fontSize: 12 }}>+ Keyword</button>
        <button onClick={() => onAddOverride(expert.id)} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer", fontSize: 12 }}>+ Override</button>
      </div>
    </div>
  )
}

export function KeywordPanel({ keyword, onSave, onDelete, isPending }: { keyword: any; onSave: (body: Record<string, unknown>) => void; onDelete: (id: string) => void; isPending: boolean }) {
  const [draft, setDraft] = useState<Record<string, any>>({ ...keyword })
  const [dirty, setDirty] = useState(false)
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label><div style={labelS}>Keyword</div><input value={draft.keyword ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, keyword: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Description</div><input value={draft.description ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, description: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={(draft.enabled ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Enabled
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ keyword: draft.keyword, description: draft.description, enabled: (draft.enabled ?? 1) === 1 })} disabled={!dirty || isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: dirty ? "#2563eb" : "#374151", color: "#fff", cursor: dirty ? "pointer" : "not-allowed" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={() => onDelete(keyword.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer" }}>Delete</button>
      </div>
    </div>
  )
}

export function OverridePanel({ override, providers, models, onSave, onDelete, isPending }: { override: any; providers: any[]; models: any[]; onSave: (body: Record<string, unknown>) => void; onDelete: (id: string) => void; isPending: boolean }) {
  const [draft, setDraft] = useState<Record<string, any>>({ ...override })
  const [dirty, setDirty] = useState(false)
  const filteredModels = models.filter((m) => m.provider_id === (draft.provider_id ?? override.provider_id))
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label><div style={labelS}>Keyword</div><input value={draft.keyword ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, keyword: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Provider</div>
        <select value={draft.provider_id ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, provider_id: e.target.value, model_id: "" })); setDirty(true) }} style={inputS}>
          <option value="">Select provider</option>
          {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </label>
      <label><div style={labelS}>Model</div>
        <select value={draft.model_id ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, model_id: e.target.value })); setDirty(true) }} style={inputS}>
          <option value="">Select model</option>
          {filteredModels.map((m) => (<option key={m.id} value={m.id}>{m.display_name || m.model_id}</option>))}
        </select>
      </label>
      <label><div style={labelS}>Priority</div><input type="number" value={draft.priority ?? 100} onChange={(e) => { setDraft((d) => ({ ...d, priority: Number(e.target.value) })); setDirty(true) }} style={inputS} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={(draft.enabled ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Enabled
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ keyword: draft.keyword, provider_id: draft.provider_id, model_id: draft.model_id, priority: draft.priority, enabled: (draft.enabled ?? 1) === 1 })} disabled={!dirty || isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: dirty ? "#2563eb" : "#374151", color: "#fff", cursor: dirty ? "pointer" : "not-allowed" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={() => onDelete(override.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer" }}>Delete</button>
      </div>
    </div>
  )
}

export function ProviderPanel({ provider, onSave, onDelete, isPending }: { provider: any; onSave: (body: Record<string, unknown>) => void; onDelete: (id: string) => void; isPending: boolean }) {
  const [draft, setDraft] = useState<Record<string, any>>({ ...provider })
  const [dirty, setDirty] = useState(false)
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label><div style={labelS}>Name</div><input value={draft.name ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Type</div>
        <select value={draft.type ?? "proxy"} onChange={(e) => { setDraft((d) => ({ ...d, type: e.target.value })); setDirty(true) }} style={inputS}>
          <option value="proxy">proxy</option>
          <option value="static">static</option>
          <option value="oauth">oauth</option>
        </select>
      </label>
      <label><div style={labelS}>Protocol</div><input value={draft.protocol ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, protocol: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Base URL</div><input value={draft.base_url ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, base_url: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Auth type</div><input value={draft.auth_type ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, auth_type: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={(draft.allow_invalid_certificates ?? 0) === 1} onChange={(e) => { setDraft((d) => ({ ...d, allow_invalid_certificates: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Allow invalid certificates
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={(draft.enabled ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Enabled
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ name: draft.name, type: draft.type, protocol: draft.protocol, base_url: draft.base_url, auth_type: draft.auth_type, allow_invalid_certificates: (draft.allow_invalid_certificates ?? 0) === 1, enabled: (draft.enabled ?? 1) === 1 })} disabled={!dirty || isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: dirty ? "#2563eb" : "#374151", color: "#fff", cursor: dirty ? "pointer" : "not-allowed" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={() => onDelete(provider.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer" }}>Delete</button>
      </div>
    </div>
  )
}

export function ModelPanel({ model, onSave, onDelete, isPending }: { model: any; onSave: (body: Record<string, unknown>) => void; onDelete: (id: string) => void; isPending: boolean }) {
  const [draft, setDraft] = useState<Record<string, any>>({ ...model })
  const [dirty, setDirty] = useState(false)
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label><div style={labelS}>Model ID</div><input value={draft.model_id ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, model_id: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Display name</div><input value={draft.display_name ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, display_name: e.target.value })); setDirty(true) }} style={inputS} /></label>
      <label><div style={labelS}>Context window</div><input type="number" value={draft.context_window ?? ""} onChange={(e) => { setDraft((d) => ({ ...d, context_window: e.target.value === "" ? null : Number(e.target.value) })); setDirty(true) }} style={inputS} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
        <input type="checkbox" checked={(draft.enabled ?? 1) === 1} onChange={(e) => { setDraft((d) => ({ ...d, enabled: e.target.checked ? 1 : 0 })); setDirty(true) }} /> Enabled
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ model_id: draft.model_id, display_name: draft.display_name, context_window: draft.context_window, enabled: (draft.enabled ?? 1) === 1 })} disabled={!dirty || isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: dirty ? "#2563eb" : "#374151", color: "#fff", cursor: dirty ? "pointer" : "not-allowed" }}>{isPending ? "Saving…" : "Save"}</button>
        <button onClick={() => onDelete(model.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#7f1d1d", color: "#fecaca", cursor: "pointer" }}>Delete</button>
      </div>
    </div>
  )
}

export function CreateExpertForm({ providers, models, onCreate, onCancel }: { providers: any[]; models: any[]; onCreate: (body: any) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "")
  const [modelId, setModelId] = useState("")
  const [error, setError] = useState("")
  const filtered = models.filter((m) => m.provider_id === providerId)
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label><div style={labelS}>Name *</div><input value={name} onChange={(e) => setName(e.target.value)} style={inputS} placeholder="unique-id" /></label>
      <label><div style={labelS}>Display name</div><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputS} /></label>
      <label><div style={labelS}>Provider</div>
        <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModelId("") }} style={inputS}>
          {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </label>
      <label><div style={labelS}>Model</div>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} style={inputS}>
          <option value="">Select model</option>
          {filtered.map((m) => (<option key={m.id} value={m.id}>{m.display_name || m.model_id}</option>))}
        </select>
      </label>
      {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          if (!name.trim()) { setError("Name is required"); return }
          if (!modelId) { setError("Model is required"); return }
          onCreate({ name: name.trim(), display_name: displayName.trim() || name.trim(), provider_id: providerId, model_id: modelId, system_prompt: "" })
        }} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>Create</button>
        <button onClick={onCancel} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#374151", color: "#e5e7eb", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  )
}

export function CreateKeywordForm({ onCreate, onCancel }: { onCreate: (body: any) => void; onCancel: () => void }) {
  const [keyword, setKeyword] = useState("")
  const [error, setError] = useState("")
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label><div style={labelS}>Keyword *</div><input value={keyword} onChange={(e) => setKeyword(e.target.value)} style={inputS} placeholder="e.g. code-review" /></label>
      {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          if (!keyword.trim()) { setError("Keyword is required"); return }
          onCreate({ keyword: keyword.trim() })
        }} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>Create</button>
        <button onClick={onCancel} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#374151", color: "#e5e7eb", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  )
}

export function CreateOverrideForm({ providers, models, onCreate, onCancel }: { providers: any[]; models: any[]; onCreate: (body: any) => void; onCancel: () => void }) {
  const [keyword, setKeyword] = useState("")
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "")
  const [modelId, setModelId] = useState("")
  const [error, setError] = useState("")
  const filtered = models.filter((m) => m.provider_id === providerId)
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label><div style={labelS}>Keyword *</div><input value={keyword} onChange={(e) => setKeyword(e.target.value)} style={inputS} placeholder="e.g. urgent" /></label>
      <label><div style={labelS}>Provider</div>
        <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModelId("") }} style={inputS}>
          {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </label>
      <label><div style={labelS}>Model</div>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} style={inputS}>
          <option value="">Select model</option>
          {filtered.map((m) => (<option key={m.id} value={m.id}>{m.display_name || m.model_id}</option>))}
        </select>
      </label>
      {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          if (!keyword.trim()) { setError("Keyword is required"); return }
          if (!modelId) { setError("Model is required"); return }
          onCreate({ keyword: keyword.trim(), provider_id: providerId, model_id: modelId })
        }} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>Create</button>
        <button onClick={onCancel} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#374151", color: "#e5e7eb", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  )
}

export function CreateProviderForm({ onCreate, onCancel, isPending }: { onCreate: (body: any) => void; onCancel: () => void; isPending: boolean }) {
  const [name, setName] = useState("")
  const [type, setType] = useState("proxy")
  const [protocol, setProtocol] = useState("openai")
  const [baseUrl, setBaseUrl] = useState("")
  const [authType, setAuthType] = useState("")
  const [error, setError] = useState("")
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label><div style={labelS}>Name *</div><input value={name} onChange={(e) => setName(e.target.value)} style={inputS} placeholder="Provider name" /></label>
      <label><div style={labelS}>Type</div>
        <select value={type} onChange={(e) => setType(e.target.value)} style={inputS}>
          <option value="proxy">proxy</option>
          <option value="static">static</option>
          <option value="oauth">oauth</option>
        </select>
      </label>
      <label><div style={labelS}>Protocol</div><input value={protocol} onChange={(e) => setProtocol(e.target.value)} style={inputS} placeholder="e.g. openai" /></label>
      <label><div style={labelS}>Base URL</div><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={inputS} placeholder="https://api.example.com/v1" /></label>
      <label><div style={labelS}>Auth type</div><input value={authType} onChange={(e) => setAuthType(e.target.value)} style={inputS} placeholder="bearer" /></label>
      {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          if (!name.trim()) { setError("Name is required"); return }
          onCreate({ name: name.trim(), type, protocol, base_url: baseUrl.trim() || undefined, auth_type: authType.trim() || undefined })
        }} disabled={isPending} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>{isPending ? "Creating…" : "Create"}</button>
        <button onClick={onCancel} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#374151", color: "#e5e7eb", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  )
}
