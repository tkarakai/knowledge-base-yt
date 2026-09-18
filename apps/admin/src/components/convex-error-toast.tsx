"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  ConvexErrorHandler,
  type ConvexErrorInfo,
} from "@repo/auth/error-handler";

/** Friendly English messages for known error codes. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Your session has expired. Please sign in again.",
  CONNECTION_LOST:
    "Unable to connect to the server. Please check your connection.",
  PROJECT_NOT_FOUND: "Project not found.",
  TASK_NOT_FOUND: "Task not found.",
  FILE_NOT_FOUND: "File not found in storage.",
  FILE_TOO_LARGE: "File too large (max 1MB).",
  UPLOAD_NOT_FOUND: "Upload not found.",
  SERVER_ERROR: "Something went wrong. Please try again.",
};

export function ConvexErrorToast() {
  const handleError = useCallback((info: ConvexErrorInfo) => {
    toast.error(FRIENDLY_MESSAGES[info.code] ?? info.message);
  }, []);

  return <ConvexErrorHandler onError={handleError} />;
}
