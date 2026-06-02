interface Env {
  OPENCODE_API_URL: string
  OPENCODE_API_KEY: string
  SYNKRA_API_URL: string
  SYNKRA_API_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    if(request.method === "GET") {
      return new Response("Worker is up", { status: 200, headers: corsHeaders },

    if (request.method === "GET") {
      return new Response("Worker is up", { status: 200, headers: corsHeaders })
    }

    if (!env.OPENCODE_API_URL || !env.OPENCODE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENCODE_API_URL or OPENCODE_API_KEY not set" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      )
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
      const maxTokens = body.maxTokens ?? 800
      const model = body.model || "deepseek-v4-pro"

      let messages: Array<{ role: string; content: string }> = []

      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        // Direct messages array — pass through as-is
        messages = body.messages
          .filter((m) => ["system", "user", "assistant"].includes(m.role))
          .map((m) => ({ role: m.role, content: m.content }))
      } else if (typeof body.message === "string") {
        // CRITICAL: Send everything as user message.
        // DO NOT split [SYSTEM]/[USER] — this triggers meta-analysis behavior.
        // The old worker worked because it sent ALL content as user role.
        messages = [{ role: "user", content: body.message }]
      }

      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "No valid messages" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const response = await fetch(env.OPENCODE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENCODE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return new Response(
          JSON.stringify({ error: `Upstream error ${response.status}: ${errText.slice(0, 200)}` }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders },
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
          model,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      )
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      )
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const url = env.SYNKRA_API_URL
    const secret = env.SYNKRA_API_SECRET

    if (!url || !secret) {
      console.log("[Cron] SYNKRA_API_URL or SYNKRA_API_SECRET not set — skipping")
      return
    }

    // ── 1. Daily check ──────────────────────────────────
    try {
      const dailyResp = await fetch(`${url}/api/routine/check`, {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json",
        },
      })

      if (dailyResp.ok) {
        const data = await dailyResp.json() as { ran: number; orgs?: Array<{ id: string; name: string }> }
        console.log(`[Cron] Dailies triggered: ${data.ran} orgs`, data.orgs?.map(o => o.name).join(", ") || "")
      } else {
        console.log(`[Cron] Daily check failed: ${dailyResp.status}`)
      }
    } catch (error) {
      console.log(`[Cron] Daily check error: ${error instanceof Error ? error.message : "Unknown"}`)
    }

    // ── 2. Server-side heartbeat (agents work continuously) ──
    try {
      const hbResp = await fetch(`${url}/api/system/heartbeat-cron`, {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json",
        },
      })

      if (hbResp.ok) {
        const hbData = await hbResp.json() as { orgsProcessed: number; totalActions: number; totalAgents: number }
        console.log(`[Cron] Heartbeat: ${hbData.orgsProcessed} orgs, ${hbData.totalActions} actions, ${hbData.totalAgents} agents`)
      } else {
        console.log(`[Cron] Heartbeat failed: ${hbResp.status}`)
      }
    } catch (error) {
      console.log(`[Cron] Heartbeat error: ${error instanceof Error ? error.message : "Unknown"}`)
    }
  },
}
