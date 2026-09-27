"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Barcode, Camera, Check, CircleCheck, CircleHelp, PackagePlus, Plus, Printer, ScanLine, X } from "lucide-react";
import { BarcodeLabel, BarcodeSvg, InventoryPrintSheets, InventoryTag, PrintSheets } from "@/components/barcode";
import { CameraScanner } from "@/components/camera-scanner";
import { ProductThumb } from "@/components/ui-parts";
import { money } from "@/lib/format";
import type { AppData, LabelSheet, Product, ScanMode } from "@/lib/types";

function DialogFrame({ children, onClose, wide = false, label }: { children: ReactNode; onClose: () => void; wide?: boolean; label: string }) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = original; document.removeEventListener("keydown", keydown); };
  }, [onClose]);
  return <div className="dialog-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`dialog ${wide ? "dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

export type ProductInput = { name: string; sku: string; category: string; mrp: number; reorderLevel: number };

export function ProductDialog({ product, companyName, onClose, onSave, busy }: { product: Product | null; companyName: string; onClose: () => void; onSave: (input: ProductInput, id?: string) => Promise<boolean>; busy: boolean }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [mrp, setMrp] = useState(product?.mrp.toString() ?? "");
  const [reorderLevel, setReorderLevel] = useState(product?.reorderLevel.toString() ?? "10");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave({ name: name.trim(), sku: sku.trim(), category: category.trim(), mrp: Number(mrp), reorderLevel: Number(reorderLevel) }, product?.id)) onClose();
  };
  return <DialogFrame onClose={onClose} label={product ? "Edit product" : "Add product"}><div className="dialog-header"><span className="dialog-header-icon"><PackagePlus size={22} /></span><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><h2>{product ? "Edit product" : "Add a new product"}</h2><p>{product ? "Update product details without changing its barcode or stock history." : "Add the details once, then print its stock scan tag from Products to track inventory."}</p></div><form onSubmit={submit} className="dialog-body"><div className="field-group"><label className="field-label" htmlFor="product-name">Product name <span>*</span></label><input id="product-name" className="form-input" placeholder="e.g. Wireless Headphones" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} autoFocus /></div><div className="form-row"><div className="field-group"><label className="field-label" htmlFor="product-sku">SKU <span className="optional">{product ? "" : "(optional)"}</span></label><input id="product-sku" className="form-input" placeholder="Auto-generated if blank" value={sku} onChange={(event) => setSku(event.target.value)} required={!!product} maxLength={40} /></div><div className="field-group"><label className="field-label" htmlFor="product-category">Category <span>*</span></label><input id="product-category" className="form-input" placeholder="e.g. Electronics" list="product-categories" value={category} onChange={(event) => setCategory(event.target.value)} required minLength={2} maxLength={60} /><datalist id="product-categories"><option value="Electronics" /><option value="Accessories" /><option value="Home & Living" /><option value="Stationery" /><option value="Clothing" /><option value="Other" /></datalist></div></div><div className="form-row"><div className="field-group"><label className="field-label" htmlFor="product-mrp">MRP (Tk) <span>*</span></label><div className="input-prefix"><span>৳</span><input id="product-mrp" className="form-input" type="number" min="0.01" max="100000000" step="0.01" placeholder="0.00" value={mrp} onChange={(event) => setMrp(event.target.value)} required /></div></div><div className="field-group"><label className="field-label" htmlFor="product-reorder">Low stock alert at</label><input id="product-reorder" className="form-input" type="number" min="0" max="100000" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} required /></div></div><div className="product-label-hint"><Barcode size={18} /><span>{product ? <>Barcode <strong>{product.barcode}</strong> stays the same.</> : <>A unique Code 128 barcode will be created automatically for <strong>{companyName}</strong>.</>}</span></div>{product && <div className="dialog-barcode-preview"><BarcodeSvg value={product.barcode} height={42} /><small>{product.barcode} · MRP {money(product.mrp)}</small></div>}<div className="dialog-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : product ? "Save changes" : "Create product"}<ArrowRight size={17} /></button></div></form></DialogFrame>;
}

