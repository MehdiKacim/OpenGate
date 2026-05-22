/**
 * Smoke test for OpenGate.
 * Assumes the server is already running (e.g. via `pnpm build && pnpm start`).
 */
const BASE = process.env.OPENGATE_SMOKE_URL || "http://localhost:18765"

async function request(path: string, init?: RequestInit) {
  const url = new URL(path, BASE).toString()
  const res = await fetch(url, init)
  const body = await res.text()
  return { status: res.status, body }
}

async function run() {
  let failed = 0

  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      console.log(`✓ ${name}`)
    } catch (err: any) {
      console.error(`✗ ${name}: ${err?.message || err}`)
      failed++
    }
  }

  await check("GET /_opengate/status", async () => {
    const { status, body } = await request("/_opengate/status")
    if (status !== 200) throw new Error(`status=${status} body=${body}`)
  })

  await check("GET /c/default/v1/models", async () => {
    const { status, body } = await request("/c/default/v1/models")
    if (status !== 200) throw new Error(`status=${status} body=${body}`)
    const json = JSON.parse(body)
    if (!Array.isArray(json.data)) throw new Error("missing data array")
  })

  await check("GET / returns index.html", async () => {
    const { status, body } = await request("/")
    if (status !== 200) throw new Error(`status=${status}`)
    if (!body.includes("<!doctype html") && !body.includes("<html")) {
      throw new Error("expected HTML response")
    }
  })

  // Optional: static provider chat completion (will only work if a static provider is seeded)
  await check("POST /c/default/v1/chat/completions (optional)", async () => {
    const { status, body } = await request("/c/default/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    })
    if (status !== 200) {
      throw new Error(`status=${status} — provider may be missing; this is OK for CI`)
    }
  })

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log("\nAll smoke checks passed")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
