import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "primereact/button"
import { Column } from "primereact/column"
import { DataTable } from "primereact/datatable"
import { Dialog } from "primereact/dialog"
import { Dropdown } from "primereact/dropdown"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { Tag } from "primereact/tag"
import { apiDelete, apiGet, apiPatch, apiPost } from "../api/client.js"
import { useStudio } from "../studio/StudioContext.js"

interface Provider {
  id: string
  name: string
  type: "oauth" | "proxy" | "static"
  adapter: string | null
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

interface ProviderAuthStatus {
  configured: boolean
  has_access_token: boolean
  has_refresh_token: boolean
  has_session_token: boolean
  expires_at: number | null
  expired: boolean | null
}

const oauthAdapters = [
  { id: "kimi", name: "Kimi", note: "Usable now when a restored access token is present." },
  { id: "chatgpt", name: "ChatGPT / Codex", note: "Adapter boundary exists; login and request translation still need recovery." },
  { id: "gemini", name: "Gemini", note: "Adapter boundary exists; Code Assist OAuth setup still needs recovery." },
]

export default function Providers() {
  const qc = useQueryClient()
  const { profileSlug } = useStudio()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const providerQuery = useQuery({
    queryKey: ["providers", profileSlug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${profileSlug}/providers`),
  })
  const providers: Provider[] = providerQuery.data?.providers ?? []
  const models: ProviderModel[] = providerQuery.data?.models ?? []
  const selectedProvider = providers.find((provider) => provider.id === selectedId) ?? providers[0] ?? null

  useEffect(() => {
    if (!selectedProvider && providers[0]) setSelectedId(providers[0].id)
  }, [providers, selectedProvider])

  const refresh = () => qc.invalidateQueries({ queryKey: ["providers", profileSlug] })
  const createProvider = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost(`/_opengate/route-profiles/${profileSlug}/providers`, body),
    onSuccess: () => {
      setCreateOpen(false)
      refresh()
    },
  })
  const updateProvider = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/_opengate/providers/${id}`, body),
    onSuccess: refresh,
  })
  const deleteProvider = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/providers/${id}`),
    onSuccess: () => {
      setSelectedId(null)
      refresh()
    },
  })

  return (
    <div className="studio-page">
      <div className="studio-page-head">
        <div>
          <p className="studio-eyebrow">Provider connections</p>
          <h1>Providers</h1>
        </div>
        <Button label="Add provider" icon="pi pi-plug" onClick={() => setCreateOpen(true)} />
      </div>

      <div className="studio-master-detail studio-provider-grid">
        <section className="studio-panel studio-list-pane">
          <div className="studio-panel-title">
            <strong>{providers.length} provider routes</strong>
            <span>Authenticate first, then enable the models experts can use.</span>
          </div>
          <DataTable
            value={providers}
            selectionMode="single"
            selection={selectedProvider}
            onSelectionChange={(event) => setSelectedId((event.value as Provider).id)}
            dataKey="id"
            size="small"
            emptyMessage="Add an OAuth provider or an OpenAI-compatible proxy."
          >
            <Column
              header="Provider"
              body={(provider: Provider) => (
                <div className="studio-table-primary">
                  <strong>{provider.name}</strong>
                  <span>{provider.adapter || provider.protocol}</span>
                </div>
              )}
            />
            <Column header="Type" body={(provider: Provider) => <Tag value={provider.type} severity={provider.type === "oauth" ? "info" : "secondary"} />} />
            <Column header="Models" body={(provider: Provider) => models.filter((model) => model.provider_id === provider.id).length} />
          </DataTable>
        </section>

        <section className="studio-panel studio-detail-pane">
          {selectedProvider ? (
            <ProviderDetail
              key={selectedProvider.id}
              provider={selectedProvider}
              models={models.filter((model) => model.provider_id === selectedProvider.id)}
              onUpdate={(body) => updateProvider.mutate({ id: selectedProvider.id, body })}
              onDelete={() => {
                if (confirm(`Delete provider "${selectedProvider.name}"?`)) deleteProvider.mutate(selectedProvider.id)
              }}
              onChanged={refresh}
              saving={updateProvider.isPending}
            />
          ) : (
            <div className="studio-empty">
              <strong>No provider selected</strong>
              <span>Providers are the connections behind expert routes.</span>
            </div>
          )}
        </section>
      </div>

      <CreateProviderDialog
        visible={createOpen}
        pending={createProvider.isPending}
        onHide={() => setCreateOpen(false)}
        onCreate={(body) => createProvider.mutate(body)}
      />
    </div>
  )
}

function ProviderDetail({
  provider,
  models,
  onUpdate,
  onDelete,
  onChanged,
  saving,
}: {
  provider: Provider
  models: ProviderModel[]
  onUpdate: (body: Record<string, unknown>) => void
  onDelete: () => void
  onChanged: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState({
    name: provider.name,
    adapter: provider.adapter ?? "",
    base_url: provider.base_url ?? "",
    auth_type: provider.auth_type ?? "",
    enabled: provider.enabled === 1,
    allow_invalid_certificates: provider.allow_invalid_certificates === 1,
  })

  return (
    <div className="provider-detail">
      <div className="studio-panel-title studio-panel-title-row">
        <div>
          <strong>{provider.name}</strong>
          <span>{provider.type} / {provider.adapter || provider.protocol}</span>
        </div>
        <div className="studio-actions">
          <Button label={saving ? "Saving" : "Save"} icon="pi pi-save" onClick={() => onUpdate(draft)} disabled={saving} />
          <Button label="Delete" icon="pi pi-trash" outlined severity="danger" onClick={onDelete} />
        </div>
      </div>

      <div className="studio-form-grid">
        <label><span>Name</span><InputText value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></label>
        <label><span>Adapter</span><InputText value={draft.adapter} disabled={provider.type === "oauth"} onChange={(event) => setDraft((value) => ({ ...value, adapter: event.target.value }))} /></label>
        {provider.type === "proxy" && (
          <>
            <label><span>OpenAI base URL</span><InputText value={draft.base_url} onChange={(event) => setDraft((value) => ({ ...value, base_url: event.target.value }))} /></label>
            <label><span>Auth type</span><InputText value={draft.auth_type} onChange={(event) => setDraft((value) => ({ ...value, auth_type: event.target.value }))} placeholder="bearer" /></label>
          </>
        )}
      </div>
      <div className="studio-flag-row">
        <label><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((value) => ({ ...value, enabled: event.target.checked }))} /> Enabled</label>
        {provider.type === "proxy" && (
          <label><input type="checkbox" checked={draft.allow_invalid_certificates} onChange={(event) => setDraft((value) => ({ ...value, allow_invalid_certificates: event.target.checked }))} /> Allow invalid certificates</label>
        )}
      </div>

      {provider.type === "oauth" && <ProviderAuthStudio provider={provider} />}
      <ProviderModels provider={provider} models={models} onChanged={onChanged} />
    </div>
  )
}

function ProviderAuthStudio({ provider }: { provider: Provider }) {
  const qc = useQueryClient()
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [draft, setDraft] = useState({
    accessToken: "",
    refreshToken: "",
    sessionToken: "",
    expiresAt: "",
    accountId: "",
    projectId: "",
  })
  const authQuery = useQuery<ProviderAuthStatus>({
    queryKey: ["provider-auth", provider.id],
    queryFn: () => apiGet(`/_opengate/providers/${provider.id}/auth`),
  })
  const saveAuth = useMutation({
    mutationFn: () =>
      apiPost(`/_opengate/providers/${provider.id}/auth`, {
        ...draft,
        expiresAt: draft.expiresAt ? Date.parse(draft.expiresAt) : undefined,
      }),
    onSuccess: () => {
      setDraft({ accessToken: "", refreshToken: "", sessionToken: "", expiresAt: "", accountId: "", projectId: "" })
      setRecoveryOpen(false)
      qc.invalidateQueries({ queryKey: ["provider-auth", provider.id] })
    },
  })
  const removeAuth = useMutation({
    mutationFn: () => apiDelete(`/_opengate/providers/${provider.id}/auth`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-auth", provider.id] }),
  })
  const status = authQuery.data
  const adapterInfo = oauthAdapters.find((adapter) => adapter.id === provider.adapter)

  return (
    <section className="studio-subtool provider-auth-studio">
      <div className="studio-panel-title studio-panel-title-row">
        <div>
          <strong>OAuth session</strong>
          <span>{adapterInfo?.note || "Choose a supported OAuth adapter."}</span>
        </div>
        <Tag
          value={status?.configured ? status.expired ? "expired" : "stored" : "not connected"}
          severity={status?.configured ? status.expired ? "warning" : "success" : "danger"}
        />
      </div>
      <div className="oauth-studio-actions">
        <Button label={`Connect ${adapterInfo?.name || "provider"}`} icon="pi pi-external-link" disabled outlined />
        <Button label="Restore credentials" icon="pi pi-key" onClick={() => setRecoveryOpen(true)} />
        {status?.configured && <Button label="Disconnect" icon="pi pi-times" severity="danger" text onClick={() => removeAuth.mutate()} />}
      </div>
      <Message
        severity={provider.adapter === "kimi" ? "info" : "warn"}
        text={
          provider.adapter === "kimi"
            ? "Kimi can run from a restored local access token today. The browser/device login button is the next recovered flow."
            : "This adapter is registered, but its OAuth login and chat translation recovery are not integrated yet."
        }
      />
      {status?.configured && (
        <div className="oauth-status-row">
          {status.has_access_token && <Tag value="access token" />}
          {status.has_refresh_token && <Tag value="refresh token" />}
          {status.has_session_token && <Tag value="session token" />}
        </div>
      )}

      <Dialog header="Credential recovery" visible={recoveryOpen} onHide={() => setRecoveryOpen(false)} style={{ width: "min(620px, 94vw)" }}>
        <div className="studio-form-stack">
          <Message severity="warn" text="Recovery values stay in the local auth store. They are not exported with route profiles and are not read back into this dialog." />
          <label><span>Access token</span><InputText type="password" autoComplete="off" value={draft.accessToken} onChange={(event) => setDraft((value) => ({ ...value, accessToken: event.target.value }))} /></label>
          <label><span>Refresh token</span><InputText type="password" autoComplete="off" value={draft.refreshToken} onChange={(event) => setDraft((value) => ({ ...value, refreshToken: event.target.value }))} /></label>
          <label><span>Session token</span><InputText type="password" autoComplete="off" value={draft.sessionToken} onChange={(event) => setDraft((value) => ({ ...value, sessionToken: event.target.value }))} /></label>
          <div className="studio-form-grid">
            <label><span>Expires at</span><InputText type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} /></label>
            <label><span>Account ID</span><InputText value={draft.accountId} onChange={(event) => setDraft((value) => ({ ...value, accountId: event.target.value }))} /></label>
            <label><span>Project ID</span><InputText value={draft.projectId} onChange={(event) => setDraft((value) => ({ ...value, projectId: event.target.value }))} /></label>
          </div>
          <Button label="Save recovery record" icon="pi pi-lock" loading={saveAuth.isPending} disabled={!draft.accessToken && !draft.refreshToken && !draft.sessionToken} onClick={() => saveAuth.mutate()} />
        </div>
      </Dialog>
    </section>
  )
}

function ProviderModels({
  provider,
  models,
  onChanged,
}: {
  provider: Provider
  models: ProviderModel[]
  onChanged: () => void
}) {
  const [draft, setDraft] = useState({ model_id: "", display_name: "" })
  const createModel = useMutation({
    mutationFn: () => apiPost(`/_opengate/providers/${provider.id}/models`, draft),
    onSuccess: () => {
      setDraft({ model_id: "", display_name: "" })
      onChanged()
    },
  })
  const toggleModel = useMutation({
    mutationFn: (model: ProviderModel) => apiPatch(`/_opengate/provider-models/${model.id}`, { enabled: model.enabled !== 1 }),
    onSuccess: onChanged,
  })
  const deleteModel = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/provider-models/${id}`),
    onSuccess: onChanged,
  })

  return (
    <section className="studio-subtool">
      <div className="studio-panel-title">
        <strong>Models</strong>
        <span>Experts select from this provider model list.</span>
      </div>
      <div className="model-compose">
        <InputText value={draft.model_id} onChange={(event) => setDraft((value) => ({ ...value, model_id: event.target.value }))} placeholder="model id" />
        <InputText value={draft.display_name} onChange={(event) => setDraft((value) => ({ ...value, display_name: event.target.value }))} placeholder="display name" />
        <Button label="Add model" icon="pi pi-plus" onClick={() => createModel.mutate()} disabled={!draft.model_id.trim()} />
      </div>
      <DataTable value={models} size="small" emptyMessage="No models are enabled for this provider yet.">
        <Column
          header="Model"
          body={(model: ProviderModel) => (
            <div className="studio-table-primary">
              <strong>{model.display_name || model.model_id}</strong>
              <span>{model.model_id}</span>
            </div>
          )}
        />
        <Column header="State" body={(model: ProviderModel) => <Tag value={model.enabled === 1 ? "enabled" : "off"} severity={model.enabled === 1 ? "success" : "secondary"} />} />
        <Column
          header=""
          body={(model: ProviderModel) => (
            <div className="studio-actions">
              <Button text label={model.enabled === 1 ? "Disable" : "Enable"} onClick={() => toggleModel.mutate(model)} />
              <Button text icon="pi pi-trash" severity="danger" aria-label="Delete model" onClick={() => deleteModel.mutate(model.id)} />
            </div>
          )}
        />
      </DataTable>
    </section>
  )
}

