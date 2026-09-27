"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Barcode, Camera, CheckCircle2, CircleHelp, CreditCard, PackageCheck, ScanLine, ShoppingBag, Truck } from "lucide-react";
import { dayKey, formatDate, formatTime, money } from "@/lib/format";
import type { AppData, ScanMode } from "@/lib/types";
import { PageHeading, PanelHeading, ProductThumb } from "@/components/ui-parts";

type Props = { data: AppData; onScan: (mode: ScanMode) => void; onSubmit: (mode: ScanMode, code: string, quantity: number, paymentMethod: string, note: string) => Promise<boolean>; busy: boolean };

function ManualScanForm({ mode, data, onSubmit, busy }: Omit<Props, "onScan"> & { mode: ScanMode }) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [payment, setPayment] = useState("Cash");
  const [note, setNote] = useState("");
  const match = data.products.find((product) => product.barcode.toLowerCase() === code.trim().toLowerCase() || product.sku.toLowerCase() === code.trim().toLowerCase());
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSubmit(mode, code.trim(), Number(quantity), payment, note)) { setCode(""); setQuantity("1"); setNote(""); }
  };
  return (
    <form className="operation-form" onSubmit={submit}>
      <div className="operation-form-head"><div><h3>Or enter a barcode manually</h3><p>Works with a barcode scanner or your keyboard, too.</p></div><Barcode size={20} /></div>
      <div className="field-group"><label className="field-label" htmlFor={`${mode}-code`}>Barcode or SKU <span>*</span></label><div className="input-with-icon"><Barcode size={17} /><input id={`${mode}-code`} className="form-input" value={code} onChange={(event) => setCode(event.target.value)} list={`${mode}-codes`} placeholder="e.g. NSG-100001" required autoComplete="off" /></div><datalist id={`${mode}-codes`}>{data.products.map((product) => <option key={product.id} value={product.barcode}>{product.name}</option>)}</datalist></div>
      {match && <div className="matched-product"><ProductThumb product={match} size="small" /><div><strong>{match.name}</strong><span>{mode === "sale" ? `${money(match.mrp)} each · ${match.stock} available` : `${match.stock} currently in stock`}</span></div><CheckCircle2 size={17} /></div>}
      <div className="form-row"><div className="field-group"><label className="field-label" htmlFor={`${mode}-qty`}>Quantity <span>*</span></label><input id={`${mode}-qty`} className="form-input" type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div>{mode === "sale" ? <div className="field-group"><label className="field-label" htmlFor="payment-method">Payment method</label><select id="payment-method" className="form-input" value={payment} onChange={(event) => setPayment(event.target.value)}><option>Cash</option><option>Card</option><option>bKash</option><option>Bank transfer</option></select></div> : <div className="field-group"><label className="field-label" htmlFor="stock-note">Note <span className="optional">(optional)</span></label><input id="stock-note" className="form-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Supplier delivery" maxLength={200} /></div>}</div>
      <button type="submit" className="btn btn-primary operation-submit" disabled={busy || !code.trim()}>{mode === "sale" ? <ShoppingBag size={18} /> : <PackageCheck size={18} />}{busy ? "Saving..." : mode === "sale" ? "Complete sale" : "Add to stock"}<ArrowRight size={17} /></button>
    </form>
  );
}

function OperationHero({ mode, onScan }: { mode: ScanMode; onScan: () => void }) {
  const receiving = mode === "stock";
  return <div className={`operation-hero ${receiving ? "receive-hero" : "checkout-hero"}`}><div className="operation-hero-art"><div className="scan-art"><span className="scan-corner top-left" /><span className="scan-corner top-right" /><Barcode size={72} strokeWidth={1.35} /><span className="scan-corner bottom-left" /><span className="scan-corner bottom-right" /><i /></div></div><div className="operation-hero-copy"><span className="step-badge"><span /> CAMERA SCANNING</span><h2>{receiving ? "Scan it in. Stock it up." : "Scan it. Sell it. Done."}</h2><p>{receiving ? "Point your phone camera at a product barcode. Its stock count updates automatically." : "Scan a product at checkout to record the sale and adjust your inventory instantly."}</p><button className="btn btn-primary" onClick={onScan}><Camera size={18} /> Start camera scanner <ArrowRight size={16} /></button></div></div>;
}

