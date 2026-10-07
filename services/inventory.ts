import { createBrowserSupabase } from "@/lib/supabase/client";
import type {
  DashboardSummary,
  InventoryOperation,
  MovementType,
  Product,
  ProductStock,
} from "@/types/inventory";

interface ProductRow {
  id: string;
  name: string;
  unit: string;
  low_stock_threshold: number;
  sku: string | null;
  active: boolean;
}

interface ProductStockRow {
  product_id: string;
  name: string;
  unit: string;
  low_stock_threshold: number;
  current_stock: number | string;
  active: boolean;
}

interface MovementRow {
  id: string;
  reference: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  party: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
}

const productColumns = "id,name,unit,low_stock_threshold,sku,active";
const movementColumns =
  "id,reference,product_id,type,quantity,party,note,created_at,created_by,profiles(display_name)";
const movementPageSize = 1000;

export interface ResetInventoryResult {
  success: true;
  deletedMovements: number;
  deletedProducts: number;
}

function toErrorMessage(error: unknown, action: string): string {
  const details = typeof error === "object" && error !== null
    ? error as { code?: unknown; message?: unknown }
    : null;
  const code = typeof details?.code === "string" ? details.code : "";
  const message = typeof details?.message === "string" ? details.message : "";
  const normalizedMessage = message.toLocaleLowerCase();

  if (
    message.startsWith("تعذر ")
    || message.startsWith("الكمية المطلوبة أكبر من المخزون المتوفر")
    || message.startsWith("ليس لديك صلاحية")
    || message.startsWith("انتهت صلاحية الجلسة")
    || message.startsWith("رمز SKU مستخدم")
    || message.startsWith("السلعة المحددة غير موجودة")
    || message.startsWith("لا يمكن تسجيل حركة")
  ) {
    return message;
  }
  if (code === "42501" || code === "401" || code === "PGRST301") {
    return "انتهت صلاحية الجلسة أو لا تملك الصلاحية اللازمة. سجّل الدخول مجددًا.";
  }
  if (normalizedMessage.includes("only managers can reset inventory")) {
    return "لا تملك صلاحية إعادة تعيين المخزون. هذه العملية متاحة للمدير فقط.";
  }
  if (normalizedMessage.includes("authentication is required")) {
    return "يجب تسجيل الدخول لإعادة تعيين المخزون.";
  }
  if (code === "23505") {
    return "رمز SKU مستخدم من قبل.";
  }
  if (message.includes("الكمية المطلوبة أكبر من المخزون المتوفر")) {
    return "الكمية المطلوبة أكبر من المخزون المتوفر.";
  }
  if (normalizedMessage.includes("product not found")) {
    return "السلعة المحددة غير موجودة.";
  }
  if (normalizedMessage.includes("inactive products")) {
    return "لا يمكن تسجيل حركة لسلعة معطلة.";
  }
  if (
    error instanceof TypeError
    || normalizedMessage.includes("failed to fetch")
    || normalizedMessage.includes("network")
  ) {
    return "تعذر الاتصال بـ Supabase. تحقق من اتصال الإنترنت ثم أعد المحاولة.";
  }

  return message
    ? `تعذر ${action}: ${message}`
    : `تعذر ${action}. يرجى المحاولة مرة أخرى.`;
}

export function getInventoryErrorMessage(error: unknown, action = "تحميل بيانات المخزون"): string {
  return toErrorMessage(error, action);
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold,
    ...(row.sku ? { sku: row.sku } : {}),
    active: row.active,
  };
}

function mapProductStock(row: ProductStockRow): ProductStock {
  const stock = Number(row.current_stock);
  if (!Number.isSafeInteger(stock)) {
    throw new Error("قيمة المخزون تتجاوز النطاق الآمن للعرض.");
  }

  return {
    id: row.product_id,
    name: row.name,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold,
    active: row.active,
    stock,
  };
}

function mapMovement(row: MovementRow): InventoryOperation {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    productId: row.product_id,
    quantity: row.quantity,
    party: row.party,
    note: row.note ?? "",
    createdAt: row.created_at,
    user: profile?.display_name?.trim() || "—",
    ...(row.created_by ? { createdBy: row.created_by } : {}),
  };
}

