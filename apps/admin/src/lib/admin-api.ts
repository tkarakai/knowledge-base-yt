import type { AuditAction, AuditStatus } from "@repo/backend";
import { authClient } from "@repo/auth/client";

// ---------------------------------------------------------------------------
// Audit event callback type — callers pass useMutation(api.auditTrail.postEvent)
// ---------------------------------------------------------------------------

export type PostAuditEventFn = (args: {
  happenedAt: number;
  sourceDetail?: string;
  action: AuditAction;
  resource: string;
  status?: AuditStatus;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  meta?: string;
}) => Promise<unknown>;

type AuthErrorLike = {
  status?: number;
  message?: string;
};

function mapAuthErrorToAuditStatus(error: AuthErrorLike | undefined): AuditStatus {
  if (!error) return "failed.internal_error";

  switch (error.status) {
    case 400:
    case 422:
      return "failed.validation_error";
    case 401:
      return "failed.unauthorized";
    case 403:
      return "failed.blocked";
    case 404:
      return "failed.not_found";
    case 429:
      return "failed.rate_limited";
    default:
      break;
  }

  if (typeof error.status === "number" && error.status >= 500) {
    return "failed.internal_error";
  }

  const message = (error.message ?? "").toLowerCase();
  if (message.includes("not found")) return "failed.not_found";
  if (message.includes("unauthorized") || message.includes("forbidden")) {
    return "failed.unauthorized";
  }
  if (message.includes("blocked") || message.includes("banned")) {
    return "failed.blocked";
  }
  if (message.includes("rate")) return "failed.rate_limited";
  if (message.includes("invalid")) return "failed.validation_error";

  return "failed.internal_error";
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: number | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  twoFactorEnabled: boolean;
};

export type FetchUsersParams = {
  searchValue?: string;
  searchField?: "email" | "name";
  searchOperator?: "contains" | "starts_with" | "ends_with";
  filterField?: string;
  filterValue?: string | string[];
  filterOperator?: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type FetchUsersResult = {
  users: AdminUser[];
  total: number;
};

export async function fetchUsers(params: FetchUsersParams): Promise<FetchUsersResult> {
  const query: Record<string, string> = {};

  if (params.searchValue) {
    query.searchValue = params.searchValue;
    query.searchField = params.searchField ?? "name";
    query.searchOperator = params.searchOperator ?? "contains";
  }

  if (params.filterField) {
    query.filterField = params.filterField;
    query.filterValue = Array.isArray(params.filterValue)
      ? params.filterValue.join(",")
      : params.filterValue ?? "";
    query.filterOperator = params.filterOperator ?? "eq";
  }

  if (params.sortBy) {
    query.sortBy = params.sortBy;
    query.sortDirection = params.sortDirection ?? "asc";
  }

  if (params.limit != null) {
    query.limit = String(params.limit);
  }

  if (params.offset != null) {
    query.offset = String(params.offset);
  }

  const result = await authClient.admin.listUsers({ query });

  const rawUsers = result.data?.users ?? [];
  const total = (result.data?.total as number) ?? 0;

  return {
    users: rawUsers.map((u) => {
      const raw = u as unknown as Record<string, unknown>;
      return {
        id: u.id,
        name: u.name ?? "",
        email: u.email,
        role: (raw.role as string | null) ?? null,
        banned: u.banned ?? null,
        banReason: u.banReason ?? null,
        banExpires: u.banExpires != null ? new Date(u.banExpires).getTime() : null,
        image: (raw.image as string | null) ?? null,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date((raw.updatedAt as string | number) ?? u.createdAt),
        emailVerified: u.emailVerified ?? false,
        phoneNumber: (raw.phoneNumber as string | null) ?? null,
        phoneNumberVerified: !!(raw.phoneNumberVerified),
        twoFactorEnabled: !!(raw.twoFactorEnabled),
      };
    }),
    total,
  };
}

export async function banUser(
  userId: string,
  banReason: string,
  banExpiresIn?: number,
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.banUser({
      userId,
      banReason,
      ...(banExpiresIn != null ? { banExpiresIn } : {}),
    });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to ban user");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.user.banned",
      resource: `user:${userId}`,
      status,
      reason: banReason,
      meta: banExpiresIn != null ? JSON.stringify({ banExpiresIn }) : undefined,
    }).catch(() => {});
  }

  if (error) throw error;
}

export async function unbanUser(
  userId: string,
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.unbanUser({ userId });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to unban user");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.user.unbanned",
      resource: `user:${userId}`,
      status,
    }).catch(() => {});
  }

  if (error) throw error;
}

export async function removeUser(
  userId: string,
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.removeUser({ userId });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to remove user");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.user.deleted",
      resource: `user:${userId}`,
      status,
    }).catch(() => {});
  }

  if (error) throw error;
}

export async function setUserRole(
  userId: string,
  role: "user" | "admin",
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.setRole({ userId, role });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to set user role");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.role_changed",
      resource: `user:${userId}`,
      status,
      newValue: JSON.stringify({ role }),
    }).catch(() => {});
  }

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export type AdminSession = {
  id: string;
  userId: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export async function listUserSessions(userId: string): Promise<AdminSession[]> {
  const result = await authClient.admin.listUserSessions({ userId });
  if (result.error) {
    throw new Error(result.error.message ?? "Failed to list user sessions");
  }
  const sessions = result.data?.sessions ?? [];
  return sessions.map((s) => {
    const raw = s as unknown as Record<string, unknown>;
    return {
      id: raw.id as string,
      userId: raw.userId as string,
      token: raw.token as string,
      ipAddress: (raw.ipAddress as string | null) ?? null,
      userAgent: (raw.userAgent as string | null) ?? null,
      expiresAt: new Date(raw.expiresAt as string | number),
      createdAt: new Date(raw.createdAt as string | number),
      updatedAt: new Date(raw.updatedAt as string | number),
    };
  });
}

export async function revokeSession(
  sessionToken: string,
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.revokeUserSession({ sessionToken });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to revoke session");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.session.revoked",
      resource: `session:…${sessionToken.slice(-8)}`,
      status,
    }).catch(() => {});
  }

  if (error) throw error;
}

export async function revokeAllSessions(
  userId: string,
  postAuditEvent?: PostAuditEventFn,
): Promise<void> {
  const happenedAt = Date.now();
  let status: AuditStatus = "succeeded";
  let error: unknown;

  try {
    const result = await authClient.admin.revokeUserSessions({ userId });
    if (result.error) {
      status = mapAuthErrorToAuditStatus(result.error as AuthErrorLike);
      error = new Error(result.error.message ?? "Failed to revoke sessions");
    }
  } catch (e) {
    error = e;
    status = "failed.unknown";
  } finally {
    postAuditEvent?.({
      happenedAt,
      sourceDetail: "admin",
      action: "admin.session.revoked_all",
      resource: `user:${userId}`,
      status,
    }).catch(() => {});
  }

  if (error) throw error;
}
