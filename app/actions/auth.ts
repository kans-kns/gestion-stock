"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

export interface SignupState {
  error?: string;
  success?: boolean;
}

export async function signIn(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { error: "أدخل البريد الإلكتروني وكلمة المرور." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { error: "تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور ثم حاول مجددًا." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("تعذر تسجيل الخروج. يرجى المحاولة مجددًا.");
  }

  redirect("/login");
}

export async function signUp(
  _previousState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "يرجى إدخال البريد الإلكتروني." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { error: "يرجى إدخال بريد إلكتروني صحيح." };
  }
  if (typeof password !== "string" || !password) {
    return { error: "يرجى إدخال كلمة المرور." };
  }
  if (typeof confirmPassword !== "string" || !confirmPassword) {
    return { error: "يرجى تأكيد كلمة المرور." };
  }
  if (password !== confirmPassword) {
    return { error: "كلمتا المرور غير متطابقتين." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    return { error: "تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا." };
  }

  if (data.session) redirect("/dashboard");

  return { success: true };
}
