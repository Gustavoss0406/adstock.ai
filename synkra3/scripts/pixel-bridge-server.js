/**
 * ── PIXEL BRIDGE LOCAL SERVER ────────────────────────────────
 *
 * Micro-servidor HTTP que roda na máquina do usuário (porta 3101).
 * Recebe dados de agentes do workspace (adstock.ai) e escreve
 * arquivos JSONL que o Pixel Agents Office (localhost:3100) lê.
 *
 * Uso: node scripts/pixel-bridge-server.js
 */

const http = require("http")
const fs = require("fs")
const path = require("path")
const os = require("os")

const PORT = 3101
const SESSIONS_DIR = path.join(os.homedir(), ".pixel-agents", "sessions")

// Garante que o diretório existe
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
}

function writeJsonlLine(filePath, type, data) {
  const callId = "sk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6)
  const lines = [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", id: callId, name: data.tool || "read", input: data.input || { taskTitle: data.taskTitle || "trabalhando" } }],
        usage: { input_tokens: 300, output_tokens: 150 },
      },
    }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: callId }] } }),
    JSON.stringify({ type: "system", subtype: "turn_duration" }),
  ].join("\n") + "\n"

  if (type === "init") {
    const initLine = JSON.stringify({
      type: "user",
      message: { content: [{ type: "text", text: (data.agentName || "Agent") + " chegou no escritorio." }] },
    }) + "\n"
    fs.writeFileSync(filePath, initLine + lines, "utf-8")
  } else {
    fs.appendFileSync(filePath, lines, "utf-8")
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS)
    res.end()
    return
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, CORS_HEADERS)
    res.end(JSON.stringify({ status: "ok", sessionsDir: SESSIONS_DIR }))
    return
  }

  if (req.method !== "POST") {
    res.writeHead(405, CORS_HEADERS)
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  let body = ""
  req.on("data", chunk => { body += chunk })
  req.on("end", () => {
    try {
      const data = JSON.parse(body)
      const { action, agentId, agentName, organizationId } = data

      if (action === "init" && organizationId) {
        // Get agents from Next.js API and create all session files
        fetch("http://localhost:3000/api/agents/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, action: "init" }),
        }).then(r => r.json()).then(result => {
          console.log("[Bridge] Init:", result.initialized, "agents")
        }).catch(() => {})

        res.writeHead(200, CORS_HEADERS)
        res.end(JSON.stringify({ ok: true, action: "init" }))
        return
      }

      if (action === "pulse" && agentId) {
        const fp = path.join(SESSIONS_DIR, "synkra-" + agentId + ".jsonl")
        writeJsonlLine(fp, "pulse", data)
        console.log("[Bridge] Pulse:", agentName || agentId)
        res.writeHead(200, CORS_HEADERS)
        res.end(JSON.stringify({ ok: true, action: "pulse", agentId }))
        return
      }

      if (action === "init-single" && agentId) {
        const fp = path.join(SESSIONS_DIR, "synkra-" + agentId + ".jsonl")
        writeJsonlLine(fp, "init", data)
        console.log("[Bridge] Init single:", agentName || agentId)
        res.writeHead(200, CORS_HEADERS)
        res.end(JSON.stringify({ ok: true, agentId }))
        return
      }

      if (action === "remove" && agentId) {
        const fp = path.join(SESSIONS_DIR, "synkra-" + agentId + ".jsonl")
        try { fs.unlinkSync(fp); console.log("[Bridge] Removed:", agentId) } catch {}
        res.writeHead(200, CORS_HEADERS)
        res.end(JSON.stringify({ ok: true, removed: true }))
        return
      }

      res.writeHead(400, CORS_HEADERS)
      res.end(JSON.stringify({ error: "Invalid action. Use: init, pulse, init-single, remove" }))
    } catch (err) {
      res.writeHead(400, CORS_HEADERS)
      res.end(JSON.stringify({ error: err.message }))
    }
  })
})

server.listen(PORT, () => {
  console.log("Pixel Bridge Server running on http://localhost:" + PORT)
  console.log("Sessions dir:", SESSIONS_DIR)
  console.log("Actions: init (orgId), pulse (agentId), init-single (agentId+name), remove (agentId)")
})
