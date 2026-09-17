"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  console.log(JSON.stringify({ diag: "global-error", message: error.message, digest: error.digest }));
  return (
    <html>
      <body>
        <p>diag-global-error: {error.message}</p>
      </body>
    </html>
  );
}
