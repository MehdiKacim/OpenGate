import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "primereact/button"
import { Chips } from "primereact/chips"
import { Column } from "primereact/column"
import { DataTable } from "primereact/datatable"
import { Dialog } from "primereact/dialog"
import { Dropdown } from "primereact/dropdown"
import { InputNumber } from "primereact/inputnumber"
import { InputTextarea } from "primereact/inputtextarea"
import { InputText } from "primereact/inputtext"
import { Tag } from "primereact/tag"
import { apiDelete, apiGet, apiPatch, apiPost } from "../api/client.js"
import { useStudio } from "../studio/StudioContext.js"

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
  expert_id: string
}

interface Override {
  id: string
  keyword: string
  priority: number
  enabled: number
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

export default function Experts() {
  const qc = useQueryClient()
  const { profileSlug } = useStudio()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const resolvedQuery = useQuery({
    queryKey: ["resolved", profileSlug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${profileSlug}/resolved`),
  })
  const providerQuery = useQuery({
    queryKey: ["providers", profileSlug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${profileSlug}/providers`),
  })

  const experts: Expert[] = resolvedQuery.data?.experts ?? []
  const keywords: Keyword[] = resolvedQuery.data?.keywords ?? []
  const overrides: Override[] = resolvedQuery.data?.overrides ?? []
  const providers: Provider[] = providerQuery.data?.providers ?? []
  const models: ProviderModel[] = providerQuery.data?.models ?? []
  const selectedExpert = experts.find((expert) => expert.id === selectedId) ?? experts[0] ?? null

  useEffect(() => {
    if (!selectedExpert && experts[0]) setSelectedId(experts[0].id)
  }, [experts, selectedExpert])

  const refreshResolved = () => qc.invalidateQueries({ queryKey: ["resolved", profileSlug] })
  const updateExpert = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/_opengate/experts/${id}`, body),
    onSuccess: refreshResolved,
  })
  const deleteExpert = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/experts/${id}`),
    onSuccess: () => {
      setSelectedId(null)
      refreshResolved()
    },
  })
  const createExpert = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost(`/_opengate/route-profiles/${profileSlug}/experts`, body),
    onSuccess: () => {
      setCreateOpen(false)
      refreshResolved()
    },
  })

  return (
    <div className="studio-page studio-experts">
      <div className="studio-page-head">
        <div>
          <p className="studio-eyebrow">Expert routing</p>
          <h1>Experts</h1>
        </div>
        <Button label="New expert" icon="pi pi-plus" onClick={() => setCreateOpen(true)} />
      </div>

      <div className="studio-master-detail">
        <section className="studio-panel studio-list-pane">
          <div className="studio-panel-title">
            <strong>{experts.length} configured</strong>
            <span>OpenAI model names exposed by this route profile.</span>
          </div>
          <DataTable
            value={experts}
            selectionMode="single"
            selection={selectedExpert}
            onSelectionChange={(event) => setSelectedId((event.value as Expert).id)}
            dataKey="id"
            size="small"
            emptyMessage="Create an expert after adding a provider and a model."
          >
            <Column
              header="Expert"
              body={(expert: Expert) => (
                <div className="studio-table-primary">
                  <strong>{expert.display_name || expert.name}</strong>
                  <span>{expert.name}</span>
                </div>
              )}
            />
            <Column
              header="Route"
              body={(expert: Expert) => (
                <span className="studio-muted">{expert.provider_name} / {expert.model_external_id}</span>
              )}
            />
            <Column
              header="State"
              body={(expert: Expert) => (
                <Tag value={expert.enabled === 1 ? "active" : "off"} severity={expert.enabled === 1 ? "success" : "danger"} />
              )}
            />
          </DataTable>
        </section>

        <section className="studio-panel studio-detail-pane">
          {selectedExpert ? (
            <ExpertEditor
              key={selectedExpert.id}
              expert={selectedExpert}
              providers={providers}
              models={models}
              keywords={keywords.filter((keyword) => keyword.expert_id === selectedExpert.id)}
              overrides={overrides.filter((override) => override.expert_id === selectedExpert.id)}
              onSave={(body) => updateExpert.mutate({ id: selectedExpert.id, body })}
              onDelete={() => {
                if (confirm(`Delete expert "${selectedExpert.name}"?`)) deleteExpert.mutate(selectedExpert.id)
              }}
              onChanged={refreshResolved}
              saving={updateExpert.isPending}
            />
          ) : (
            <div className="studio-empty">
              <strong>No expert selected</strong>
              <span>Experts bind a model name to a default provider route, keywords and overrides.</span>
            </div>
          )}
        </section>
      </div>

      <CreateExpertDialog
        visible={createOpen}
        providers={providers}
        models={models}
        pending={createExpert.isPending}
        onHide={() => setCreateOpen(false)}
        onCreate={(body) => createExpert.mutate(body)}
      />
    </div>
  )
}

