"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useInventory } from "@/components/layout/inventory-provider";
import { getInventoryErrorMessage } from "@/services/inventory";
import {
  productCategories,
  isProductCategory,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@/types/inventory";
import { Icon } from "@/components/ui/icon";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const { addProduct, updateProduct } = useInventory();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "أتاي");
  const [unit, setUnit] = useState(product?.unit ?? "كرتون");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 10),
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [format, setFormat] = useState(product?.format ?? "");
  const [garmentType, setGarmentType] = useState(product?.garmentType ?? "");
  const [size, setSize] = useState(product?.size ?? "");
  const [color, setColor] = useState(product?.color ?? "");
  const [active, setActive] = useState(product?.active !== false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(product);

  function changeCategory(nextCategory: ProductCategory) {
    setCategory(nextCategory);
    setUnit(nextCategory === "أتاي" ? "كرتون" : "قطعة");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const threshold = Number(lowStockThreshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      setError("يرجى إدخال حد تنبيه صحيح لا يقل عن صفر.");
      return;
    }

    const input: ProductInput = {
      name,
      category,
      unit,
      lowStockThreshold: threshold,
      sku,
      brand,
      format,
      garmentType,
      size,
      color,
      active,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      if (product) {
        await updateProduct(product.id, input);
      } else {
        await addProduct(input);
      }
      router.push("/produits");
      router.refresh();
    } catch (saveError) {
      setError(getInventoryErrorMessage(saveError, isEditing ? "تعديل المنتج" : "إضافة المنتج"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="product-form-card simple-card">
      <div className="product-form-heading">
        <span className="product-icon" aria-hidden="true"><Icon name="package" size={22} /></span>
        <div>
          <h2>{isEditing ? "تعديل بيانات المنتج" : "إضافة منتج إلى المخزون"}</h2>
          <p>تُحفظ الكميات من خلال حركات الإدخال والإخراج لضمان دقة الرصيد.</p>
        </div>
      </div>

      <form className="product-edit-form" onSubmit={handleSubmit}>
        <div className="product-form-grid">
          <label className="form-field">
            <span>الفئة</span>
            <select
              disabled={isEditing}
              onChange={(event) => {
                if (isProductCategory(event.target.value)) {
                  changeCategory(event.target.value);
                }
              }}
              value={category}
            >
              {productCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {isEditing && <small>لا يمكن تغيير فئة المنتج بعد إنشائه.</small>}
          </label>
          <label className="form-field">
            <span>اسم المنتج</span>
            <input autoComplete="off" maxLength={160} required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {category === "أتاي" ? (
            <>
              <label className="form-field">
                <span>العلامة التجارية</span>
                <input maxLength={120} required value={brand} onChange={(event) => setBrand(event.target.value)} />
              </label>
              <label className="form-field">
                <span>الوزن أو الصيغة</span>
                <input maxLength={80} placeholder="مثال: 500 غرام" required value={format} onChange={(event) => setFormat(event.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="form-field">
                <span>المرجع</span>
                <input autoComplete="off" maxLength={80} required value={sku} onChange={(event) => setSku(event.target.value)} />
              </label>
              <label className="form-field">
                <span>نوع الملابس</span>
                <input maxLength={100} required value={garmentType} onChange={(event) => setGarmentType(event.target.value)} />
              </label>
              <label className="form-field">
                <span>المقاس</span>
                <input maxLength={60} required value={size} onChange={(event) => setSize(event.target.value)} />
              </label>
              <label className="form-field">
                <span>اللون</span>
                <input maxLength={80} required value={color} onChange={(event) => setColor(event.target.value)} />
              </label>
            </>
          )}
          <label className="form-field">
            <span>وحدة المخزون</span>
            <input maxLength={40} required value={unit} onChange={(event) => setUnit(event.target.value)} />
          </label>
          <label className="form-field">
            <span>حد تنبيه انخفاض المخزون</span>
            <input
              inputMode="numeric"
              min="0"
              required
              type="number"
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>حالة المنتج</span>
            <select value={active ? "active" : "inactive"} onChange={(event) => setActive(event.target.value === "active")}>
              <option value="active">متاح للحركات</option>
              <option value="inactive">غير متاح للحركات</option>
            </select>
          </label>
        </div>

        {error && <p className="form-message form-message-error" role="alert">{error}</p>}

        <div className="product-form-actions">
          <button className="button button-entry" disabled={isSubmitting} type="submit">
            {isSubmitting ? "جارٍ الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة المنتج"}
          </button>
          <button className="button button-secondary" disabled={isSubmitting} onClick={() => router.push("/produits")} type="button">
            إلغاء
          </button>
        </div>
      </form>
    </section>
  );
}