export function ScanDialog({ mode, data, onClose, onSubmit, busy }: { mode: ScanMode; data: AppData; onClose: () => void; onSubmit: (mode: ScanMode, code: string, quantity: number, payment: string, note: string) => Promise<boolean>; busy: boolean }) {
  const [cameraActive, setCameraActive] = useState(true);
  const [session, setSession] = useState(0);
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [payment, setPayment] = useState("Cash");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState("");
  const receiving = mode === "stock";
  const processCode = async (value: string) => {
    setCameraActive(false);
    setCode(value);
    const okay = await onSubmit(mode, value, Number(quantity), payment, note);
    if (okay) setSuccess(value);
  };
  const manualSubmit = async (event: FormEvent) => { event.preventDefault(); await processCode(code.trim()); };
  const scanNext = () => { setCode(""); setSuccess(""); setSession((current) => current + 1); setCameraActive(true); };
  // The camera pauses after every scan attempt, success or failure (e.g. no
  // matching product, insufficient stock, a duplicate). Without this, a
  // failed scan left the camera permanently paused with no way to resume it
  // short of closing and reopening the whole dialog.
  const canResumeCamera = !cameraActive && !busy;
  const matched = data.products.find((product) => product.barcode.toLowerCase() === code.trim().toLowerCase() || product.sku.toLowerCase() === code.trim().toLowerCase());
  return <DialogFrame onClose={onClose} label={receiving ? "Scan incoming stock" : "Scan a sale"}><div className="dialog-header scan-dialog-header"><span className="dialog-header-icon"><ScanLine size={22} /></span><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><h2>{receiving ? "Scan incoming stock" : "Scan a product to sell"}</h2><p>{receiving ? "Each successful scan adds the quantity to your inventory." : "Each successful scan records a sale and reduces available stock."}</p></div><div className="dialog-body scan-dialog-body"><div className="scan-modal-view">{cameraActive ? <CameraScanner key={session} onDetected={(value) => { void processCode(value); }} /> : <div className={`scan-paused ${success ? "scan-complete" : ""}`}>{success ? <CircleCheck size={42} /> : <Camera size={36} />}<strong>{success ? "Scan recorded!" : busy ? "Saving your scan..." : "Camera paused"}</strong><span>{success ? `${matched?.name ?? success} ${receiving ? "added to stock" : "sold successfully"}` : "Use the manual form below or scan again."}</span></div>}</div>{canResumeCamera && <button className="btn btn-outline scan-again" onClick={scanNext}><ScanLine size={17} /> {success ? "Scan another item" : "Resume camera scanning"} <ArrowRight size={16} /></button>}<form onSubmit={manualSubmit} className="scan-modal-form"><div className="scan-form-divider"><span>SCAN OPTIONS</span></div><div className="form-row"><div className="field-group"><label className="field-label" htmlFor="scan-quantity">Quantity</label><input id="scan-quantity" className="form-input" type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div>{receiving ? <div className="field-group"><label className="field-label" htmlFor="scan-note">Note <span className="optional">(optional)</span></label><input id="scan-note" className="form-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier delivery" maxLength={200} /></div> : <div className="field-group"><label className="field-label" htmlFor="scan-payment">Payment method</label><select id="scan-payment" className="form-input" value={payment} onChange={(event) => setPayment(event.target.value)}><option>Cash</option><option>Card</option><option>bKash</option><option>Bank transfer</option></select></div>}</div><div className="field-group"><label className="field-label" htmlFor="scan-manual">Or enter barcode / SKU manually</label><div className="scan-manual-line"><input id="scan-manual" className="form-input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Type or paste a barcode" required autoComplete="off" /><button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>{busy ? "Saving..." : "Confirm"}</button></div></div>{matched && !success && <div className="matched-product"><ProductThumb product={matched} size="small" /><div><strong>{matched.name}</strong><span>{money(matched.mrp)} · {matched.stock} in stock</span></div><Check size={17} /></div>}</form><div className="scan-help"><CircleHelp size={15} /> Keep the barcode flat and well lit. Camera access requires HTTPS or localhost.</div></div></DialogFrame>;
}

export function CashEntryDialog({ onClose, onSave, busy }: { onClose: () => void; onSave: (input: { type: "income" | "expense"; category: string; amount: number; note: string }) => Promise<boolean>; busy: boolean }) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); if (await onSave({ type, category: category.trim(), amount: Number(amount), note: note.trim() })) onClose(); };
  return <DialogFrame onClose={onClose} label="Add cash entry"><div className="dialog-header"><span className="dialog-header-icon"><Plus size={22} /></span><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><h2>Add cash entry</h2><p>Track money coming in or going out of your business.</p></div><form onSubmit={submit} className="dialog-body"><div className="field-group"><label className="field-label">Entry type</label><div className="segmented-control"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Expense</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Other income</button></div></div><div className="form-row"><div className="field-group"><label className="field-label" htmlFor="cash-category">Category <span>*</span></label><input id="cash-category" className="form-input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder={type === "expense" ? "e.g. Utilities" : "e.g. Other income"} list="cash-categories" required minLength={2} maxLength={60} /><datalist id="cash-categories"><option value="Rent" /><option value="Utilities" /><option value="Supplies" /><option value="Transport" /><option value="Salary" /><option value="Other income" /></datalist></div><div className="field-group"><label className="field-label" htmlFor="cash-amount">Amount (Tk) <span>*</span></label><div className="input-prefix"><span>৳</span><input id="cash-amount" className="form-input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div></div></div><div className="field-group"><label className="field-label" htmlFor="cash-note">Description <span>*</span></label><input id="cash-note" className="form-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was this for?" required minLength={2} maxLength={250} /></div><div className="product-label-hint"><CircleHelp size={18} /><span>Cash sales are recorded automatically when you choose Cash at checkout. Only add other transactions here.</span></div><div className="dialog-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save entry"}<ArrowRight size={17} /></button></div></form></DialogFrame>;
}

