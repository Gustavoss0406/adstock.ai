interface Env {
  OPENCODE_API_URL: string
  OPENCODE_API_KEY: string
  SYNKRA_API_URL: string
  SYNKRA_API_SECRET: string
}

export default {
  // ── AI Chat Proxy ──
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    try {
      const body = await request.json() as {
        message?: string
        messages?: Array<{ role: string; content: string }>
        temperature?: number
        maxTokens?: number
        model?: string
      }

      const temperature = body.temperature ?? 0.7
      const requestedMaxTokens = body.maxTokens ?? 800
      const requestedModel = body.model || "deepseek-v4-pro"

      // ── AUTO-MODEL: deepseek-v4-pro precisa de 1500+ tokens ──
      // Com menos de 1500 ele gasta tudo em reasoning e retorna null.
      // Auto-switch para glm-5.1 (rápido, sem overhead de reasoning).
      const model = requestedModel === "deepseek-v4-pro" && requestedMaxTokens < 1500
        ? "glm-5.1"
        : requestedModel
      const maxTokens = Math.max(requestedMaxTokens, 200)

      let messages: Array<{ role: string; content: string }> = []

      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        messages = body.messages
          .filter(function (m) { return ["system", "user", "assistant"].includes(m.role) })
          .map(function (m) { return { role: m.role, content: m.content } })
      } else if (typeof body.message === "string") {
        // TUDO como user message — NUNCA fazer split [SYSTEM]/[USER]
        // Isso evita meta-texto ("O usuário quer...") no deepseek-v4-pro
        messages = [{ role: "user", content: body.message }]
      }

      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "No valid messages" }), {
          status: 400,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders),
        })
      }

      const response = await fetch(env.OPENCODE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.OPENCODE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return new Response(
          JSON.stringify({ error: "Upstream error " + response.status + ": " + errText.slice(0, 200) }),
          {
            status: 502,
            headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders),
          },
        )
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { total_tokens: number }
      }

      return new Response(
        JSON.stringify({
          reply: data.choices?.[0]?.message?.content || null,
          usage: data.usage,
          model: model,
        }),
        {
          status: 200,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders),
        },
      )
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || "Unknown error" }),
        {
          status: 500,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders),
        },
      )
    }
  },

  // ── Cron: Trigger dailies + heartbeat every 5 minutes ──
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const url = env.SYNKRA_API_URL
    const secret = env.SYNKRA_API_SECRET

    if (!url || !secret) {
      console.log("[Cron] SYNKRA_API_URL or SYNKRA_API_SECRET not set — skipping")
      return
    }

    // 1. Daily check
    try {
      const dailyResp = await fetch(url + "/api/routine/check", {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json",
        },
      })

      if (dailyResp.ok) {
        const data = await dailyResp.json() as { ran: number; orgs?: Array<{ id: string; name: string }> }
        console.log("[Cron] Dailies triggered: " + (data.ran || 0) + " orgs")
      } else {
        console.log("[Cron] Daily check failed: " + dailyResp.status)
      }
    } catch (error: any) {
      console.log("[Cron] Daily check error: " + (error.message || "Unknown"))
    }

    // 2. Server heartbeat (agents work continuously)
    try {
      const hbResp = await fetch(url + "/api/system/heartbeat-cron", {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json",
        },
      })

      if (hbResp.ok) {
        const hbData = await hbResp.json() as { orgsProcessed: number; totalActions: number; totalAgents: number }
        console.log("[Cron] Heartbeat: " + (hbData.orgsProcessed || 0) + " orgs, " + (hbData.totalActions || 0) + " actions")
      } else {
        console.log("[Cron] Heartbeat failed: " + hbResp.status)
      }
    } catch (error: any) {
      console.log("[Cron] Heartbeat error: " + (error.message || "Unknown"))
    }
  },
}
