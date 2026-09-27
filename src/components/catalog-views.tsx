"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Barcode, Check, ChevronDown, CircleHelp, Edit3, Globe2, Plus, Printer, Search, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { AppData, Product } from "@/lib/types";
import { money } from "@/lib/format";
import { EmptyState, PageHeading, ProductThumb, StockBadge } from "@/components/ui-parts";

type ProductsProps = {
  data: AppData;
  search: string;
  onSearchChange: (value: string) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onGenerateLabels: (products: Product[]) => void;
  onPrintStockTags: (products: Product[]) => void;
};

export function ProductsView({ data, search, onSearchChange, onAddProduct, onEditProduct, onGenerateLabels, onPrintStockTags }: ProductsProps) {
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All stock");
  const [selected, setSelected] = useState<string[]>([]);
  const categories = ["All categories", ...Array.from(new Set(data.products.map((product) => product.category))).sort()];
  const filtered = useMemo(() => data.products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku} ${product.barcode}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All categories" || product.category === category;
    const matchesStatus = status === "All stock" || (status === "In stock" && product.stock > product.reorderLevel) || (status === "Low stock" && product.stock > 0 && product.stock <= product.reorderLevel) || (status === "Out of stock" && product.stock === 0);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [data.products, search, category, status]);
  const allSelected = filtered.length > 0 && filtered.every((product) => selected.includes(product.id));
  const toggleAll = () => setSelected(allSelected ? selected.filter((id) => !filtered.some((product) => product.id === id)) : Array.from(new Set([...selected, ...filtered.map((product) => product.id)])));
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const selectedProducts = selected.length ? data.products.filter((product) => selected.includes(product.id)) : [];

  return (
    <div className="view-content">
      <PageHeading eyebrow="YOUR CATALOG" title="Products" subtitle="All your products, prices, and stock levels in one place." actions={<><button className="btn btn-secondary" onClick={() => onGenerateLabels(selectedProducts)}><Barcode size={17} /> Barcode generator{selected.length ? ` (${selected.length})` : ""}</button><button className="btn btn-primary" onClick={onAddProduct}><Plus size={18} /> Add product</button></>} />
      <div className="catalog-summary"><div className="catalog-summary-icon"><Barcode size={21} /></div><div><strong>{data.products.length} products in your catalog</strong><p>Catalog barcodes are for stock scans. Select rows to prefill independent serial labels.</p></div><button type="button" className="catalog-stock-action" onClick={() => onPrintStockTags(selectedProducts.length ? selectedProducts : filtered)} disabled={!(selectedProducts.length || filtered.length)}><Printer size={15} /> Print stock scan tags</button><span className="catalog-summary-count">{data.products.reduce((sum, item) => sum + item.stock, 0).toLocaleString()} units on hand</span></div>
      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div className="catalog-toolbar-title"><h2>All products</h2><span>{filtered.length}</span></div><div className="catalog-controls"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search name, SKU, barcode..." aria-label="Search products" /></div><label className="select-wrap"><SlidersHorizontal size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category">{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label><label className="select-wrap stock-filter"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter stock status">{["All stock", "In stock", "Low stock", "Out of stock"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div></div>
        {filtered.length ? <div className="table-scroll"><table className="data-table product-table"><thead><tr><th className="check-col"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible products" /></th><th>PRODUCT</th><th>CATEGORY</th><th>BARCODE</th><th>MRP</th><th>STOCK</th><th>STATUS</th><th className="edit-col" /></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td className="check-col"><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} aria-label={`Select ${product.name}`} /></td><td><div className="product-cell"><ProductThumb product={product} /><span><strong>{product.name}</strong><small>SKU: {product.sku}</small></span></div></td><td><span className="category-pill">{product.category}</span></td><td><span className="barcode-cell"><Barcode size={16} />{product.barcode}</span></td><td className="amount-cell">{money(product.mrp)}</td><td><div className="stock-cell"><strong>{product.stock}</strong><div className="stock-track"><span style={{ width: `${Math.min(100, Math.max(3, (product.stock / Math.max(product.reorderLevel * 3, 1)) * 100))}%`, background: product.stock === 0 ? "#ee8778" : product.stock <= product.reorderLevel ? "#efb655" : "#31b183" }} /></div></div></td><td><StockBadge product={product} /></td><td><button className="icon-button edit-button" aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => onEditProduct(product)}><Edit3 size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching products" description="Try another search or filter to find what you're looking for." action={<button className="btn btn-secondary" onClick={() => { onSearchChange(""); setCategory("All categories"); setStatus("All stock"); }}>Clear filters</button>} />}
        <div className="table-footer"><span>Showing {filtered.length} of {data.products.length} products</span><span>Select rows to prefill a sheet of unique serial labels</span></div>
      </section>
    </div>
  );
}

export function SettingsView({ data, onSave, busy }: { data: AppData; onSave: (name: string) => Promise<boolean>; busy: boolean }) {
  const [companyName, setCompanyName] = useState(data.settings.companyName);
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave(companyName)) { setSaved(true); window.setTimeout(() => setSaved(false), 3000); }
  };
  return (
    <div className="view-content settings-view">
      <PageHeading eyebrow="PREFERENCES" title="Settings" subtitle="Make your workspace feel like yours." />
      <div className="settings-layout"><div className="settings-main"><section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-heading-icon"><Settings2 size={21} /></span><div><h2>Business details</h2><p>These details appear on your printed barcode labels.</p></div></div><form onSubmit={submit} className="settings-form"><label className="field-label" htmlFor="company-name">Company name</label><input id="company-name" className="form-input" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required minLength={2} maxLength={100} placeholder="Your business name" /><p className="field-help">Use the name you want customers to see on product labels.</p><div className="settings-divider" /><div className="settings-readonly"><div><span className="field-label">Currency</span><p>Prices and reports are shown in Bangladeshi Taka.</p></div><span className="readonly-pill">৳ &nbsp; BDT</span></div><div className="settings-readonly"><div><span className="field-label">Business timezone</span><p>Daily reports follow your local business day.</p></div><span className="readonly-pill"><Globe2 size={15} /> Asia/Dhaka</span></div><div className="settings-divider" /><button className="btn btn-primary settings-save" type="submit" disabled={busy || companyName.trim().length < 2}>{saved ? <Check size={17} /> : null}{saved ? "Saved" : busy ? "Saving..." : "Save changes"}</button></form></section></div><aside className="settings-aside"><div className="settings-note"><span><ShieldCheck size={22} /></span><h3>Built for accuracy</h3><p>Every stock receipt and sale is recorded as a movement, giving you a clear history of how quantities change.</p></div><div className="settings-help"><CircleHelp size={19} /><div><strong>Need a hand?</strong><p>Create a product, print its stock scan tag from Products, then scan it for inventory. Use Barcode generator separately for unique serial labels.</p></div></div></aside></div>
    </div>
  );
}
