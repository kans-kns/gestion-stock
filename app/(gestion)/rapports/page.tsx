"use client";

import { useState } from "react";
import { useInventory } from "@/components/layout/inventory-provider";
import { SearchField } from "@/components/stock/filter-controls";
import { getDashboardSummary, formatQuantity } from "@/services/inventory";
import { Icon } from "@/components/ui/icon";

export default function RapportsPage() {
  const { productStocks, operations, isLoading, error } = useInventory();
  const [search, setSearch] = useState("");
  const summary = getDashboardSummary(productStocks, operations);
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredProducts = productStocks.filter((product) =>
    `${product.name} ${product.unit ?? ""}`.toLocaleLowerCase().includes(searchTerm),
  );
  const totalIncoming = operations.filter((operation) => operation.type === "entry").reduce((total, operation) => total + operation.quantity, 0);
  const totalOutgoing = operations.filter((operation) => operation.type === "exit").reduce((total, operation) => total + operation.quantity, 0);
  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <h1>التقارير</h1>
          <p>متابعة حركة المخزون وأرصدة المنتجات في متجرك</p>
        </div>
      </div>
      {isLoading && productStocks.length === 0 ? (
        <div className="reports-loading" aria-label="جارٍ تحميل التقارير" aria-busy="true">
          <div className="reports-loading-summary">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="reports-loading-stat" key={index}>
                <span className="reports-skeleton reports-skeleton-icon" />
                <span className="reports-skeleton reports-skeleton-value" />
                <span className="reports-skeleton reports-skeleton-label" />
              </div>
            ))}
          </div>
          <div className="reports-loading-search">
            <span className="reports-skeleton reports-skeleton-label" />
            <span className="reports-skeleton reports-skeleton-input" />
          </div>
          <div className="reports-loading-products">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="reports-skeleton reports-skeleton-product" key={index} />
            ))}
          </div>
        </div>
      ) : error && productStocks.length === 0 ? (
        <div className="reports-error" role="alert">
          <span className="reports-error-icon" aria-hidden="true">
            <Icon name="alert" size={22} />
          </span>
          <div>
            <strong>تعذر تحميل بيانات التقارير</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <section className="calculation-card report-calculation" aria-labelledby="reports-summary-title">
            <div className="report-section-heading">
              <span className="report-section-icon" aria-hidden="true"><Icon name="activity" size={19} /></span>
              <div>
                <h2 id="reports-summary-title">ملخص حركة المخزون</h2>
                <p>نظرة عامة على إجمالي الكميات المسجلة</p>
              </div>
            </div>
            <div className="calculation-flow">
              <div className="report-summary-item">
                <span className="report-summary-icon report-summary-icon-entry" aria-hidden="true"><Icon name="arrowDown" size={18} /></span>
                <strong className="calc-entry" dir="ltr">{formatQuantity(totalIncoming)}</strong>
                <span>إجمالي المداخل · طرد</span>
              </div>
              <span className="calc-operator" aria-hidden="true">−</span>
              <div className="report-summary-item">
                <span className="report-summary-icon report-summary-icon-exit" aria-hidden="true"><Icon name="arrowUp" size={18} /></span>
                <strong className="calc-exit" dir="ltr">{formatQuantity(totalOutgoing)}</strong>
                <span>إجمالي المخارج · طرد</span>
              </div>
              <span className="calc-operator" aria-hidden="true">=</span>
              <div className="report-summary-item report-summary-current">
                <span className="report-summary-icon report-summary-icon-current" aria-hidden="true"><Icon name="boxes" size={18} /></span>
                <strong className="calc-total" dir="ltr">{formatQuantity(summary.currentStock)}</strong>
                <span>المخزون الحالي · طرد</span>
              </div>
            </div>
          </section>
          <section className="report-search-panel" aria-labelledby="reports-products-title">
            <div className="report-section-heading">
              <span className="report-section-icon" aria-hidden="true"><Icon name="package" size={19} /></span>
              <div>
                <h2 id="reports-products-title">أرصدة المنتجات</h2>
                <p>ابحث عن منتج لمراجعة رصيده الحالي</p>
              </div>
            </div>
            <div className="report-search">
              <span className="report-search-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
              <SearchField
                id="reports-product-search"
                label="البحث في المنتجات"
                onChange={setSearch}
                placeholder="ابحث باسم المنتج أو الوحدة"
                value={search}
              />
            </div>
          </section>
          <section className="report-list" aria-label="أرصدة المنتجات">
            {filteredProducts.map((product) => (
              <article className="simple-card report-row" key={product.id}>
                <span className="product-icon" aria-hidden="true"><Icon name="package" size={21} /></span>
                <strong dir="auto">{product.name}</strong>
                <span className="report-row-value">
                  <b dir="ltr">{formatQuantity(product.stock)}</b>
                  <small dir="auto">{product.unit || "طرد"}</small>
                </span>
              </article>
            ))}
            {filteredProducts.length === 0 && (
              <div className="product-empty-state reports-empty-state">
                <span className="product-empty-icon" aria-hidden="true">
                  <Icon name={productStocks.length === 0 ? "package" : "search"} size={22} />
                </span>
                <strong>{productStocks.length === 0 && !search ? "لا توجد منتجات" : "لا توجد نتائج"}</strong>
                <p>
                  {productStocks.length === 0 && !search
                    ? "ستظهر المنتجات هنا بعد إضافتها إلى النظام."
                    : "جرّب تعديل كلمات البحث."}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
