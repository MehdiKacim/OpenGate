import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { InputTextarea } from "primereact/inputtextarea"
import { Tag } from "primereact/tag"
import { apiGet, apiPost } from "../api/client.js"
import { useStudio } from "../studio/StudioContext.js"

interface Expert {
  id: string
  name: string
  display_name: string | null
  provider_name: string
  model_external_id: string
  enabled: number
}

export default function Workspace() {
  const { profileSlug } = useStudio()
  const [expertName, setExpertName] = useState("builder")
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const resolvedQuery = useQuery({
    queryKey: ["resolved", profileSlug],
    queryFn: () => apiGet(`/_opengate/route-profiles/${profileSlug}/resolved`),
  })
  const experts: Expert[] = resolvedQuery.data?.experts ?? []
  const enabledExperts = experts.filter((expert) => expert.enabled === 1)
  const selectedExpert = enabledExperts.find((expert) => expert.name === expertName) ?? enabledExperts[0]

  useEffect(() => {
    if (selectedExpert && selectedExpert.name !== expertName) setExpertName(selectedExpert.name)
  }, [expertName, selectedExpert])

  const sendPrompt = async () => {
    if (!prompt.trim() || !selectedExpert) return
    setLoading(true)
    setResult(null)
    try {
      const data = await apiPost("/_opengate/playground", {
        profileSlug,
        model: selectedExpert.name,
        messages: [{ role: "user", content: prompt.trim() }],
      })
      setResult(data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2))
    } catch (err) {
      setResult(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-editor">
        <header className="workspace-toolbar">
          <div>
            <p className="studio-eyebrow">Prompt buffer</p>
            <strong>Playground.request</strong>
          </div>
          <Tag value={`/c/${profileSlug}/v1`} severity="info" />
        </header>

        <div className="workspace-composer">
          <div className="workspace-routebar">
            <label>
              <span>Expert</span>
              <Dropdown
                value={selectedExpert?.name}
                options={enabledExperts}
                optionLabel="display_name"
                optionValue="name"
                itemTemplate={(expert: Expert) => expert.display_name || expert.name}
                valueTemplate={(expert?: Expert) => expert ? expert.display_name || expert.name : "Select an expert"}
                onChange={(event) => setExpertName(event.value)}
                placeholder="Select expert"
              />
            </label>
            {selectedExpert && (
              <div className="workspace-route">
                <span>Resolved target</span>
                <strong>{selectedExpert.provider_name} / {selectedExpert.model_external_id}</strong>
              </div>
            )}
          </div>
          <InputTextarea
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Write a request for the selected expert..."
          />
          <div className="workspace-submit">
            <span>{enabledExperts.length} enabled expert{enabledExperts.length === 1 ? "" : "s"} in this profile.</span>
            <Button label={loading ? "Routing..." : "Run"} icon="pi pi-send" disabled={!prompt.trim() || !selectedExpert || loading} onClick={sendPrompt} />
          </div>
        </div>
      </section>

      <aside className="workspace-inspector">
        <section className="studio-panel workspace-response">
          <div className="studio-panel-title workspace-panel-title">
            <strong>Response</strong>
            <span>Output buffer</span>
          </div>
          {result ? <pre>{result}</pre> : <div className="workspace-placeholder">Run the request to inspect the response here.</div>}
        </section>
        <section className="studio-panel workspace-expert-list">
          <div className="studio-panel-title workspace-panel-title">
            <strong>Experts</strong>
            <span>Available buffers</span>
          </div>
          {enabledExperts.map((expert) => (
            <button key={expert.id} className={expert.name === selectedExpert?.name ? "workspace-expert is-selected" : "workspace-expert"} onClick={() => setExpertName(expert.name)}>
              <strong>{expert.display_name || expert.name}</strong>
              <span>{expert.name}</span>
            </button>
          ))}
          {!enabledExperts.length && <div className="workspace-placeholder">Configure a provider model and an expert first.</div>}
        </section>
      </aside>
    </div>
  )
}
