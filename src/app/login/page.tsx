import { LoginForm } from "@/components/login-form";
import { pageAccess } from "@/lib/auth";
import { Barcode, CircleAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Stockly", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const access = await pageAccess();
  if (access === "open" || access === "authorized") redirect("/");

  return (
    <main className="login-page">
      <div className="login-shell">
        <div className="login-brand"><span className="login-brand-icon"><Barcode size={25} strokeWidth={2.4} /></span><span>stockly<span>.</span></span></div>
        <div className="login-card">
          <span className="login-card-icon">{access === "misconfigured" ? <CircleAlert size={24} /> : <ShieldCheck size={24} />}</span>
          <div className="eyebrow"><span className="eyebrow-dot" /> PRIVATE WORKSPACE</div>
          {access === "misconfigured" ? <>
            <h1>Finish setting up Stockly</h1>
            <p className="login-intro">This deployment is locked until its security settings are configured. Your business data is not being shown.</p>
            <div className="login-setup-note">
              In Vercel, open <strong>Project Settings → Environment Variables</strong>, set <code>STOCKLY_ADMIN_PASSWORD</code> (at least 12 characters) and <code>STOCKLY_SESSION_SECRET</code> (at least 32 random characters), then redeploy. See <strong>DEPLOYMENT.md</strong> in the repository.
            </div>
          </> : <>
            <h1>Welcome back.</h1>
            <p className="login-intro">Sign in to access your inventory, sales and barcode workspace.</p>
            <LoginForm />
          </>}
        </div>
        <p className="login-footer">Stockly · Your stock and sales stay in your workspace</p>
      </div>
    </main>
  );
}
