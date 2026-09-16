import { SiteHeader } from "@repo/design-patterns";
import { AdminResetPasswordForm } from "@/components/auth/admin-reset-password-form";

type Props = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams;

  return (
    <main
      className="flex min-h-[calc(100dvh-var(--env-banner-h,0px))] flex-col"
      style={{ background: "var(--glow-warm-intense)" }}
    >
      <SiteHeader appName="Web App Starter Administration" />
      <div className="flex flex-1 items-center justify-center p-4 pt-20">
        <AdminResetPasswordForm token={token} error={error} />
      </div>
    </main>
  );
}
