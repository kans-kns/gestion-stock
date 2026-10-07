"use client";

import Link from "next/link";
import { useState } from "react";
import { useInventory } from "@/components/layout/inventory-provider";
import { FilterField, SearchField } from "@/components/stock/filter-controls";
import { formatQuantity } from "@/services/inventory";
import { Icon } from "@/components/ui/icon";

type ProductStatus = "all" | "active" | "inactive" | "low";

function isProductStatus(value: string): value is ProductStatus {
  return value === "all" || value === "active" || value === "inactive" || value === "low";
}

export default function ProduitsPage() {
  const {
    productStocks,
    productCreatedNotice,
    clearProductCreatedNotice,
    isLoading,
    error,
    refreshInventory,
  } = useInventory();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus>("all");

  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredProducts = productStocks.filter((product) => {
    const matchesSearch = !searchTerm
      || `${product.name} ${product.unit ?? ""}`.toLocaleLowerCase().includes(searchTerm);
    const isActive = product.active !== false;
    const matchesStatus = status === "all"
      || (status === "active" && isActive)
      || (status === "inactive" && !isActive)
      || (status === "low" && isActive && product.stock <= product.lowStockThreshold);
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="inventory-page">
      <div className="page-heading">
        <div><h1>المنتجات</h1><p>إدارة المنتجات ومتابعة حالتها في المخزون</p></div>
        <Link className="button button-entry" href="/ajouter-produit">
          <Icon name="package" size={18} />
          إضافة منتج
        </Link>
      </div>
      {productCreatedNotice && (
        <div className="form-message form-message-success product-created-notice" role="status">
          <span>{productCreatedNotice}</span>
          <button aria-label="إغلاق رسالة النجاح" onClick={clearProductCreatedNotice} type="button">×</button>
        </div>
      )}
      <div className="product-filter-panel">
        <div className="product-search-field">
          <Icon aria-hidden="true" name="search" size={19} />
          <SearchField
            id="products-search"
            label="البحث عن منتج"
            onChange={setSearch}
            placeholder="البحث عن منتج..."
            value={search}
          />
        </div>
        <div className="product-filter-controls">
          <FilterField label="حالة المنتج">
            <select
              onChange={(event) => {
                if (isProductStatus(event.target.value)) setStatus(event.target.value);
              }}
              value={status}
            >
              <option value="all">الكل</option>
              <option value="active">متاح</option>
              <option value="inactive">غير متاح</option>
              <option value="low">المخزون منخفض</option>
            </select>
          </FilterField>
        <button
          className="clear-filters-button"
          onClick={() => {
            setSearch("");
            setStatus("all");
          }}
          type="button"
        >
          مسح الفلاتر
        </button>
        </div>
      </div>
      <div className="results-heading">
        <strong>{formatQuantity(filteredProducts.length)} منتج</strong>
        <span>من أصل {formatQuantity(productStocks.length)}</span>
      </div>
      {error && (
        <div className="product-load-error" role="alert">
          <span className="product-load-error-icon" aria-hidden="true"><Icon name="alert" size={19} /></span>
          <span className="product-load-error-copy">
            <strong>تعذر تحميل المنتجات</strong>
            <small>{error}</small>
          </span>
          <button
            className="button button-secondary product-retry-button"
            disabled={isLoading}
            onClick={() => void refreshInventory()}
            type="button"
          >
            {isLoading ? "جارٍ التحديث..." : "إعادة المحاولة"}
          </button>
        </div>
      )}
      <div className="product-list">
        {isLoading && productStocks.length === 0 ? (
          <div className="product-loading" aria-label="جارٍ تحميل المنتجات" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div className="product-loading-card" key={item}>
                <span className="product-skeleton product-skeleton-icon" />
                <span className="product-skeleton product-skeleton-copy" />
                <span className="product-skeleton product-skeleton-value" />
                <span className="product-skeleton product-skeleton-actions" />
              </div>
            ))}
            <span className="visually-hidden">جارٍ تحميل المنتجات...</span>
          </div>
        ) : filteredProducts.map((product) => {
          const isLow = product.stock <= product.lowStockThreshold;
          const unit = product.unit || "طرد";
          return (
            <article className="product-card simple-card" key={product.id}>
              <div className="product-card-header">
                <span className="product-icon" aria-hidden="true"><Icon name="package" size={24} /></span>
                <span className={`stock-status ${product.active === false ? "stock-status-disabled" : isLow ? "stock-status-low" : "stock-status-ok"}`}>
                  <Icon
                    name={product.active === false ? "close" : isLow ? "alert" : "check"}
                    size={14}
                  />
                  {product.active === false ? "غير متاح" : isLow ? "مخزون منخفض" : "متاح"}
                </span>
              </div>
              <div className="product-name">
                <strong dir="auto">{product.name}</strong>
                {product.sku && <small className="product-sku" dir="ltr">SKU: {product.sku}</small>}
              </div>
              <div className="product-stock-summary">
                <div className="product-stock">
                  <strong dir="ltr">{formatQuantity(product.stock)}</strong>
                  <small>{unit} في المخزون</small>
                </div>
                <div className="product-stock-threshold">
                  <span>حد التنبيه</span>
                  <strong dir="ltr">{formatQuantity(product.lowStockThreshold)} <small>{unit}</small></strong>
                </div>
              </div>
              <div className="product-actions">
                <Link className="button button-entry button-small" href="/entrees">
                  <Icon name="arrowDown" size={15} /> مدخل
                </Link>
                <Link className="button button-exit button-small" href="/sorties">
                  <Icon name="arrowUp" size={15} /> مخرج
                </Link>
              </div>
            </article>
          );
        })}
        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="product-empty-state">
            <span className="product-empty-icon" aria-hidden="true"><Icon name={productStocks.length === 0 ? "package" : "search"} size={22} /></span>
            <strong>{productStocks.length === 0 && !search && status === "all" ? "لا توجد منتجات" : "لا توجد نتائج"}</strong>
            <p>
              {productStocks.length === 0 && !search && status === "all"
                ? "أضف منتجاتك لتبدأ بمتابعة المخزون."
                : "جرّب تعديل كلمات البحث أو الفلاتر."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
