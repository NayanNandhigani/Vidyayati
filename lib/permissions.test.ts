import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    school: { findUnique: vi.fn() },
    staffProfile: { findUnique: vi.fn() },
    platformStaffProfile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireModuleAccess, getPermittedClassIds, requirePlatformModuleAccess, getPlatformPermissionMap } from "@/lib/permissions";

const mockedAuth = vi.mocked(auth);
const mockSchoolFindUnique = vi.mocked(db.school.findUnique);
const mockStaffFindUnique = vi.mocked(db.staffProfile.findUnique);
const mockPlatformStaffFindUnique = vi.mocked(db.platformStaffProfile.findUnique);

beforeEach(() => {
  mockedAuth.mockReset();
  mockSchoolFindUnique.mockReset();
  mockStaffFindUnique.mockReset();
  mockPlatformStaffFindUnique.mockReset();
  // Default: module isn't disabled for the school, unless a test overrides it.
  mockSchoolFindUnique.mockResolvedValue({ disabledModules: [] } as any);
});

describe("requireModuleAccess() — School Admin implicit full access", () => {
  it("gives a School Admin EDIT on any module with no StaffPermission lookup at all", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "admin-1", role: "SCHOOL_ADMIN", schoolId: "school-1" } } as any);
    const level = await requireModuleAccess("Fees", "EDIT");
    expect(level).toBe("EDIT");
    expect(mockStaffFindUnique).not.toHaveBeenCalled();
  });
});

describe("requireModuleAccess() — Staff VIEW/EDIT/NONE ladder", () => {
  const session = { user: { id: "staff-1", role: "STAFF", schoolId: "school-1" } };

  it("throws for a Staff member with no StaffPermission row at all (NONE)", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [] } as any);
    await expect(requireModuleAccess("Fees", "VIEW")).rejects.toThrow(/insufficient permission/i);
  });

  it("allows VIEW-minimum access for a Staff member with a VIEW row", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: null, accessLevel: "VIEW" }] } as any);
    const level = await requireModuleAccess("Fees", "VIEW");
    expect(level).toBe("VIEW");
  });

  it("rejects a VIEW row when EDIT is required", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: null, accessLevel: "VIEW" }] } as any);
    await expect(requireModuleAccess("Fees", "EDIT")).rejects.toThrow(/has VIEW, needs EDIT/i);
  });

  it("allows EDIT when the Staff member has an EDIT row", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: null, accessLevel: "EDIT" }] } as any);
    const level = await requireModuleAccess("Fees", "EDIT");
    expect(level).toBe("EDIT");
  });

  it("throws for any non-Staff, non-School-Admin role (e.g. PARENT)", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "p1", role: "PARENT", schoolId: "school-1" } } as any);
    await expect(requireModuleAccess("Fees", "VIEW")).rejects.toThrow(/cannot access module/i);
  });

  it("throws when there's no session", async () => {
    mockedAuth.mockResolvedValue(null as any);
    await expect(requireModuleAccess("Fees", "VIEW")).rejects.toThrow(/not authenticated/i);
  });

  it("throws when the module is disabled for the school, even for a School Admin", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "admin-1", role: "SCHOOL_ADMIN", schoolId: "school-1" } } as any);
    mockSchoolFindUnique.mockResolvedValue({ disabledModules: ["Fees"] } as any);
    await expect(requireModuleAccess("Fees", "VIEW")).rejects.toThrow(/disabled for this school/i);
  });
});

describe("requireModuleAccess() — class-scoped vs school-wide StaffPermission precedence", () => {
  const session = { user: { id: "staff-1", role: "STAFF", schoolId: "school-1" } };

  it("a school-wide (classId: null) row grants access to ANY class, even one with no row of its own", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: null, accessLevel: "EDIT" }] } as any);
    const level = await requireModuleAccess("Attendance", "EDIT", "class-unseen");
    expect(level).toBe("EDIT");
  });

  it("a class-specific row only grants access to that exact class, not another", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: "class-A", accessLevel: "EDIT" }] } as any);

    expect(await requireModuleAccess("Attendance", "EDIT", "class-A")).toBe("EDIT");
    await expect(requireModuleAccess("Attendance", "EDIT", "class-B")).rejects.toThrow(/insufficient permission/i);
  });

  it("the school-wide row wins even when it grants LESS than a more specific class row would suggest is available elsewhere", async () => {
    // School-wide VIEW + a class-specific EDIT for one class: per the documented
    // resolution order, the school-wide row always wins regardless of level,
    // so this Staff member gets VIEW even for the class they have an EDIT row for.
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({
      permissions: [
        { classId: null, accessLevel: "VIEW" },
        { classId: "class-A", accessLevel: "EDIT" },
      ],
    } as any);

    const level = await requireModuleAccess("Attendance", "VIEW", "class-A");
    expect(level).toBe("VIEW");
    await expect(requireModuleAccess("Attendance", "EDIT", "class-A")).rejects.toThrow(/has VIEW, needs EDIT/i);
  });

  it("omitting classId only ever resolves the school-wide row, never a class-specific one", async () => {
    mockedAuth.mockResolvedValue(session as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [{ classId: "class-A", accessLevel: "EDIT" }] } as any);
    await expect(requireModuleAccess("Attendance", "VIEW")).rejects.toThrow(/insufficient permission/i);
  });
});

