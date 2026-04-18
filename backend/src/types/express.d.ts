export interface AuthUser {
  id: string;
  email: string;
}

export interface TenantContext {
  tenantId: string;
  role: string;
  tenantUserId: string;
  allowedPages: string[];
  allowedBranchIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantContext?: TenantContext;
    }
  }
}
