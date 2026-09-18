"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system";
import { AdminChangePasswordForm } from "@/components/settings/admin-change-password-form";
import { AdminPasskeySection } from "@/components/settings/admin-passkey-section";
import { AdminSessionsList } from "@/components/settings/admin-sessions-list";
import { AdminTwoFactorSection } from "@/components/settings/admin-two-factor-section";

function normalizeTab(value: string | null): "password" | "2fa" | "passkeys" | "sessions" {
  if (value === "2fa" || value === "passkeys" || value === "sessions") return value;
  return "password";
}

export function AdminSecuritySection() {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<"password" | "2fa" | "passkeys" | "sessions">(
    normalizeTab(searchParams.get("tab")),
  );

  React.useEffect(() => {
    setTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  const enforce = searchParams.get("enforce");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent>
        {enforce ? (
          <div className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
            {enforce === "passkey"
              ? "Your account policy requires a passkey. Add one to continue."
              : "Your account policy requires two-factor authentication. Complete setup to continue."}
          </div>
        ) : null}
        <Tabs value={tab} onValueChange={(value) => setTab(normalizeTab(value))}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="2fa">Two-factor</TabsTrigger>
            <TabsTrigger value="passkeys">Passkeys</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="mt-4">
            <AdminChangePasswordForm />
          </TabsContent>
          <TabsContent value="2fa" className="mt-4">
            <AdminTwoFactorSection />
          </TabsContent>
          <TabsContent value="passkeys" className="mt-4">
            <AdminPasskeySection />
          </TabsContent>
          <TabsContent value="sessions" className="mt-4">
            <AdminSessionsList />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
