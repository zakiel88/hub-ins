/**
 * User roles in the system.
 * Maps to users.role column.
 */
export const UserRoles = {
    ADMIN: 'admin',
    MERCHANDISING: 'merchandising',
    SALES_PROCUREMENT: 'sales_procurement',
    WAREHOUSE: 'warehouse',
    LOGISTIC: 'logistic',
    BRAND: 'brand',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const ALL_ROLES = Object.values(UserRoles);
