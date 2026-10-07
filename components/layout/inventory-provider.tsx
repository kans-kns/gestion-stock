"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createProduct as saveProduct,
  createStockMovement as saveStockMovement,
  getInventoryErrorMessage,
  loadMovements,
  loadProductStocks,
  loadProducts,
  resetInventory as resetInventoryData,
  type ResetInventoryResult,
} from "@/services/inventory";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { InventoryOperation, MovementType, Product, ProductStock } from "@/types/inventory";

interface MovementInput {
  type: MovementType;
  productId: string;
  quantity: number;
  party: string;
  note: string;
}

interface ProductInput {
  name: string;
  unit: string;
  lowStockThreshold: number;
  sku?: string;
}

type AddProductResult =
  | { success: true; product: Product }
  | { success: false; error: string };

interface InventoryContextValue {
  products: Product[];
  productStocks: ProductStock[];
  operations: InventoryOperation[];
  isLoading: boolean;
  error: string | null;
  refreshInventory: () => Promise<void>;
  addMovement: (input: MovementInput) => Promise<string | null>;
  addProduct: (input: ProductInput) => Promise<AddProductResult>;
  resetInventory: () => Promise<ResetInventoryResult>;
  productCreatedNotice: string | null;
  clearProductCreatedNotice: () => void;
}

interface RefreshInventoryOptions {
  throwOnError?: boolean;
}

export class InventoryRefreshAfterResetError extends Error {
  constructor() {
    super("تمت إعادة تعيين المخزون، لكن تعذّر تحديث البيانات المعروضة. يُرجى إعادة تحميل الصفحة.");
    this.name = "InventoryRefreshAfterResetError";
  }
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [operations, setOperations] = useState<InventoryOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productCreatedNotice, setProductCreatedNotice] = useState<string | null>(null);
  const refreshRequest = useRef(0);

  const refreshInventory = useCallback(async ({ throwOnError = false }: RefreshInventoryOptions = {}) => {
    const requestId = ++refreshRequest.current;
    setIsLoading(true);
    setError(null);

    try {
      const [nextProducts, nextProductStocks, nextOperations] = await Promise.all([
        loadProducts(),
        loadProductStocks(),
        loadMovements(),
      ]);

      if (requestId !== refreshRequest.current) return;
      setProducts(nextProducts);
      setProductStocks(nextProductStocks);
      setOperations(nextOperations);
    } catch (loadError) {
      const message = getInventoryErrorMessage(loadError);
      if (requestId === refreshRequest.current) {
        setError(message);
      }
      if (throwOnError) throw new Error(message);
    } finally {
      if (requestId === refreshRequest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription: ReturnType<
      ReturnType<typeof createBrowserSupabase>["auth"]["onAuthStateChange"]
    >["data"]["subscription"] | undefined;
    const scheduledRefreshes = new Set<number>();

    try {
      const supabase = createBrowserSupabase();
      subscription = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) {
          refreshRequest.current += 1;
          setProducts([]);
          setProductStocks([]);
          setOperations([]);
          setProductCreatedNotice(null);
          setError(null);
          setIsLoading(false);
          return;
        }

        if (
          event === "INITIAL_SESSION"
          || event === "SIGNED_IN"
          || event === "TOKEN_REFRESHED"
          || event === "USER_UPDATED"
        ) {
          const timer = window.setTimeout(() => {
            scheduledRefreshes.delete(timer);
            void refreshInventory();
          }, 0);
          scheduledRefreshes.add(timer);
        }
      }).data.subscription;
    } catch (initializationError) {
      const timer = window.setTimeout(() => {
        scheduledRefreshes.delete(timer);
        setError(getInventoryErrorMessage(initializationError));
        setIsLoading(false);
      }, 0);
      scheduledRefreshes.add(timer);
    }

    return () => {
      scheduledRefreshes.forEach((timer) => window.clearTimeout(timer));
      subscription?.unsubscribe();
      refreshRequest.current += 1;
    };
  }, [refreshInventory]);

  const addProduct = useCallback(async (input: ProductInput): Promise<AddProductResult> => {
    const name = input.name.trim();
    const unit = input.unit.trim();
    const sku = input.sku?.trim() || undefined;

    if (!name) return { success: false, error: "يرجى إدخال اسم المنتج." };
    if (!unit) return { success: false, error: "يرجى إدخال الوحدة." };
    if (!Number.isSafeInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
      return { success: false, error: "حد التنبيه يجب أن يكون رقمًا صحيحًا يساوي صفرًا أو أكبر." };
    }
    if (products.some((product) => product.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return { success: false, error: "توجد سلعة بهذا الاسم بالفعل." };
    }
    if (sku && products.some((product) => product.sku?.trim().toLocaleLowerCase() === sku.toLocaleLowerCase())) {
      return { success: false, error: "رمز المنتج مستخدم من قبل." };
    }

    try {
      const product = await saveProduct({
        name,
        unit,
        lowStockThreshold: input.lowStockThreshold,
        sku,
      });
      setProductCreatedNotice("تمت إضافة المنتج بنجاح.");
      await refreshInventory();
      return { success: true, product };
    } catch (saveError) {
      return {
        success: false,
        error: getInventoryErrorMessage(saveError, "إضافة المنتج"),
      };
    }
  }, [products, refreshInventory]);

  const addMovement = useCallback(async (input: MovementInput): Promise<string | null> => {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      return "يرجى إدخال كمية صحيحة أكبر من صفر.";
    }

    const product = productStocks.find((item) => item.id === input.productId);
    if (!product) return "يرجى اختيار المنتج.";
    if (!input.party.trim()) return "يرجى إدخال اسم المورد أو العميل.";
    if (input.type === "exit" && input.quantity > product.stock) {
      return "الكمية المطلوبة أكبر من المخزون المتوفر.";
    }

    try {
      await saveStockMovement(input);
      await refreshInventory();
      return null;
    } catch (saveError) {
      return getInventoryErrorMessage(saveError, "تسجيل حركة المخزون");
    }
  }, [productStocks, refreshInventory]);

  const resetInventory = useCallback(async (): Promise<ResetInventoryResult> => {
    const result = await resetInventoryData();
    setProductCreatedNotice(null);
    try {
      await refreshInventory({ throwOnError: true });
    } catch {
      throw new InventoryRefreshAfterResetError();
    }
    return result;
  }, [refreshInventory]);

  const value = useMemo<InventoryContextValue>(() => ({
    products,
    productStocks,
    operations,
    isLoading,
    error,
    refreshInventory,
    addMovement,
    addProduct,
    resetInventory,
    productCreatedNotice,
    clearProductCreatedNotice: () => setProductCreatedNotice(null),
  }), [
    products,
    productStocks,
    operations,
    isLoading,
    error,
    refreshInventory,
    addMovement,
    addProduct,
    resetInventory,
    productCreatedNotice,
  ]);

  return (
    <InventoryContext.Provider value={value}>
      {isLoading && (
        <p className="form-message form-message-success" role="status">
          جارٍ تحميل بيانات المخزون...
        </p>
      )}
      {error && (
        <p className="form-message form-message-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used inside InventoryProvider.");
  return context;
}
