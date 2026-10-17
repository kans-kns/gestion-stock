"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { useInventory } from "@/components/layout/inventory-provider";

export default function ModifierProduitPage() {
  const params = useParams<{ id: string }>();
  const { products, isLoading } = useInventory();
  const product = products.find((item) => item.id === params.id);

  return (
    <section className="edit-product-page">
      <div className="page-heading">
        <div>
          <h1>تعديل المنتج</h1>
          <p>حدّث بيانات المنتج مع الحفاظ على فئته وحركاته المسجلة.</p>
        </div>
      </div>
      {product ? (
        <ProductForm key={product.id} product={product} />
      ) : isLoading ? (
        <p className="product-form-loading" role="status">جارٍ تحميل بيانات المنتج...</p>
      ) : (
        <div className="product-empty-state">
          <strong>لم يتم العثور على المنتج</strong>
          <p>قد يكون المنتج غير متاح أو لم يعد موجودًا في قائمة المخزون.</p>
          <Link className="button button-primary" href="/produits">العودة إلى المنتجات</Link>
        </div>
      )}
    </section>
  );
}
