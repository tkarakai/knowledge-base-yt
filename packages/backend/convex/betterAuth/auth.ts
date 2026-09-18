// This file is used ONLY by the Better Auth CLI for schema generation.
// It mirrors the plugin configuration from @convex-dev/better-auth's
// built-in auth-options.ts (for schema compatibility) plus our custom
// plugins. Do NOT import this file at runtime.
import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth/minimal";
import {
  admin,
  anonymous,
  bearer,
  emailOTP,
  genericOAuth,
  jwt,
  magicLink,
  oidcProvider,
  oneTap,
  oneTimeToken,
  phoneNumber,
  twoFactor,
  username,
} from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  database: convexAdapter({} as any, {} as any),
  rateLimit: {
    storage: "database",
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    // Plugins from @convex-dev/better-auth built-in config (for schema compat)
    twoFactor(),
    anonymous(),
    username(),
    phoneNumber(),
    magicLink({ sendMagicLink: async () => {} }),
    emailOTP({ sendVerificationOTP: async () => {} }),
    passkey(),
    genericOAuth({
      config: [{ clientId: "", clientSecret: "", providerId: "" }],
    }),
    oneTap(),
    oidcProvider({ loginPage: "/login" }),
    bearer(),
    oneTimeToken(),
    jwt(),
    convex({
      authConfig: { providers: [{ applicationID: "convex", domain: "" }] },
    }),
    // Our custom plugins
    admin(),
  ],
} as BetterAuthOptions);
