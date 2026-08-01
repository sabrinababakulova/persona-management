/**
 * Roles a user can hold inside their company.
 *
 * `admin` belongs to the person who created the company and to nobody else — it is only ever
 * written by the registration flow, and a partial unique index on `user (companyId)` keeps a
 * second admin from appearing. Everyone who joins later is a `member` with read-only access to
 * the company profile.
 */
export const COMPANY_ROLE_ADMIN = "admin";
export const COMPANY_ROLE_MEMBER = "member";

export const COMPANY_ROLES = [COMPANY_ROLE_ADMIN, COMPANY_ROLE_MEMBER] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

export function isCompanyAdmin(role: string | null | undefined): boolean {
  return role === COMPANY_ROLE_ADMIN;
}
