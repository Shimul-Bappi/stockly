import { db } from "@/db";
import { cashEntries, companySettings, products, sales, stockMovements } from "@/db/schema";
import { getRecentLabelSheets } from "@/lib/labels";
import { ensureSeedData } from "@/lib/seed";
import type { AppData } from "@/lib/types";
import { desc, eq } from "drizzle-orm";

export async function getAppData(): Promise<AppData> {
  const hosted = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  if (process.env.SEED_DEMO_DATA === "true" || (!hosted && process.env.SEED_DEMO_DATA !== "false")) {
    await ensureSeedData();
  }

  const [settingsRows, productRows, saleRows, movementRows, cashRows, recentSheets] = await Promise.all([
    db.select().from(companySettings).limit(1),
    db.select().from(products).orderBy(desc(products.createdAt)),
    db.select({ sale: sales, productName: products.name, productSku: products.sku })
      .from(sales).leftJoin(products, eq(sales.productId, products.id)).orderBy(desc(sales.createdAt)).limit(5000),
    db.select({ movement: stockMovements, productName: products.name })
      .from(stockMovements).leftJoin(products, eq(stockMovements.productId, products.id)).orderBy(desc(stockMovements.createdAt)).limit(5000),
    db.select().from(cashEntries).orderBy(desc(cashEntries.createdAt)).limit(2000),
    getRecentLabelSheets(),
  ]);

  return {
    settings: {
      companyName: settingsRows[0]?.companyName ?? "My business",
      currency: settingsRows[0]?.currency ?? "BDT",
    },
    products: productRows.map((product) => ({
      ...product,
      mrp: Number(product.mrp),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
    sales: saleRows.map(({ sale, productName, productSku }) => ({
      ...sale,
      productName: productName ?? "Deleted product",
      productSku: productSku ?? "—",
      unitPrice: Number(sale.unitPrice),
      total: Number(sale.total),
      createdAt: sale.createdAt.toISOString(),
    })),
    movements: movementRows.map(({ movement, productName }) => ({
      ...movement,
      productName: productName ?? "Deleted product",
      createdAt: movement.createdAt.toISOString(),
    })),
    cashEntries: cashRows.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
      createdAt: entry.createdAt.toISOString(),
    })),
    labelSheets: recentSheets,
    serverTime: new Date().toISOString(),
  };
}
