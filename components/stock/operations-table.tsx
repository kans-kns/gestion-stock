import type { InventoryOperation, Product } from "@/types/inventory";
import { formatDate, formatQuantity, formatTime } from "@/services/inventory";

export function OperationsTable({
  operations,
  products,
  compact = false,
  emptyMessage = "لا توجد عمليات مسجلة بعد.",
}: {
  operations: InventoryOperation[];
  products: Product[];
  compact?: boolean;
  emptyMessage?: string;
}) {
  const rows = compact ? operations.slice(0, 5) : operations;
  if (rows.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="operations-table">
        <thead>
          <tr>
            <th>المرجع</th>
            <th>الحركة</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>التاريخ والوقت</th>
            {!compact && <th>الجهة</th>}
            {!compact && <th>المسؤول</th>}
            {!compact && <th>ملاحظات</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((operation) => {
            const product = products.find((item) => item.id === operation.productId);
            const isEntry = operation.type === "entry";
            return (
              <tr key={operation.id}>
                <td className="operation-reference" dir="ltr">{operation.reference}</td>
                <td><span className={`operation-badge ${isEntry ? "badge-entry" : "badge-exit"}`}>{isEntry ? "مدخل" : "مخرج"}</span></td>
                <td className="operation-product" dir="auto">{product?.name ?? "منتج غير معروف"}</td>
                <td className={`operation-quantity ${isEntry ? "quantity-entry" : "quantity-exit"}`} dir="ltr">
                  {isEntry ? "+" : "−"}{formatQuantity(operation.quantity)}
                </td>
                <td><span className="operation-datetime">{formatDate(operation.createdAt)}<small>{formatTime(operation.createdAt)}</small></span></td>
                {!compact && <td dir="auto">{operation.party}</td>}
                {!compact && <td dir="auto">{operation.user}</td>}
                {!compact && <td className="operation-note" dir="auto">{operation.note || "—"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
