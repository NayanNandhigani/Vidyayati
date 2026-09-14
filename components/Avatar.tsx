import { avatarColorFor } from "@/lib/academic";
import { initials } from "@/lib/format";

/** A person's photo when set (Student.photoPath / StaffProfile.photoPath, served via /api/id-card-assets), falling back to the existing colored-initials circle everywhere else in the app already used. */
export default function Avatar({ photoPath, seed, name, size, fontSize }: { photoPath: string | null; seed: string; name: string; size: number; fontSize?: number }) {
  if (photoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/id-card-assets/${photoPath}`}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? size * 0.36,
        fontWeight: 700,
        color: "#fff",
        flex: "none",
        background: avatarColorFor(seed),
      }}
    >
      {initials(name)}
    </div>
  );
}
