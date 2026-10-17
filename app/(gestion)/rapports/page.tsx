"use client";

import { useState } from "react";
import { useInventory } from "@/components/layout/inventory-provider";
import { FilterField, SearchField } from "@/components/stock/filter-controls";
import { getDashboardSummary, formatQuantity, getProductSearchText } from "@/services/inventory";
import { isProductCategory, productCategories, type ProductCategory } from "@/types/inventory";
import { Icon } from "@/components/ui/icon";

type CategoryFilter = "all" | ProductCategory;

export default function RapportsPage() {
  const { productStocks, operations, isLoading, error } = useInventory();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const summary = getDashboardSummary(productStocks, operations);
  const categoryUnits = productCategories.flatMap((item) =>
    summary.byCategory[item].map((unitSummary) => ({ category: item, ...unitSummary })),
  );
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredProducts = productStocks.filter((product) => {
    const matchesSearch = getProductSearchText(product).toLocaleLowerCase().includes(searchTerm);
    return matchesSearch && (category === "all" || product.category === category);
  });
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
            <div className="report-category-summary-grid">
              {categoryUnits.map((item) => (
                <article className="report-category-summary-card" key={`${item.category}-${item.unit}`}>
                  <h3>{item.category} · {item.unit}</h3>
                  <div>
                    <span>الرصيد الحالي</span>
                    <strong className="calc-total" dir="ltr">{formatQuantity(item.currentStock)}</strong>
                  </div>
                  <div>
                    <span>إجمالي المداخل</span>
                    <strong className="calc-entry" dir="ltr">{formatQuantity(item.totalIncoming)}</strong>
                  </div>
                  <div>
                    <span>إجمالي المخارج</span>
                    <strong className="calc-exit" dir="ltr">{formatQuantity(item.totalOutgoing)}</strong>
                  </div>
                </article>
              ))}
              {categoryUnits.length === 0 && <p className="empty-state">لا توجد أرصدة مسجلة.</p>}
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
            <div className="report-search-controls">
              <div className="report-search">
                <span className="report-search-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
                <SearchField
                  id="reports-product-search"
                  label="البحث في المنتجات"
                  onChange={setSearch}
                  placeholder="ابحث بالاسم أو العلامة أو المرجع أو المقاس"
                  value={search}
                />
              </div>
              <FilterField label="فئة المنتج">
                <select
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all" || isProductCategory(value)) {
                      setCategory(value);
                    }
                  }}
                  value={category}
                >
                  <option value="all">كل الفئات</option>
                  {productCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </FilterField>
            </div>
          </section>
          <section className="report-list" aria-label="أرصدة المنتجات">
            {filteredProducts.map((product) => (
              <article className="simple-card report-row" key={product.id}>
                <span className="product-icon" aria-hidden="true"><Icon name="package" size={21} /></span>
                <div className="report-product-copy">
                  <strong dir="auto">{product.name}</strong>
                  <small>{product.category} · {product.category === "أتاي"
                    ? [product.brand, product.format].filter(Boolean).join(" · ")
                    : [product.sku, product.garmentType, product.size, product.color].filter(Boolean).join(" · ")}</small>
                </div>
                <span className="report-row-value">
                  <b dir="ltr">{formatQuantity(product.stock)}</b>
                  <small dir="auto">{product.unit || (product.category === "أتاي" ? "كرتون" : "قطعة")}</small>
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
