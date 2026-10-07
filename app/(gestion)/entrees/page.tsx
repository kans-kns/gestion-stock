import { MovementForm } from "@/components/stock/movement-form";

export default function EntreesPage() {
  return (
    <section className="movement-page movement-page-entry">
      <div className="page-heading">
        <div><h1>المداخل</h1><p>تسجيل ومتابعة عمليات دخول المخزون</p></div>
      </div>
      <MovementForm type="entry" />
    </section>
  );
}
