export type MovementType = "entry" | "exit";

export const productCategories = ["أتاي", "الحوايج"] as const;

export type ProductCategory = (typeof productCategories)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return productCategories.some((category) => category === value);
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit?: string;
  lowStockThreshold: number;
  sku?: string;
  brand?: string;
  format?: string;
  garmentType?: string;
  size?: string;
  color?: string;
  active?: boolean;
}

export interface ProductInput {
  name: string;
  category: ProductCategory;
  unit: string;
  lowStockThreshold: number;
  sku: string;
  brand: string;
  format: string;
  garmentType: string;
  size: string;
  color: string;
  active: boolean;
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
  byCategory: Record<ProductCategory, Array<{
    unit: string;
    currentStock: number;
    incomingToday: number;
    outgoingToday: number;
    totalIncoming: number;
    totalOutgoing: number;
  }>>;
  lowStockCount: number;
}
