"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, Barcode, Bell, Boxes, ChartNoAxesCombined, ChevronDown, ChevronRight, CircleAlert, LayoutDashboard, LogOut, Menu, PackagePlus, Printer, Search, Settings2, ShoppingBag, Wallet, X } from "lucide-react";
import { ProductsView, SettingsView } from "@/components/catalog-views";
import { DashboardView } from "@/components/dashboard-view";
import { CashEntryDialog, PrintDialog, ProductDialog, ScanDialog, StockTagDialog, type ProductInput } from "@/components/dialogs";
import { CashbookView, ReportsView } from "@/components/finance-views";
import { LabelGeneratorView } from "@/components/label-generator-view";
import { SalesView, StockInView } from "@/components/operations-views";
import { formatDate, initials } from "@/lib/format";
import type { AppData, LabelItemInput, LabelSheet, Product, ScanMode, View } from "@/lib/types";

const primaryNav = [
  { view: "overview" as View, label: "Overview", icon: LayoutDashboard },
  { view: "products" as View, label: "Products", icon: Boxes },
  { view: "labels" as View, label: "Barcode generator", icon: Barcode },
  { view: "stock-in" as View, label: "Stock in", icon: PackagePlus },
  { view: "sales" as View, label: "Sales", icon: ShoppingBag },
  { view: "reports" as View, label: "Reports", icon: ChartNoAxesCombined },
];
const secondaryNav = [
  { view: "cashbook" as View, label: "Cashbook", icon: Wallet },
  { view: "settings" as View, label: "Settings", icon: Settings2 },
];
const validViews: View[] = ["overview", "products", "labels", "stock-in", "sales", "reports", "cashbook", "settings"];

type ApiResponse = { data?: AppData; result?: { message: string; sheetId?: string }; error?: string };

