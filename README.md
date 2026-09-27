# Stockly

A responsive business workspace for **product inventory, barcode-based stock receiving and sales, independent serial-label generation, cash management, and daily reporting**. Built with Next.js App Router, PostgreSQL, and Drizzle ORM. Prices are in Bangladeshi Taka (৳); business dates follow `Asia/Dhaka`.

> **Deploying to GitHub + Vercel?** Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for the Git commands, hosted PostgreSQL setup, secrets, database schema and verification checklist. Vercel deployments are password-gated by default; hosted databases start empty unless sample data is explicitly enabled. This is a single-workspace password gate, not multi-user role-based authentication.

## Two different barcode workflows

| | Product stock tags | Independent serial labels |
| --- | --- | --- |
| Where | **Products → Print stock scan tags** | **Barcode generator**, or select products on **Products → Barcode generator** |
| Code | Existing stable product barcode (`STK-...` or sample `NSG-...`) | New, individually issued serial (`LBL-0000000001`, `LBL-0000000002`, …) |
| Repeat the same product | Tags intentionally reuse that product's code | Every copy gets a **different** saved serial barcode |
| Stock in / sales scans | **Yes** | **No**: `LBL-...` codes are not recognized as inventory products |
| Stock impact of printing | None | None |
| Paper | Up to 20 stock tags per A4 page, additional pages as needed | **1–20 unique serials maximum on exactly one A4 page** |

### How to generate an independent serial sheet

1. Open **Barcode generator** in the sidebar or from **Products**. Selecting product rows first prefills the sheet; selecting none opens an empty sheet.
2. Pick a catalog product or choose **Custom label** to enter a name and MRP without creating a product. Enter how many labels you need for that item. For example, add **Wireless Headphones × 10** to get **ten different serial barcodes** for the same product.
3. Add more items if needed; the running counter and layout preview show how many of the **20 available positions** are occupied. The server also refuses empty or overfilled sheets.
4. Click **Generate unique barcodes**. PostgreSQL issues a new permanent global serial for **each label**, and saves its product-name/MRP snapshot and sheet/company information in the independent printing ledger. The actual barcode is a Code 128 SVG encoding the `LBL-` serial.
5. Print the A4 sheet at **100% scale, no margins**. Print again from **Saved barcode sheets** to reuse the *same* serials, or **generate another sheet** to issue new serials for those same products. Find an older sheet by entering any `LBL-...` barcode on it in the search box.

Serials are allocated by a PostgreSQL `bigserial` primary key, so concurrent requests and application restarts cannot issue the same number. Sequence gaps can occur after a failed transaction, as with normal database sequences; uniqueness and increasing issuance, **not gap-free numbering**, are the guarantee. The encoded `LBL-` code is deterministically derived from that stored serial. The label tables contain printed snapshots and **have no foreign key to products, sales, or stock movements**. Merely generating or printing them does not add to or remove from stock. The `LBL-` prefix is reserved and explicitly rejected by Stock in and Sales—even if someone attempts to enter one as a product SKU.

To use phone scanning for inventory, print **stock scan tags** from Products instead. These reuse the existing product code so every identical unit resolves to the same product in the stock and sales workflows.

## Other capabilities

- **Products:** company name in Settings; create/edit product name, SKU, category, MRP, reorder threshold; a stable product barcode is automatically created with each catalog item. Products start with zero stock.
- **Stock in:** scan a product tag with a phone's rear camera or type its barcode/SKU. A receipt increases on-hand stock and records an auditable movement with note and resulting quantity.
- **Sales:** scan a product tag, choose quantity and payment method (Cash, Card, bKash, Bank transfer). The transaction records a price snapshot and decreases available stock, rejecting a sale that would oversell.
- **Overview:** monthly revenue, sold units, current stock, alerts, revenue chart, stock health, and recent sales.
- **Reports:** choose a business day to compare revenue, units sold, receipts and closing stock per product. Export a daily CSV.
- **Cashbook:** monthly revenue and expenses, cash-only balance/flow, payment breakdown, and manual income/expense entries.
- **Live UI:** actions return refreshed data immediately; visible tabs poll every 15 seconds for updates made on other devices.

## Run locally

Requirements: **Node.js 20+**, npm and PostgreSQL.

```bash
npm install
cp .env.example .env
# Create your PostgreSQL database and set DATABASE_URL in .env.
npx drizzle-kit push
npm run dev
```

Open `http://localhost:3000`. In local development, an empty catalog gets illustrative sample data unless `SEED_DEMO_DATA=false`. A Vercel database is **not** seeded automatically: start with your real company settings and products, or use `SEED_DEMO_DATA=true` only on a disposable demo database. Phone-camera permission requires **HTTPS in production** (localhost works for development). Use **Products → Print stock scan tags** to test receiving and sales; use **Barcode generator** to test independent serial sheets.

```bash
npm run build
npm run start
```

On Vercel, use a hosted PostgreSQL `DATABASE_URL` (pooled) and run Drizzle Kit once against `DATABASE_URL_UNPOOLED` (direct) before serving requests. Set `STOCKLY_ADMIN_PASSWORD` and `STOCKLY_SESSION_SECRET` in Vercel, never in GitHub. See [DEPLOYMENT.md](./DEPLOYMENT.md) for exact steps; never commit `.env`.

## Architecture and data safety

