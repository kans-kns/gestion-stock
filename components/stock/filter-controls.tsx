"use client";

import { useId, type ReactNode } from "react";
import type { Product } from "@/types/inventory";

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface SearchFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: "search" | "text" | "date" | "number";
  min?: string;
}

export function SearchField({
  id,
  label,
  value,
  placeholder,
  onChange,
  type = "search",
  min,
}: SearchFieldProps) {
  return (
    <label className="filter-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        dir={type === "search" || type === "text" ? "auto" : undefined}
        min={min}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

export function getProductLabel(product: Product): string {
  return product.unit ? `${product.name} · ${product.unit}` : product.name;
}

interface SearchableProductPickerProps {
  products: Product[];
  query: string;
  onChange: (query: string) => void;
  placeholder: string;
  required?: boolean;
}

export function SearchableProductPicker({
  products,
  query,
  onChange,
  placeholder,
  required = false,
}: SearchableProductPickerProps) {
  const listId = useId();

  return (
    <>
      <input
        autoComplete="off"
        dir="auto"
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={query}
      />
      <datalist id={listId}>
        {products.map((product) => (
          <option key={product.id} value={getProductLabel(product)} />
        ))}
      </datalist>
    </>
  );
}
