"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@repo/design-system";
import {
  ConvexErrorHandler,
  type ConvexErrorInfo,
} from "@repo/auth/error-handler";

/** Map Convex error codes to i18n keys under the "errors.convex" namespace. */
const I18N_KEY_MAP: Record<string, string> = {
  RATE_LIMITED: "rateLimited",
  NOT_AUTHENTICATED: "notAuthenticated",
  CONNECTION_LOST: "connectionLost",
  SERVER_ERROR: "serverError",
  PROJECT_NOT_FOUND: "projectNotFound",
  TASK_NOT_FOUND: "taskNotFound",
  FILE_NOT_FOUND: "fileNotFound",
  FILE_TOO_LARGE: "fileTooLarge",
  UPLOAD_NOT_FOUND: "uploadNotFound",
};

export function ConvexErrorToast() {
  const t = useTranslations("errors.convex");

  const handleError = useCallback(
    (info: ConvexErrorInfo) => {
      const key = I18N_KEY_MAP[info.code];
      toast.error(key ? t(key, info.params) : info.message);
    },
    [t],
  );

  return <ConvexErrorHandler onError={handleError} />;
}