export async function loadProducts(): Promise<Product[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .order("name", { ascending: true });

  if (error) throw new Error(toErrorMessage(error, "تحميل المنتجات"));
  return ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
}

export async function loadProductStocks(): Promise<ProductStock[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("product_stock")
    .select("product_id,name,unit,low_stock_threshold,current_stock,active")
    .order("name", { ascending: true });

  if (error) throw new Error(toErrorMessage(error, "تحميل أرصدة المنتجات"));
  return ((data ?? []) as unknown as ProductStockRow[]).map(mapProductStock);
}

export async function loadMovements(): Promise<InventoryOperation[]> {
  const supabase = createBrowserSupabase();
  const rows: MovementRow[] = [];

  for (let offset = 0; ; offset += movementPageSize) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select(movementColumns)
      .order("created_at", { ascending: false })
      .range(offset, offset + movementPageSize - 1);

    if (error) throw new Error(toErrorMessage(error, "تحميل سجل العمليات"));

    const page = (data ?? []) as unknown as MovementRow[];
    rows.push(...page);
    if (page.length < movementPageSize) break;
  }

  return rows.map(mapMovement);
}

export async function createProduct(input: {
  name: string;
  unit: string;
  lowStockThreshold: number;
  sku?: string;
}): Promise<Product> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      unit: input.unit.trim(),
      low_stock_threshold: input.lowStockThreshold,
      sku: input.sku?.trim() || null,
      active: true,
    })
    .select(productColumns)
    .single();

  if (error) throw new Error(toErrorMessage(error, "إضافة السلعة"));
  if (!data) throw new Error("لم تُرجع قاعدة البيانات بيانات السلعة التي أُضيفت.");
  return mapProduct(data as unknown as ProductRow);
}

export async function createStockMovement(input: {
  type: MovementType;
  productId: string;
  quantity: number;
  party: string;
  note: string;
}): Promise<InventoryOperation> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc("create_stock_movement", {
    p_product_id: input.productId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_party: input.party.trim(),
    p_note: input.note.trim() || null,
  });

  if (error) throw new Error(toErrorMessage(error, "تسجيل حركة المخزون"));

  const row = (Array.isArray(data) ? data[0] : data) as unknown as MovementRow | null;
  if (!row) throw new Error("لم تُرجع قاعدة البيانات تفاصيل حركة المخزون.");
  return mapMovement(row);
}

export async function resetInventory(): Promise<ResetInventoryResult> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc("reset_inventory");

  if (error) throw new Error(toErrorMessage(error, "إعادة تعيين المخزون"));

  const result: unknown = data;
  if (
    typeof result !== "object"
    || result === null
    || !("success" in result)
    || result.success !== true
    || !("deleted_movements" in result)
    || !("deleted_products" in result)
    || typeof result.deleted_movements !== "number"
    || !Number.isSafeInteger(result.deleted_movements)
    || typeof result.deleted_products !== "number"
    || !Number.isSafeInteger(result.deleted_products)
  ) {
    throw new Error("لم تُرجع قاعدة البيانات نتيجة صالحة لإعادة تعيين المخزون.");
  }

  return {
    success: true,
    deletedMovements: result.deleted_movements,
    deletedProducts: result.deleted_products,
  };
}

export function isToday(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function getDashboardSummary(
  productStocks: ProductStock[],
  operations: InventoryOperation[],
): DashboardSummary {
  return {
    currentStock: productStocks.reduce((total, product) => total + product.stock, 0),
    incomingToday: operations
      .filter((operation) => operation.type === "entry" && isToday(operation.createdAt))
      .reduce((total, operation) => total + operation.quantity, 0),
    outgoingToday: operations
      .filter((operation) => operation.type === "exit" && isToday(operation.createdAt))
      .reduce((total, operation) => total + operation.quantity, 0),
    lowStockCount: productStocks.filter((product) => product.stock <= product.lowStockThreshold).length,
  };
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("ar").format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ar", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ar", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}
