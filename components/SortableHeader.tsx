import Link from "next/link";

/**
 * A clickable column-header label that toggles sort direction via URL
 * search params (?sortBy=field&sortDir=asc|desc), server-rendered — no
 * client JS needed since it's just a Link. Drop into any list-view
 * header row; preserves every other current search param (filters,
 * pagination, etc.) so clicking a header to sort doesn't reset them.
 */
export function SortableHeader({
  label,
  field,
  basePath,
  currentParams,
}: {
  label: string;
  field: string;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  const currentSort = currentParams.sortBy;
  const currentDir = currentParams.sortDir === "desc" ? "desc" : "asc";
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value && key !== "sortBy" && key !== "sortDir") params.set(key, value);
  }
  params.set("sortBy", field);
  params.set("sortDir", nextDir);

  return (
    <Link
      href={`${basePath}?${params.toString()}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, color: isActive ? "var(--marigold-deep)" : "inherit", textDecoration: "none" }}
    >
      {label}
      <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.35 }}>{isActive ? (currentDir === "asc" ? "▲" : "▼") : "▲"}</span>
    </Link>
  );
}

/** Parses ?sortBy/?sortDir into a Prisma-ready orderBy, given a map of
 * field name -> Prisma orderBy fragment (a field can map to more than
 * one column, e.g. "name" -> [{firstName:dir},{surname:dir}]). Falls
 * back to `fallback` when sortBy is absent or unrecognized. */
export function resolveSort<T>(
  params: { sortBy?: string; sortDir?: string },
  fieldMap: Record<string, (dir: "asc" | "desc") => T>,
  fallback: T
): T {
  const dir: "asc" | "desc" = params.sortDir === "desc" ? "desc" : "asc";
  const build = params.sortBy ? fieldMap[params.sortBy] : undefined;
  return build ? build(dir) : fallback;
}
