import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SignupPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect("/dashboard");

  return (
    <main className="login-page auth-page auth-signup-page" dir="rtl">
      <section aria-labelledby="signup-heading" className="simple-card login-card auth-card">
        <div className="brand-mark login-brand-mark" aria-hidden="true">م</div>
        <h1 id="signup-heading">إنشاء حساب</h1>
        <p>أنشئ حسابًا جديدًا لإدارة المخزون</p>
        <SignupForm />
      </section>
    </main>
  );
}
