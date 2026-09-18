"use client";

import * as React from "react";
import Link from "next/link";

import { authClient } from "@repo/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@repo/design-system";

function getAndClearPrefillEmail(): string {
  try {
    const value = window.sessionStorage.getItem("forgot-password-email");
    if (value) window.sessionStorage.removeItem("forgot-password-email");
    return value ?? "";
  } catch {
    return "";
  }
}

export function AdminForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState(getAndClearPrefillEmail);
  const [emailSent, setEmailSent] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      // Always show "email sent" to prevent email enumeration, except for
      // rate limiting which is safe to surface (not user-specific).
      if (result.error?.status === 429) {
        setError("Too many requests. Please try again later.");
      } else {
        setEmailSent(true);
      }
    } catch {
      setEmailSent(true);
    } finally {
      setPending(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Check your email
          </CardTitle>
          <CardDescription>
            If an account exists for {email}, we sent a password reset link.
            Check your inbox and spam folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Forgot password
        </CardTitle>
        <CardDescription>
          Enter your email and we&#39;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Sending..." : "Send reset link"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
