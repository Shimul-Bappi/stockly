import { actionSchema, ActionError, performAction } from "@/lib/actions";
import { apiAccess, isSameOrigin } from "@/lib/auth";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = apiAccess(request);
  if (denied) return denied;
  try {
    const data = await getAppData();
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Workspace GET failed", error);
    return Response.json({ error: "Unable to load workspace data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = apiAccess(request);
  if (denied) return denied;
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const result = await performAction(parsed.data);
    const data = await getAppData();
    return Response.json({ result, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ActionError) return Response.json({ error: error.message }, { status: error.status });
    const pgError = error as { code?: string; cause?: { code?: string } };
    if (pgError.code === "23505" || pgError.cause?.code === "23505") {
      return Response.json({ error: "That SKU or barcode is already in use" }, { status: 409 });
    }
    console.error("Workspace POST failed", error);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
