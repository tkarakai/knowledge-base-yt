import { getTranslations } from "next-intl/server";

import { Button } from "@repo/design-system";
import { fetchAuthQuery } from "@repo/auth/server";
import { api } from "@repo/backend";

export default async function ForbiddenPage() {
  const t = await getTranslations("forbidden");
  const user = await fetchAuthQuery(api.auth.getCurrentUser).catch(
    () => null,
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        {user?.email && (
          <p className="text-primary text-sm font-bold">
            {t("signedInAs", { email: user.email })}
          </p>
        )}
        <p className="text-muted-foreground">{t("description")}</p>
        <Button asChild variant="outline">
          <a href="/api/auth/clear-session">{t("backToSignIn")}</a>
        </Button>
      </div>
    </main>
  );
}
