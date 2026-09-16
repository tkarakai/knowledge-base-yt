"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";

import { api } from "@repo/backend";
import type { AuditStatus } from "@repo/backend";
import { authClient } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SlideTransition,
} from "@repo/design-system";
import { Clock, KeyRound, Download, ShieldCheck, UserCog } from "lucide-react";

import { CreateAccountStep } from "./steps/create-account-step";
import { TotpSetupStep } from "./steps/totp-setup-step";
import { BackupCodesStep } from "./steps/backup-codes-step";
import { PasskeyStep } from "./steps/passkey-step";
import { OnboardingStepIndicator } from "./onboarding-step-indicator";

type WizardStep = 0 | 1 | 2 | 3;
type WizardMode = "loading" | "error" | "session-conflict" | "wizard";

const STEP_TITLES: Record<WizardStep, string> = {
  0: "Create your account",
  1: "Set up two-factor authentication",
  2: "Save your backup codes",
  3: "Add a passkey (optional)",
};

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  0: "Set up your admin credentials to get started.",
  1: "Add an extra layer of security with an authenticator app.",
  2: "Store these codes safely — they're your backup if you lose your device.",
  3: "Passkeys provide fast, phishing-resistant sign-in.",
};

const STEP_LABELS = ["Account", "2FA", "Backup", "Passkey"];

