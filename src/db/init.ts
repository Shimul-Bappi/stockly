import { pool } from "@/db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'Northstar Goods',
  currency TEXT NOT NULL DEFAULT 'BDT',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Other',
  mrp NUMERIC(12,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
DO $$ BEGIN ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE products ADD CONSTRAINT products_mrp_nonnegative CHECK (mrp >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE products ADD CONSTRAINT products_reorder_nonnegative CHECK (reorder_level >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales(created_at);
CREATE INDEX IF NOT EXISTS sales_product_idx ON sales(product_id);
DO $$ BEGIN ALTER TABLE sales ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL,
  request_id UUID UNIQUE,
  quantity_change INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id);
CREATE TABLE IF NOT EXISTS cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_entries_created_at_idx ON cash_entries(created_at);
DO $$ BEGIN ALTER TABLE cash_entries ADD CONSTRAINT cash_entries_amount_positive CHECK (amount > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS label_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  label_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS label_sheets_created_at_idx ON label_sheets(created_at);
DO $$ BEGIN ALTER TABLE label_sheets ADD CONSTRAINT label_sheets_count_range CHECK (label_count between 1 and 20); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS generated_labels (
  serial BIGSERIAL PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES label_sheets(id),
  position INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  mrp NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS generated_labels_sheet_position_idx ON generated_labels(sheet_id, position);
DO $$ BEGIN ALTER TABLE generated_labels ADD CONSTRAINT generated_labels_position_range CHECK (position between 1 and 20); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE generated_labels ADD CONSTRAINT generated_labels_mrp_positive CHECK (mrp > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

let initialized = false;

export async function ensureSchema(): Promise<void> {
  if (initialized) return;
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    initialized = true;
  } finally {
    client.release();
  }
}
