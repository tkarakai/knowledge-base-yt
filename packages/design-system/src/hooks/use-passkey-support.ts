"use client";

import * as React from "react";

type PasskeySupport = {
  /** null while still checking, true/false once resolved */
  supported: boolean | null;
};

export function usePasskeySupport(): PasskeySupport {
  const [supported, setSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        if (
          typeof window !== "undefined" &&
          window.PublicKeyCredential &&
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
            "function"
        ) {
          const available =
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (!cancelled) setSupported(available);
        } else {
          if (!cancelled) setSupported(false);
        }
      } catch {
        if (!cancelled) setSupported(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { supported };
}