describe("getPermittedClassIds()", () => {
  it("returns 'ALL' for a School Admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "a1", role: "SCHOOL_ADMIN", schoolId: "school-1" } } as any);
    expect(await getPermittedClassIds("Attendance", "VIEW")).toBe("ALL");
  });

  it("returns an empty Set for a Staff member with no qualifying rows", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "s1", role: "STAFF", schoolId: "school-1" } } as any);
    mockStaffFindUnique.mockResolvedValue({ permissions: [] } as any);
    const result = await getPermittedClassIds("Attendance", "VIEW");
    expect(result).toEqual(new Set());
  });

  it("returns 'ALL' when a school-wide row meets the minimum, ignoring any class-specific rows", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "s1", role: "STAFF", schoolId: "school-1" } } as any);
    mockStaffFindUnique.mockResolvedValue({
      permissions: [
        { classId: null, accessLevel: "EDIT" },
        { classId: "class-A", accessLevel: "VIEW" },
      ],
    } as any);
    expect(await getPermittedClassIds("Attendance", "VIEW")).toBe("ALL");
  });

  it("returns the specific set of class ids that meet the minimum, excluding ones that don't", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "s1", role: "STAFF", schoolId: "school-1" } } as any);
    mockStaffFindUnique.mockResolvedValue({
      permissions: [
        { classId: "class-A", accessLevel: "EDIT" },
        { classId: "class-B", accessLevel: "VIEW" },
      ],
    } as any);
    expect(await getPermittedClassIds("Attendance", "EDIT")).toEqual(new Set(["class-A"]));
  });

  // See TEST_FINDINGS.md: getPermittedClassIds() disagrees with
  // requireModuleAccess() for this exact StaffPermission shape — a
  // school-wide row below `minimum` plus a class-specific row at/above it.
  // requireModuleAccess() always lets the school-wide row win (by design,
  // per its own docstring), so it would REJECT this class at EDIT. But
  // getPermittedClassIds() filters by level first, so the school-wide row
  // drops out of consideration entirely and the class-specific EDIT row
  // makes it into the returned set — the opposite answer. A page that
  // trusts this set to decide what to show as "editable" (e.g.
  // app/app/homework/page.tsx's editableClassIds) will offer an edit
  // control that then throws when actually used.
  it("BUG: includes a class the staffer's school-wide row would actually block at requireModuleAccess() time", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "s1", role: "STAFF", schoolId: "school-1" } } as any);
    const permissions = [
      { classId: null, accessLevel: "VIEW" },
      { classId: "class-A", accessLevel: "EDIT" },
    ];
    mockStaffFindUnique.mockResolvedValue({ permissions } as any);

    const editableClassIds = await getPermittedClassIds("Homework", "EDIT");
    expect(editableClassIds).toEqual(new Set(["class-A"])); // says class-A is editable...

    mockStaffFindUnique.mockResolvedValue({ permissions } as any); // requireModuleAccess does its own lookup
    await expect(requireModuleAccess("Homework", "EDIT", "class-A")).rejects.toThrow(/has VIEW, needs EDIT/i); // ...but the actual write path disagrees
  });
});

describe("requirePlatformModuleAccess() — mirrors the school-level ladder for Vidya Yati's own team", () => {
  it("gives SUPER_ADMIN implicit EDIT with no PlatformStaffProfile lookup", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "sa1", role: "SUPER_ADMIN", schoolId: null } } as any);
    const level = await requirePlatformModuleAccess("Schools", "EDIT");
    expect(level).toBe("EDIT");
    expect(mockPlatformStaffFindUnique).not.toHaveBeenCalled();
  });

  it("throws for PLATFORM_STAFF with no permission row for the module", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "ps1", role: "PLATFORM_STAFF", schoolId: null } } as any);
    mockPlatformStaffFindUnique.mockResolvedValue({ permissions: [] } as any);
    await expect(requirePlatformModuleAccess("Schools", "VIEW")).rejects.toThrow(/insufficient permission/i);
  });

  it("throws for a school-scoped role (e.g. SCHOOL_ADMIN) trying to use a platform module", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "a1", role: "SCHOOL_ADMIN", schoolId: "school-1" } } as any);
    await expect(requirePlatformModuleAccess("Schools", "VIEW")).rejects.toThrow(/cannot access platform module/i);
  });
});

describe("getPlatformPermissionMap()", () => {
  it("returns null for SUPER_ADMIN (caller should treat every module as EDIT)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "sa1", role: "SUPER_ADMIN", schoolId: null } } as any);
    expect(await getPlatformPermissionMap()).toBeNull();
  });

  it("builds a moduleName -> accessLevel map for PLATFORM_STAFF", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "ps1", role: "PLATFORM_STAFF", schoolId: null } } as any);
    mockPlatformStaffFindUnique.mockResolvedValue({
      permissions: [
        { moduleName: "Schools", accessLevel: "VIEW" },
        { moduleName: "Subscriptions", accessLevel: "EDIT" },
      ],
    } as any);
    expect(await getPlatformPermissionMap()).toEqual({ Schools: "VIEW", Subscriptions: "EDIT" });
  });
});
