"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import {
  InventoryRefreshAfterResetError,
  useInventory,
} from "@/components/layout/inventory-provider";
import type { ResetInventoryResult } from "@/services/inventory";

function formatCount(count: number): string {
  return new Intl.NumberFormat("ar").format(count);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "تعذرت إعادة تعيين المخزون. يرجى المحاولة مجددًا.";
}

export function InventoryResetControl() {
  const { resetInventory } = useInventory();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resetInProgress = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ResetInventoryResult | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function openDialog() {
    setConfirmation("");
    setError(null);
    setSuccess(null);
    setRefreshWarning(null);
    setIsOpen(true);
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement, Event>) {
    if (resetInProgress.current) {
      event.preventDefault();
      return;
    }
    setIsOpen(false);
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current && !resetInProgress.current) {
      setIsOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetInProgress.current || confirmation !== "RESET") return;

    resetInProgress.current = true;
    setIsResetting(true);
    setError(null);
    setSuccess(null);
    setRefreshWarning(null);

    try {
      const result = await resetInventory();
      setSuccess(result);
      setIsOpen(false);
      setConfirmation("");
    } catch (resetError) {
      if (resetError instanceof InventoryRefreshAfterResetError) {
        setRefreshWarning(resetError.message);
        setIsOpen(false);
        setConfirmation("");
      } else {
        setError(getErrorMessage(resetError));
      }
    } finally {
      resetInProgress.current = false;
      setIsResetting(false);
    }
  }

  return (
    <section className="admin-tools">
      <details>
        <summary>إدارة النظام</summary>
        <div className="admin-tools-content">
          <p>إجراءات إدارية تؤثر على بيانات المخزون بالكامل.</p>
          <button className="button admin-danger-button" onClick={openDialog} type="button">
            إعادة تعيين المخزون
          </button>
        </div>
      </details>

      {success && (
        <p className="form-message form-message-success admin-reset-success" role="status">
          تمت إعادة تعيين المخزون بنجاح. حُذفت {formatCount(success.deletedProducts)} منتجات و
          {" "}{formatCount(success.deletedMovements)} حركة.
          <button
            aria-label="إغلاق رسالة النجاح"
            onClick={() => setSuccess(null)}
            type="button"
          >
            ×
          </button>
        </p>
      )}

      {refreshWarning && (
        <p className="form-message form-message-error admin-reset-success" role="alert">
          {refreshWarning}
          <button
            aria-label="إغلاق الرسالة"
            onClick={() => setRefreshWarning(null)}
            type="button"
          >
            ×
          </button>
        </p>
      )}

      <dialog
        aria-labelledby="inventory-reset-title"
        className="inventory-reset-dialog"
        onCancel={handleCancel}
        onClick={handleDialogClick}
        ref={dialogRef}
      >
        <section className="inventory-reset-card" dir="rtl" role="document">
          <h2 id="inventory-reset-title">تأكيد إعادة تعيين المخزون</h2>
          <p>
            سيؤدي هذا الإجراء إلى حذف جميع المنتجات وجميع حركات وسجل المخزون.
            لن تُحذف حسابات المستخدمين أو ملفاتهم الشخصية أو إعدادات التطبيق.
            لا يمكن التراجع عن هذا الإجراء.
          </p>

          <form className="inventory-reset-form" onSubmit={handleSubmit}>
            <label className="form-field" htmlFor="inventory-reset-confirmation">
              <span>اكتب RESET للمتابعة</span>
              <input
                autoComplete="off"
                autoFocus
                id="inventory-reset-confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
                required
                value={confirmation}
              />
            </label>

            {error && <p className="form-message form-message-error" role="alert">{error}</p>}

            <div className="inventory-reset-actions">
              <button
                className="button button-secondary"
                disabled={isResetting}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                إلغاء
              </button>
              <button
                className="button admin-danger-button"
                disabled={confirmation !== "RESET" || isResetting}
                type="submit"
              >
                {isResetting ? "جارٍ إعادة التعيين..." : "تأكيد إعادة التعيين"}
              </button>
            </div>
          </form>
        </section>
      </dialog>
    </section>
  );
}
