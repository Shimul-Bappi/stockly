import { sql } from "drizzle-orm";
import { bigserial, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default("Northstar Goods"),
  currency: text("currency").notNull().default("BDT"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  category: text("category").notNull().default("Other"),
  mrp: numeric("mrp", { precision: 12, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("products_category_idx").on(table.category),
  check("products_stock_nonnegative", sql`${table.stock} >= 0`),
  check("products_mrp_nonnegative", sql`${table.mrp} >= 0`),
  check("products_reorder_nonnegative", sql`${table.reorderLevel} >= 0`),
]);

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sales_created_at_idx").on(table.createdAt),
  index("sales_product_idx").on(table.productId),
  check("sales_quantity_positive", sql`${table.quantity} > 0`),
]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  kind: text("kind").notNull(),
  requestId: uuid("request_id").unique(),
  quantityChange: integer("quantity_change").notNull(),
  stockAfter: integer("stock_after").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stock_movements_created_at_idx").on(table.createdAt),
  index("stock_movements_product_idx").on(table.productId),
]);

export const cashEntries = pgTable("cash_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("cash_entries_created_at_idx").on(table.createdAt),
  check("cash_entries_amount_positive", sql`${table.amount} > 0`),
]);

// A separate printing ledger: generating or reprinting a label never changes inventory.
export const labelSheets = pgTable("label_sheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().unique(),
  companyName: text("company_name").notNull(),
  labelCount: integer("label_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("label_sheets_created_at_idx").on(table.createdAt),
  check("label_sheets_count_range", sql`${table.labelCount} between 1 and 20`),
]);

export const generatedLabels = pgTable("generated_labels", {
  serial: bigserial("serial", { mode: "bigint" }).primaryKey(),
  sheetId: uuid("sheet_id").notNull().references(() => labelSheets.id),
  position: integer("position").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  // Link to the catalog product (null for custom labels, which can never change stock).
  productId: uuid("product_id").references(() => products.id),
  mrp: numeric("mrp", { precision: 12, scale: 2 }).notNull(),
  // One label = one physical unit. These make each serial single-use per direction.
  stockedAt: timestamp("stocked_at", { withTimezone: true }),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("generated_labels_sheet_position_idx").on(table.sheetId, table.position),
  check("generated_labels_position_range", sql`${table.position} between 1 and 20`),
  check("generated_labels_mrp_positive", sql`${table.mrp} > 0`),
]);
