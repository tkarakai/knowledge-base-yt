import { AdminTotpSetup } from "@/components/auth/admin-totp-setup";

export default function Setup2faPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up two-factor authentication
        </h1>
        <p className="text-sm text-muted-foreground">
          Add an extra layer of security to your admin account.
        </p>
      </div>
      <div className="max-w-md">
        <AdminTotpSetup />
      </div>
    </div>
  );
}
