"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/components/layout/inventory-provider";
import { FilterField, SearchField, SearchableProductPicker } from "@/components/stock/filter-controls";
import { OperationsTable } from "@/components/stock/operations-table";
import { formatQuantity } from "@/services/inventory";
import type { MovementType } from "@/types/inventory";

type TypeFilter = "all" | MovementType;

interface OperationFiltersState {
  query: string;
  type: TypeFilter;
  productSearch: string;
  party: string;
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  quantityFrom: string;
  quantityTo: string;
}

const emptyFilters: OperationFiltersState = {
  query: "",
  type: "all",
  productSearch: "",
  party: "",
  employeeId: "",
  dateFrom: "",
  dateTo: "",
  quantityFrom: "",
  quantityTo: "",
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function dateStartUtc(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function dateEndUtcExclusive(value: string): number | null {
  const start = dateStartUtc(value);
  if (start === null) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.getTime();
}

export function OperationFilters() {
  const { operations, products, isLoading, error, refreshInventory } = useInventory();
  const [filters, setFilters] = useState<OperationFiltersState>(emptyFilters);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const employees = useMemo(() => {
    const uniqueEmployees = new Map<string, string>();
    for (const operation of operations) {
      const employeeId = operation.createdBy ?? operation.user;
      if (!uniqueEmployees.has(employeeId)) {
        uniqueEmployees.set(employeeId, operation.user);
      }
    }
    return Array.from(uniqueEmployees, ([id, name]) => ({ id, name }));
  }, [operations]);

  const filteredOperations = useMemo(() => {
    const query = normalized(filters.query);
    const productSearch = normalized(filters.productSearch);
    const partyQuery = normalized(filters.party);
    const from = dateStartUtc(filters.dateFrom);
    const to = dateEndUtcExclusive(filters.dateTo);
    const quantityFrom = filters.quantityFrom === "" ? null : Number(filters.quantityFrom);
    const quantityTo = filters.quantityTo === "" ? null : Number(filters.quantityTo);

    return operations.filter((operation) => {
      const product = productById.get(operation.productId);
      if (query) {
        const searchableText = [
          operation.reference,
          product?.name ?? "",
          product?.unit ?? "",
          operation.party,
          operation.user,
          operation.note,
        ].join(" ").toLocaleLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      if (filters.type !== "all" && operation.type !== filters.type) return false;
      if (productSearch) {
        const productText = `${product?.name ?? ""} ${product?.unit ?? ""}`.toLocaleLowerCase();
        if (!productText.includes(productSearch)) return false;
      }
      if (partyQuery && !normalized(operation.party).includes(partyQuery)) return false;
      if (
        filters.employeeId
        && (operation.createdBy ?? operation.user) !== filters.employeeId
      ) return false;

      const timestamp = new Date(operation.createdAt).getTime();
      if (from !== null && timestamp < from) return false;
      if (to !== null && timestamp >= to) return false;
      if (quantityFrom !== null && operation.quantity < quantityFrom) return false;
      if (quantityTo !== null && operation.quantity > quantityTo) return false;
      return true;
    });
  }, [filters, operations, productById]);

  function updateFilter<Key extends keyof OperationFiltersState>(
    key: Key,
    value: OperationFiltersState[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="operation-search">
      <div className="history-filter-panel">
        <div className="history-filter-heading">
          <span className="history-filter-heading-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2>البحث والتصفية</h2>
            <p>اعثر على العمليات باستخدام عوامل التصفية المتاحة</p>
          </div>
        </div>
        <div className="history-filter-primary">
          <div className="history-search-field">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth="1.7" />
              <path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <SearchField
              id="operations-search"
              label="البحث في العمليات"
              onChange={(value) => updateFilter("query", value)}
              placeholder="ابحث في العمليات..."
              value={filters.query}
            />
          </div>
          <FilterField label="نوع الحركة">
            <select
              onChange={(event) => {
                const value = event.target.value;
                updateFilter("type", value === "entry" || value === "exit" ? value : "all");
              }}
              value={filters.type}
            >
              <option value="all">الكل</option>
              <option value="entry">مدخل</option>
              <option value="exit">مخرج</option>
            </select>
          </FilterField>
          <FilterField label="المنتج">
            <SearchableProductPicker
              onChange={(value) => updateFilter("productSearch", value)}
              placeholder="كل المنتجات"
              products={products}
              query={filters.productSearch}
            />
          </FilterField>
        </div>

        <details className="additional-filters">
          <summary>تصفية إضافية</summary>
          <div className="history-filter-extra">
            <SearchField
              id="operations-party"
              label="المورد / المستلم"
              onChange={(value) => updateFilter("party", value)}
              placeholder="ابحث باسم المورد أو المستلم"
              type="text"
              value={filters.party}
            />
            <FilterField label="الموظف">
              <select
                onChange={(event) => updateFilter("employeeId", event.target.value)}
                value={filters.employeeId}
              >
                <option value="">الكل</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </FilterField>
            <SearchField
              id="operations-date-from"
              label="من تاريخ"
              onChange={(value) => updateFilter("dateFrom", value)}
              type="date"
              value={filters.dateFrom}
            />
            <SearchField
              id="operations-date-to"
              label="إلى تاريخ"
              onChange={(value) => updateFilter("dateTo", value)}
              type="date"
              value={filters.dateTo}
            />
            <SearchField
              id="operations-quantity-from"
              label="الكمية من"
              min="0"
              onChange={(value) => updateFilter("quantityFrom", value)}
              placeholder="أي كمية"
              type="number"
              value={filters.quantityFrom}
            />
            <SearchField
              id="operations-quantity-to"
              label="الكمية إلى"
              min="0"
              onChange={(value) => updateFilter("quantityTo", value)}
              placeholder="أي كمية"
              type="number"
              value={filters.quantityTo}
            />
          </div>
        </details>

        <button
          className="clear-filters-button"
          onClick={() => setFilters(emptyFilters)}
          type="button"
        >
          مسح الفلاتر
        </button>
      </div>

      <div className="results-heading">
        <strong>{formatQuantity(filteredOperations.length)} عملية</strong>
      </div>
      <div className="panel operations-panel history-panel">
        {isLoading && operations.length === 0 ? (
          <div className="history-table-skeleton" aria-label="جارٍ تحميل سجل العمليات" aria-busy="true">
            {Array.from({ length: 6 }, (_, row) => (
              <div className="history-skeleton-row" key={row} aria-hidden="true">
                {Array.from({ length: 8 }, (_, column) => (
                  <span className="history-skeleton-cell" key={column} />
                ))}
              </div>
            ))}
          </div>
        ) : error && operations.length === 0 ? (
          <div className="history-load-error" role="alert">
            <span className="history-load-error-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="history-load-error-copy">
              <strong>تعذر تحميل سجل العمليات</strong>
              <small>{error}</small>
            </span>
            <button
              className="history-retry-button"
              disabled={isLoading}
              onClick={() => void refreshInventory()}
              type="button"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filteredOperations.length === 0 ? (
          <div className="history-empty-state">
            <span className="history-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 7h10a3 3 0 0 1 3 3v7H4v-7a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M8 7V5h8v2m-8 5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <strong>{operations.length > 0 ? "لا توجد نتائج مطابقة" : "لا توجد عمليات"}</strong>
            <p>
              {operations.length > 0
                ? "جرّب تعديل البحث أو مسح الفلاتر لعرض عمليات أخرى."
                : "ستظهر حركات المخزون هنا بعد تسجيل أول عملية."}
            </p>
          </div>
        ) : (
          <OperationsTable operations={filteredOperations} products={products} />
        )}
      </div>
    </section>
  );
}
