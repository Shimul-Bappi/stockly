# Deploy Stockly with GitHub + Vercel

Stockly is a **full-stack Next.js application**, not a static website. GitHub stores the source; Vercel runs the Next.js pages and API; a **hosted PostgreSQL database** holds products, stock history, sales, cash entries and permanent label serials. GitHub Pages alone cannot run it. For PostgreSQL, [Neon](https://neon.com/) is a convenient choice; Vercel's [Neon Marketplace integration](https://neon.com/docs/guides/vercel-managed-integration) can also provide its connection variables.

## 1. Put the source on GitHub

Make a new **empty** GitHub repository (for example `stockly`; do not initialize it with another README). In this project's root folder, run:

```bash
git init -b main
git add .
git status --short     # verify .env, .env.production.local, node_modules and .next are absent
git commit -m "Initial Stockly application"
git remote add origin https://github.com/YOUR_USERNAME/stockly.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Sign in to GitHub when Git prompts you. `package-lock.json` **should** be committed, but `.env` and all `.env.*` files except `.env.example` must not be. `.gitignore` also excludes `.vercel/`. Each later push to `main` can trigger a new Vercel production deployment. `.github/workflows/ci.yml` checks types, lint and the build without accessing your real database.

## 2. Create a hosted PostgreSQL database

**Recommended first-deployment route:** Create a project at [Neon Console](https://console.neon.tech/), choose a region close to your Vercel Functions region, and open **Connect**. Copy **both** URLs for the **same database/branch**:

- **Pooled connection** (hostname typically contains `-pooler`) → `DATABASE_URL`, used by the running app.
- **Direct/unpooled connection** → `DATABASE_URL_UNPOOLED`, used by Drizzle Kit to create/update tables. Include `sslmode=require` as provided by Neon.

You can alternatively create a Neon database through **Vercel → Storage / Marketplace → Neon Postgres** and connect it to the Vercel project. This integration typically sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically. If you create the Vercel project first without any database variable, its initial build may fail with `DATABASE_URL is required`; connect the database and **redeploy**. Do not use the local `127.0.0.1` connection string on Vercel: it points to Vercel's own function instance, not your computer.

### Initialize the database once

Before using the hosted site, apply the tables and indexes to the **hosted** database. On your own computer, make an ignored `.env.production.local` file with your two real Neon URLs:

```text
DATABASE_URL=postgresql://...-pooler.../DATABASE?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../DATABASE?sslmode=require
```

Then, using Node.js 22 and the project's installed dependencies:

```bash
npm ci
node --env-file=.env.production.local ./node_modules/drizzle-kit/bin.cjs push
```

**Double-check which database you are targeting before approving a Drizzle schema change.** This app intentionally does **not** auto-run `drizzle-kit push` during every Vercel build; previews must never silently change a production schema. For later schema changes, back up the database, review the Drizzle diff and apply a reviewed migration or push deliberately. If using Vercel's Neon integration, you can use the Vercel CLI to obtain your own production variables (`npx vercel env pull .env.production.local --environment=production`) and run the same command. The pulled file contains secrets and is already Git-ignored. A separate Neon branch for Preview deployments prevents them from writing to production.

## 3. Set access credentials

Stockly uses one shared workspace password as a minimum protection for a small single-business deployment. Choose a **unique password of at least 12 characters** and generate a separate **random session secret of at least 32 characters**. For example, generate a secret locally:

```bash
openssl rand -hex 32
```

Save the output privately. **Never commit the password or secret or put them in `NEXT_PUBLIC_` variables.** On Vercel, set:

| Variable | Value | Needed where |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL URL | Production; a separate branch/database for Preview |
| `STOCKLY_ADMIN_PASSWORD` | Your long private workspace password | Production; Preview only if you plan to use it |
| `STOCKLY_SESSION_SECRET` | The random secret you generated | Production; separate secret for Preview |
| `DATABASE_URL_UNPOOLED` | Neon direct URL | Needed by your local schema commands; optional on Vercel if not running Drizzle there |
| `SEED_DEMO_DATA` | Leave **unset** for a clean hosted business | Optional `true` only on a disposable demonstration database |

On Vercel, missing or too-short access credentials **fail closed**: the app shows a setup screen and data APIs return 503. After changing Vercel environment variables, **redeploy** so the new values take effect. To revoke every active login, rotate `STOCKLY_SESSION_SECRET` and redeploy. Locally, when neither credential is configured and the app is not running on Vercel, the workspace remains open for development.

> This is a shared-password gate, **not** per-employee login or role-based access. For multiple employees, add a full authentication system with roles and audit attribution. Protect the login endpoint against brute-force attempts with Vercel Firewall/rate limits, use a strong unique password, limit who can view Vercel environment variables, enable database backups and review your access settings.

## 4. Import into Vercel and deploy

1. Visit [vercel.com/new](https://vercel.com/new), connect your GitHub account, select the `stockly` repository and choose **Import**.
2. Use **Next.js** as the framework, repository root `.` and Node.js **22**. Keep the default build command (`npm run build`). No `vercel.json` or static export is required.
3. In **Environment Variables** during import (or **Project → Settings → Environment Variables** afterward), add `DATABASE_URL`, `STOCKLY_ADMIN_PASSWORD` and `STOCKLY_SESSION_SECRET` for **Production**. Use the pooled URL for runtime. If using the Vercel Neon Marketplace integration, connect the database to the project instead of duplicating its generated `DATABASE_URL`.
4. Ensure the database schema was applied in step 2; select **Deploy**. If variables were added after an initial deployment, trigger **Redeploy** from the Deployments tab.
5. Vercel supplies HTTPS. The rear-camera barcode scanner works on HTTPS and on localhost; ordinary HTTP domains cannot obtain camera access.

**Preview deployments:** New branches and pull requests may get their own URLs. Use Neon's Preview Branching integration or a different non-production database and different secrets for Preview, and consider enabling Vercel Deployment Protection. Do not let an untrusted PR or test deployment share your production database. If you only need the `main` site, restrict who can deploy previews.

**Optional domain:** In **Project → Settings → Domains**, add your domain and follow Vercel's DNS instructions. Vercel will provision TLS automatically.

## 5. Verify and operate

1. Visit `https://YOUR-PROJECT.vercel.app/api/health`. It should return `{"ok":true}`. This endpoint tests database connectivity without revealing business data.
2. Visit the main URL. It should take you to **Sign in**. Log in with `STOCKLY_ADMIN_PASSWORD`.
3. With a new hosted database, the dashboard begins empty. Go to **Settings** to set your company name; add a product from **Products**. Print its **stock scan tag** to use Stock in / Sales. Use **Barcode generator** separately for serial-only A4 labels.
4. Sign out and check that `/api/workspace` and `/api/label-sheets?code=LBL-0000000001` return 401. The browser should not reveal data while signed out.
5. Each new commit pushed to `main` runs the GitHub CI workflow and triggers a new Vercel production deployment. Check the Vercel Deployments tab if it fails.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Build says `DATABASE_URL is required` | Set the hosted `DATABASE_URL` in the Vercel project for the correct environment, then redeploy. |
| Login shows "Finish setting up Stockly" | Set both security variables at or above their length requirements; redeploy. |
| `/api/health` returns 500 | Confirm Neon URLs, network access, credentials and TLS settings. Check Vercel Function logs. |
| Health works, workspace reports missing table | Run the Drizzle schema command against the **direct URL for this exact database/branch**. |
| Preview deployment edits live products | Move Preview to an isolated Neon branch/database immediately; never use the production URL for previews. |
| Phone camera unavailable | Use HTTPS, approve camera permission, or enter the product stock barcode/SKU manually. |
| `LBL-...` code rejected at checkout | Correct: independent serial labels do not affect inventory. Print/scan the product's stock tag instead. |

**References:** [Vercel Git deployment](https://vercel.com/docs/deployments/git), [Neon + Vercel integration](https://neon.com/docs/guides/vercel-managed-integration), [Neon + Drizzle connection setup](https://neon.com/docs/guides/drizzle), [Neon Vercel connection guidance](https://neon.com/docs/guides/vercel-connection-methods).
