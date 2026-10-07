"use client";

import Link from "next/link";
import { useInventory } from "@/components/layout/inventory-provider";
import { OperationsTable } from "@/components/stock/operations-table";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatQuantity, getDashboardSummary } from "@/services/inventory";

type MetricTone = "entry" | "exit" | "warning";

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  tone: MetricTone;
}) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone}`}>
      <span className="dashboard-metric-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="dashboard-metric-copy">
        <span className="dashboard-metric-label">{label}</span>
        <strong className="dashboard-metric-value" dir="ltr">
          {formatQuantity(value)}
        </strong>
      </div>
    </article>
  );
}

function DashboardLoadingState() {
  return (
    <div className="dashboard-loading" aria-label="جارٍ تحميل لوحة التحكم" aria-busy="true">
      <div className="dashboard-loading-overview">
        <div className="dashboard-loading-hero">
          <span className="dashboard-skeleton dashboard-skeleton-label" />
          <span className="dashboard-skeleton dashboard-skeleton-number" />
          <span className="dashboard-skeleton dashboard-skeleton-caption" />
        </div>
        <div className="dashboard-loading-metrics">
          {[0, 1, 2].map((item) => (
            <span className="dashboard-skeleton dashboard-skeleton-metric" key={item} />
          ))}
        </div>
      </div>
      <div className="dashboard-loading-secondary">
        {[0, 1].map((item) => (
          <span className="dashboard-skeleton dashboard-skeleton-secondary" key={item} />
        ))}
      </div>
      <div className="dashboard-loading-panels">
        <div className="dashboard-skeleton-panel">
          <span className="dashboard-skeleton dashboard-skeleton-panel-heading" />
          {[0, 1, 2, 3].map((item) => (
            <span className="dashboard-skeleton dashboard-skeleton-row" key={item} />
          ))}
        </div>
        <div className="dashboard-skeleton-panel">
          <span className="dashboard-skeleton dashboard-skeleton-panel-heading" />
          {[0, 1, 2].map((item) => (
            <span className="dashboard-skeleton dashboard-skeleton-row" key={item} />
          ))}
        </div>
      </div>
      <span className="visually-hidden">جارٍ تحميل بيانات لوحة التحكم...</span>
    </div>
  );
}

export function DashboardOverview() {
  const { products, productStocks, operations, isLoading, error, refreshInventory } = useInventory();
  const summary = getDashboardSummary(productStocks, operations);
  const totalIncoming = operations
    .filter((operation) => operation.type === "entry")
    .reduce((total, operation) => total + operation.quantity, 0);
  const totalOutgoing = operations
    .filter((operation) => operation.type === "exit")
    .reduce((total, operation) => total + operation.quantity, 0);
  const lowStockProducts = productStocks.filter(
    (product) => product.stock <= product.lowStockThreshold,
  );
  const hasInventoryData = products.length > 0 || productStocks.length > 0 || operations.length > 0;
  const showInitialError = Boolean(error) && !hasInventoryData && !isLoading;

  return (
    <div className="dashboard-page" dir="rtl" lang="ar">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">نظرة عامة</span>
          <h1>لوحة التحكم</h1>
          <p>نظرة عامة على حالة المخزون والعمليات.</p>
        </div>
      </header>

      {error && hasInventoryData && (
        <div className="dashboard-error" role="alert">
          <span className="dashboard-error-icon" aria-hidden="true">
            <Icon name="alert" size={19} />
          </span>
          <span>{error}</span>
          <button
            className="dashboard-retry-button"
            disabled={isLoading}
            onClick={() => void refreshInventory()}
            type="button"
          >
            <Icon name="activity" size={16} />
            {isLoading ? "جارٍ التحديث..." : "إعادة المحاولة"}
          </button>
        </div>
      )}

      {isLoading && !hasInventoryData ? (
        <DashboardLoadingState />
      ) : showInitialError ? (
        <section className="dashboard-load-error" aria-live="polite">
          <span className="dashboard-load-error-icon" aria-hidden="true">
            <Icon name="alert" size={24} />
          </span>
          <h2>تعذر تحميل بيانات المخزون</h2>
          <p>تحقق من اتصالك ثم أعد المحاولة.</p>
          <button
            className="button button-primary dashboard-load-retry"
            disabled={isLoading}
            onClick={() => void refreshInventory()}
            type="button"
          >
            {isLoading ? "جارٍ التحديث..." : "إعادة المحاولة"}
          </button>
        </section>
      ) : (
        <>
          <section className="dashboard-overview-grid" aria-label="ملخص المخزون">
            <article className="dashboard-stock-card">
              <div className="dashboard-stock-card-top">
                <span className="dashboard-stock-icon" aria-hidden="true">
                  <Icon name="boxes" size={25} />
                </span>
                <span className="dashboard-stock-context">نظرة المخزون</span>
              </div>
              <div className="dashboard-stock-copy">
                <span className="dashboard-stock-label">إجمالي المخزون الحالي</span>
                <div className="dashboard-stock-total">
                  <strong dir="ltr">{formatQuantity(summary.currentStock)}</strong>
                  <span>وحدة في المخزون</span>
                </div>
                <p>إجمالي الكمية المتاحة حاليًا في جميع المنتجات</p>
              </div>
              <span className="dashboard-stock-decoration" aria-hidden="true" />
            </article>

            <div className="dashboard-metric-grid" aria-label="حركة المخزون وتنبيهات اليوم">
              <MetricCard
                icon="arrowDown"
                label="المداخل اليوم"
                tone="entry"
                value={summary.incomingToday}
              />
              <MetricCard
                icon="arrowUp"
                label="المخارج اليوم"
                tone="exit"
                value={summary.outgoingToday}
              />
              <MetricCard
                icon="alert"
                label="منتجات منخفضة المخزون"
                tone="warning"
                value={summary.lowStockCount}
              />
            </div>
          </section>

          <section className="dashboard-secondary-stats" aria-label="إجمالي حركة المخزون">
            <MetricCard
              icon="arrowDown"
              label="إجمالي المداخل"
              tone="entry"
              value={totalIncoming}
            />
            <MetricCard
              icon="arrowUp"
              label="إجمالي المخارج"
              tone="exit"
              value={totalOutgoing}
            />
          </section>

          <section className="dashboard-quick-actions" aria-labelledby="dashboard-actions-title">
            <div className="dashboard-section-heading dashboard-actions-heading">
              <div>
                <h2 id="dashboard-actions-title">إجراءات سريعة</h2>
                <p>انتقل مباشرة إلى المهام اليومية.</p>
              </div>
            </div>
            <div className="dashboard-action-list">
              <Link className="dashboard-action dashboard-action-product" href="/ajouter-produit">
                <span className="dashboard-action-icon" aria-hidden="true">
                  <Icon name="package" size={20} />
                </span>
                <span>إضافة منتج</span>
                <Icon className="dashboard-action-arrow" name="arrowRight" size={17} />
              </Link>
              <Link className="dashboard-action dashboard-action-entry" href="/entrees">
                <span className="dashboard-action-icon" aria-hidden="true">
                  <Icon name="arrowDown" size={20} />
                </span>
                <span>تسجيل مدخل</span>
                <Icon className="dashboard-action-arrow" name="arrowRight" size={17} />
              </Link>
              <Link className="dashboard-action dashboard-action-exit" href="/sorties">
                <span className="dashboard-action-icon" aria-hidden="true">
                  <Icon name="arrowUp" size={20} />
                </span>
                <span>تسجيل مخرج</span>
                <Icon className="dashboard-action-arrow" name="arrowRight" size={17} />
              </Link>
              <Link className="dashboard-action dashboard-action-products" href="/produits">
                <span className="dashboard-action-icon" aria-hidden="true">
                  <Icon name="boxes" size={20} />
                </span>
                <span>عرض المنتجات</span>
                <Icon className="dashboard-action-arrow" name="arrowRight" size={17} />
              </Link>
            </div>
          </section>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel dashboard-activity" aria-labelledby="dashboard-activity-title">
              <div className="dashboard-panel-heading">
                <div className="dashboard-section-heading">
                  <span className="dashboard-panel-icon dashboard-panel-icon-activity" aria-hidden="true">
                    <Icon name="clock" size={19} />
                  </span>
                  <div>
                    <h2 id="dashboard-activity-title">آخر العمليات</h2>
                    <p>أحدث خمس حركات مسجلة في المخزون</p>
                  </div>
                </div>
                <Link className="dashboard-panel-link" href="/historique">
                  عرض السجل كاملًا
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              {operations.length > 0 ? (
                <OperationsTable compact operations={operations} products={products} />
              ) : (
                <div className="dashboard-empty-state">
                  <span className="dashboard-empty-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
                  <strong>لا توجد عمليات حاليًا</strong>
                  <p>ستظهر العمليات هنا عند تسجيل أول مدخل أو مخرج.</p>
                </div>
              )}
            </section>

            <section className="dashboard-panel dashboard-low-stock" aria-labelledby="dashboard-low-stock-title">
              <div className="dashboard-panel-heading">
                <div className="dashboard-section-heading">
                  <span className="dashboard-panel-icon dashboard-panel-icon-warning" aria-hidden="true">
                    <Icon name="alert" size={19} />
                  </span>
                  <div>
                    <h2 id="dashboard-low-stock-title">منتجات تحتاج إلى الانتباه</h2>
                    <p>وصلت إلى حد التنبيه أو انخفضت عنه</p>
                  </div>
                </div>
              </div>

              {lowStockProducts.length > 0 ? (
                <ul className="dashboard-low-stock-list">
                  {lowStockProducts.map((product) => (
                    <li className="dashboard-low-stock-item" key={product.id}>
                      <span className="dashboard-low-stock-product">
                        <span className="dashboard-low-stock-product-icon" aria-hidden="true">
                          <Icon name="package" size={18} />
                        </span>
                        <span className="dashboard-low-stock-product-copy">
                          <strong dir="auto">{product.name}</strong>
                          <small>
                            حد التنبيه: {formatQuantity(product.lowStockThreshold)} {product.unit || "طرد"}
                          </small>
                        </span>
                      </span>
                      <span className="dashboard-low-stock-quantity">
                        <strong dir="ltr">{formatQuantity(product.stock)}</strong>
                        <small>{product.unit || "طرد"}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="dashboard-low-stock-empty">
                  <span aria-hidden="true"><Icon name="check" size={20} /></span>
                  <strong>لا توجد منتجات منخفضة المخزون</strong>
                  <p>المخزون في حالة جيدة حاليًا.</p>
                </div>
              )}

              <Link className="dashboard-panel-link dashboard-stock-link" href="/produits">
                عرض المنتجات
                <Icon name="arrowRight" size={16} />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
