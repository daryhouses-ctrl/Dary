import pg from "pg";

const LOCAL_URL = "postgresql://Dary:Omar2023@localhost:5432/Dary";
const REMOTE_URL =
  "postgresql://postgres.huchgbmywctfnkykgpdd:DaryDb2026Test123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const REMOTE_URL_DIRECT =
  "postgresql://postgres.huchgbmywctfnkykgpdd:DaryDb2026Test123@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

async function test() {
  console.log("Connecting to local DB...");
  const localClient = new pg.Client({ connectionString: LOCAL_URL });
  await localClient.connect();
  console.log("Connected to local DB!");

  const localProps = await localClient.query(
    "SELECT COUNT(*) FROM properties;",
  );
  console.log("Local properties count:", localProps.rows[0].count);

  const localUsers = await localClient.query("SELECT COUNT(*) FROM users;");
  console.log("Local users count:", localUsers.rows[0].count);

  await localClient.end();

  console.log("\nConnecting to Supabase DB...");
  let remoteClient;
  try {
    remoteClient = new pg.Client({
      connectionString: REMOTE_URL_DIRECT,
      ssl: { rejectUnauthorized: false },
    });
    await remoteClient.connect();
    console.log("Connected to Supabase (5432)!");
  } catch (err) {
    console.log("5432 direct failed, trying 6543 pooler:", err.message);
    remoteClient = new pg.Client({
      connectionString: REMOTE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await remoteClient.connect();
    console.log("Connected to Supabase (6543)!");
  }

  const remoteProps = await remoteClient.query(
    "SELECT COUNT(*) FROM properties;",
  );
  console.log("Supabase properties count:", remoteProps.rows[0].count);

  const remoteUsers = await remoteClient.query("SELECT COUNT(*) FROM users;");
  console.log("Supabase users count:", remoteUsers.rows[0].count);

  await remoteClient.end();
  console.log("\nDone test!");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
