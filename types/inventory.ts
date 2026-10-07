export type MovementType = "entry" | "exit";

export interface Product {
  id: string;
  name: string;
  unit?: string;
  lowStockThreshold: number;
  sku?: string;
  active?: boolean;
}

export interface InventoryOperation {
  id: string;
  reference: string;
  type: MovementType;
  productId: string;
  quantity: number;
  party: string;
  note: string;
  createdAt: string;
  user: string;
  createdBy?: string;
}

export interface ProductStock extends Product {
  stock: number;
}

export interface DashboardSummary {
  currentStock: number;
  incomingToday: number;
  outgoingToday: number;
  lowStockCount: number;
}
