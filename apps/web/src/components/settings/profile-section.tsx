"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useTheme } from "next-themes";

import { authClient } from "@repo/auth/client";
import { api } from "@repo/backend";
import type { AuditStatus } from "@repo/backend";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TimezoneSelector,
  toast,
} from "@repo/design-system";
import { ThemeToggle } from "@repo/design-patterns";
import { locales, localeMetadata, persistLocale, type Locale } from "@repo/i18n";
import { useAuthUser } from "@/components/auth/auth-guard";

const AVATAR_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
];

export function ProfileSection() {
  const authUser = useAuthUser();
  const tp = useTranslations("dashboard.profile");
  const tc = useTranslations("common");
  const tt = useTranslations("theme");
  const tl = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

  const userProfile = useQuery(api.userProfiles.get) ?? null;
  const upsertProfile = useMutation(api.userProfiles.upsert);
  const setLocale = useMutation(api.userProfiles.setLocale);
  const postAuditEvent = useMutation(api.auditTrail.postEvent);

  const [name, setName] = React.useState(authUser?.name ?? "");
  const [avatarColor, setAvatarColor] = React.useState<string>("");
  const [timezone, setTimezone] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  // Sync form state when profile data loads
  React.useEffect(() => {
    if (authUser?.name && !name) {
      setName(authUser.name);
    }
  }, [authUser?.name, name]);

  React.useEffect(() => {
    if (userProfile) {
      if (userProfile.avatarColor) setAvatarColor(userProfile.avatarColor);
      if (userProfile.timezone) setTimezone(userProfile.timezone);
    }
  }, [userProfile]);

  const initials = (name || authUser?.name || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const themeLabels = {
    light: tt("light"),
    system: tt("system"),
    dark: tt("dark"),
    aria: tt.raw("ariaLabel"),
  };

  const handleSave = async () => {
    setSaving(true);
    const happenedAt = Date.now();
    let status: AuditStatus = "succeeded";
    const currentName = authUser?.name ?? "";
    const nameChanged = name.trim() && name.trim() !== currentName;

    try {
      // Update name via Better Auth if changed
      if (nameChanged) {
        await authClient.updateUser({ name: name.trim() });
      }

      // Update profile preferences via Convex
      await upsertProfile({
        avatarColor: avatarColor || undefined,
        timezone: timezone || undefined,
        theme: theme || undefined,
      });

      toast.success(tp("saved"));
    } catch {
      status = "failed.unknown";
      toast.error(tc("error"));
    } finally {
      setSaving(false);
      postAuditEvent({
        happenedAt,
        sourceDetail: "settings",
        action: nameChanged ? "user.name_changed" : "user.profile_updated",
        resource: "user:self",
        status,
        oldValue: nameChanged ? JSON.stringify({ name: currentName }) : undefined,
        newValue: nameChanged ? JSON.stringify({ name: name.trim() }) : undefined,
      }).catch(() => {});
    }
  };

  const handleLocaleChange = (newLocale: string) => {
    persistLocale(newLocale);
    setLocale({ locale: newLocale }).catch(() => {});
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/") || `/${newLocale}`;
    router.push(newPath);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tp("title")}</CardTitle>
        <CardDescription>{tp("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email (readonly) */}
        <div className="space-y-2">
          <Label>{tp("email")}</Label>
          <p className="text-sm">{authUser?.email ?? ""}</p>
          <p className="text-xs text-muted-foreground">{tp("emailReadonly")}</p>
        </div>

        {/* Display name */}
        <div className="space-y-2">
          <Label htmlFor="profile-name">{tp("name")}</Label>
          <Input
            id="profile-name"
            className="w-full sm:max-w-xs"
            placeholder={tp("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Avatar color picker */}
        <div className="space-y-2">
          <Label>{tp("avatarColor")}</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 shrink-0 border border-border/60">
              <AvatarFallback
                className="text-sm font-medium"
                style={avatarColor ? { backgroundColor: avatarColor, color: "#fff" } : undefined}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: avatarColor === color ? "currentColor" : "transparent",
                  }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label>{tp("language")}</Label>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue placeholder={tl("ariaLabel")} />
            </SelectTrigger>
            <SelectContent>
              {locales.map((code) => {
                const meta = localeMetadata[code as Locale];
                return (
                  <SelectItem key={code} value={code}>
                    {meta.flag} {meta.nativeName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label>{tp("timezone")}</Label>
          <TimezoneSelector
            value={timezone}
            onValueChange={setTimezone}
            placeholder={tp("timezonePlaceholder")}
            searchPlaceholder={tp("timezoneSearch")}
            detectedLabel={tp("timezoneDetected")}
            noResultsText={tp("noTimezoneResults")}
            className="w-full sm:max-w-xs"
          />
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label>{tp("theme")}</Label>
          <div>
            <ThemeToggle
              className="w-full max-w-[140px]"
              labels={themeLabels}
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
