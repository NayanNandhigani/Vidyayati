// Super Admin portal modules that are gateable per PlatformStaffPermission
// (see lib/permissions.ts#requirePlatformModuleAccess). Dashboard and
// Settings are deliberately excluded — Dashboard is a landing overview and
// Settings is a user's own account, neither is a resource to grant/deny
// access to independently.
export const PLATFORM_MODULES = ["Schools", "Leads", "Subscriptions & Billing", "Plans", "Accounts", "Contracts", "Staff", "Reports", "Audit Log"] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];
