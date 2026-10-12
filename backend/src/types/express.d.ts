import type { Role } from '../models/enums';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Active school memberships for school-scoped access control. */
  schoolIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
