"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { ArrowLeft, Download } from "lucide-react";

import { api } from "@repo/backend";
import {
  Button,
  Checkbox,
  CopyableField,
  Input,
  Label,
  SlideTransition,
  toast,
} from "@repo/design-system";

interface BackupCodesStepProps {
  /** Backup codes from TOTP verification (empty on resume flow) */
  backupCodes: string[];
  onComplete: () => Promise<void>;
}

export function BackupCodesStep({ backupCodes: initialCodes, onComplete }: BackupCodesStepProps) {
  const [codes, setCodes] = React.useState<string[]>(initialCodes);
  const [loading, setLoading] = React.useState(!initialCodes.length);
  const [saved, setSaved] = React.useState(false);
  const [subStep, setSubStep] = React.useState<0 | 1>(0);
  const [verifyCode1, setVerifyCode1] = React.useState("");
  const [verifyCode2, setVerifyCode2] = React.useState("");
  const [completing, setCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const viewBackupCodes = useAction(api.auth.viewBackupCodes);

  // Fetch backup codes on resume flow (when none are passed from Step 1)
  React.useEffect(() => {
    if (initialCodes.length > 0) return;

    (async () => {
      setLoading(true);
      try {
        const result = await viewBackupCodes();
        setCodes(result ?? []);
      } catch {
        setError("Failed to load backup codes.");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialCodes, viewBackupCodes]);

  const handleDownload = () => {
    const content = [
      "Web App Starter — Admin Backup Codes",
      "=====================================",
      "",
      "Each code can only be used once.",
      "Store these codes in a safe place.",
      "",
      ...codes,
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Verify two codes match actual backup codes
  const verifiedCodes = React.useMemo(() => {
    const trimmed1 = verifyCode1.trim();
    const trimmed2 = verifyCode2.trim();
    if (!trimmed1 || !trimmed2) return false;
    if (trimmed1 === trimmed2) return false;
    const codeSet = new Set(codes);
    return codeSet.has(trimmed1) && codeSet.has(trimmed2);
  }, [verifyCode1, verifyCode2, codes]);

  const handleVerifyContinue = async () => {
    if (!verifiedCodes || completing) return;
    setCompleting(true);
    try {
      await onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Loading backup codes...
      </p>
    );
  }

  return (
    <SlideTransition stepIndex={subStep}>
      {subStep === 0 ? (
        /* ── Sub-screen A: Display backup codes ── */
        <div className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <CopyableField
            value={codes.join("\n")}
            rows={10}
            onCopied={() => toast.success("Backup codes copied.")}
            onCopyError={() => toast.error("Failed to copy.")}
          />

          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download .txt
          </Button>

          <div className="flex items-center gap-2">
            <Checkbox
              id="backup-saved"
              checked={saved}
              onCheckedChange={(checked) => setSaved(checked === true)}
            />
            <Label htmlFor="backup-saved" className="text-sm cursor-pointer">
              I have saved my backup codes in a secure place
            </Label>
          </div>

          <Button
            className="w-full"
            type="button"
            onClick={() => setSubStep(1)}
            disabled={!saved}
          >
            Continue
          </Button>
        </div>
      ) : (
        /* ── Sub-screen B: Verify backup codes ── */
        <div className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            To confirm you saved them, enter any two of your backup codes.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="verify-code-1" className="text-xs">Code 1</Label>
              <Input
                id="verify-code-1"
                value={verifyCode1}
                onChange={(event) => setVerifyCode1(event.target.value)}
                placeholder="Enter a backup code"
                className="font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-code-2" className="text-xs">Code 2</Label>
              <Input
                id="verify-code-2"
                value={verifyCode2}
                onChange={(event) => setVerifyCode2(event.target.value)}
                placeholder="Enter a different backup code"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <Button
            className="w-full mt-6"
            type="button"
            onClick={handleVerifyContinue}
            disabled={!verifiedCodes || completing}
          >
            {completing ? "Continuing..." : "Continue"}
          </Button>

          <Button
            className="w-full"
            type="button"
            variant="ghost"
            onClick={() => {
              setVerifyCode1("");
              setVerifyCode2("");
              setSubStep(0);
              setError(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to backup codes
          </Button>
        </div>
      )}
    </SlideTransition>
  );
}
