import { auth } from "@/auth";
import { requireModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import NewBookForm from "./NewBookForm";

export default async function NewBookPage() {
  await requireModuleAccess("Library", "EDIT");
  const session = await auth();
  const showIsbnLookup = await hasFeature(session!.user.schoolId, "library.isbnLookup");
  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Add Title
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Add a new book to the library catalogue.</p>
      <div className="card" style={{ padding: 24, maxWidth: 480 }}>
        <NewBookForm showIsbnLookup={showIsbnLookup} />
      </div>
    </div>
  );
}
