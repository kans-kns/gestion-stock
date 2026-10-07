"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useInventory } from "@/components/layout/inventory-provider";

const productUnits = ["طرد", "قطعة", "كرتون", "صندوق", "وحدة"] as const;

export default function AjouterProduitPage() {
  const router = useRouter();
  const { addProduct } = useInventory();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>(productUnits[0]);
  const [customUnit, setCustomUnit] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [sku, setSku] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const cleanName = name.trim();
    const cleanUnit = (unit === "custom" ? customUnit : unit).trim();
    const threshold = Number(lowStockThreshold);

    if (!cleanName) {
      setError("يرجى إدخال اسم المنتج.");
      return;
    }
    if (!cleanUnit) {
      setError("يرجى إدخال الوحدة.");
      return;
    }
    if (!lowStockThreshold.trim() || !Number.isSafeInteger(threshold) || threshold < 0) {
      setError("حد التنبيه يجب أن يكون رقمًا صحيحًا يساوي صفرًا أو أكبر.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const result = await addProduct({
        name: cleanName,
        unit: cleanUnit,
        lowStockThreshold: threshold,
        sku,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }

      setName("");
      setUnit(productUnits[0]);
      setCustomUnit("");
      setLowStockThreshold("10");
      setSku("");
      router.push("/produits");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="add-product-page">
      <div className="page-heading">
        <div>
          <h1>إضافة منتج</h1>
          <p>أضف منتجًا جديدًا إلى قائمة المنتجات</p>
        </div>
      </div>
      <div className="simple-card add-product-card">
        <form className="add-product-page-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>اسم المنتج *</span>
            <input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: زيت 5 لترات"
              required
              value={name}
            />
          </label>
          <div className="form-field">
            <label htmlFor="product-unit">الوحدة *</label>
            <select
              id="product-unit"
              onChange={(event) => setUnit(event.target.value)}
              required
              value={unit}
            >
              {productUnits.map((productUnit) => (
                <option key={productUnit} value={productUnit}>{productUnit}</option>
              ))}
              <option value="custom">وحدة مخصصة</option>
            </select>
            {unit === "custom" && (
              <input
                aria-label="الوحدة المخصصة"
                onChange={(event) => setCustomUnit(event.target.value)}
                placeholder="اكتب الوحدة"
                required
                value={customUnit}
              />
            )}
          </div>
          <label className="form-field">
            <span>حد التنبيه للمخزون *</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => setLowStockThreshold(event.target.value)}
              required
              type="number"
              value={lowStockThreshold}
            />
          </label>
          <label className="form-field">
            <span>رمز المنتج <small>اختياري</small></span>
            <input
              autoCapitalize="characters"
              onChange={(event) => setSku(event.target.value)}
              placeholder="أدخل رمز المنتج"
              dir="ltr"
              value={sku}
            />
          </label>
          {error && <p className="form-message form-message-error" role="alert">{error}</p>}
          <div className="add-product-page-actions">
            <button className="button button-entry" disabled={isSaving} type="submit">
              {isSaving ? "جارٍ الحفظ..." : "حفظ المنتج"}
            </button>
            <Link className="button button-secondary" href="/produits">إلغاء</Link>
          </div>
        </form>
      </div>
    </section>
  );
}
