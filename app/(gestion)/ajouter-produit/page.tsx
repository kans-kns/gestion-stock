"use client";

import { ProductForm } from "@/components/products/product-form";

export default function AjouterProduitPage() {
  return (
    <section className="add-product-page">
      <div className="page-heading">
        <div>
          <h1>إضافة منتج</h1>
          <p>أضف منتجًا إلى فئة أتاي أو الحوايج مع بياناته الأساسية.</p>
        </div>
      </div>
      <ProductForm />
    </section>
  );
}
