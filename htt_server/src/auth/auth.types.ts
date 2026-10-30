export type PermissionLevel = "view" | "full";

export interface AuthContext {
  staffId: string;
  email: string;
  fullName: string;
  sessionId: string;
  roles: string[];
  permissions: Record<string, PermissionLevel>;
}
