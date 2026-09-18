"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { PasskeySection } from "@/components/settings/passkey-section";
import { TwoFactorSection } from "@/components/settings/two-factor-section";
import { SessionsList } from "@/components/settings/sessions-list";

function normalizeTab(value: string | null): "password" | "2fa" | "passkeys" | "sessions" {
  if (value === "2fa" || value === "passkeys" || value === "sessions") return value;
  return "password";
}

export function SecuritySection() {
  const td = useTranslations("dashboard");
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
        <CardTitle>{td("security")}</CardTitle>
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
            <TabsTrigger value="password">{td("changePassword.title")}</TabsTrigger>
            <TabsTrigger value="2fa">{td("twoFactor.title")}</TabsTrigger>
            <TabsTrigger value="passkeys">Passkeys</TabsTrigger>
            <TabsTrigger value="sessions">{td("sessions.title")}</TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="mt-4">
            <ChangePasswordForm />
          </TabsContent>
          <TabsContent value="2fa" className="mt-4">
            <TwoFactorSection />
          </TabsContent>
          <TabsContent value="passkeys" className="mt-4">
            <PasskeySection />
          </TabsContent>
          <TabsContent value="sessions" className="mt-4">
            <SessionsList />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
