"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useInventory } from "@/components/layout/inventory-provider";
import { getProductLabel, SearchableProductPicker } from "@/components/stock/filter-controls";
import type { MovementType } from "@/types/inventory";
import { Icon } from "@/components/ui/icon";

export function MovementForm({ type }: { type: MovementType }) {
  const { productStocks, addMovement, isLoading } = useInventory();
  const availableProducts = productStocks.filter((product) => product.active !== false);
  const isEntry = type === "entry";
  const [productId, setProductId] = useState("");
  const [productQuery, setProductQuery] = useState(
    "",
  );
  const [quantity, setQuantity] = useState("1");
  const [party, setParty] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const initializedProduct = useRef(false);

  useEffect(() => {
    if (initializedProduct.current || availableProducts.length === 0) return;
    const firstProduct = availableProducts[0];
    initializedProduct.current = true;
    setProductId(firstProduct.id);
    setProductQuery(getProductLabel(firstProduct));
  }, [availableProducts]);

  function handleProductQuery(query: string) {
    setProductQuery(query);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matchingProduct = availableProducts.find((product) => {
      const label = getProductLabel(product).toLocaleLowerCase();
      return label === normalizedQuery || product.name.toLocaleLowerCase() === normalizedQuery;
    });
    setProductId(matchingProduct?.id ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      const error = await addMovement({ type, productId, quantity: Number(quantity), party, note });
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }

      setMessage({
        type: "success",
        text: isEntry ? "تم تسجيل المدخل بنجاح" : "تم تسجيل المخرج بنجاح",
      });
      setQuantity("1");
      setParty("");
      setNote("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={`form-card simple-card${isEntry ? " movement-entry-card" : " movement-exit-card"}`}>
      <div className={`movement-form-heading${isEntry ? " movement-form-heading-entry" : " movement-form-heading-exit"}`}>
        <span className={`form-icon ${isEntry ? "form-icon-entry" : "form-icon-exit"}`}>
          <Icon name={isEntry ? "arrowDown" : "arrowUp"} size={23} />
        </span>
        <div>
          <h2>{isEntry ? "تفاصيل المدخل" : "تفاصيل المخرج"}</h2>
          <p>{isEntry ? "أدخل بيانات المنتجات الواردة إلى المخزون" : "أدخل بيانات المنتجات الخارجة من المخزون"}</p>
        </div>
      </div>
      <form className={`movement-form${isEntry ? " movement-form-entry" : " movement-form-exit"}`} onSubmit={handleSubmit}>
        <div className="movement-form-details">
          <div className="form-field">
            <span className="movement-field-label">
              {!isEntry && <Icon name="package" size={16} />}
              المنتج
            </span>
            <SearchableProductPicker
              onChange={handleProductQuery}
              placeholder={availableProducts.length ? "ابحث عن المنتج أو اختره" : "لا توجد منتجات في المخزون"}
              products={availableProducts}
              query={productQuery}
              required
            />
            {isEntry && (
              <Link className="text-link add-product-link" href="/ajouter-produit">
                لا تجد المنتج؟ أضف منتجًا
              </Link>
            )}
          </div>
          <label className="form-field">
            <span className="movement-field-label">
              {!isEntry && <Icon name="activity" size={16} />}
              الكمية
            </span>
            <div className="quantity-input-wrap">
              <input
                inputMode="numeric"
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                required
                type="number"
                value={quantity}
              />
              <span>طرد</span>
            </div>
          </label>
        </div>
        <div className="movement-form-source">
          <label className="form-field">
            <span className="movement-field-label">
              {!isEntry && <Icon name="users" size={16} />}
              {isEntry ? "المورد" : "المستلم / الجهة"}
            </span>
            <input
              onChange={(event) => setParty(event.target.value)}
              placeholder={isEntry ? "اسم المورد" : "اسم العميل أو الجهة"}
              required
              value={party}
            />
          </label>
        </div>
        <label className="form-field">
          <span className="movement-field-label">
            {!isEntry && <Icon name="more" size={16} />}
            ملاحظات <small>اختياري</small>
          </span>
          <textarea onChange={(event) => setNote(event.target.value)} placeholder="أضف ملاحظة إن وجدت" rows={3} value={note} />
        </label>
        {message && (
          <p className={`form-message movement-feedback form-message-${message.type}${!isEntry && message.type === "error" && message.text === "الكمية المطلوبة أكبر من المخزون المتوفر." ? " movement-feedback-stock-warning" : ""}`} role={message.type === "error" ? "alert" : "status"}>
            <Icon name={message.type === "success" ? "check" : "alert"} size={18} />
            {message.text}
          </p>
        )}
        <button
          className={`button form-submit ${isEntry ? "button-entry" : "button-exit"}`}
          disabled={isLoading || isSubmitting}
          type="submit"
        >
          {isSubmitting && <span aria-hidden="true" className="movement-submit-spinner" />}
          {isSubmitting ? "جارٍ التسجيل..." : isEntry ? "تسجيل المدخل" : "تسجيل المخرج"}
          {!isSubmitting && <Icon name={isEntry ? "arrowDown" : "arrowUp"} size={17} />}
        </button>
      </form>
    </section>
  );
}
