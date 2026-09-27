import { AppShell } from "@/components/app-shell";
import { pageAccess } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import type { View } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const views: View[] = ["overview", "products", "labels", "stock-in", "sales", "reports", "cashbook", "settings"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const access = await pageAccess();
  if (access === "unauthorized" || access === "misconfigured") redirect("/login");

  const params = await searchParams;
  const initialView = views.includes(params.view as View) ? params.view as View : "overview";
  const data = await getAppData();
  return <AppShell initialData={data} initialView={initialView} canSignOut={access === "authorized"} />;
}