export function AppShell({ initialData, initialView, canSignOut }: { initialData: AppData; initialView: View; canSignOut: boolean }) {
  const [data, setData] = useState(initialData);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to sign out");
      window.location.replace("/login");
    } catch {
      setSigningOut(false);
      setToast({ message: "Could not sign out. Please try again.", type: "error" });
    }
  };
  const [view, setView] = useState<View>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [productDialog, setProductDialog] = useState<Product | "new" | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  const [prefillIds, setPrefillIds] = useState<string[]>([]);
  const [printSheet, setPrintSheet] = useState<LabelSheet | null>(null);
  const [stockTagProducts, setStockTagProducts] = useState<Product[] | null>(null);
  const [cashDialog, setCashDialog] = useState(false);

  const go = useCallback((next: View, selectedIds?: string[]) => {
    if (next === "labels") setPrefillIds(selectedIds ?? []);
    setView(next);
    setMobileOpen(false);
    setNotificationsOpen(false);
    window.history.pushState({ view: next }, "", next === "overview" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPop = () => {
      const value = new URLSearchParams(window.location.search).get("view") as View | null;
      setView(value && validViews.includes(value) ? value : "overview");
      if (value === "labels") setPrefillIds([]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      if (busyRef.current || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.status === 401) { window.location.replace("/login"); return; }
        if (response.ok) {
          const json: ApiResponse = await response.json();
          if (json.data && !busyRef.current) setData(json.data);
        }
      } catch { /* Keep the last known data during a temporary network interruption. */ }
    };
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const postAction = async (payload: Record<string, unknown>): Promise<ApiResponse | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (response.status === 401) { window.location.replace("/login"); return null; }
      const json: ApiResponse = await response.json();
      if (!response.ok || !json.data) throw new Error(json.error || "Unable to save changes");
      setData(json.data);
      setToast({ message: json.result?.message ?? "Saved successfully", type: "success" });
      return json;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Something went wrong", type: "error" });
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const mutate = async (payload: Record<string, unknown>) => Boolean(await postAction(payload));
  const saveProduct = async (input: ProductInput, id?: string) => {
    const okay = await mutate({ action: id ? "updateProduct" : "createProduct", ...(id ? { id } : {}), ...input });
    if (okay && !id) go("products");
    return okay;
  };
  const submitScan = (mode: ScanMode, code: string, quantity: number, paymentMethod: string, note: string) => mutate({
    action: mode === "stock" ? "stockIn" : "recordSale", code, quantity, paymentMethod, note,
    requestId: crypto.randomUUID(),
  });
  const saveCash = (input: { type: "income" | "expense"; category: string; amount: number; note: string }) => mutate({ action: "addCashEntry", ...input });
  const saveSettings = (companyName: string) => mutate({ action: "updateSettings", companyName });
  const generateSheet = async (items: LabelItemInput[], requestId: string): Promise<LabelSheet | null> => {
    const response = await postAction({ action: "createLabelSheet", items, requestId });
    const id = response?.result?.sheetId;
    if (!id) return null;
    const inRecent = response?.data?.labelSheets.find((sheet) => sheet.id === id);
    if (inRecent) return inRecent;
    try {
      const fetched = await fetch(`/api/label-sheets?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json: { sheet?: LabelSheet; error?: string } = await fetched.json();
      if (!fetched.ok || !json.sheet) throw new Error(json.error ?? "Couldn't load the saved sheet");
      return json.sheet;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Couldn't load the saved sheet", type: "error" });
      return null;
    }
  };
  const openSerialPrint = (sheet: LabelSheet) => { setStockTagProducts(null); setPrintSheet(sheet); };
  const openStockPrint = (products: Product[]) => { setPrintSheet(null); setStockTagProducts(products); };

  const lowProducts = data.products.filter((product) => product.stock <= product.reorderLevel);
  const currentLabel = [...primaryNav, ...secondaryNav].find((item) => item.view === view)?.label ?? "Overview";
  const navButton = (item: (typeof primaryNav)[number]) => {
    const Icon = item.icon;
    return <button key={item.view} className={`nav-item ${view === item.view ? "nav-active" : ""}`} onClick={() => go(item.view)}><Icon size={19} strokeWidth={1.85} /><span>{item.label}</span>{item.view === "products" && lowProducts.length > 0 && <span className="nav-count">{lowProducts.length}</span>}</button>;
  };

  return <div className="app-shell">
    {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-icon"><Barcode size={25} strokeWidth={2.4} /></span><span className="brand-word">stockly<span>.</span></span><button className="mobile-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
      <button className="workspace-picker" onClick={() => go("settings")}><span className="workspace-avatar">{initials(data.settings.companyName)}</span><span><strong>{data.settings.companyName}</strong><small>Business workspace</small></span><ChevronDown size={16} /></button>
      <nav className="sidebar-nav" aria-label="Main navigation"><span className="nav-section-label">WORKSPACE</span>{primaryNav.map(navButton)}<span className="nav-section-label nav-section-second">MANAGEMENT</span>{secondaryNav.map(navButton)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-promo"><span className="promo-icon"><Printer size={20} /></span><strong>Every label is unique</strong><p>Create 1–20 new serials on a single A4 sheet.</p><button onClick={() => go("labels")}>Open generator <ArrowRight size={15} /></button></div><div className="sidebar-account"><span className="account-avatar">{initials(data.settings.companyName)}</span><span><strong>Store owner</strong><small>{data.settings.companyName}</small></span><span className="account-online" /></div>{canSignOut && <button className="sidebar-signout" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}</button>}</div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={23} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{currentLabel}</strong></div></div><div className="topbar-right"><div className="global-search"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); if (view !== "products") go("products"); }} placeholder="Search products, barcodes..." aria-label="Search products and barcodes" /><kbd>⌘ K</kbd></div><span className="topbar-divider" /><div className="notification-wrap"><button className="topbar-icon" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={20} />{lowProducts.length > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-head"><strong>Notifications</strong><span>{lowProducts.length} alerts</span></div>{lowProducts.length ? lowProducts.slice(0, 4).map((product) => <button key={product.id} onClick={() => go("products")}><span className="notification-alert"><CircleAlert size={17} /></span><span><strong>{product.name}</strong><small>{product.stock === 0 ? "Out of stock" : `Only ${product.stock} left in stock`}</small></span></button>) : <p className="no-notifications">All caught up. Your stock is looking good!</p>}<button className="notification-footer" onClick={() => go("products")}>View inventory <ArrowRight size={14} /></button></div>}</div><span className="topbar-date">{formatDate(new Date(), { weekday: "short" })}</span><button className="topbar-avatar" onClick={() => go("settings")} aria-label="Open settings">{initials(data.settings.companyName)}</button></div></header>
      <main className="main-content"><div className="content-container">
        {view === "overview" && <DashboardView data={data} onNavigate={go} onScan={setScanMode} onOpenGenerator={() => go("labels")} />}
        {view === "products" && <ProductsView data={data} search={search} onSearchChange={setSearch} onAddProduct={() => setProductDialog("new")} onEditProduct={setProductDialog} onGenerateLabels={(selected) => go("labels", selected.map((product) => product.id))} onPrintStockTags={openStockPrint} />}
        {view === "labels" && <LabelGeneratorView data={data} initialProductIds={prefillIds} busy={busy} onGenerate={generateSheet} onPrint={openSerialPrint} onBack={() => go("products")} />}
        {view === "stock-in" && <StockInView data={data} onScan={setScanMode} onSubmit={submitScan} busy={busy} />}
        {view === "sales" && <SalesView data={data} onScan={setScanMode} onSubmit={submitScan} busy={busy} />}
        {view === "reports" && <ReportsView data={data} />}
        {view === "cashbook" && <CashbookView data={data} onAddEntry={() => setCashDialog(true)} />}
        {view === "settings" && <SettingsView data={data} onSave={saveSettings} busy={busy} />}
        <div className="app-footer"><span>© {new Date().getFullYear()} stockly. Built for better business.</span><span><Activity size={14} /> Your data is up to date</span></div>
      </div></main>
    </div>
    {productDialog && <ProductDialog key={productDialog === "new" ? "new" : productDialog.id} product={productDialog === "new" ? null : productDialog} companyName={data.settings.companyName} onClose={() => setProductDialog(null)} onSave={saveProduct} busy={busy} />}
    {scanMode && <ScanDialog mode={scanMode} data={data} onClose={() => setScanMode(null)} onSubmit={submitScan} busy={busy} />}
    {printSheet && <PrintDialog sheet={printSheet} onClose={() => setPrintSheet(null)} />}
    {stockTagProducts && <StockTagDialog products={stockTagProducts} companyName={data.settings.companyName} onClose={() => setStockTagProducts(null)} />}
    {cashDialog && <CashEntryDialog onClose={() => setCashDialog(false)} onSave={saveCash} busy={busy} />}
    {toast && <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`} role="status"><span>{toast.type === "error" ? <CircleAlert size={18} /> : <Activity size={18} />}</span><strong>{toast.message}</strong><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
  </div>;
}
