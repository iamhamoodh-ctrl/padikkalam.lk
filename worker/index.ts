import { independent } from "./independent";
import { studyApi } from "./study-api";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    const hosted = (request:Request) => {
    const path=new URL(request.url).pathname;
    if(env.PADIKKALAM_DEPLOYMENT==="standalone" && env.ASSETS && (path.startsWith("/downloads/")||path.startsWith("/samples/")))return env.ASSETS.fetch(request);
    if (path.startsWith("/api/"))
      return studyApi(request, env as any).catch(() =>
        Response.json(
          { error: "Could not complete the request. Please try again." },
          { status: 500 },
        ),
      );
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt)
            return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: "request_context_expired",
              message: "This request has expired. Please try again.",
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () =>
      handler.fetch(request, env, ctx),
    );
    };
    return env.PADIKKALAM_DEPLOYMENT==="standalone"?independent(request,env,hosted):hosted(request);
  },
};

export default worker;
