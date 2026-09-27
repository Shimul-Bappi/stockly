import { db } from "@/db";
import { cashEntries, companySettings, products, sales, stockMovements } from "@/db/schema";
import { sql } from "drizzle-orm";

const catalog = [
  { name: "Wireless Headphones", sku: "AUD-001", barcode: "NSG-100001", category: "Electronics", mrp: "2450.00", stock: 48, reorderLevel: 12 },
  { name: "Ceramic Coffee Mug", sku: "HOM-002", barcode: "NSG-100002", category: "Home & Living", mrp: "650.00", stock: 9, reorderLevel: 10 },
  { name: "Adjustable Desk Lamp", sku: "HOM-003", barcode: "NSG-100003", category: "Home & Living", mrp: "1850.00", stock: 32, reorderLevel: 10 },
  { name: "Canvas Tote Bag", sku: "ACC-004", barcode: "NSG-100004", category: "Accessories", mrp: "890.00", stock: 18, reorderLevel: 10 },
  { name: "Premium Notebook Set", sku: "STA-005", barcode: "NSG-100005", category: "Stationery", mrp: "420.00", stock: 67, reorderLevel: 15 },
  { name: "Bluetooth Speaker", sku: "AUD-006", barcode: "NSG-100006", category: "Electronics", mrp: "3200.00", stock: 4, reorderLevel: 8 },
  { name: "Insulated Water Bottle", sku: "ACC-007", barcode: "NSG-100007", category: "Accessories", mrp: "1150.00", stock: 25, reorderLevel: 10 },
  { name: "USB-C Charging Cable", sku: "ELE-008", barcode: "NSG-100008", category: "Electronics", mrp: "550.00", stock: 120, reorderLevel: 20 },
  { name: "Leather Card Holder", sku: "ACC-009", barcode: "NSG-100009", category: "Accessories", mrp: "1490.00", stock: 7, reorderLevel: 10 },
];

// Seed once, under a PostgreSQL advisory lock so simultaneous first visitors cannot create duplicate demo data.
export async function ensureSeedData() {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(72481001)`);
    const again = await tx.select({ id: products.id }).from(products).limit(1);
    if (again.length) return;

    await tx.insert(companySettings).values({ id: 1, companyName: "Northstar Goods", currency: "BDT" }).onConflictDoNothing();
    const inserted = await tx.insert(products).values(catalog.map((item) => ({ ...item }))).returning();
    const bySku = new Map(inserted.map((product) => [product.sku, product]));
    const now = new Date();
    const atDaysAgo = (days: number, hour = 12, minute = 0) => {
      const date = new Date(now);
      date.setDate(date.getDate() - days);
      date.setHours(hour, minute, 0, 0);
      return date;
    };

    type DemoEvent = { productIndex: number; day: number; date: Date; kind: "sale" | "stock_in"; quantity: number; payment?: string };
    const events: DemoEvent[] = [];
    for (let day = 145; day >= 0; day -= 2) {
      const index = (day * 7 + 3) % catalog.length;
      events.push({ productIndex: index, day, date: atDaysAgo(day, 10 + (day % 7), (day * 13) % 60), kind: "sale", quantity: day % 5 === 0 ? 2 : 1, payment: day % 4 === 0 ? "bKash" : day % 3 === 0 ? "Card" : "Cash" });
      if (day % 6 === 0) {
        events.push({ productIndex: (index + 4) % catalog.length, day, date: atDaysAgo(day, 15, (day * 11) % 60), kind: "sale", quantity: day % 12 === 0 ? 2 : 1, payment: day % 4 === 0 ? "Cash" : "bKash" });
      }
    }
    events.push(
      { productIndex: 0, day: 0, date: new Date(now.getTime() - 3 * 60 * 60 * 1000), kind: "sale", quantity: 1, payment: "Cash" },
      { productIndex: 3, day: 0, date: new Date(now.getTime() - 75 * 60 * 1000), kind: "sale", quantity: 2, payment: "bKash" },
      { productIndex: 6, day: 0, date: new Date(now.getTime() - 8 * 60 * 1000), kind: "sale", quantity: 1, payment: "Card" },
      { productIndex: 0, day: 18, date: atDaysAgo(18, 9), kind: "stock_in", quantity: 25 },
      { productIndex: 4, day: 12, date: atDaysAgo(12, 11), kind: "stock_in", quantity: 40 },
      { productIndex: 7, day: 6, date: atDaysAgo(6, 10), kind: "stock_in", quantity: 50 },
      { productIndex: 2, day: 3, date: atDaysAgo(3, 14), kind: "stock_in", quantity: 16 },
    );
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    const opening = catalog.map((item, index) => item.stock + events.filter((e) => e.productIndex === index && e.kind === "sale").reduce((sum, e) => sum + e.quantity, 0) - events.filter((e) => e.productIndex === index && e.kind === "stock_in").reduce((sum, e) => sum + e.quantity, 0));
    const running = [...opening];

    await tx.insert(stockMovements).values(catalog.map((item, index) => ({
      productId: bySku.get(item.sku)!.id,
      kind: "opening",
      quantityChange: opening[index],
      stockAfter: opening[index],
      note: "Opening inventory",
      createdAt: atDaysAgo(150, 9),
    })));

    const saleRows = [];
    const movementRows = [];
    for (const event of events) {
      const product = bySku.get(catalog[event.productIndex].sku)!;
      const change = event.kind === "sale" ? -event.quantity : event.quantity;
      running[event.productIndex] += change;
      if (event.kind === "sale") {
        saleRows.push({
          productId: product.id,
          quantity: event.quantity,
          unitPrice: product.mrp,
          total: (Number(product.mrp) * event.quantity).toFixed(2),
          paymentMethod: event.payment!,
          createdAt: event.date,
        });
      }
      movementRows.push({
        productId: product.id,
        kind: event.kind,
        quantityChange: change,
        stockAfter: running[event.productIndex],
        note: event.kind === "sale" ? "Barcode sale" : "New stock received",
        createdAt: event.date,
      });
    }
    await tx.insert(sales).values(saleRows);
    await tx.insert(stockMovements).values(movementRows);
    await tx.insert(cashEntries).values([
      { type: "expense", category: "Rent", amount: "12000.00", note: "Monthly shop rent", createdAt: atDaysAgo(5, 11) },
      { type: "expense", category: "Supplies", amount: "1850.00", note: "Packaging and supplies", createdAt: atDaysAgo(3, 14) },
      { type: "income", category: "Other income", amount: "1500.00", note: "Display space rental", createdAt: atDaysAgo(2, 12) },
      { type: "expense", category: "Utilities", amount: "2200.00", note: "Electricity and internet", createdAt: atDaysAgo(9, 10) },
      { type: "expense", category: "Transport", amount: "720.00", note: "Delivery charges", createdAt: atDaysAgo(1, 16) },
    ]);
  });
}
