"use client";

import { CopyableField, toast } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const SAMPLE_SECRET_KEY = "JBSWY3DPEHPK3PXP4GRTHM7UNZAVKZLF";
const SAMPLE_API_TOKEN = "tok_sample_a1b2c3d4e5f6g7h8i9j0klmnopqrstuvwxyz1234567890ab";
const SAMPLE_RECOVERY_CODE = "a8f2-9b3c-d4e5-f6a7";
const SAMPLE_SSH_KEY = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7F2Xk
vGp3kJfNzRm1a2R8bT4OoXyZ9sLqWnMdQe5p
UvK7YmBx3cDfG6hJ9kLmN0pQrStUvWxYz1234
A5b6C7d8E9f0GhIjKlMnOpQrStUvWxYzAbCdE
FgHiJkLmNoPqRsTuVwXyZ012345678901234==
user@example.com`;
const SAMPLE_LOG_OUTPUT = `[2026-02-27T10:15:32Z] INFO  Starting application server...
[2026-02-27T10:15:32Z] INFO  Loading configuration from /etc/app/config.yml
[2026-02-27T10:15:33Z] INFO  Database connection established (pool: 10)
[2026-02-27T10:15:33Z] WARN  Cache TTL not configured, using default: 3600s
[2026-02-27T10:15:34Z] INFO  Registered 24 API routes
[2026-02-27T10:15:34Z] INFO  Health check endpoint: /api/health
[2026-02-27T10:15:34Z] INFO  Server listening on 0.0.0.0:8080
[2026-02-27T10:15:35Z] INFO  Ready to accept connections`;

export default function CopyableFieldShowcase() {
  return (
    <>
      <DemoSection
        title="Default"
        description="A read-only field with an inline copy button. Click the icon to copy."
      >
        <div className="max-w-md space-y-3">
          <CopyableField
            value={SAMPLE_SECRET_KEY}
            onCopied={() => toast.success("Copied!")}
            onCopyError={() => toast.error("Failed to copy.")}
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Use Cases"
        description="Common scenarios: secret keys, API tokens, and recovery codes."
      >
        <div className="max-w-lg space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">TOTP Secret Key</p>
            <CopyableField
              value={SAMPLE_SECRET_KEY}
              onCopied={() => toast.success("Secret key copied.")}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">API Token</p>
            <CopyableField
              value={SAMPLE_API_TOKEN}
              onCopied={() => toast.success("API token copied.")}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Recovery Code</p>
            <CopyableField
              value={SAMPLE_RECOVERY_CODE}
              onCopied={() => toast.success("Recovery code copied.")}
            />
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Multiline"
        description="Set the rows prop for scrollable multi-line content. The copy button is pinned to the top-right."
      >
        <div className="max-w-lg space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">SSH Public Key (rows=4)</p>
            <CopyableField
              value={SAMPLE_SSH_KEY}
              rows={4}
              onCopied={() => toast.success("SSH key copied.")}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Log Output (rows=6)</p>
            <CopyableField
              value={SAMPLE_LOG_OUTPUT}
              rows={6}
              onCopied={() => toast.success("Log output copied.")}
            />
          </div>
        </div>
      </DemoSection>
    </>
  );
}
