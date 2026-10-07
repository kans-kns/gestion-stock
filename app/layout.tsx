import type { Metadata } from "next";
import { InventoryProvider } from "@/components/layout/inventory-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "إدارة المخزون",
  description: "تطبيق بسيط لإدارة مخزون المتجر.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <InventoryProvider>{children}</InventoryProvider>
      </body>
    </html>
  );
}
