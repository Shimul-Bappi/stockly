import { db } from "@/db";
import { generatedLabels, labelSheets } from "@/db/schema";
import type { GeneratedLabel, LabelSheet } from "@/lib/types";
import { asc, desc, eq, inArray } from "drizzle-orm";

// This namespace is deliberately different from product barcodes (STK-/NSG-).
// The PostgreSQL bigserial is the unique, durable source of truth; gaps are normal.
export function barcodeForSerial(serial: bigint | string): string {
  return `LBL-${String(serial).padStart(10, "0")}`;
}

async function populateSheets(rows: (typeof labelSheets.$inferSelect)[]): Promise<LabelSheet[]> {
  if (!rows.length) return [];
  const labels = await db.select().from(generatedLabels)
    .where(inArray(generatedLabels.sheetId, rows.map((row) => row.id)))
    .orderBy(asc(generatedLabels.position));
  const bySheet = new Map<string, GeneratedLabel[]>();
  for (const label of labels) {
    const item: GeneratedLabel = {
      serial: String(label.serial),
      barcode: barcodeForSerial(label.serial),
      position: label.position,
      productName: label.productName,
      sku: label.sku,
      mrp: Number(label.mrp),
    };
    const group = bySheet.get(label.sheetId) ?? [];
    group.push(item);
    bySheet.set(label.sheetId, group);
  }
  return rows.map((row) => ({
    id: row.id,
    companyName: row.companyName,
    labelCount: row.labelCount,
    createdAt: row.createdAt.toISOString(),
    labels: bySheet.get(row.id) ?? [],
  }));
}

export async function getRecentLabelSheets(): Promise<LabelSheet[]> {
  const rows = await db.select().from(labelSheets).orderBy(desc(labelSheets.createdAt), desc(labelSheets.id)).limit(30);
  return populateSheets(rows);
}

export async function getLabelSheet(id: string): Promise<LabelSheet | null> {
  const [row] = await db.select().from(labelSheets).where(eq(labelSheets.id, id)).limit(1);
  if (!row) return null;
  return (await populateSheets([row]))[0];
}

export async function findLabelSheetByBarcode(value: string): Promise<LabelSheet | null> {
  const match = /^(?:LBL-)?(\d{1,19})$/i.exec(value.trim());
  if (!match) return null;
  const serial = BigInt(match[1]);
  if (serial <= BigInt(0) || serial > BigInt("9223372036854775807")) return null;
  const [label] = await db.select({ sheetId: generatedLabels.sheetId })
    .from(generatedLabels).where(eq(generatedLabels.serial, serial)).limit(1);
  return label ? getLabelSheet(label.sheetId) : null;
}
