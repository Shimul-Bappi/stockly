"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Download, FileBarChart2, Plus, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { compactMoney, dateFromKey, dayKey, formatDate, formatTime, money, monthKey, recentDayKeys, recentMonthKeys } from "@/lib/format";
import type { AppData } from "@/lib/types";
import { EmptyState, PageHeading, PanelHeading, ProductThumb, StockBadge } from "@/components/ui-parts";

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReportsView({ data }: { data: AppData }) {
  const [date, setDate] = useState(dayKey(new Date()));
  const dailySales = data.sales.filter((sale) => dayKey(sale.createdAt) === date);
  const dailyMovements = data.movements.filter((movement) => dayKey(movement.createdAt) === date && movement.kind === "stock_in");
  const revenue = dailySales.reduce((sum, sale) => sum + sale.total, 0);
  const sold = dailySales.reduce((sum, sale) => sum + sale.quantity, 0);
  const received = dailyMovements.reduce((sum, movement) => sum + movement.quantityChange, 0);
  const rows = data.products.map((product) => {
    const productSales = dailySales.filter((sale) => sale.productId === product.id);
    const productArrivals = dailyMovements.filter((movement) => movement.productId === product.id);
    const closing = data.movements.find((movement) => movement.productId === product.id && dayKey(movement.createdAt) <= date)?.stockAfter ?? 0;
    return { product, sold: productSales.reduce((sum, sale) => sum + sale.quantity, 0), received: productArrivals.reduce((sum, movement) => sum + movement.quantityChange, 0), revenue: productSales.reduce((sum, sale) => sum + sale.total, 0), closing };
  }).sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);
  const days = recentDayKeys(7);
  const dailyTotals = days.map((key) => data.sales.filter((sale) => dayKey(sale.createdAt) === key).reduce((sum, sale) => sum + sale.total, 0));
  const chartMax = Math.max(1, ...dailyTotals);
  const topProduct = rows.find((row) => row.sold > 0);

  const download = () => {
    const lines = [
      ["Daily sales & stock report", date].map(csvCell).join(","),
      ["Company", data.settings.companyName].map(csvCell).join(","),
      [],
      ["Product", "SKU", "Barcode", "Stock received", "Units sold", "Closing stock", "Revenue (BDT)"].map(csvCell).join(","),
      ...rows.map((row) => [row.product.name, row.product.sku, row.product.barcode, row.received, row.sold, row.closing, row.revenue.toFixed(2)].map(csvCell).join(",")),
      ["TOTAL", "", "", received, sold, "", revenue.toFixed(2)].map(csvCell).join(","),
    ].map((line) => Array.isArray(line) ? "" : line).join("\r\n");
    const blob = new Blob(["\uFEFF", lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `stockly-daily-report-${date}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  return <div className="view-content"><PageHeading eyebrow="ANALYTICS / DAILY REPORT" title="Reports" subtitle="See the full picture behind every sale and stock movement." actions={<><label className="date-picker"><CalendarDays size={16} /><input type="date" value={date} max={dayKey(new Date())} onChange={(event) => setDate(event.target.value)} aria-label="Report date" /></label><button className="btn btn-primary" onClick={download}><Download size={17} /> Export CSV</button></>} />
    <div className="report-intro"><div className="report-intro-icon"><FileBarChart2 size={24} /></div><div><strong>Daily business snapshot</strong><p>Sales and stock for {formatDate(dateFromKey(date), { weekday: "long" })}. Every number below is based on recorded transactions.</p></div></div>
    <div className="report-stats"><div><span>REVENUE</span><strong>{money(revenue)}</strong><small>From {dailySales.length} transactions</small></div><div><span>UNITS SOLD</span><strong>{sold}</strong><small>Products checked out</small></div><div><span>STOCK RECEIVED</span><strong>+{received}</strong><small>Units added to inventory</small></div><div><span>PRODUCTS SOLD</span><strong>{new Set(dailySales.map((sale) => sale.productId)).size}</strong><small>Unique products sold</small></div></div>
    <div className="report-upper-grid"><section className="panel report-chart-panel"><PanelHeading title="Sales activity" subtitle="Revenue over the last seven days" action={<span className="panel-period">Last 7 days</span>} /><div className="bar-chart"><div className="bar-chart-guide"><span>{compactMoney(chartMax)}</span><span>{compactMoney(chartMax / 2)}</span><span>৳0</span></div><div className="bar-chart-bars">{days.map((key, index) => <div className="bar-chart-column" key={key} title={`${key}: ${money(dailyTotals[index])}`}><div className={`bar-chart-bar ${key === dayKey(new Date()) ? "bar-current" : ""}`} style={{ height: `${Math.max(3, (dailyTotals[index] / chartMax) * 100)}%` }} /><span>{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", weekday: "short" }).format(dateFromKey(key))}</span></div>)}</div></div></section><section className="panel report-highlight"><PanelHeading title="At a glance" subtitle="Highlights for the selected day" /><div className="highlight-line"><span className="highlight-icon highlight-green"><TrendingUp size={19} /></span><div><small>Top selling product</small><strong>{topProduct?.product.name ?? "No sales recorded"}</strong><span>{topProduct ? `${topProduct.sold} unit${topProduct.sold === 1 ? "" : "s"} sold` : "Select another date to explore"}</span></div></div><div className="highlight-line"><span className="highlight-icon highlight-blue"><ReceiptText size={19} /></span><div><small>Average sale value</small><strong>{money(dailySales.length ? revenue / dailySales.length : 0)}</strong><span>Across {dailySales.length} transactions</span></div></div><div className="report-note">A closing stock figure is the last recorded quantity for each item on this date.</div></section></div>
    <section className="panel report-table-panel"><PanelHeading title="Sales & stock breakdown" subtitle="A clear view of product performance and inventory levels" /><div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>STOCK IN</th><th>SOLD</th><th>CLOSING STOCK</th><th>STOCK STATUS</th><th>REVENUE</th></tr></thead><tbody>{rows.map((row) => <tr key={row.product.id}><td><div className="product-cell"><ProductThumb product={row.product} size="small" /><span><strong>{row.product.name}</strong><small>{row.product.sku}</small></span></div></td><td>{row.received ? <span className="positive-number">+{row.received}</span> : <span className="muted-cell">—</span>}</td><td><span className={row.sold ? "table-main" : "muted-cell"}>{row.sold || "—"}</span></td><td><strong className="table-main">{row.closing}</strong></td><td><StockBadge product={{ stock: row.closing, reorderLevel: row.product.reorderLevel }} /></td><td className="amount-cell">{row.revenue ? money(row.revenue) : "—"}</td></tr>)}</tbody></table></div><div className="report-table-total"><span>DAILY TOTAL</span><span>+{received} received</span><span>{sold} sold</span><strong>{money(revenue)}</strong></div></section>
  </div>;
}

export function CashbookView({ data, onAddEntry }: { data: AppData; onAddEntry: () => void }) {
  const currentMonth = monthKey(new Date());
  const monthSales = data.sales.filter((sale) => monthKey(sale.createdAt) === currentMonth);
  const monthEntries = data.cashEntries.filter((entry) => monthKey(entry.createdAt) === currentMonth);
  const revenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);
  const expenses = monthEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const income = monthEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const monthCashSales = monthSales.filter((sale) => sale.paymentMethod === "Cash").reduce((sum, sale) => sum + sale.total, 0);
  const cashBalance = data.sales.filter((sale) => sale.paymentMethod === "Cash").reduce((sum, sale) => sum + sale.total, 0) + data.cashEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0) - data.cashEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const months = recentMonthKeys(6);
  const monthBars = months.map((month) => ({
    income: data.sales.filter((sale) => sale.paymentMethod === "Cash" && monthKey(sale.createdAt) === month).reduce((sum, sale) => sum + sale.total, 0) + data.cashEntries.filter((entry) => entry.type === "income" && monthKey(entry.createdAt) === month).reduce((sum, entry) => sum + entry.amount, 0),
    expense: data.cashEntries.filter((entry) => entry.type === "expense" && monthKey(entry.createdAt) === month).reduce((sum, entry) => sum + entry.amount, 0),
  }));
  const maxBar = Math.max(1, ...monthBars.flatMap((bar) => [bar.income, bar.expense]));
  const paymentMethods = ["Cash", "bKash", "Card", "Bank transfer"];
  const ledger = [
    ...data.cashEntries.map((entry) => ({ id: entry.id, title: entry.note, subtitle: entry.category, amount: entry.amount, type: entry.type, createdAt: entry.createdAt })),
    ...data.sales.filter((sale) => sale.paymentMethod === "Cash").map((sale) => ({ id: sale.id, title: sale.productName, subtitle: `Cash sale · ${sale.quantity} unit${sale.quantity === 1 ? "" : "s"}`, amount: sale.total, type: "income", createdAt: sale.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  return <div className="view-content"><PageHeading eyebrow="FINANCES / CASH FLOW" title="Cashbook" subtitle="Know what's coming in, going out, and staying with you." actions={<button className="btn btn-primary" onClick={onAddEntry}><Plus size={18} /> Add entry</button>} />
    <div className="cash-banner"><span><Wallet size={20} /></span><p><strong>Cash sales are tracked automatically.</strong> Add other income and expenses here to keep your cash position up to date.</p></div>
    <div className="cash-stats"><div className="cash-stat cash-stat-featured"><span className="cash-stat-icon"><Wallet size={20} /></span><small>ESTIMATED CASH BALANCE</small><strong>{money(cashBalance)}</strong><p>Cash sales + other income − expenses</p></div><div className="cash-stat"><span className="cash-stat-icon cash-icon-green"><ArrowUpRight size={20} /></span><small>MONTHLY REVENUE</small><strong>{money(revenue)}</strong><p>Across all payment methods</p></div><div className="cash-stat"><span className="cash-stat-icon cash-icon-red"><ArrowDownLeft size={20} /></span><small>MONTHLY EXPENSES</small><strong>{money(expenses)}</strong><p>Manually recorded expenses</p></div><div className="cash-stat"><span className="cash-stat-icon cash-icon-blue"><TrendingUp size={20} /></span><small>MONTHLY CASH FLOW</small><strong>{money(monthCashSales + income - expenses)}</strong><p>Cash received less cash spent</p></div></div>
    <div className="cash-main-grid"><section className="panel cash-chart-panel"><PanelHeading title="Cash flow" subtitle="Cash in vs. cash out over the last 6 months" /><div className="cash-chart-legend"><span><i className="legend-dot green" /> Cash in</span><span><i className="legend-dot coral" /> Cash out</span></div><div className="cash-bar-chart">{monthBars.map((bar, index) => <div className="cash-bar-group" key={months[index]}><div className="cash-bar-pair"><div className="cash-bar-in" style={{ height: `${Math.max(2, (bar.income / maxBar) * 100)}%` }} title={`Cash in: ${money(bar.income)}`} /><div className="cash-bar-out" style={{ height: `${Math.max(2, (bar.expense / maxBar) * 100)}%` }} title={`Cash out: ${money(bar.expense)}`} /></div><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${months[index]}-15T12:00:00+06:00`))}</span></div>)}</div></section><section className="panel payment-panel"><PanelHeading title="Payment methods" subtitle="Where this month's sales came from" /><div className="payment-breakdown">{paymentMethods.map((method) => { const amount = monthSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.total, 0); const percent = revenue ? Math.round((amount / revenue) * 100) : 0; return <div className="payment-row" key={method}><div><span>{method}</span><strong>{money(amount)}</strong></div><div className="payment-track"><i style={{ width: `${percent}%` }} className={`payment-${method.toLowerCase().replace(" ", "-")}`} /></div><small>{percent}% of revenue</small></div>; })}</div></section></div>
    <section className="panel ledger-panel"><PanelHeading title="Cash activity" subtitle="Cash sales and manually recorded entries" action={<span className="panel-period">Recent activity</span>} />{ledger.length ? <div className="ledger-list">{ledger.map((entry) => <div className="ledger-row" key={entry.id}><span className={`ledger-icon ${entry.type === "income" ? "ledger-in" : "ledger-out"}`}>{entry.type === "income" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="ledger-name"><strong>{entry.title}</strong><small>{entry.subtitle}</small></div><span className="ledger-date">{formatDate(entry.createdAt, { year: undefined })} · {formatTime(entry.createdAt)}</span><strong className={entry.type === "income" ? "ledger-amount-in" : "ledger-amount-out"}>{entry.type === "income" ? "+" : "−"}{money(entry.amount)}</strong></div>)}</div> : <EmptyState title="No cash activity yet" description="Record a sale or add a cash entry to see it here." action={<button className="btn btn-primary" onClick={onAddEntry}>Add an entry <ArrowRight size={16} /></button>} />}</section>
  </div>;
}
