import { MovementForm } from "@/components/stock/movement-form";

export default function SortiesPage() {
  return (
    <section className="movement-page movement-page-exit">
      <div className="page-heading">
        <div><h1>المخارج</h1><p>تسجيل ومتابعة عمليات خروج المخزون</p></div>
      </div>
      <MovementForm type="exit" />
    </section>
  );
}