```text
Responsive Next.js + React client
  ├── html5-qrcode: local camera decoding of product Code 128 tags
  ├── JsBarcode: vector SVG tags and independent serial labels
  └── responsive A4 4 × 5 print layout
                   │
                   ▼
        /api/workspace (validated writes + fresh reads)
        /api/label-sheets (read-only saved-sheet lookup)
                   │
                   ▼
            Drizzle ORM + PostgreSQL
            ├── inventory: products ↔ sales ↔ stock_movements
            ├── money: cash_entries + company_settings
            └── printing: label_sheets → generated_labels
                      (no link to inventory ledger)
```

- **Hosted access:** A Vercel deployment requires a password and random session secret. The server redirects unauthenticated page requests to sign-in and returns 401 for protected API calls; cookies are signed, HTTP-only, SameSite=Strict and Secure on Vercel. A missing configuration returns 503 instead of exposing data. This is a single shared workspace, not individual user accounts.
- **Server-side authority:** Zod validates every action. The database, not the browser, determines product price and stock. Catalog details are read once and snapshotted into independently generated labels. Custom labels can be created without catalog products.
- **Unique serials and concurrency:** The `generated_labels.serial` database primary key backs each unique `LBL-...` barcode. Sheet creation and all 1–20 labels are inserted in one transaction. A unique request ID makes a retried generation idempotent instead of silently allocating duplicate sheets.
- **Reliable inventory:** Receipt/sale transactions lock the product row (`SELECT ... FOR UPDATE`). Updates, sales and movements commit together; stock cannot drop below zero. Inventory endpoints look up **only** the product barcode or SKU, never independent serial labels.
- **Stable reprints:** Sheets store company name; labels store item name, SKU if from catalog, and MRP at generation time. Reprinting the sheet uses the same codes and snapshots even if product details change later.
- **Responsive UI:** persistent desktop sidebar; mobile drawer; stacked cards, touch-friendly controls, camera-first checkout and manual barcode entry. Printed label sheets are isolated from dashboard styles.
- **Reporting:** timestamps use timezone-aware PostgreSQL columns. Daily/monthly grouping follows `Asia/Dhaka`. Sales snapshot `numeric(12,2)` prices to keep historical revenue accurate.

## Data model

| Table | Contents |
| --- | --- |
| `company_settings` | Business name and currency. |
| `products` | Product SKU, stable stock-scan barcode, MRP, reorder threshold, current stock. |
| `sales` | Sale quantity, unit-price snapshot, total, payment, timestamp. |
| `stock_movements` | Signed opening/receipt/sale adjustment, resulting stock, request ID. |
| `cash_entries` | Other income and expenses, separate from automatically recorded sales. |
| `label_sheets` | Independent A4 sheet, count (database check: **1–20**), business-name snapshot, idempotency ID. |
| `generated_labels` | Unique PostgreSQL serial, A4 position (database check: **1–20**), printed product/MRP snapshot. References only `label_sheets`. |

**Cash definitions:** Monthly revenue includes all sales regardless of method. Estimated cash balance = all Cash sales + manually recorded other income − manual expenses. Card, bKash and bank transfers are revenue but not physical cash balance. If migrating a real shop, add a dedicated opening-cash transaction and reconciliation workflow.

**Report definitions:** Daily revenue/units sold come from sales; stock received from positive `stock_in` movements; closing stock is the last saved `stockAfter` on or before the selected day. Independent labels do **not** appear in reports or affect any stock calculation.

## API

On Vercel, business endpoints require a signed session cookie. Unauthorized reads and writes return 401; the health endpoint is intentionally public and contains no business data.

- `POST /api/auth/login` / `POST /api/auth/logout`: sign in and clear the session.
- `GET /api/workspace`: latest workspace data, including the 30 most recent saved label sheets and their serials.
- `POST /api/workspace`: validated `createProduct`, `updateProduct`, `stockIn`, `recordSale`, `addCashEntry`, `updateSettings`, and independent `createLabelSheet` actions. A sheet request includes `requestId` and 1–20 items in total, each either `{source:"catalog",productId,quantity}` or `{source:"custom",name,mrp,quantity}`.
- `GET /api/label-sheets?code=LBL-0000000001`: find the saved sheet containing that serial for reprinting. Also supports `?id=<sheet UUID>`.
- `GET /api/health`: PostgreSQL-backed health check.

## Practical next steps for production

1. Define labels/printer dimensions, test real Code 128 tags with the shop's phones and A4 stock, confirm tax/discount rules and receipt needs.
2. Replace the shared-password gate with per-employee accounts, role-based permissions and audit attribution; add login rate limiting, regular backups and database access reviews. Use Vercel's HTTPS and a separate database for Preview deployments.
3. Add checkout carts, returns/refunds as reversing transactions, purchase orders, stock adjustments and optional multiple locations.
4. At high scale, paginate transaction and sheet history, aggregate large reports in SQL, and replace visible-tab polling with authenticated SSE or WebSockets.
5. Test concurrent label issuance, request replay, the 1/20/21 boundary, cross-session reprints, no inventory mutation, concurrent sales, timezone reports and physical A4 printing on mobile/desktop.

Technology: **Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM, Zod, Tailwind CSS 4 + focused CSS, JsBarcode (Code 128), html5-qrcode, Lucide icons, locally bundled fonts.**
