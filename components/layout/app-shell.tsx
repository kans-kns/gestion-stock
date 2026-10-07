"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { InventoryResetControl } from "@/components/layout/inventory-reset-control";
import { Icon } from "@/components/ui/icon";

const navigation = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "activity" },
  { href: "/produits", label: "المنتجات", icon: "boxes" },
  { href: "/ajouter-produit", label: "إضافة منتج", icon: "package" },
  { href: "/entrees", label: "المداخل", icon: "arrowDown" },
  { href: "/sorties", label: "المخارج", icon: "arrowUp" },
  { href: "/historique", label: "السجل", icon: "clock" },
  { href: "/rapports", label: "التقارير", icon: "calendar" },
] as const;

function NavigationLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return navigation.map(({ href, label, icon }) => {
    const active = pathname === href;
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`nav-link${active ? " nav-link-active" : ""}`}
        href={href}
        key={href}
        onClick={onNavigate}
      >
        <Icon name={icon} size={21} />
        <span>{label}</span>
      </Link>
    );
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  const pageTitle = navigation.find(({ href }) => href === pathname)?.label ?? "لوحة التحكم";

  useEffect(() => {
    const dialog = mobileMenuRef.current;
    if (!dialog) return;
    if (isMobileMenuOpen && !dialog.open) dialog.showModal();
    if (!isMobileMenuOpen && dialog.open) dialog.close();
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const dialog = mobileMenuRef.current;
    if (dialog?.open) dialog.close();
  }, [pathname]);

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard" aria-label="إدارة المخزون - لوحة التحكم">
          <span className="brand-mark"><Icon name="boxes" size={24} /></span>
          <span className="brand-copy">
            <strong>إدارة المخزون</strong>
            <small>نظام إدارة المخزون</small>
          </span>
        </Link>
        <p className="sidebar-caption">مساحة العمل</p>
        <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
          <NavigationLinks pathname={pathname} />
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-account">
            <span className="sidebar-account-icon" aria-hidden="true"><Icon name="users" size={19} /></span>
            <span className="sidebar-account-copy"><strong>الحساب</strong><small>إدارة المخزون</small></span>
          </div>
          <form action={signOut}>
            <button className="logout-button sidebar-logout" type="submit">
              <Icon name="arrowRight" size={17} />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-page">
            <span className="topbar-breadcrumb">
              <Link href="/dashboard">الرئيسية</Link>
              <span aria-hidden="true">/</span>
              {pageTitle}
            </span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-mobile-brand">
            <button
              aria-controls="mobile-navigation-dialog"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              className="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(true)}
              type="button"
            >
              <Icon name="menu" size={22} />
            </button>
            <Link className="brand-lockup mobile-brand" href="/dashboard">
              <span className="brand-mark"><Icon name="boxes" size={21} /></span>
              <span>إدارة المخزون</span>
            </Link>
          </div>
          <div className="topbar-actions">
            <span className="topbar-note">مرحبًا بك</span>
            <span className="topbar-avatar" aria-hidden="true">م</span>
          </div>
        </header>
        <main className="page-content">
          {children}
          <InventoryResetControl />
        </main>
      </div>
      <dialog
        aria-label="القائمة الرئيسية"
        className="mobile-navigation-dialog"
        id="mobile-navigation-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsMobileMenuOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setIsMobileMenuOpen(false);
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          setIsMobileMenuOpen(false);
        }}
        onClose={() => setIsMobileMenuOpen(false)}
        ref={mobileMenuRef}
      >
        <div className="mobile-navigation-panel">
          <div className="mobile-navigation-header">
            <Link className="brand-lockup" href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="brand-mark"><Icon name="boxes" size={22} /></span>
              <span className="brand-copy"><strong>إدارة المخزون</strong><small>نظام إدارة المخزون</small></span>
            </Link>
            <button
              aria-label="إغلاق القائمة"
              className="mobile-menu-close"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
            <NavigationLinks onNavigate={() => setIsMobileMenuOpen(false)} pathname={pathname} />
          </nav>
          <div className="mobile-navigation-footer">
            <span>الحساب · إدارة المخزون</span>
            <form action={signOut}>
              <button className="logout-button sidebar-logout" type="submit">
                <Icon name="arrowRight" size={17} />
                <span>تسجيل الخروج</span>
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}
