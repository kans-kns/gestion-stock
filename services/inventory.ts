import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  type DashboardSummary,
  type InventoryOperation,
  type MovementType,
  type Product,
  type ProductCategory,
  type ProductInput,
  type ProductStock,
  isProductCategory,
} from "@/types/inventory";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  low_stock_threshold: number;
  sku: string | null;
  brand: string | null;
  format: string | null;
  garment_type: string | null;
  size: string | null;
  color: string | null;
  active: boolean;
}

interface ProductStockRow {
  product_id: string;
  name: string;
  category: string;
  unit: string;
  low_stock_threshold: number;
  current_stock: number | string;
  active: boolean;
  sku: string | null;
  brand: string | null;
  format: string | null;
  garment_type: string | null;
  size: string | null;
  color: string | null;
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

const productColumns =
  "id,name,category,unit,low_stock_threshold,sku,brand,format,garment_type,size,color,active";
const movementColumns =
  "id,reference,product_id,type,quantity,party,note,created_at,created_by,profiles(display_name)";
const movementPageSize = 1000;
const nullableProductFields = (input: ProductInput) => ({
  sku: input.sku.trim() || null,
  brand: input.brand.trim() || null,
  format: input.format.trim() || null,
  garment_type: input.garmentType.trim() || null,
  size: input.size.trim() || null,
  color: input.color.trim() || null,
});

export interface ResetInventoryResult {
  success: true;
  deletedMovements: number;
  preservedProducts: number;
}

function toErrorMessage(error: unknown, action: string): string {
  const details = typeof error === "object" && error !== null
    ? error as { code?: unknown; message?: unknown }
    : null;
  const code = typeof details?.code === "string" ? details.code : "";
  const message = typeof details?.message === "string" ? details.message : "";
  const normalizedMessage = message.toLocaleLowerCase();

  if (
    (code === "42703" && normalizedMessage.includes("category"))
    || (code === "PGRST204" && normalizedMessage.includes("category"))
  ) {
    return "يلزم تطبيق migration 007 محليًا على قاعدة البيانات لإضافة أعمدة الفئات والبيانات التفصيلية، ثم تحديث مخطط Supabase.";
  }

  if (
    message.startsWith("تعذر ")
    || message.startsWith("الكمية المطلوبة أكبر من المخزون المتوفر")
    || message.startsWith("ليس لديك صلاحية")
    || message.startsWith("انتهت صلاحية الجلسة")
    || message.startsWith("السلعة المحددة غير موجودة")
    || message.startsWith("لا يمكن تسجيل حركة")
    || message.startsWith("فئة المنتج غير مسموحة")
    || message.startsWith("تتطلب منتجات أتاي")
    || message.startsWith("تتطلب منتجات الحوايج")
    || message.startsWith("لا يمكن تغيير فئة المنتج")
    || message.startsWith("لا يمكن حذف المنتجات")
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
    return "يوجد منتج بالمرجع أو البيانات نفسها.";
  }
  if (normalizedMessage.includes("only أتاي and الحوايج product categories are allowed")) {
    return "فئة المنتج غير مسموحة.";
  }
  if (normalizedMessage.includes("tea products require")) {
    return "تتطلب منتجات أتاي علامة تجارية ووزنًا أو صيغة.";
  }
  if (normalizedMessage.includes("clothing products require")) {
    return "تتطلب منتجات الحوايج مرجعًا ونوعًا ومقاسًا ولونًا.";
  }
  if (normalizedMessage.includes("a product category cannot be changed")) {
    return "لا يمكن تغيير فئة المنتج بعد إنشائه.";
  }
  if (normalizedMessage.includes("products cannot be deleted")) {
    return "لا يمكن حذف المنتجات من قائمة المخزون.";
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
  if (!isProductCategory(row.category)) {
    throw new Error("تحتوي قاعدة البيانات على فئة منتجات غير معتمدة.");
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold,
    ...(row.sku ? { sku: row.sku } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.format ? { format: row.format } : {}),
    ...(row.garment_type ? { garmentType: row.garment_type } : {}),
    ...(row.size ? { size: row.size } : {}),
    ...(row.color ? { color: row.color } : {}),
    active: row.active,
  };
}

function mapProductStock(row: ProductStockRow): ProductStock {
  if (!isProductCategory(row.category)) {
    throw new Error("تحتوي قاعدة البيانات على فئة منتجات غير معتمدة.");
  }

  const stock = Number(row.current_stock);
  if (!Number.isSafeInteger(stock)) {
    throw new Error("قيمة المخزون تتجاوز النطاق الآمن للعرض.");
  }

  return {
    id: row.product_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold,
    active: row.active,
    ...(row.sku ? { sku: row.sku } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.format ? { format: row.format } : {}),
    ...(row.garment_type ? { garmentType: row.garment_type } : {}),
    ...(row.size ? { size: row.size } : {}),
    ...(row.color ? { color: row.color } : {}),
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

function assertUniqueProductIds(products: Product[]): void {
  const ids = new Set<string>();
  for (const product of products) {
    if (ids.has(product.id)) {
      throw new Error("تحتوي قاعدة البيانات على سجلات منتجات مكررة.");
    }
    ids.add(product.id);
  }
}

export async function loadProducts(): Promise<Product[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .order("name", { ascending: true });

  if (error) throw new Error(toErrorMessage(error, "تحميل المنتجات"));
  const products = ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
  assertUniqueProductIds(products);
  return products;
}

export async function loadProductStocks(): Promise<ProductStock[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("product_stock")
    .select("product_id,name,category,unit,low_stock_threshold,current_stock,active,sku,brand,format,garment_type,size,color")
    .order("name", { ascending: true });

  if (error) throw new Error(toErrorMessage(error, "تحميل أرصدة المنتجات"));
  const products = ((data ?? []) as unknown as ProductStockRow[]).map(mapProductStock);
  assertUniqueProductIds(products);
  return products;
}

function productPayload(input: ProductInput) {
  return {
    name: input.name.trim(),
    category: input.category,
    unit: input.unit.trim(),
    low_stock_threshold: input.lowStockThreshold,
    active: input.active,
    ...nullableProductFields(input),
  };
}

function validateProductInput(input: ProductInput): void {
  if (!isProductCategory(input.category)) {
    throw new Error("فئة المنتج غير مسموحة.");
  }
  if (!input.name.trim() || !input.unit.trim()) {
    throw new Error("يرجى إدخال اسم المنتج ووحدة المخزون.");
  }
  if (!Number.isSafeInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
    throw new Error("يرجى إدخال حد تنبيه صحيح لا يقل عن صفر.");
  }
  if (input.category === "أتاي" && (!input.brand.trim() || !input.format.trim())) {
    throw new Error("تتطلب منتجات أتاي علامة تجارية ووزنًا أو صيغة.");
  }
  if (
    input.category === "الحوايج"
    && (!input.sku.trim() || !input.garmentType.trim() || !input.size.trim() || !input.color.trim())
  ) {
    throw new Error("تتطلب منتجات الحوايج مرجعًا ونوعًا ومقاسًا ولونًا.");
  }
}

export async function createProduct(input: ProductInput): Promise<Product> {
  validateProductInput(input);
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("products")
    .insert(productPayload(input))
    .select(productColumns)
    .single();

  if (error) throw new Error(toErrorMessage(error, "إضافة المنتج"));
  return mapProduct(data as unknown as ProductRow);
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  validateProductInput(input);
  const supabase = createBrowserSupabase();
  const payload = productPayload(input);
  const { data, error } = await supabase
    .from("products")
    .update({
      name: payload.name,
      unit: payload.unit,
      low_stock_threshold: payload.low_stock_threshold,
      active: payload.active,
      sku: payload.sku,
      brand: payload.brand,
      format: payload.format,
      garment_type: payload.garment_type,
      size: payload.size,
      color: payload.color,
    })
    .eq("id", id)
    .select(productColumns)
    .single();

  if (error) throw new Error(toErrorMessage(error, "تعديل المنتج"));
  return mapProduct(data as unknown as ProductRow);
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
    || !("preserved_products" in result)
    || typeof result.deleted_movements !== "number"
    || !Number.isSafeInteger(result.deleted_movements)
    || typeof result.preserved_products !== "number"
    || !Number.isSafeInteger(result.preserved_products)
    || result.preserved_products < 0
  ) {
    throw new Error("لم تُرجع قاعدة البيانات نتيجة صالحة لإعادة تعيين المخزون.");
  }

  return {
    success: true,
    deletedMovements: result.deleted_movements,
    preservedProducts: result.preserved_products,
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
  const byCategory: DashboardSummary["byCategory"] = {
    "أتاي": [],
    "الحوايج": [],
  };
  const stockByProductId = new Map<string, DashboardSummary["byCategory"][ProductCategory][number]>();

  for (const product of productStocks) {
    const unit = product.unit || (product.category === "أتاي" ? "كرتون" : "قطعة");
    let summary = byCategory[product.category].find((item) => item.unit === unit);
    if (!summary) {
      summary = {
        unit,
        currentStock: 0,
        incomingToday: 0,
        outgoingToday: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
      };
      byCategory[product.category].push(summary);
    }
    summary.currentStock += product.stock;
    stockByProductId.set(product.id, summary);
  }

  for (const operation of operations) {
    const summary = stockByProductId.get(operation.productId);
    if (!summary) continue;
    if (operation.type === "entry") {
      summary.totalIncoming += operation.quantity;
      if (isToday(operation.createdAt)) summary.incomingToday += operation.quantity;
    } else {
      summary.totalOutgoing += operation.quantity;
      if (isToday(operation.createdAt)) summary.outgoingToday += operation.quantity;
    }
  }

  return {
    byCategory,
    lowStockCount: productStocks.filter((product) => product.stock <= product.lowStockThreshold).length,
  };
}

export function getProductSearchText(product: Product): string {
  return [
    product.category,
    product.name,
    product.unit ?? "",
    product.sku ?? "",
    product.brand ?? "",
    product.format ?? "",
    product.garmentType ?? "",
    product.size ?? "",
    product.color ?? "",
  ].join(" ");
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
