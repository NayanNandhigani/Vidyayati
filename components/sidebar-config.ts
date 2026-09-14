import type { ComponentType, SVGProps } from "react";
import {
  IconHome,
  IconUsers,
  IconBriefcase,
  IconCheckSquare,
  IconEdit,
  IconBook,
  IconClock,
  IconReceipt,
  IconCalculator,
  IconClipboard,
  IconTruck,
  IconLibrary,
  IconCalendar,
  IconAward,
  IconMessage,
  IconBarChart,
  IconSettings,
  IconSchool,
  IconBox,
  IconBed,
  IconTarget,
} from "./icons";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** StaffPermission.moduleName this item is gated behind for STAFF users. Omit for items every portal role can see (e.g. Dashboard). */
  module?: string;
  /** Roles allowed to see this item at all. Defaults to SCHOOL_ADMIN + STAFF. */
  roles?: Array<"SCHOOL_ADMIN" | "STAFF" | "PARENT">;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/app/dashboard", icon: IconHome, roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] }],
  },
  {
    label: "Admissions",
    items: [{ label: "Admissions", href: "/app/admissions", icon: IconClipboard, module: "Admissions", roles: ["SCHOOL_ADMIN", "STAFF"] }],
  },
  {
    label: "Academics",
    items: [
      { label: "Academic Management", href: "/app/institute", icon: IconSchool, roles: ["SCHOOL_ADMIN"] },
      { label: "Students", href: "/app/students", icon: IconUsers, module: "Students", roles: ["SCHOOL_ADMIN", "STAFF"] },
      { label: "Employees", href: "/app/employees", icon: IconBriefcase, module: "Employees", roles: ["SCHOOL_ADMIN", "STAFF"] },
      { label: "Attendance", href: "/app/attendance", icon: IconCheckSquare, module: "Attendance", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Exams", href: "/app/exams", icon: IconEdit, module: "Exams", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Homework", href: "/app/homework", icon: IconBook, module: "Homework", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Timetable", href: "/app/timetable", icon: IconClock, module: "Timetable", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Teaching", href: "/app/teaching", icon: IconTarget, module: "Teaching", roles: ["SCHOOL_ADMIN", "STAFF"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fees", href: "/app/fees", icon: IconReceipt, module: "Fees", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Accounts", href: "/app/accounts", icon: IconCalculator, module: "Accounts", roles: ["SCHOOL_ADMIN", "STAFF"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Transport", href: "/app/transport", icon: IconTruck, module: "Transport", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Hostel", href: "/app/hostel", icon: IconBed, module: "Hostel", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Library", href: "/app/library", icon: IconLibrary, module: "Library", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Inventory", href: "/app/inventory", icon: IconBox, module: "Inventory", roles: ["SCHOOL_ADMIN", "STAFF"] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Events", href: "/app/events", icon: IconCalendar, module: "Events", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Certificates", href: "/app/certificates", icon: IconAward, module: "Certificates", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
      { label: "Communication", href: "/app/communication", icon: IconMessage, module: "Communication", roles: ["SCHOOL_ADMIN", "STAFF", "PARENT"] },
    ],
  },
  {
    label: "Insights",
    items: [{ label: "Reports", href: "/app/reports", icon: IconBarChart, module: "Reports", roles: ["SCHOOL_ADMIN", "STAFF"] }],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/app/settings", icon: IconSettings, roles: ["SCHOOL_ADMIN"] }],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Maps a request path (e.g. "/app/attendance/mark") to its nav label ("Attendance"), for activity logging. */
export function moduleLabelForPath(pathname: string): string | null {
  const match = ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? null;
}
