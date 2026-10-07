"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type SignupState } from "@/app/actions/auth";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  if (state.success) {
    return (
      <div className="signup-success">
        <p className="form-message form-message-success" role="status">
          تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.
        </p>
        <Link className="button button-primary login-submit" href="/login">الانتقال إلى تسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="login-form">
      <label className="form-field" htmlFor="signup-email">
        البريد الإلكتروني
        <input
          autoComplete="email"
          autoFocus
          id="signup-email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="form-field" htmlFor="signup-password">
        كلمة المرور
        <input
          autoComplete="new-password"
          id="signup-password"
          name="password"
          required
          type="password"
        />
      </label>
      <label className="form-field" htmlFor="confirm-password">
        تأكيد كلمة المرور
        <input
          autoComplete="new-password"
          id="confirm-password"
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {state.error && <p className="form-message form-message-error" role="alert">{state.error}</p>}
      <button className="button button-primary login-submit" disabled={isPending} type="submit">
        {isPending ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
      </button>
      <p className="auth-switch-link">
        لديك حساب؟ <Link href="/login">تسجيل الدخول</Link>
      </p>
    </form>
  );
}