export function PrintDialog({ sheet, onClose }: { sheet: LabelSheet; onClose: () => void }) {
  const labels = sheet.labels;
  return <>
    <DialogFrame onClose={onClose} wide label="Print unique barcode sheet">
      <div className="dialog-header">
        <span className="dialog-header-icon"><Printer size={22} /></span>
        <button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <h2>Your unique barcodes are ready</h2>
        <p>Each label has its own saved serial. Printing again will reuse these codes, not generate new ones.</p>
      </div>
      <div className="print-dialog-content">
        <div className="print-options">
          <div className="print-summary">
            <span className="print-summary-icon"><Barcode size={21} /></span>
            <div><strong>{labels.length} unique {labels.length === 1 ? "barcode" : "barcodes"} saved</strong><small>Sheet #{sheet.id.slice(0, 8).toUpperCase()} · Code 128</small></div>
          </div>
          <div className="print-specs">
            <div><span>First serial</span><strong>{labels[0]?.barcode ?? "—"}</strong></div>
            <div><span>Last serial</span><strong>{labels.at(-1)?.barcode ?? "—"}</strong></div>
            <div><span>Paper size</span><strong>A4 · 4 × 5 grid</strong></div>
            <div><span>Labels on sheet</span><strong>{labels.length} / 20</strong></div>
            <div><span>Pages needed</span><strong>1</strong></div>
          </div>
          <div className="print-instruction"><CircleHelp size={17} /><p>Print at <strong>100% scale</strong> with margins set to <strong>none</strong>. This sheet is saved in your history; reprinting never changes stock or uses new serials.</p></div>
          <button className="btn btn-primary print-action" onClick={() => window.print()}><Printer size={18} /> Print {labels.length} unique labels <ArrowRight size={17} /></button>
        </div>
        <div className="print-preview-side">
          <div className="preview-title"><span>A4 PRINT PREVIEW</span><small>1 of 1 · max 20 labels</small></div>
          <div className="preview-sheet">{labels.map((label) => <BarcodeLabel key={label.serial} label={label} companyName={sheet.companyName} />)}</div>
        </div>
      </div>
    </DialogFrame>
    <PrintSheets sheet={sheet} />
  </>;
}

export function StockTagDialog({ products, companyName, onClose }: { products: Product[]; companyName: string; onClose: () => void }) {
  const [copies, setCopies] = useState(1);
  const labels = products.flatMap((product) => Array.from({ length: copies }, () => product));
  const pageCount = Math.ceil(labels.length / 20);
  return <>
    <DialogFrame onClose={onClose} wide label="Print stock scan tags">
      <div className="dialog-header"><span className="dialog-header-icon"><Printer size={22} /></span><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={19} /></button><h2>Print stock scan tags</h2><p>These product barcodes work with Stock in and Sales. Repeated tags intentionally use the same product code.</p></div>
      <div className="print-dialog-content">
        <div className="print-options">
          <div className="print-summary"><span className="print-summary-icon"><Barcode size={21} /></span><div><strong>{products.length} {products.length === 1 ? "product" : "products"} selected</strong><small>Inventory scanning · Code 128</small></div></div>
          <div className="field-group"><label className="field-label" htmlFor="stock-print-copies">Tags per product</label><input id="stock-print-copies" className="form-input" type="number" min="1" max="20" value={copies} onChange={(event) => setCopies(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></div>
          <div className="print-specs"><div><span>Total tags</span><strong>{labels.length}</strong></div><div><span>Paper size</span><strong>A4</strong></div><div><span>Tags per sheet</span><strong>20 (4 × 5)</strong></div><div><span>Pages needed</span><strong>{pageCount}</strong></div></div>
          <div className="print-instruction"><CircleHelp size={17} /><p>For 1–20 <strong>different serials</strong> per A4 sheet, use the independent Barcode Generator instead. Print at 100% scale without margins.</p></div>
          <button className="btn btn-primary print-action" onClick={() => window.print()}><Printer size={18} /> Print stock tags <ArrowRight size={17} /></button>
        </div>
        <div className="print-preview-side"><div className="preview-title"><span>STOCK TAG PREVIEW</span><small>Page 1 of {pageCount}</small></div><div className="preview-sheet">{labels.slice(0, 20).map((product, index) => <InventoryTag key={`${product.id}-${index}`} product={product} companyName={companyName} />)}</div></div>
      </div>
    </DialogFrame>
    <InventoryPrintSheets products={products} companyName={companyName} copies={copies} />
  </>;
}
