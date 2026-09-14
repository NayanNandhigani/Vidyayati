// Runs a local, file-backed PostgreSQL server for development — no Docker,
// no system install. Data lives in /DATA at the project root so it's easy
// to find, back up, or wipe. Swapping to an external database later is just
// changing DATABASE_URL in .env; nothing else about the app depends on
// this script.
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATABASE_NAME = "vidyayati";
const PORT = 5432;
const USER = "postgres";
const PASSWORD = "postgres";

const databaseDir = path.join(process.cwd(), "DATA", "postgres");

const pg = new EmbeddedPostgres({
  databaseDir,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
});

async function main() {
  const fs = await import("node:fs");
  const alreadyInitialised = fs.existsSync(path.join(databaseDir, "PG_VERSION"));

  if (!alreadyInitialised) {
    console.log(`Initialising local Postgres data directory at ${databaseDir} ...`);
    await pg.initialise();
  }

  await pg.start();
  console.log(`Local Postgres is running on port ${PORT}.`);

  // embedded-postgres's initdb doesn't expose a locale/encoding option — on
  // Windows it defaults the whole cluster to the OS codepage (WIN1252), which
  // can't store characters outside it (₹, emoji, some names). Rather than
  // pg.createDatabase() (CREATE DATABASE with no options, inheriting that
  // default), create this one database explicitly as UTF8/C-locale off
  // template0 — a database's encoding is fixed at creation and can't be
  // ALTERed later, so this only has to happen once.
  const client = pg.getPgClient();
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DATABASE_NAME]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(DATABASE_NAME)} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
    console.log(`Created database "${DATABASE_NAME}" (UTF8).`);
  }
  await client.end();

  console.log(`DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE_NAME}`);
  console.log("Local database ready. Leave this process running while you work; Ctrl+C to stop it.");
}

async function shutdown() {
  console.log("\nStopping local Postgres...");
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
