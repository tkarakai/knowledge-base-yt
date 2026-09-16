import { Button } from "@repo/design-system";
import { fetchAuthQuery } from "@repo/auth/server";
import { api } from "@repo/backend";

export default async function ForbiddenPage() {
  const user = await fetchAuthQuery(api.auth.getCurrentUser).catch(
    () => null,
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-4xl font-bold">Access Denied</h1>
        {user?.email && (
          <p className="text-primary text-sm font-bold">
            You are signed in as {user.email}.
          </p>
        )}
        <p className="text-muted-foreground">
          You do not have permission to access this resource. If you believe
          this is an error, please contact your organization&apos;s
          administrator.
        </p>
        <Button asChild variant="outline">
          <a href="/api/auth/clear-session">Back to sign in</a>
        </Button>
      </div>
    </main>
  );
}
