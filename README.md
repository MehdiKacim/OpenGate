# OpenGate

A lightweight, provider-agnostic AI gateway.

**Purpose**: normalize, route, adapt.

OpenGate aggregates multiple AI providers behind a single local endpoint, usable by any OpenAI-compatible or Anthropic-compatible client.

---

## Features

- **OpenAI-compatible endpoints**: `GET /v1/models`, `POST /v1/chat/completions`
- **Anthropic-compatible endpoints**: `POST /v1/messages`, `POST /v1/messages/count_tokens`
- **Profile-based routing**: switch between `architect`, `builder`, `commit-writer` profiles
- **Multiple providers**: ChatGPT (Codex), Kimi, local proxies (Ollama, LM Studio, OVMS)
- **Usage tracking**: `GET /_opengate/usage`, `GET /_opengate/providers/{name}/usage`
- **Session-aware routing**: maintains provider affinity across Anthropic-style aliases

---

## Quick Start

```bash
# Install
bun install

# Run the gateway
bun run src/cli.ts serve

# Or use the installed binary
opengate serve
```

The gateway listens on `http://localhost:18765` by default.

---

## Configuration

Create `~/.config/opengate/config.json` (macOS/Linux) or `%APPDATA%\opengate\config.json` (Windows):

```json
{
  "port": 18765,
  "profiles": {
    "architect": {
      "provider": "codex",
      "model": "gpt-5.4",
      "systemPrompt": "Focus on planning and architecture."
    },
    "builder": {
      "provider": "kimi",
      "model": "kimi-for-coding",
      "systemPrompt": "Focus on implementation."
    }
  },
  "local-ollama": {
    "type": "proxy",
    "baseUrl": "http://localhost:11434/v1",
    "models": ["llama3", "mistral"]
  }
}
```

Priority: CLI > ENV > JSON > defaults.

---

## Client Configuration

### OpenAI-compatible (Continue.dev, Roo, OpenWebUI, etc.)

```bash
export OPENAI_BASE_URL="http://localhost:18765/v1"
export OPENAI_API_KEY="anything"
export OPENAI_MODEL="architect"   # or gpt-5.4, kimi-for-coding, etc.
```

### Anthropic-compatible (Claude Code)

```bash
export ANTHROPIC_BASE_URL="http://localhost:18765"
export ANTHROPIC_AUTH_TOKEN="anything"
export ANTHROPIC_MODEL="kimi-for-coding"
```

---

## CLI Commands

```bash
opengate serve                    # Start the gateway
opengate profiles                 # List available profiles
opengate codex auth login         # Authenticate with ChatGPT
opengate kimi auth login          # Authenticate with Kimi
opengate <provider> auth status   # Check auth status
opengate <provider> auth logout   # Clear auth
opengate --version                # Show version
```

---

## Provider Types

### OAuth (ChatGPT, Kimi)

Built-in OAuth flow for ChatGPT (via Codex) and Kimi.

### Proxy (Ollama, LM Studio, OVMS)

Add to `config.json`:

```json
{
  "my-local": {
    "type": "proxy",
    "baseUrl": "http://localhost:11434/v1",
    "models": ["llama3"],
    "allowInvalidCertificates": false
  }
}
```

---

## Architecture

OpenGate uses an adapter pattern:

- **ProviderAdapter** interface: `protocol`, `listModels()`, `complete()`, `usage?()`
- **Legacy bridge**: Anthropic providers are wrapped to support OpenAI requests
- **Routing**: based on `request.model` → provider → `complete()`
- **Profiles**: encapsulate model, provider, prompt, temperature, limits

---

## Philosophy

- Prefer adapter + routing + configuration
- Avoid runtime, GPU manager, scheduler, embedded inference
- External systems remain external
- Not a LiteLLM clone, not an inference runtime

---

## License

MIT
