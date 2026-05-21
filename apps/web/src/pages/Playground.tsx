import { useState } from "react"
import { apiPost } from "../api/client.js"

export default function Playground() {
  const [profileSlug, setProfileSlug] = useState("default")
  const [model, setModel] = useState("builder")
  const [prompt, setPrompt] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setResult(null)
    try {
      const data = await apiPost("/_opengate/playground", {
        profileSlug,
        model,
        messages: [{ role: "user", content: prompt }],
      })
      setResult(data.choices?.[0]?.message?.content || JSON.stringify(data))
    } catch (err) {
      setResult(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Playground</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div>
          <label>Profile</label>
          <input value={profileSlug} onChange={(e) => setProfileSlug(e.target.value)} />
        </div>
        <div>
          <label>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      </div>
      <textarea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt…"
        style={{ width: "100%", padding: 10, borderRadius: 6, background: "#1f2937", color: "#e5e7eb", border: "1px solid #374151" }}
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={loading || !prompt}>
          {loading ? "Sending…" : "Send"}
        </button>
      </div>
      {result && (
        <pre
          style={{
            marginTop: 16,
            padding: 16,
            background: "#1f2937",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </pre>
      )}
    </div>
  )
}