function CreateProviderDialog({
  visible,
  pending,
  onHide,
  onCreate,
}: {
  visible: boolean
  pending: boolean
  onHide: () => void
  onCreate: (body: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState({
    name: "",
    type: "oauth" as Provider["type"],
    adapter: "kimi",
    base_url: "",
  })
  const typeOptions = [
    { label: "OAuth subscription", value: "oauth" },
    { label: "OpenAI proxy", value: "proxy" },
    { label: "Static test", value: "static" },
  ]

  return (
    <Dialog header="Add provider" visible={visible} onHide={onHide} style={{ width: "min(760px, 96vw)" }}>
      <div className="studio-form-stack">
        <label>
          <span>Connection type</span>
          <Dropdown
            value={draft.type}
            options={typeOptions}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                type: event.value,
                adapter: event.value === "oauth" ? "kimi" : event.value === "static" ? "static" : "openai",
              }))
            }
          />
        </label>
        {draft.type === "oauth" && (
          <div className="oauth-adapter-grid">
            {oauthAdapters.map((adapter) => (
              <button
                type="button"
                key={adapter.id}
                className={adapter.id === draft.adapter ? "oauth-adapter-choice is-selected" : "oauth-adapter-choice"}
                onClick={() => setDraft((value) => ({ ...value, adapter: adapter.id }))}
              >
                <strong>{adapter.name}</strong>
                <span>{adapter.note}</span>
              </button>
            ))}
          </div>
        )}
        <label>
          <span>Provider name</span>
          <InputText value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder={draft.adapter} />
        </label>
        {draft.type === "proxy" && (
          <label>
            <span>OpenAI-compatible base URL</span>
            <InputText value={draft.base_url} onChange={(event) => setDraft((value) => ({ ...value, base_url: event.target.value }))} placeholder="http://localhost:11434/v1" />
          </label>
        )}
        <Button
          label="Create provider"
          icon="pi pi-arrow-right"
          loading={pending}
          disabled={!draft.name.trim() || (draft.type === "proxy" && !draft.base_url.trim())}
          onClick={() => onCreate({ ...draft, name: draft.name.trim(), base_url: draft.base_url.trim() || undefined })}
        />
      </div>
    </Dialog>
  )
}
