"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@repo/design-system";

const SUPERPOWERS = [
  "coffee-to-code",
  "pixel-perfect",
  "bug-whisperer",
  "spreadsheet-wizard",
  "inbox-zero",
  "parallel-parking",
  "remembering-names",
  "never-burning-toast",
  "explaining-tech",
  "finding-restaurants",
  "staying-calm",
  "other",
] as const;

const EXCITEMENT_LEVELS = [
  "take-my-money",
  "cant-wait",
  "cautiously-optimistic",
  "just-browsing",
  "friend-made-me",
] as const;

function MultiSelectDropdown({
  id,
  label,
  placeholder,
  options,
  selected,
  onToggle,
  translationPrefix,
  t,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  translationPrefix: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className="w-full justify-between font-normal"
            type="button"
          >
            <span className="truncate">
              {selected.length > 0
                ? t("selectedCount", { count: selected.length })
                : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[var(--radix-dropdown-menu-trigger-width)]"
          align="start"
        >
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={() => onToggle(option)}
              onSelect={(e) => e.preventDefault()}
            >
              {t(`${translationPrefix}.${option}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_SITE_URL");
}

export function WaitlistForm() {
  const t = useTranslations("landing.waitlist");
  const tAuth = useTranslations("auth");
  const [email, setEmail] = React.useState("");
  const [superpowers, setSuperpowers] = React.useState<string[]>([]);
  const [excitement, setExcitement] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggleSelection = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`${CONVEX_SITE_URL}/api/waitlist/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          meta: JSON.stringify({ superpowers, excitement }),
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const raw = typeof data.error === "string" ? data.error : "";
        if (raw.includes("WAITLIST_NOT_ENABLED")) {
          setError(t("errors.waitlistNotEnabled"));
        } else if (raw.includes("INVALID_EMAIL")) {
          setError(t("errors.invalidEmail"));
        } else if (raw.includes("RATE_LIMITED")) {
          setError(t("errors.rateLimited"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
        <CardHeader className="text-center">
          <CardTitle>{t("successTitle")}</CardTitle>
          <CardDescription>{t("successDescription")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="waitlist-email">{t("emailLabel")}</Label>
            <Input
              id="waitlist-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>
          <MultiSelectDropdown
            id="waitlist-superpowers"
            label={t("superpowersLabel")}
            placeholder={t("superpowersPlaceholder")}
            options={SUPERPOWERS}
            selected={superpowers}
            onToggle={(v) => toggleSelection(superpowers, setSuperpowers, v)}
            translationPrefix="superpowers"
            t={t}
          />
          <MultiSelectDropdown
            id="waitlist-excitement"
            label={t("excitementLabel")}
            placeholder={t("excitementPlaceholder")}
            options={EXCITEMENT_LEVELS}
            selected={excitement}
            onToggle={(v) => toggleSelection(excitement, setExcitement, v)}
            translationPrefix="excitement"
            t={t}
          />
          {error ? (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={pending || superpowers.length === 0 || excitement.length === 0}
          >
            {pending ? t("submitting") : t("submit")}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {tAuth("legal.prefix")}{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {tAuth("legal.termsOfService")}
            </Link>{" "}
            {tAuth("legal.and")}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {tAuth("legal.privacyPolicy")}
            </Link>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