function ExpertEditor({
  expert,
  providers,
  models,
  keywords,
  overrides,
  onSave,
  onDelete,
  onChanged,
  saving,
}: {
  expert: Expert
  providers: Provider[]
  models: ProviderModel[]
  keywords: Keyword[]
  overrides: Override[]
  onSave: (body: Record<string, unknown>) => void
  onDelete: () => void
  onChanged: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState({
    name: expert.name,
    display_name: expert.display_name ?? "",
    provider_id: expert.provider_id,
    model_id: expert.model_id,
    system_prompt: expert.system_prompt,
    temperature: expert.temperature,
    max_tokens: expert.max_tokens,
    expose_as_model: expert.expose_as_model === 1,
    enabled: expert.enabled === 1,
  })
  const [keywordValues, setKeywordValues] = useState(() => keywords.map((keyword) => keyword.keyword))
  const [overrideDraft, setOverrideDraft] = useState({
    keyword: keywords[0]?.keyword ?? "",
    provider_id: expert.provider_id,
    model_id: expert.model_id,
  })
  const providerModels = useMemo(
    () => models.filter((model) => model.provider_id === draft.provider_id),
    [draft.provider_id, models],
  )
  const overrideModels = models.filter((model) => model.provider_id === overrideDraft.provider_id)
  const keywordCreate = useMutation({
    mutationFn: (keyword: string) => apiPost(`/_opengate/experts/${expert.id}/keywords`, { keyword }),
  })
  const keywordDelete = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/expert-keywords/${id}`),
  })
  const overrideCreate = useMutation({
    mutationFn: () => apiPost(`/_opengate/experts/${expert.id}/overrides`, overrideDraft),
    onSuccess: onChanged,
  })
  const overrideDelete = useMutation({
    mutationFn: (id: string) => apiDelete(`/_opengate/keyword-overrides/${id}`),
    onSuccess: onChanged,
  })

  const saveKeywords = async () => {
    const normalized = Array.from(new Set(keywordValues.map((value) => value.trim()).filter(Boolean)))
    const existing = new Map(keywords.map((keyword) => [keyword.keyword, keyword]))
    await Promise.all(normalized.filter((keyword) => !existing.has(keyword)).map((keyword) => keywordCreate.mutateAsync(keyword)))
    await Promise.all(keywords.filter((keyword) => !normalized.includes(keyword.keyword)).map((keyword) => keywordDelete.mutateAsync(keyword.id)))
    onChanged()
  }

  return (
    <div className="expert-editor">
      <div className="studio-panel-title studio-panel-title-row">
        <div>
          <strong>{expert.display_name || expert.name}</strong>
          <span>`model={expert.name}` resolves here first.</span>
        </div>
        <div className="studio-actions">
          <Button label={saving ? "Saving" : "Save"} icon="pi pi-save" onClick={() => onSave(draft)} disabled={saving} />
          <Button label="Delete" icon="pi pi-trash" severity="danger" outlined onClick={onDelete} />
        </div>
      </div>

      <div className="studio-form-grid">
        <label>
          <span>Model name</span>
          <InputText value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
        </label>
        <label>
          <span>Display name</span>
          <InputText value={draft.display_name} onChange={(event) => setDraft((value) => ({ ...value, display_name: event.target.value }))} />
        </label>
        <label>
          <span>Default provider</span>
          <Dropdown
            value={draft.provider_id}
            options={providers}
            optionLabel="name"
            optionValue="id"
            onChange={(event) => setDraft((value) => ({ ...value, provider_id: event.value, model_id: "" }))}
          />
        </label>
        <label>
          <span>Default model</span>
          <Dropdown
            value={draft.model_id}
            options={providerModels}
            optionLabel="display_name"
            optionValue="id"
            itemTemplate={(model: ProviderModel) => model.display_name || model.model_id}
            valueTemplate={(model?: ProviderModel) => model ? model.display_name || model.model_id : "Select model"}
            onChange={(event) => setDraft((value) => ({ ...value, model_id: event.value }))}
          />
        </label>
        <label>
          <span>Temperature</span>
          <InputNumber value={draft.temperature} min={0} max={2} onValueChange={(event) => setDraft((value) => ({ ...value, temperature: event.value ?? null }))} />
        </label>
        <label>
          <span>Max tokens</span>
          <InputNumber value={draft.max_tokens} min={1} onValueChange={(event) => setDraft((value) => ({ ...value, max_tokens: event.value ?? null }))} />
        </label>
      </div>

      <label className="studio-field-wide">
        <span>System prompt</span>
        <InputTextarea
          rows={5}
          value={draft.system_prompt}
          onChange={(event) => setDraft((value) => ({ ...value, system_prompt: event.target.value }))}
        />
      </label>

      <div className="studio-flag-row">
        <label><input type="checkbox" checked={draft.expose_as_model} onChange={(event) => setDraft((value) => ({ ...value, expose_as_model: event.target.checked }))} /> Expose as model</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((value) => ({ ...value, enabled: event.target.checked }))} /> Enabled</label>
      </div>

      <section className="studio-subtool">
        <div className="studio-panel-title studio-panel-title-row">
          <div>
            <strong>Keywords</strong>
            <span>Domains detected for prompt enrichment and override matching.</span>
          </div>
          <Button label="Save keywords" icon="pi pi-check" outlined onClick={saveKeywords} loading={keywordCreate.isPending || keywordDelete.isPending} />
        </div>
        <Chips
          value={keywordValues}
          onChange={(event) => setKeywordValues(event.value ?? [])}
          separator=","
          placeholder="frontend, oauth, security"
        />
      </section>

      <section className="studio-subtool">
        <div className="studio-panel-title">
          <strong>Keyword overrides</strong>
          <span>Only add a provider/model switch when a keyword needs a different route.</span>
        </div>
        <div className="override-compose">
          <Dropdown
            value={overrideDraft.keyword}
            options={keywordValues}
            onChange={(event) => setOverrideDraft((value) => ({ ...value, keyword: event.value }))}
            placeholder="Keyword"
          />
          <Dropdown
            value={overrideDraft.provider_id}
            options={providers}
            optionLabel="name"
            optionValue="id"
            onChange={(event) => setOverrideDraft((value) => ({ ...value, provider_id: event.value, model_id: "" }))}
            placeholder="Provider"
          />
          <Dropdown
            value={overrideDraft.model_id}
            options={overrideModels}
            optionValue="id"
            optionLabel="display_name"
            itemTemplate={(model: ProviderModel) => model.display_name || model.model_id}
            valueTemplate={(model?: ProviderModel) => model ? model.display_name || model.model_id : "Model"}
            onChange={(event) => setOverrideDraft((value) => ({ ...value, model_id: event.value }))}
          />
          <Button label="Add override" icon="pi pi-directions-alt" onClick={() => overrideCreate.mutate()} disabled={!overrideDraft.keyword || !overrideDraft.model_id} />
        </div>
        <DataTable value={overrides} size="small" emptyMessage="No keyword route overrides.">
          <Column field="keyword" header="Keyword" />
          <Column header="Route" body={(override: Override) => `${override.provider_name} / ${override.model_external_id}`} />
          <Column field="priority" header="Priority" />
          <Column
            header=""
            body={(override: Override) => (
              <Button icon="pi pi-times" text severity="danger" aria-label="Delete override" onClick={() => overrideDelete.mutate(override.id)} />
            )}
          />
        </DataTable>
      </section>
    </div>
  )
}

function CreateExpertDialog({
  visible,
  providers,
  models,
  pending,
  onHide,
  onCreate,
}: {
  visible: boolean
  providers: Provider[]
  models: ProviderModel[]
  pending: boolean
  onHide: () => void
  onCreate: (body: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState({ name: "", display_name: "", provider_id: "", model_id: "" })
  const providerModels = models.filter((model) => model.provider_id === draft.provider_id)

  return (
    <Dialog header="New expert" visible={visible} onHide={onHide} style={{ width: "min(560px, 94vw)" }}>
      <div className="studio-form-stack">
        <label><span>Model name</span><InputText value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="builder" /></label>
        <label><span>Display name</span><InputText value={draft.display_name} onChange={(event) => setDraft((value) => ({ ...value, display_name: event.target.value }))} /></label>
        <label>
          <span>Default provider</span>
          <Dropdown value={draft.provider_id} options={providers} optionLabel="name" optionValue="id" onChange={(event) => setDraft((value) => ({ ...value, provider_id: event.value, model_id: "" }))} />
        </label>
        <label>
          <span>Default model</span>
          <Dropdown
            value={draft.model_id}
            options={providerModels}
            optionValue="id"
            optionLabel="display_name"
            itemTemplate={(model: ProviderModel) => model.display_name || model.model_id}
            valueTemplate={(model?: ProviderModel) => model ? model.display_name || model.model_id : "Select model"}
            onChange={(event) => setDraft((value) => ({ ...value, model_id: event.value }))}
          />
        </label>
        <Button
          label="Create expert"
          icon="pi pi-plus"
          loading={pending}
          disabled={!draft.name.trim() || !draft.provider_id || !draft.model_id}
          onClick={() =>
            onCreate({
              ...draft,
              name: draft.name.trim(),
              display_name: draft.display_name.trim() || draft.name.trim(),
              system_prompt: "",
            })
          }
        />
      </div>
    </Dialog>
  )
}
