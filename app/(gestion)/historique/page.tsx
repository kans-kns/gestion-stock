"use client";

import { OperationFilters } from "@/components/stock/operation-filters";

export default function HistoriquePage() {
  return (
    <section className="history-page">
      <div className="page-heading">
        <div>
          <h1>سجل العمليات</h1>
          <p>عرض وتتبع جميع حركات المخزون</p>
        </div>
      </div>
      <OperationFilters />
    </section>
  );
}
