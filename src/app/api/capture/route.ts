import { handleCapture, MAX_BODY_BYTES } from "@/lib/capture/handle";
import { captureStore, createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/capture — where the iPhone "Log It" Shortcut sends what you said.
 * Needs "Authorization: Bearer <your capture token>" (Settings → Connections).
 * JSON body format: docs/07-architecture.md §6.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES * 2) {
    return Response.json({ ok: false, error: "Too much text in one capture." }, { status: 413 });
  }
  try {
    const result = await handleCapture(
      { authorization: request.headers.get("authorization"), bodyText: await request.text(), now: new Date() },
      captureStore(createAdminClient()),
    );
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("capture failed", error);
    return Response.json({ ok: false, error: "Something went wrong saving that. Try again." }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ ok: false, error: "Send captures with POST." }, { status: 405 });
}
