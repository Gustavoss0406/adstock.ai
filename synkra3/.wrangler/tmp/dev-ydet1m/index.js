var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-mnG7Vj/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker/index.js
var worker_default = {
  // ── AI Chat Proxy ──
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    try {
      const body = await request.json();
      const temperature = body.temperature ?? 0.7;
      const maxTokens = body.maxTokens ?? 800;
      const model = body.model || "deepseek-v4-pro";
      let messages = [];
      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        messages = body.messages.filter(function(m) {
          return ["system", "user", "assistant"].includes(m.role);
        }).map(function(m) {
          return { role: m.role, content: m.content };
        });
      } else if (typeof body.message === "string") {
        messages = [{ role: "user", content: body.message }];
      }
      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "No valid messages" }), {
          status: 400,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders)
        });
      }
      const response = await fetch(env.OPENCODE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.OPENCODE_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
      });
      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: "Upstream error " + response.status + ": " + errText.slice(0, 200) }),
          {
            status: 502,
            headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders)
          }
        );
      }
      const data = await response.json();
      return new Response(
        JSON.stringify({
          reply: data.choices?.[0]?.message?.content || null,
          usage: data.usage,
          model
        }),
        {
          status: 200,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders)
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message || "Unknown error" }),
        {
          status: 500,
          headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders)
        }
      );
    }
  },
  // ── Cron: Trigger dailies + heartbeat every 5 minutes ──
  async scheduled(_event, env, _ctx) {
    const url = env.SYNKRA_API_URL;
    const secret = env.SYNKRA_API_SECRET;
    if (!url || !secret) {
      console.log("[Cron] SYNKRA_API_URL or SYNKRA_API_SECRET not set \u2014 skipping");
      return;
    }
    try {
      const dailyResp = await fetch(url + "/api/routine/check", {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json"
        }
      });
      if (dailyResp.ok) {
        const data = await dailyResp.json();
        console.log("[Cron] Dailies triggered: " + (data.ran || 0) + " orgs");
      } else {
        console.log("[Cron] Daily check failed: " + dailyResp.status);
      }
    } catch (error) {
      console.log("[Cron] Daily check error: " + (error.message || "Unknown"));
    }
    try {
      const hbResp = await fetch(url + "/api/system/heartbeat-cron", {
        method: "GET",
        headers: {
          "x-api-key": secret,
          "Content-Type": "application/json"
        }
      });
      if (hbResp.ok) {
        const hbData = await hbResp.json();
        console.log("[Cron] Heartbeat: " + (hbData.orgsProcessed || 0) + " orgs, " + (hbData.totalActions || 0) + " actions");
      } else {
        console.log("[Cron] Heartbeat failed: " + hbResp.status);
      }
    } catch (error) {
      console.log("[Cron] Heartbeat error: " + (error.message || "Unknown"));
    }
  }
};

// ../../.nvm/versions/node/v22.18.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.nvm/versions/node/v22.18.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-mnG7Vj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.nvm/versions/node/v22.18.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-mnG7Vj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
