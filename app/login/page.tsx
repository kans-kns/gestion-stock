import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect("/dashboard");

  return (
    <main className="login-page auth-page auth-login-page" dir="rtl">
      <section aria-labelledby="login-heading" className="simple-card login-card auth-card">
        <div className="brand-mark login-brand-mark" aria-hidden="true">م</div>
        <h1 id="login-heading">تسجيل الدخول</h1>
        <p>سجّل الدخول إلى نظام إدارة المخزون</p>
        <LoginForm />
      </section>
    </main>
  );
}
