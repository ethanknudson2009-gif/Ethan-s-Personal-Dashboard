import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { bearerToken, hashToken, scopeOf } from "@/lib/tokens";
import { captureStore, createAdminClient } from "@/lib/supabase/admin";
import { buildMcpServer } from "@/lib/mcp/server";

/**
 * /api/mcp — the Claude connector (remote MCP, Streamable HTTP, stateless).
 * Add it on claude.ai → Settings → Connectors → Add custom connector, with
 * the request header "Authorization: Bearer <mcp token from Settings>".
 * Guide: docs/setup/04-claude-connector.md
 */
async function handle(request: Request): Promise<Response> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || scopeOf(token) !== "mcp") {
    return Response.json({ error: "Missing or invalid connector token" }, { status: 401 });
  }
  let owner: { userId: string; tokenId: string } | null;
  try {
    owner = await captureStore(createAdminClient()).findTokenUser(await hashToken(token), "mcp");
  } catch (error) {
    console.error("mcp: token lookup failed", error);
    return Response.json({ error: "Server problem checking the token" }, { status: 500 });
  }
  if (!owner) return Response.json({ error: "That connector token isn't valid (revoked?)" }, { status: 401 });

  await createAdminClient().from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", owner.tokenId);

  // A fresh server per request, built for this one user (stateless: fits Vercel's serverless functions).
  const server = buildMcpServer(owner.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
