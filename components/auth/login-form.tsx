"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="login-form">
      <label className="form-field" htmlFor="email">
        البريد الإلكتروني
        <input
          autoComplete="username"
          autoFocus
          id="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="form-field" htmlFor="password">
        كلمة المرور
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </label>
      {state.error && <p className="form-message form-message-error" role="alert">{state.error}</p>}
      <button className="button button-primary login-submit" disabled={isPending} type="submit">
        {isPending ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
      <p className="auth-switch-link">
        ليس لديك حساب؟ <Link href="/signup">إنشاء حساب</Link>
      </p>
    </form>
  );
}
