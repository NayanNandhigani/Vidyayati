import { SVGProps } from "react";

// Hand-rolled 16x16 stroke icons matching the .icon class spec in
// globals.css (stroke-width 1.7, round caps/joins, currentColor). Kept in
// one place so the sidebar and module headers stay visually consistent.

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9" />
  </Icon>
);

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.7 20c.7-3.4 3.2-5.5 6.3-5.5s5.6 2.1 6.3 5.5" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.8 14.7c2.6.6 4.4 2.5 5 5.3" />
  </Icon>
);

export const IconBriefcase = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="7.5" width="18" height="12" rx="1.6" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
    <path d="M3 12.5h18" />
  </Icon>
);

export const IconCheckSquare = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.2" />
    <path d="M7.5 12.3l3 3 6-6.4" />
  </Icon>
);

export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 16.5V20h3.5L18.5 9 15 5.5 4 16.5Z" />
    <path d="M13 7.5 16.5 11" />
  </Icon>
);

export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 5.2c0-.9.8-1.6 2-1.6h6.5v15.8H6c-1.2 0-2 .7-2 1.6z" />
    <path d="M20 5.2c0-.9-.8-1.6-2-1.6h-5.5v15.8H18c1.2 0 2 .7 2 1.6z" />
  </Icon>
);

export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.5V12l3.2 2" />
  </Icon>
);

export const IconWallet = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 7.6c0-1.2 1-2.1 2.2-2.1h11.6c1.2 0 2.2.9 2.2 2.1v9.3c0 1.2-1 2.1-2.2 2.1H5.2C4 19 3 18.1 3 16.9z" />
    <path d="M15.5 12.4a1.8 1.8 0 1 0 0 .1" />
    <path d="M3 10.5h15.5" />
  </Icon>
);

export const IconCalculator = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.8" />
    <path d="M7.5 7h9" />
    <path d="M7.5 11h.01M12 11h.01M16.5 11h.01M7.5 14.5h.01M12 14.5h.01M16.5 14.5v3.5M7.5 18h.01M12 18h.01" />
  </Icon>
);

export const IconClipboard = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="1.8" />
    <rect x="9" y="3" width="6" height="3" rx="1" />
    <path d="M8.5 11.5h7M8.5 15h7" />
  </Icon>
);

export const IconTruck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="2.5" y="7" width="11" height="9" rx="1" />
    <path d="M13.5 10h3.6L20 13v3h-6.5z" />
    <circle cx="7" cy="18" r="1.7" />
    <circle cx="17" cy="18" r="1.7" />
  </Icon>
);

export const IconLibrary = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 20V6l4-2v16z" />
    <path d="M11 20V5.5l4-1.5v16z" />
    <path d="M18 20V7l2.5 1v12z" />
    <path d="M2.5 20h19" />
  </Icon>
);

export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v4M16 3v4" />
  </Icon>
);

export const IconAward = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="9" r="5.3" />
    <path d="M8.7 13.3 7.5 20.5 12 18l4.5 2.5-1.2-7.2" />
  </Icon>
);

export const IconMessage = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z" />
  </Icon>
);

export const IconBarChart = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 20V10M11 20V4M18 20v-7" />
    <path d="M2.5 20h19" />
  </Icon>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2" />
  </Icon>
);

export const IconSchool = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.5 9 12 4l9.5 5-9.5 5-9.5-5Z" />
    <path d="M6 11.3v5c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7v-5" />
    <path d="M21.5 9v6.5" />
  </Icon>
);

export const IconReceipt = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5.5 3.5h13v17l-2.3-1.6-2.2 1.6-2.3-1.6-2.2 1.6-2.2-1.6-1.8 1.6z" />
    <path d="M8.3 8h7.4M8.3 11.5h7.4M8.3 15h4.5" />
  </Icon>
);

export const IconFileText = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6.5 3.5h8L18.5 8v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M8.3 12.3h7.4M8.3 15.6h7.4M8.3 18.9h4.5" />
  </Icon>
);

export const IconPaperclip = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M16.8 7.3 9.4 14.7a3 3 0 1 0 4.24 4.24l7.1-7.1a5 5 0 1 0-7.07-7.07l-7.1 7.1a7 7 0 1 0 9.9 9.9" />
  </Icon>
);

export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12.5 3.5h5A2 2 0 0 1 19.5 5.5v5a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6Z" />
    <circle cx="15.5" cy="7.5" r="1.4" />
  </Icon>
);

export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.8" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    <circle cx="12" cy="15" r="1.4" />
  </Icon>
);

export const IconLogOut = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 20.5H5.6a1.6 1.6 0 0 1-1.6-1.6V5.1A1.6 1.6 0 0 1 5.6 3.5H9" />
    <path d="M15.5 16.5 20 12l-4.5-4.5" />
    <path d="M20 12H9" />
  </Icon>
);

export const IconBox = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z" />
    <path d="M3.5 8v9L12 21.5 20.5 17V8" />
    <path d="M12 12.5V21.5" />
  </Icon>
);

export const IconBed = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 19v-8.5A1.5 1.5 0 0 1 4.5 9H11v4" />
    <path d="M21 19v-4a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v4" />
    <circle cx="6.5" cy="9.8" r="1.4" />
    <path d="M3 16h18" />
    <path d="M3 19v1.5M21 19v1.5" />
  </Icon>
);
