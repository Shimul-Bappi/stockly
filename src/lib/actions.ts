import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { cashEntries, companySettings, generatedLabels, labelSheets, products, sales, stockMovements } from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

const productFields = {
  name: z.string().trim().min(2, "Enter a product name").max(120),
  sku: z.string().trim().max(40).refine((value) => !/^LBL-/i.test(value), "LBL- is reserved for independent barcode serials"),
  category: z.string().trim().min(2).max(60),
  mrp: z.number().finite().positive("MRP must be greater than zero").max(100000000),
  reorderLevel: z.number().int().min(0).max(100000),
};

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createProduct"), ...productFields }),
  z.object({ action: z.literal("updateProduct"), id: z.string().uuid(), ...productFields }),
  z.object({ action: z.literal("stockIn"), code: z.string().trim().min(1), quantity: z.number().int().min(1).max(10000), note: z.string().trim().max(200).optional(), requestId: z.string().uuid() }),
  z.object({ action: z.literal("recordSale"), code: z.string().trim().min(1), quantity: z.number().int().min(1).max(10000), paymentMethod: z.enum(["Cash", "Card", "bKash", "Bank transfer"]), requestId: z.string().uuid() }),
  z.object({ action: z.literal("addCashEntry"), type: z.enum(["income", "expense"]), category: z.string().trim().min(2).max(60), amount: z.number().finite().positive().max(100000000), note: z.string().trim().min(2).max(250) }),
  z.object({
    action: z.literal("createLabelSheet"),
    requestId: z.string().uuid(),
    items: z.array(z.discriminatedUnion("source", [
      z.object({ source: z.literal("catalog"), productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }),
      z.object({ source: z.literal("custom"), name: z.string().trim().min(2).max(120), mrp: z.number().finite().positive().max(100000000), quantity: z.number().int().min(1).max(20) }),
    ])).min(1, "Add at least one label").max(20),
  }),
  z.object({ action: z.literal("updateSettings"), companyName: z.string().trim().min(2).max(100) }),
]);

export class ActionError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function performAction(input: z.infer<typeof actionSchema>) {
  if (input.action === "createProduct") {
    const sku = (input.sku || `SKU-${randomBytes(3).toString("hex")}`).toUpperCase();
    const barcode = `STK-${randomBytes(5).toString("hex").toUpperCase()}`;
    const [created] = await db.insert(products).values({
      name: input.name,
      sku,
      barcode,
      category: input.category,
      mrp: input.mrp.toFixed(2),
      reorderLevel: input.reorderLevel,
    }).returning();
    return { message: `${created.name} added to your catalog`, productId: created.id };
  }

  if (input.action === "updateProduct") {
    const [updated] = await db.update(products).set({
      name: input.name,
      sku: input.sku.toUpperCase(),
      category: input.category,
      mrp: input.mrp.toFixed(2),
      reorderLevel: input.reorderLevel,
      updatedAt: new Date(),
    }).where(eq(products.id, input.id)).returning();
    if (!updated) throw new ActionError("Product not found", 404);
    return { message: `${updated.name} updated` };
  }

