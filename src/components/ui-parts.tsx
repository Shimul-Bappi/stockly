"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Cable, Headphones, Home, Package, ShoppingBag, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";

export function PageHeading({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div className="page-heading-copy">
        <div className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  );
}

export function PanelHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="panel-heading">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export function ProductThumb({ product, size = "regular" }: { product: Pick<Product, "category" | "name">; size?: "regular" | "small" }) {
  const category = product.category.toLowerCase();
  const Icon = category.includes("electronic") ? (product.name.toLowerCase().includes("cable") ? Cable : Headphones)
    : category.includes("home") ? Home
    : category.includes("station") ? BookOpen
    : category.includes("access") ? ShoppingBag : Package;
  const tone = category.includes("electronic") ? "blue" : category.includes("home") ? "peach" : category.includes("station") ? "lavender" : category.includes("access") ? "mint" : "gray";
  return <span className={`product-thumb thumb-${tone} ${size === "small" ? "product-thumb-small" : ""}`}><Icon size={size === "small" ? 18 : 21} strokeWidth={1.8} /></span>;
}

export function StockBadge({ product }: { product: Pick<Product, "stock" | "reorderLevel"> }) {
  const out = product.stock === 0;
  const low = !out && product.stock <= product.reorderLevel;
  return <span className={`status-badge ${out ? "status-out" : low ? "status-low" : "status-good"}`}><span className="status-dot" />{out ? "Out of stock" : low ? "Low stock" : "In stock"}</span>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = "mint", featured = false, foot }: { label: string; value: string; detail: ReactNode; icon: LucideIcon; tone?: string; featured?: boolean; foot?: string }) {
  return (
    <div className={`stat-card ${featured ? "stat-featured" : ""}`}>
      <div className="stat-top"><span className={`stat-icon tone-${tone}`}><Icon size={21} strokeWidth={1.9} /></span><span className="stat-more">↗</span></div>
      <div className="stat-bottom"><p className="stat-label">{label}</p><div className="stat-value">{value}</div><div className="stat-detail">{detail}{foot && <span>{foot}</span>}</div></div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Sparkles size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