export function AdminOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [mode, setMode] = React.useState<WizardMode>("loading");
  const [step, setStep] = React.useState<WizardStep>(0);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [signingOut, setSigningOut] = React.useState(false);
  const [showIntro, setShowIntro] = React.useState(true);

  // Once the wizard is actively running, stop the init effect from re-evaluating
  // mode — reactive query changes (e.g. tokenResult → ALREADY_CLAIMED after
  // claimInvitation) must not override the wizard.
  const wizardActiveRef = React.useRef(false);

  // Password from Step 0 — kept in memory only for auto-enabling TOTP in Step 1
  const passwordRef = React.useRef("");

  // Backup codes from Step 1 TOTP verification
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);

  // Convex mutations
  const claimInvitation = useMutation(api.adminInvitations.claimInvitation);
  const advanceOnboardingStep = useMutation(api.adminInvitations.advanceOnboardingStep);
  const completeOnboarding = useMutation(api.adminInvitations.completeOnboarding);
  const postAuditEvent = useMutation(api.auditTrail.postEvent);

  // Token validation (only when token is present)
  const tokenResult = useQuery(
    api.adminInvitations.validateToken,
    token ? { token } : "skip",
  );

  // Onboarding status (for resume flow — always queries)
  const onboardingStatus = useQuery(api.adminInvitations.getMyOnboardingStatus);

  // Mount logic: determine entry mode
  React.useEffect(() => {
    // Once the wizard is running, don't let reactive query changes re-evaluate mode
    if (wizardActiveRef.current) return;

    async function init() {
      try {
        const session = await authClient.getSession();
        const isAuthenticated = !!session.data?.session;

        if (isAuthenticated) {
          const userEmail = (session.data?.user as Record<string, unknown>)?.email as string;

          // Token in URL with valid invite for a different email → session conflict
          if (token && tokenResult !== undefined) {
            if (tokenResult.valid && tokenResult.email !== userEmail) {
              setSessionEmail(userEmail ?? "");
              setInviteEmail(tokenResult.email);
              setMode("session-conflict");
              return;
            }
          }

          // Check onboarding status for the current session
          if (onboardingStatus === undefined) return; // still loading

          if (onboardingStatus && !onboardingStatus.completed) {
            // Resume incomplete onboarding for this admin — skip the intro
            const resumeStep = (onboardingStatus.step ?? 1) as WizardStep;
            setEmail(userEmail ?? "");
            setStep(resumeStep);
            setShowIntro(false);
            wizardActiveRef.current = true;
            setMode("wizard");
            return;
          }

          // Active session but onboarding is complete (or no record) — treat token
          // as missing/invalid just like the unauthenticated path below. If there's
          // no valid token, show the appropriate error; if the token is for the same
          // email we already handled above. Redirect completed admins to dashboard.
          if (!token) {
            router.replace("/dashboard");
            return;
          }

          if (tokenResult === undefined) return; // still loading

          if (!tokenResult.valid) {
            const reasons: Record<string, string> = {
              NOT_FOUND: "This invitation link is invalid.",
              ALREADY_CLAIMED: "This invitation has already been used.",
              EXPIRED: "This invitation has expired. Please ask an admin to resend.",
            };
            setError(reasons[tokenResult.reason] ?? "Invalid invitation.");
            setMode("error");
            return;
          }

          // Token valid + same email + onboarding complete → dashboard
          router.replace("/dashboard");
          return;
        }

        // Unauthenticated: need a token
        if (!token) {
          setError("No invitation token found. Please use the link from your invitation email.");
          setMode("error");
          return;
        }

        if (tokenResult === undefined) return; // still loading

        if (!tokenResult.valid) {
          const reasons: Record<string, string> = {
            NOT_FOUND: "This invitation link is invalid.",
            ALREADY_CLAIMED: "This invitation has already been used.",
            EXPIRED: "This invitation has expired. Please ask an admin to resend.",
          };
          setError(reasons[tokenResult.reason] ?? "Invalid invitation.");
          setMode("error");
          return;
        }

        setEmail(tokenResult.email);
        setStep(0);
        wizardActiveRef.current = true;
        setMode("wizard");
      } catch {
        setError("Something went wrong. Please try again.");
        setMode("error");
      }
    }

    init();
  }, [token, tokenResult, onboardingStatus, router]);

  // Pre-signup: claim the invitation token BEFORE creating the account.
  // This proves token possession and adds the email to adminEmails so the
  // auth signup hook will auto-promote to admin role.
  const handleBeforeSignUp = React.useCallback(async () => {
    if (token) {
      try {
        await claimInvitation({ token });
      } catch (err) {
        // If already claimed (e.g. retrying after a failed signup), the
        // adminEmails entry already exists so signup will still promote.
        if (err instanceof Error && err.message === "ALREADY_CLAIMED") return;
        throw err;
      }
    }
  }, [token, claimInvitation]);

  // Step 0 complete: account created
  const handleAccountCreated = React.useCallback(async (password: string) => {
    passwordRef.current = password;

    await postAuditEvent({
      happenedAt: Date.now(),
      sourceDetail: "admin-onboarding",
      action: "admin.onboarding.account_created",
      resource: `admin-invitation:${email}`,
      status: "succeeded",
    }).catch(() => {});

    setStep(1);
  }, [email, postAuditEvent]);

  // Step 1 complete: TOTP verified
  const handleTotpComplete = React.useCallback(async (codes: string[]) => {
    setBackupCodes(codes);
    passwordRef.current = ""; // clear password from memory

    await postAuditEvent({
      happenedAt: Date.now(),
      sourceDetail: "admin-onboarding",
      action: "admin.onboarding.totp_configured",
      resource: `admin-invitation:${email}`,
      status: "succeeded",
    }).catch(() => {});

    // advanceOnboardingStep may fail with NOT_AUTHENTICATED if the Convex auth
    // session hasn't propagated yet (same race as Step 0 → claimInvitation).
    // This is non-critical — it only persists the step for resume. The TOTP
    // setup itself is already complete through Better Auth.
    await advanceOnboardingStep({ step: 2 }).catch(() => {});
    setStep(2);
  }, [email, advanceOnboardingStep, postAuditEvent]);

  // Step 2 complete: backup codes acknowledged
  const handleBackupCodesComplete = React.useCallback(async () => {
    await postAuditEvent({
      happenedAt: Date.now(),
      sourceDetail: "admin-onboarding",
      action: "admin.onboarding.backup_codes_acknowledged",
      resource: `admin-invitation:${email}`,
      status: "succeeded",
    }).catch(() => {});

    await advanceOnboardingStep({ step: 3 }).catch(() => {});
    setStep(3);
  }, [email, advanceOnboardingStep, postAuditEvent]);

  // Step 3 complete: passkey done or skipped
  const handlePasskeyComplete = React.useCallback(async (added: boolean) => {
    const action = added
      ? "admin.onboarding.passkey_registered" as const
      : "admin.onboarding.passkey_skipped" as const;
    const status: AuditStatus = "succeeded";

    await postAuditEvent({
      happenedAt: Date.now(),
      sourceDetail: "admin-onboarding",
      action,
      resource: `admin-invitation:${email}`,
      status,
    }).catch(() => {});

    await postAuditEvent({
      happenedAt: Date.now(),
      sourceDetail: "admin-onboarding",
      action: "admin.onboarding.completed",
      resource: `admin-invitation:${email}`,
      status: "succeeded",
    }).catch(() => {});

    // completeOnboarding may fail if the Convex session hasn't synced yet
    // (unlikely by Step 3, but possible). If it fails, the admin will
    // resume onboarding at the passkey step on next sign-in.
    await completeOnboarding({}).catch(() => {});

    // Sign out so they sign in fresh with full security
    await authClient.signOut();
    router.push("/sign-in");
  }, [email, completeOnboarding, postAuditEvent, router]);

  // Loading state
  if (mode === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8">
          <p className="text-center text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (mode === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Invalid Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Session conflict: different account logged in
  if (mode === "session-conflict") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Different Account Signed In</CardTitle>
          <CardDescription>
            You are currently signed in as <strong>{sessionEmail}</strong>.
            This invitation is for <strong>{inviteEmail}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await authClient.signOut();
                  window.location.reload();
                } catch {
                  setSigningOut(false);
                }
              }}
            >
              {signingOut ? "Signing out..." : "Sign out and onboard new account"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={signingOut}
              onClick={() => router.push("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compute a slide index where intro = -1 and steps 0–3 map directly
  const slideIndex = showIntro ? -1 : step;

  // Wizard
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        {showIntro ? (
          <>
            <CardTitle className="text-xl font-semibold">
              Welcome to the Team
            </CardTitle>
            <CardDescription>
              You've been invited as an administrator. Let's get your account
              set up with the security it needs.
            </CardDescription>
          </>
        ) : (
          <>
            <OnboardingStepIndicator
              currentStep={step}
              labels={STEP_LABELS}
            />
            <CardTitle className="text-xl font-semibold mt-4">
              {STEP_TITLES[step]}
            </CardTitle>
            <CardDescription>
              {STEP_DESCRIPTIONS[step]}
            </CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent>
        <SlideTransition stepIndex={slideIndex}>
          {showIntro ? (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Admin accounts have elevated privileges, so they require
                stronger protection. This quick setup walks you through
                everything — it only takes a few minutes.
              </p>

              <div className="space-y-2">
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Create your account</p>
                    <p className="text-xs text-muted-foreground">
                      Choose a strong password for your admin credentials.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Two-factor authentication</p>
                    <p className="text-xs text-muted-foreground">
                      Link an authenticator app for an extra layer of protection.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Save backup codes</p>
                    <p className="text-xs text-muted-foreground">
                      One-time recovery codes in case you ever lose your device.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Passkey{" "}
                      <span className="font-normal text-muted-foreground">
                        — optional
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sign in with biometrics or a security key — no password
                      needed. Highly recommended for daily use.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong className="text-foreground">Before you start:</strong>{" "}
                  have an authenticator app ready (e.g. Google Authenticator, Authy,
                  or 1Password). A password manager is highly recommended for
                  storing your credentials securely.
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  This takes about 3 minutes.
                </p>
              </div>

              <Button
                className="w-full"
                type="button"
                onClick={() => setShowIntro(false)}
              >
                Get started
              </Button>
            </div>
          ) : step === 0 ? (
            <CreateAccountStep
              email={email}
              onBeforeSignUp={handleBeforeSignUp}
              onComplete={handleAccountCreated}
              onBack={() => setShowIntro(true)}
            />
          ) : step === 1 ? (
            <TotpSetupStep
              password={passwordRef.current}
              onComplete={handleTotpComplete}
            />
          ) : step === 2 ? (
            <BackupCodesStep
              backupCodes={backupCodes}
              onComplete={handleBackupCodesComplete}
            />
          ) : (
            <PasskeyStep onComplete={handlePasskeyComplete} />
          )}
        </SlideTransition>
      </CardContent>
    </Card>
  );
}
