import { EmailVerificationPolicyCard } from "@/components/settings/email-verification-policy-card";
import { MagicLinkPolicyCard } from "@/components/settings/magic-link-policy-card";
import { MfaPolicyCard } from "@/components/settings/mfa-policy-card";
import { PasskeyPolicyCard } from "@/components/settings/passkey-policy-card";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Security policies and authentication requirements.
        </p>
      </div>
      <div className="max-w-2xl space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">User Policies</h2>
          <EmailVerificationPolicyCard scope="user" />
          <MfaPolicyCard scope="user" />
          <PasskeyPolicyCard scope="user" />
          <MagicLinkPolicyCard />
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Admin Policies</h2>
          <EmailVerificationPolicyCard scope="admin" />
          <MfaPolicyCard scope="admin" />
          <PasskeyPolicyCard scope="admin" />
        </section>
      </div>
    </div>
  );
}
