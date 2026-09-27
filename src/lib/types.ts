export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  mrp: number;
  stock: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
};

export type Sale = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  kind: string;
  quantityChange: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
};

export type CashEntry = {
  id: string;
  type: string;
  category: string;
  amount: number;
  note: string;
  createdAt: string;
};

export type GeneratedLabel = {
  serial: string;
  barcode: string;
  position: number;
  productName: string;
  sku: string | null;
  mrp: number;
};

export type LabelSheet = {
  id: string;
  companyName: string;
  labelCount: number;
  createdAt: string;
  labels: GeneratedLabel[];
};

export type LabelItemInput =
  | { source: "catalog"; productId: string; quantity: number }
  | { source: "custom"; name: string; mrp: number; quantity: number };

export type AppData = {
  settings: { companyName: string; currency: string };
  products: Product[];
  sales: Sale[];
  movements: StockMovement[];
  cashEntries: CashEntry[];
  labelSheets: LabelSheet[];
  serverTime: string;
};

export type View = "overview" | "products" | "labels" | "stock-in" | "sales" | "reports" | "cashbook" | "settings";
export type ScanMode = "stock" | "sale";