  if (input.action === "stockIn" || input.action === "recordSale") {
    if (/^LBL-/i.test(input.code)) {
      throw new ActionError("Independent LBL serials do not change stock. Scan a product stock tag instead.");
    }
    return db.transaction(async (tx) => {
      const [product] = await tx.select().from(products)
        .where(or(eq(products.barcode, input.code), eq(products.sku, input.code.toUpperCase())))
        .limit(1).for("update");
      if (!product) throw new ActionError("No product found for that barcode or SKU", 404);

      const [previous] = await tx.select().from(stockMovements).where(eq(stockMovements.requestId, input.requestId)).limit(1);
      if (previous) return { message: "This scan was already recorded", productName: product.name, stockAfter: product.stock, duplicate: true };

      if (input.action === "recordSale" && product.stock < input.quantity) {
        throw new ActionError(`Only ${product.stock} unit${product.stock === 1 ? "" : "s"} of ${product.name} available`, 409);
      }
      const isSale = input.action === "recordSale";
      const newStock = product.stock + (isSale ? -input.quantity : input.quantity);
      await tx.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, product.id));

      if (isSale) {
        await tx.insert(sales).values({
          productId: product.id,
          quantity: input.quantity,
          unitPrice: product.mrp,
          total: (Math.round(Number(product.mrp) * input.quantity * 100) / 100).toFixed(2),
          paymentMethod: input.paymentMethod,
        });
      }
      await tx.insert(stockMovements).values({
        productId: product.id,
        kind: isSale ? "sale" : "stock_in",
        requestId: input.requestId,
        quantityChange: isSale ? -input.quantity : input.quantity,
        stockAfter: newStock,
        note: isSale ? `${input.paymentMethod} sale` : input.note || "Stock received by barcode scan",
      });
      return {
        message: isSale ? `Sale recorded for ${product.name}` : `${input.quantity} ${input.quantity === 1 ? "unit" : "units"} of ${product.name} added`,
        productName: product.name,
        stockAfter: newStock,
        total: isSale ? Number(product.mrp) * input.quantity : undefined,
      };
    });
  }

  if (input.action === "createLabelSheet") {
    const total = input.items.reduce((sum, item) => sum + item.quantity, 0);
    if (total < 1 || total > 20) throw new ActionError("An A4 sheet can contain 1 to 20 unique barcodes");

    return db.transaction(async (tx) => {
      const [previous] = await tx.select({ id: labelSheets.id })
        .from(labelSheets).where(eq(labelSheets.requestId, input.requestId)).limit(1);
      if (previous) return { message: "This sheet was already generated", sheetId: previous.id };

      const catalogIds = [...new Set(input.items.flatMap((item) => item.source === "catalog" ? [item.productId] : []))];
      const catalog = catalogIds.length
        ? await tx.select({ id: products.id, name: products.name, sku: products.sku, mrp: products.mrp })
          .from(products).where(inArray(products.id, catalogIds))
        : [];
      if (catalog.length !== catalogIds.length) throw new ActionError("A selected product is no longer available", 404);
      const byId = new Map(catalog.map((product) => [product.id, product]));
      const [settings] = await tx.select({ companyName: companySettings.companyName }).from(companySettings).limit(1);

      const [sheet] = await tx.insert(labelSheets).values({
        requestId: input.requestId,
        companyName: settings?.companyName ?? "My business",
        labelCount: total,
      }).onConflictDoNothing({ target: labelSheets.requestId }).returning({ id: labelSheets.id });
      if (!sheet) {
        const [existing] = await tx.select({ id: labelSheets.id })
          .from(labelSheets).where(eq(labelSheets.requestId, input.requestId)).limit(1);
        if (!existing) throw new ActionError("Unable to retrieve the generated sheet", 409);
        return { message: "This sheet was already generated", sheetId: existing.id };
      }

      const rows: (typeof generatedLabels.$inferInsert)[] = [];
      for (const item of input.items) {
        const product = item.source === "catalog" ? byId.get(item.productId) : null;
        for (let index = 0; index < item.quantity; index++) {
          rows.push({
            sheetId: sheet.id,
            position: rows.length + 1,
            productName: product ? product.name : item.source === "custom" ? item.name : "",
            sku: product?.sku ?? null,
            mrp: product ? product.mrp : item.source === "custom" ? item.mrp.toFixed(2) : "0.00",
          });
        }
      }
      await tx.insert(generatedLabels).values(rows);
      return { message: `${total} unique barcode${total === 1 ? "" : "s"} generated and saved`, sheetId: sheet.id };
    });
  }

  if (input.action === "addCashEntry") {
    await db.insert(cashEntries).values({
      type: input.type,
      category: input.category,
      amount: input.amount.toFixed(2),
      note: input.note,
    });
    return { message: `${input.type === "income" ? "Income" : "Expense"} recorded successfully` };
  }

  await db.insert(companySettings).values({ id: 1, companyName: input.companyName, currency: "BDT" })
    .onConflictDoUpdate({ target: companySettings.id, set: { companyName: input.companyName, updatedAt: new Date() } });
  return { message: "Business settings saved" };
}
