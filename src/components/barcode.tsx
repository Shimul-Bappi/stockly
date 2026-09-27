"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";
import type { GeneratedLabel, LabelSheet, Product } from "@/lib/types";
import { money } from "@/lib/format";

export function BarcodeSvg({ value, height = 36, className = "" }: { value: string; height?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 1.35,
        height,
        displayValue: false,
        margin: 10,
        background: "#ffffff",
        lineColor: "#152723",
      });
    } catch (error) {
      console.error("Could not render barcode", error);
    }
  }, [value, height]);

  return <svg ref={svgRef} className={className} aria-label={`Barcode ${value}`} role="img" />;
}

export function BarcodeLabel({ label, companyName }: { label: GeneratedLabel; companyName: string }) {
  return (
    <div className="barcode-label">
      <div className="barcode-label-company">{companyName}</div>
      <div className="barcode-label-name">{label.productName}</div>
      <BarcodeSvg value={label.barcode} height={34} className="barcode-label-svg" />
      <div className="barcode-label-code">{label.barcode}</div>
      <div className="barcode-label-price">MRP {money(label.mrp)}</div>
    </div>
  );
}

export function PrintSheets({ sheet }: { sheet: LabelSheet }) {
  return (
    <div className="print-root" aria-hidden="true">
      <div className="print-page">
        {sheet.labels.map((label) => <BarcodeLabel key={label.serial} label={label} companyName={sheet.companyName} />)}
      </div>
    </div>
  );
}

// Product-code tags are for Stock in / Sales, unlike the independent serial labels above.
export function InventoryTag({ product, companyName }: { product: Product; companyName: string }) {
  return <div className="barcode-label">
    <div className="barcode-label-company">{companyName}</div>
    <div className="barcode-label-name">{product.name}</div>
    <BarcodeSvg value={product.barcode} height={34} className="barcode-label-svg" />
    <div className="barcode-label-code">{product.barcode}</div>
    <div className="barcode-label-price">MRP {money(product.mrp)}</div>
  </div>;
}

export function InventoryPrintSheets({ products, companyName, copies }: { products: Product[]; companyName: string; copies: number }) {
  const labels = products.flatMap((product) => Array.from({ length: copies }, () => product));
  const pages: Product[][] = [];
  for (let index = 0; index < labels.length; index += 20) pages.push(labels.slice(index, index + 20));
  return <div className="stock-print-root" aria-hidden="true">{pages.map((page, pageIndex) =>
    <div className="print-page" key={pageIndex}>{page.map((product, index) =>
      <InventoryTag key={`${pageIndex}-${index}`} product={product} companyName={companyName} />
    )}</div>
  )}</div>;
}
