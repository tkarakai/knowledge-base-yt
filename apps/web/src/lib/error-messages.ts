const ERROR_CODE_MAP: Record<string, string> = {
  NOT_AUTHENTICATED: "errors.NOT_AUTHENTICATED",
  PROJECT_NOT_FOUND: "errors.PROJECT_NOT_FOUND",
  TASK_NOT_FOUND: "errors.TASK_NOT_FOUND",
  FILE_NOT_FOUND: "errors.FILE_NOT_FOUND",
  FILE_TOO_LARGE: "errors.FILE_TOO_LARGE",
  UPLOAD_NOT_FOUND: "errors.UPLOAD_NOT_FOUND",
};

export function getErrorMessageKey(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error);
  return ERROR_CODE_MAP[message] ?? "common.error";
}
