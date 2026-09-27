import { apiAccess } from "@/lib/auth";
import { findLabelSheetByBarcode, getLabelSheet } from "@/lib/labels";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = apiAccess(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const sheetId = params.get("id");
  const code = params.get("code");
  if (!sheetId && !code) return Response.json({ error: "Provide a sheet ID or label serial" }, { status: 400 });
  if (sheetId && !z.string().uuid().safeParse(sheetId).success) {
    return Response.json({ error: "Invalid sheet ID" }, { status: 400 });
  }
  if (code && !/^(?:LBL-)?\d{1,19}$/i.test(code.trim())) {
    return Response.json({ error: "Enter a valid serial or LBL barcode" }, { status: 400 });
  }

  try {
    const sheet = sheetId ? await getLabelSheet(sheetId) : await findLabelSheetByBarcode(code!);
    if (!sheet) return Response.json({ error: "No saved sheet found for that serial" }, { status: 404 });
    return Response.json({ sheet }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Label sheet lookup failed", error);
    return Response.json({ error: "Unable to load that label sheet" }, { status: 500 });
  }
}
