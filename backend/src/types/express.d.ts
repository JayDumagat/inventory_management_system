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
  planKey: string;
  addonLimits: Record<string, number>;
}

export interface SuperadminContext {
  id: string;
  email: string;
  role: string;
  allowedPages: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantContext?: TenantContext;
      superadmin?: SuperadminContext;
    }
  }
}
