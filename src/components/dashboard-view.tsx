"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, CircleAlert, Package, Printer, ScanLine, ShoppingCart, TrendingUp, Truck, Wallet } from "lucide-react";
import { compactMoney, formatDate, formatTime, money, monthKey, recentMonthKeys } from "@/lib/format";
import type { AppData, ScanMode, View } from "@/lib/types";
import { PageHeading, PanelHeading, ProductThumb, StatCard } from "@/components/ui-parts";

type Props = {
  data: AppData;
  onNavigate: (view: View) => void;
  onScan: (mode: ScanMode) => void;
  onOpenGenerator: () => void;
};

function RevenueChart({ sales }: { sales: AppData["sales"] }) {
  const months = recentMonthKeys(6);
  const totals = months.map((month) => sales.filter((sale) => monthKey(sale.createdAt) === month).reduce((sum, sale) => sum + sale.total, 0));
  const [active, setActive] = useState(5);
  const max = Math.max(1000, ...totals) * 1.18;
  const points = totals.map((amount, index) => ({ x: 61 + index * 122, y: 190 - (amount / max) * 160 }));
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const mid = (points[index - 1].x + points[index].x) / 2;
    line += ` C ${mid} ${points[index - 1].y}, ${mid} ${points[index].y}, ${points[index].x} ${points[index].y}`;
  }
  const area = `${line} L ${points[points.length - 1].x} 195 L ${points[0].x} 195 Z`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${months[active]}-15T12:00:00+06:00`));

  return (
    <div className="chart-wrap">
      <div className="chart-summary"><div><span>Revenue in {label}</span><strong>{money(totals[active])}</strong></div><span className="chart-legend"><i /> Revenue</span></div>
      <svg className="revenue-chart" viewBox="0 0 700 215" preserveAspectRatio="none" role="img" aria-label="Revenue over the last six months">
        <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30b58a" stopOpacity="0.22" /><stop offset="100%" stopColor="#30b58a" stopOpacity="0" /></linearGradient></defs>
        {[30, 70, 110, 150, 190].map((y, index) => <g key={y}><line x1="61" x2="680" y1={y} y2={y} stroke="#e9efec" strokeDasharray="4 5" /><text x="0" y={y + 4} fill="#9aa9a3" fontSize="11">{compactMoney(max * (1 - index / 4) / 1.18)}</text></g>)}
        <path d={area} fill="url(#revenueFill)" />
        <path d={line} fill="none" stroke="#169b71" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <line x1={points[active].x} x2={points[active].x} y1={points[active].y} y2="193" stroke="#4ab895" strokeWidth="1.5" strokeDasharray="4 5" />
        <circle cx={points[active].x} cy={points[active].y} r="8" fill="#ffffff" stroke="#15996d" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => <rect key={index} x={point.x - 50} y="15" width="100" height="185" fill="transparent" onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} tabIndex={0} aria-label={`${months[index]}: ${money(totals[index])}`} className="chart-hit" />)}
      </svg>
      <div className="chart-months">{months.map((month) => <span key={month}>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${month}-15T12:00:00+06:00`))}</span>)}</div>
    </div>
  );
}

