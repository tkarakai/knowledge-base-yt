import { EnvironmentBanner } from "./environment-banner";

function collectPublicEnvVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_") && value !== undefined) {
      vars[key] = value;
    }
  }
  return vars;
}

export function EnvironmentBannerWrapper({
  appName,
}: {
  appName: string;
}) {
  const environment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT as
    | "development"
    | "staging"
    | "production"
    | undefined;

  if (
    environment === "production" ||
    (!environment && process.env.NODE_ENV === "production")
  ) {
    return null;
  }

  return (
    <EnvironmentBanner
      environment={environment || "development"}
      gitSha={process.env.NEXT_PUBLIC_GIT_SHA}
      gitBranch={process.env.NEXT_PUBLIC_GIT_BRANCH}
      deployedAt={process.env.NEXT_PUBLIC_DEPLOY_TIMESTAMP}
      appName={process.env.NEXT_PUBLIC_APP_NAME || appName}
      buildId={process.env.NEXT_PUBLIC_BUILD_ID}
      envVars={collectPublicEnvVars()}
    />
  );
}
