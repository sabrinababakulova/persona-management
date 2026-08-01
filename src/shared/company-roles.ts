/**
 * Roles a user can hold inside their company.
 *
 * The hierarchy is master → admin → member:
 * - the **master account** (`user.isMasterAccount`, set once at registration) created the
 *   company and may do everything, including managing other people's roles and access;
 * - **admins** may edit the company profile and invite people, but cannot touch members;
 * - **members** can only view the company profile.
 *
 * A company can have any number of admins — only the master account is unique.
 */
export const COMPANY_ROLE_ADMIN = "admin";
export const COMPANY_ROLE_MEMBER = "member";

export const COMPANY_ROLES = [COMPANY_ROLE_ADMIN, COMPANY_ROLE_MEMBER] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

export function isCompanyRole(value: string): value is CompanyRole {
  return (COMPANY_ROLES as readonly string[]).includes(value);
}

export function isCompanyAdmin(role: string | null | undefined): boolean {
  return role === COMPANY_ROLE_ADMIN;
}
