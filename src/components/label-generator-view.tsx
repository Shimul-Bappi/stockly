"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Barcode, Check, CircleHelp, Clock3, Hash, Minus, Package, Plus, Printer, Search, ShieldCheck, Trash2 } from "lucide-react";
import { formatDate, formatTime, money } from "@/lib/format";
import type { AppData, LabelItemInput, LabelSheet } from "@/lib/types";
import { PageHeading, PanelHeading, ProductThumb } from "@/components/ui-parts";

type DraftItem = LabelItemInput & { key: string };

type Props = {
  data: AppData;
  initialProductIds: string[];
  busy: boolean;
  onGenerate: (items: LabelItemInput[], requestId: string) => Promise<LabelSheet | null>;
  onPrint: (sheet: LabelSheet) => void;
  onBack: () => void;
};

export function LabelGeneratorView({ data, initialProductIds, busy, onGenerate, onPrint, onBack }: Props) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    [...new Set(initialProductIds)].filter((id) => data.products.some((product) => product.id === id))
      .slice(0, 20).map((id) => ({ key: id, source: "catalog" as const, productId: id, quantity: 1 }))
  );
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const [productId, setProductId] = useState(initialProductIds[0] ?? data.products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [customName, setCustomName] = useState("");
  const [customMrp, setCustomMrp] = useState("");
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const remaining = 20 - total;
  const queued = items.flatMap((item) => {
    const name = item.source === "catalog"
      ? data.products.find((product) => product.id === item.productId)?.name ?? "Product"
      : item.name;
    return Array.from({ length: item.quantity }, () => name);
  });

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) { setError("Choose a quantity between 1 and 20."); return; }
    if (quantity > remaining) { setError(`Only ${remaining} ${remaining === 1 ? "space" : "spaces"} left on this A4 sheet.`); return; }
    if (tab === "catalog") {
      if (!data.products.some((product) => product.id === productId)) { setError("Choose a product from your catalog."); return; }
      const existing = items.find((item) => item.source === "catalog" && item.productId === productId);
      if (existing) setItems(items.map((item) => item.key === existing.key ? { ...item, quantity: item.quantity + quantity } : item));
      else setItems([...items, { key: productId, source: "catalog", productId, quantity }]);
    } else {
      const name = customName.trim();
      const mrp = Number(customMrp);
      if (name.length < 2 || name.length > 120 || !Number.isFinite(mrp) || mrp <= 0 || mrp > 100000000) {
        setError("Enter a label name and a valid MRP greater than zero."); return;
      }
      setItems([...items, { key: crypto.randomUUID(), source: "custom", name, mrp, quantity }]);
      setCustomName("");
      setCustomMrp("");
    }
    requestIdRef.current = null;
    setQuantity(1);
    setError("");
  };

  const changeQuantity = (key: string, next: number) => {
    const current = items.find((item) => item.key === key);
    if (!current || next < 1 || next > 20 - (total - current.quantity)) return;
    setItems(items.map((item) => item.key === key ? { ...item, quantity: next } : item));
    requestIdRef.current = null;
    setError("");
  };

  const remove = (key: string) => {
    setItems(items.filter((item) => item.key !== key));
    requestIdRef.current = null;
    setError("");
  };

  const generate = async () => {
    if (total < 1 || total > 20 || busy) { setError("Add 1 to 20 labels before generating a sheet."); return; }
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    const payload: LabelItemInput[] = items.map((item) => item.source === "catalog"
      ? { source: "catalog", productId: item.productId, quantity: item.quantity }
      : { source: "custom", name: item.name, mrp: item.mrp, quantity: item.quantity });
    const sheet = await onGenerate(payload, requestId);
    if (sheet) { requestIdRef.current = null; setError(""); onPrint(sheet); }
  };

  const findSavedSheet = async (event: FormEvent) => {
    event.preventDefault();
    if (!lookup.trim()) return;
    setLooking(true);
    setLookupError("");
    try {
      const response = await fetch(`/api/label-sheets?code=${encodeURIComponent(lookup.trim())}`, { cache: "no-store" });
      const result: { sheet?: LabelSheet; error?: string } = await response.json();
      if (!response.ok || !result.sheet) throw new Error(result.error ?? "Sheet not found");
      onPrint(result.sheet);
    } catch (caught) {
      setLookupError(caught instanceof Error ? caught.message : "Couldn't find that sheet.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="view-content studio-view">
      <PageHeading eyebrow="PRODUCTS / LABEL STUDIO" title="Barcode generator" subtitle="Give every label its own permanent serial, even for the same product."
        actions={<button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Back to products</button>} />

      <div className="studio-intro">
        <div className="studio-intro-mark"><Barcode size={29} strokeWidth={1.8} /></div>
        <div className="studio-intro-copy"><span>INDEPENDENT LABEL WORKFLOW</span><strong>Unique codes. One tidy sheet. Zero stock changes.</strong><p>Build a sheet of 1–20 labels. The database assigns a new serial to every label when you generate it.</p></div>
        <div className="studio-intro-points"><span><Hash size={15} /> Permanent serial</span><span><ShieldCheck size={15} /> No inventory effect</span></div>
      </div>

      <div className="studio-grid">
        <section className="panel studio-builder">
          <div className="studio-section-head"><span className="studio-step">01</span><div><h2>Build your label sheet</h2><p>Pick an existing product or enter any label details.</p></div></div>
          <div className="studio-tabs" role="tablist" aria-label="Label source">
            <button type="button" role="tab" aria-selected={tab === "catalog"} className={tab === "catalog" ? "active" : ""} onClick={() => { setTab("catalog"); setError(""); }}><Package size={16} /> From catalog</button>
            <button type="button" role="tab" aria-selected={tab === "custom"} className={tab === "custom" ? "active" : ""} onClick={() => { setTab("custom"); setError(""); }}><Plus size={16} /> Custom label</button>
          </div>
          <form className="studio-add-form" onSubmit={addItem}>
            {tab === "catalog" ? <div className="field-group"><label className="field-label" htmlFor="label-product">Choose a product</label><select id="label-product" className="form-input" value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="" disabled>Select a product</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.name} · {money(product.mrp)}</option>)}</select></div> :
              <div className="studio-custom-fields"><div className="field-group"><label className="field-label" htmlFor="label-custom-name">Label name</label><input id="label-custom-name" className="form-input" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Special gift box" minLength={2} maxLength={120} required /></div><div className="field-group"><label className="field-label" htmlFor="label-custom-mrp">MRP (Tk)</label><div className="input-prefix"><span>৳</span><input id="label-custom-mrp" className="form-input" type="number" min="0.01" max="100000000" step="0.01" value={customMrp} onChange={(event) => setCustomMrp(event.target.value)} placeholder="0.00" required /></div></div></div>}
            <div className="studio-add-bottom"><div className="field-group"><label className="field-label" htmlFor="label-add-quantity">Unique barcodes to make</label><div className="studio-number-control"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease labels to add" disabled={quantity <= 1}><Minus size={15} /></button><input id="label-add-quantity" type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label="Unique barcodes to make" /><button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Increase labels to add" disabled={quantity >= 20}><Plus size={15} /></button></div></div><button type="submit" className="btn btn-secondary studio-add-button" disabled={remaining === 0 || busy}><Plus size={17} /> Add to sheet</button></div>
          </form>
          <div className="studio-queue-head"><div><strong>Sheet contents</strong><span>{total} / 20 labels</span></div><div className="studio-progress"><i style={{ width: `${total * 5}%` }} /></div></div>
          {items.length ? <div className="studio-items">{items.map((item) => {
            const product = item.source === "catalog" ? data.products.find((entry) => entry.id === item.productId) : null;
            const name = product?.name ?? (item.source === "custom" ? item.name : "Unknown product");
            const mrp = product?.mrp ?? (item.source === "custom" ? item.mrp : 0);
            return <div className="studio-item" key={item.key}>
              {product ? <ProductThumb product={product} size="small" /> : <span className="studio-custom-icon"><Barcode size={17} /></span>}
              <div className="studio-item-name"><strong>{name}</strong><small>{money(mrp)} · {item.source === "custom" ? "Custom label" : "Catalog product"}</small></div>
              <div className="studio-item-qty"><button type="button" onClick={() => changeQuantity(item.key, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Remove one ${name} label`}><Minus size={13} /></button><span aria-label={`${item.quantity} labels`}>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.key, item.quantity + 1)} disabled={remaining < 1} aria-label={`Add one ${name} label`}><Plus size={13} /></button></div>
              <button type="button" className="studio-remove" onClick={() => remove(item.key)} aria-label={`Remove ${name} from sheet`}><Trash2 size={16} /></button>
            </div>;
          })}</div> : <div className="studio-empty"><span><Barcode size={21} /></span><strong>Your sheet is empty</strong><p>Add a product above. You can make up to 20 unique labels per page.</p></div>}
          {error && <p className="studio-error" role="alert">{error}</p>}
          {initialProductIds.length > 20 && <p className="studio-hint">Only the first 20 selected products were added. Make another sheet for the rest.</p>}
          <div className="studio-builder-footer"><div><strong>{remaining} slots left</strong><span>Each slot gets a different saved serial.</span></div><button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={busy || total === 0}>{busy ? "Generating..." : `Generate ${total} unique ${total === 1 ? "barcode" : "barcodes"}`} <ArrowRight size={17} /></button></div>
        </section>

        <aside className="studio-right">
          <section className="panel studio-preview-panel">
            <div className="studio-section-head"><span className="studio-step studio-step-soft">02</span><div><h2>A4 sheet preview</h2><p>4 columns × 5 rows · maximum 20 labels</p></div></div>
            <div className="studio-paper-wrap"><div className="studio-paper" aria-label={`A4 preview with ${total} of 20 label positions filled`}>{Array.from({ length: 20 }, (_, index) => <div key={index} className={`studio-paper-slot ${queued[index] ? "studio-paper-filled" : ""}`}>{queued[index] ? <><span className="studio-paper-mini-name">{queued[index]}</span><span className="studio-paper-bars" /><small>NEW SERIAL</small></> : <span className="studio-paper-number">{String(index + 1).padStart(2, "0")}</span>}</div>)}</div></div>
            <div className="studio-preview-note"><CircleHelp size={16} /><span>This is a layout preview. The real barcodes appear after serials are saved.</span></div>
          </section>
          <div className="studio-separation"><span><ShieldCheck size={20} /></span><div><strong>Completely separate from stock</strong><p>These LBL serials are for independent labeling. They are not recognized by Stock in or Sales; use a product’s STK barcode for inventory scanning.</p></div></div>
        </aside>
      </div>

      <section className="panel studio-history-panel"><div className="studio-history-head"><PanelHeading title="Saved barcode sheets" subtitle="Your generated serials stay in the database and can be reprinted." /><form onSubmit={(event) => void findSavedSheet(event)} className="studio-lookup"><Search size={16} /><input value={lookup} onChange={(event) => { setLookup(event.target.value); setLookupError(""); }} placeholder="Find by serial, e.g. LBL-0000000001" aria-label="Find a saved sheet by barcode serial" /><button type="submit" disabled={looking || !lookup.trim()}>{looking ? "Finding..." : "Find sheet"}</button></form></div>
        {lookupError && <p className="studio-lookup-error" role="alert">{lookupError}</p>}
        {data.labelSheets.length ? <div className="table-scroll"><table className="data-table studio-history-table"><thead><tr><th>SHEET</th><th>CREATED</th><th>UNIQUE LABELS</th><th>SERIALS ISSUED</th><th /></tr></thead><tbody>{data.labelSheets.map((sheet) => <tr key={sheet.id}><td><div className="studio-history-title"><span><Barcode size={17} /></span><strong>Sheet #{sheet.id.slice(0, 8).toUpperCase()}</strong></div></td><td><span className="table-main">{formatDate(sheet.createdAt)}</span><small className="table-sub">{formatTime(sheet.createdAt)}</small></td><td><span className="studio-history-count">{sheet.labelCount} / 20</span></td><td><span className="studio-history-serial">{sheet.labels[0]?.barcode ?? "—"}</span>{sheet.labels.length > 1 && <small className="table-sub">to {sheet.labels.at(-1)?.barcode}</small>}</td><td><button className="btn btn-secondary studio-reprint" onClick={() => onPrint(sheet)}><Printer size={15} /> Reprint</button></td></tr>)}</tbody></table></div> : <div className="studio-history-empty"><Clock3 size={19} /> No saved sheets yet. Generate your first sheet above.</div>}
        <div className="studio-history-foot"><span><Check size={14} /> Your issued serials never reset or repeat.</span><span>Showing the latest 30 sheets · use serial search for older ones</span></div>
      </section>
    </div>
  );
}