export function StockInView({ data, onScan, onSubmit, busy }: Props) {
  const today = dayKey(new Date());
  const receivedToday = data.movements.filter((movement) => movement.kind === "stock_in" && dayKey(movement.createdAt) === today).reduce((sum, movement) => sum + movement.quantityChange, 0);
  const arrivals = data.movements.filter((movement) => movement.kind === "stock_in");
  return <div className="view-content"><PageHeading eyebrow="INVENTORY / RECEIVE" title="Stock in" subtitle="Keep your shelves and your numbers perfectly in sync." actions={<button className="btn btn-primary" onClick={() => onScan("stock")}><Camera size={18} /> Open scanner</button>} />
    <div className="operation-metrics"><div><span className="metric-icon metric-green"><ArrowDownLeft size={20} /></span><span><small>Units received today</small><strong>{receivedToday}</strong></span></div><div><span className="metric-icon metric-blue"><Truck size={20} /></span><span><small>Total stock on hand</small><strong>{data.products.reduce((sum, p) => sum + p.stock, 0).toLocaleString()}</strong></span></div><div><span className="metric-icon metric-purple"><PackageCheck size={20} /></span><span><small>Products in catalog</small><strong>{data.products.length}</strong></span></div></div>
    <div className="operation-grid"><section className="panel operation-primary"><OperationHero mode="stock" onScan={() => onScan("stock")} /><ManualScanForm mode="stock" data={data} onSubmit={onSubmit} busy={busy} /></section><aside className="operation-aside"><div className="panel steps-panel"><PanelHeading title="How stock in works" subtitle="A simple 3-step workflow" /><div className="steps-list"><div><span>01</span><p><strong>Create your product</strong><small>Add its details and print the barcode label.</small></p></div><div><span>02</span><p><strong>Scan on arrival</strong><small>Use your phone camera or enter the code.</small></p></div><div><span>03</span><p><strong>Stock updates instantly</strong><small>Every receipt is saved in your history.</small></p></div></div></div><div className="side-hint"><CircleHelp size={20} /><p>Camera scanning works on HTTPS or localhost. You can always type a barcode instead.</p></div></aside></div>
    <section className="panel history-panel"><PanelHeading title="Recent stock arrivals" subtitle="A record of products added to inventory" /><div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>DATE & TIME</th><th>QUANTITY ADDED</th><th>STOCK AFTER</th><th>NOTE</th></tr></thead><tbody>{arrivals.slice(0, 8).map((entry) => <tr key={entry.id}><td><div className="product-cell"><ProductThumb product={{ name: entry.productName, category: data.products.find((p) => p.id === entry.productId)?.category ?? "Other" }} size="small" /><span><strong>{entry.productName}</strong></span></div></td><td><span className="table-main">{formatDate(entry.createdAt)}</span><small className="table-sub">{formatTime(entry.createdAt)}</small></td><td><span className="positive-number">+{entry.quantityChange}</span></td><td className="table-main">{entry.stockAfter}</td><td className="muted-cell">{entry.note}</td></tr>)}</tbody></table>{!arrivals.length && <div className="inline-empty">No stock receipts yet. Scan your first product to get started.</div>}</div></section>
  </div>;
}

export function SalesView({ data, onScan, onSubmit, busy }: Props) {
  const today = dayKey(new Date());
  const todaySales = data.sales.filter((sale) => dayKey(sale.createdAt) === today);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const todayUnits = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
  return <div className="view-content"><PageHeading eyebrow="POINT OF SALE" title="Sales" subtitle="Every sale counts. Keep checkout moving and stock accurate." actions={<button className="btn btn-primary" onClick={() => onScan("sale")}><ScanLine size={18} /> Scan a sale</button>} />
    <div className="operation-metrics"><div><span className="metric-icon metric-green"><ArrowUpRight size={20} /></span><span><small>Revenue today</small><strong>{money(todayRevenue)}</strong></span></div><div><span className="metric-icon metric-blue"><ShoppingBag size={20} /></span><span><small>Transactions today</small><strong>{todaySales.length}</strong></span></div><div><span className="metric-icon metric-purple"><PackageCheck size={20} /></span><span><small>Units sold today</small><strong>{todayUnits}</strong></span></div></div>
    <div className="operation-grid"><section className="panel operation-primary"><OperationHero mode="sale" onScan={() => onScan("sale")} /><ManualScanForm mode="sale" data={data} onSubmit={onSubmit} busy={busy} /></section><aside className="operation-aside"><div className="panel steps-panel"><PanelHeading title="Checkout made simple" subtitle="Fast, accurate, and always in sync" /><div className="steps-list"><div><span>01</span><p><strong>Scan the barcode</strong><small>Find a product with your phone camera.</small></p></div><div><span>02</span><p><strong>Choose payment</strong><small>Cash, card, bKash, or bank transfer.</small></p></div><div><span>03</span><p><strong>You&apos;re all set</strong><small>Sales and stock update together, instantly.</small></p></div></div></div><div className="side-hint"><CreditCard size={20} /><p>MRP is saved with each sale, so historical reports remain accurate even if prices change later.</p></div></aside></div>
    <section className="panel history-panel"><PanelHeading title="Sales history" subtitle="Your most recent completed transactions" /><div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>DATE & TIME</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th><th>PAYMENT</th></tr></thead><tbody>{data.sales.slice(0, 12).map((sale) => <tr key={sale.id}><td><div className="product-cell"><ProductThumb product={{ name: sale.productName, category: data.products.find((p) => p.id === sale.productId)?.category ?? "Other" }} size="small" /><span><strong>{sale.productName}</strong><small>{sale.productSku}</small></span></div></td><td><span className="table-main">{formatDate(sale.createdAt)}</span><small className="table-sub">{formatTime(sale.createdAt)}</small></td><td>{sale.quantity}</td><td>{money(sale.unitPrice)}</td><td className="amount-cell">{money(sale.total)}</td><td><span className="payment-pill">{sale.paymentMethod}</span></td></tr>)}</tbody></table></div></section>
  </div>;
}