export function DashboardView({ data, onNavigate, onScan, onOpenGenerator }: Props) {
  const currentMonth = monthKey(new Date());
  const previousMonth = recentMonthKeys(2)[0];
  const monthSales = data.sales.filter((sale) => monthKey(sale.createdAt) === currentMonth);
  const previousSales = data.sales.filter((sale) => monthKey(sale.createdAt) === previousMonth);
  const revenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);
  const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.total, 0);
  const change = previousRevenue > 0 ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100) : 0;
  const unitsSold = monthSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalStock = data.products.reduce((sum, product) => sum + product.stock, 0);
  const lowProducts = data.products.filter((product) => product.stock > 0 && product.stock <= product.reorderLevel);
  const outProducts = data.products.filter((product) => product.stock === 0);
  const healthy = data.products.length - lowProducts.length - outProducts.length;
  const healthyPercent = data.products.length ? Math.round((healthy / data.products.length) * 100) : 0;
  const lowPercent = data.products.length ? (lowProducts.length / data.products.length) * 100 : 0;
  const healthySlice = data.products.length ? (healthy / data.products.length) * 100 : 0;
  const donut = data.products.length
    ? `conic-gradient(#20a97a 0% ${healthySlice}%, #f5b951 ${healthySlice}% ${healthySlice + lowPercent}%, #ed806f ${healthySlice + lowPercent}% 100%)`
    : "conic-gradient(#e5eee7 0% 100%)";
  const firstName = data.settings.companyName.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="view-content">
      <PageHeading eyebrow={formatDate(new Date(), { weekday: "long" }).toUpperCase()} title={`${greeting}, ${firstName}.`} subtitle="Here's what's happening with your business today."
        actions={<><span className="header-period"><CalendarDays size={16} /> This month</span><button className="btn btn-primary" onClick={() => onScan("sale")}><ScanLine size={18} /> Quick scan</button></>} />

      {data.products.length === 0 && <div className="onboarding-card">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> GETTING STARTED</span><h2>Your workspace is ready for your first product.</h2><p>Set your business name, add a product and print its stock tag. Your live reports will fill in as you receive stock and record sales.</p></div>
        <div className="onboarding-actions"><button className="btn btn-secondary" onClick={() => onNavigate("settings")}>Business settings</button><button className="btn btn-primary" onClick={() => onNavigate("products")}>Add a product <ArrowRight size={16} /></button></div>
      </div>}

      <div className="stats-grid">
        <StatCard label="Total revenue" value={money(revenue)} icon={Wallet} featured detail={<span className={`trend-pill ${change < 0 ? "trend-down" : ""}`}><TrendingUp size={13} />{change >= 0 ? "+" : ""}{change}%</span>} foot="vs. last month" />
        <StatCard label="Products sold" value={unitsSold.toLocaleString()} icon={ShoppingCart} tone="blue" detail={<><span className="stat-detail-strong">{monthSales.length} sales</span><span>this month</span></>} />
        <StatCard label="Items in stock" value={totalStock.toLocaleString()} icon={Package} tone="purple" detail={<><span className="stat-detail-strong">{data.products.length} products</span><span>in your catalog</span></>} />
        <StatCard label="Low stock alerts" value={String(lowProducts.length + outProducts.length).padStart(2, "0")} icon={CircleAlert} tone="orange" detail={<><span className="stat-detail-warning">Needs attention</span><span>to avoid stockouts</span></>} />
      </div>

      <div className="dashboard-main-grid">
        <section className="panel revenue-panel"><PanelHeading title="Revenue overview" subtitle="Your sales performance over the last 6 months" action={<span className="panel-period">Last 6 months</span>} /><RevenueChart sales={data.sales} /></section>
        <section className="panel health-panel"><PanelHeading title="Stock health" subtitle="A snapshot of your inventory" /><div className="donut-area"><div className="stock-donut" style={{ background: donut }}><div className="donut-inner"><strong>{healthyPercent}%</strong><span>Healthy stock</span></div></div></div><div className="health-legend"><div><span><i className="legend-dot green" /> In stock</span><strong>{healthy}</strong></div><div><span><i className="legend-dot yellow" /> Low stock</span><strong>{lowProducts.length}</strong></div><div><span><i className="legend-dot coral" /> Out of stock</span><strong>{outProducts.length}</strong></div></div><button className="health-callout" onClick={() => onNavigate("products")}><span className="health-callout-icon"><CircleAlert size={18} /></span><span><strong>{lowProducts.length + outProducts.length} products need attention</strong><small>Review inventory levels</small></span><ArrowRight size={17} /></button></section>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="panel recent-panel"><PanelHeading title="Recent sales" subtitle="The latest transactions from your store" action={<button className="text-link" onClick={() => onNavigate("sales")}>View all <ArrowRight size={15} /></button>} /><div className="table-scroll"><table className="data-table recent-table"><thead><tr><th>PRODUCT</th><th>DATE & TIME</th><th>QTY</th><th>AMOUNT</th><th>PAYMENT</th></tr></thead><tbody>{data.sales.slice(0, 5).map((sale) => <tr key={sale.id}><td><div className="product-cell"><ProductThumb product={{ name: sale.productName, category: data.products.find((p) => p.id === sale.productId)?.category ?? "Other" }} size="small" /><span><strong>{sale.productName}</strong><small>{sale.productSku}</small></span></div></td><td><span className="table-main">{formatDate(sale.createdAt, { year: undefined })}</span><small className="table-sub">{formatTime(sale.createdAt)}</small></td><td><span className="table-main">{sale.quantity}</span></td><td className="amount-cell">{money(sale.total)}</td><td><span className="payment-pill">{sale.paymentMethod}</span></td></tr>)}</tbody></table></div></section>
        <section className="panel quick-panel"><PanelHeading title="Quick actions" subtitle="Jump right back into work" /><div className="quick-list"><button onClick={() => onScan("stock")}><span className="quick-icon quick-green"><Truck size={20} /></span><span><strong>Receive stock</strong><small>Scan incoming products</small></span><ArrowUpRight size={17} /></button><button onClick={() => onScan("sale")}><span className="quick-icon quick-blue"><ScanLine size={20} /></span><span><strong>Record a sale</strong><small>Scan an item at checkout</small></span><ArrowUpRight size={17} /></button><button onClick={onOpenGenerator}><span className="quick-icon quick-purple"><Printer size={20} /></span><span><strong>Generate barcodes</strong><small>1–20 unique serials per A4 sheet</small></span><ArrowUpRight size={17} /></button></div><div className="quick-tip"><span className="tip-sparkle">✦</span><div><strong>A little tip</strong><p>Keep your stock accurate by scanning every item as it arrives or sells.</p></div></div></section>
      </div>
    </div>
  );
}
