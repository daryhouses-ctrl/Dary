import pg from "pg";

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  "postgresql://Dary:Omar2023@localhost:5432/Dary";
const REMOTE_URL =
  process.env.REMOTE_DATABASE_URL ||
  "postgresql://postgres.huchgbmywctfnkykgpdd:DaryDb2026Test123@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

const TABLES = [
  { name: "roles", pkey: ["id"] },
  { name: "permissions", pkey: ["id"] },
  { name: "role_permissions", pkey: ["role_id", "permission_id"] },
  { name: "users", pkey: ["id"] },
  { name: "profiles", pkey: ["id"] },
  { name: "user_roles", pkey: ["user_id", "role_id"] },
  { name: "properties", pkey: ["id"] },
  { name: "property_rooms", pkey: ["id"] },
  { name: "property_images", pkey: ["id"] },
  { name: "saved_searches", pkey: ["id"] },
  { name: "favorites", pkey: ["user_id", "property_id"] },
  { name: "recently_viewed", pkey: ["user_id", "property_id"] },
  { name: "bookings", pkey: ["id"] },
  { name: "contracts", pkey: ["id"] },
  { name: "reviews", pkey: ["id"] },
  { name: "reports", pkey: ["id"] },
  { name: "support_tickets", pkey: ["id"] },
  { name: "ticket_messages", pkey: ["id"] },
  { name: "notifications", pkey: ["id"] },
];

async function syncTable(localClient, remoteClient, tableConfig) {
  const { name, pkey } = tableConfig;

  const existsQuery = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    );
  `;
  const existsRes = await localClient.query(existsQuery, [name]);
  if (!existsRes.rows[0].exists) {
    console.log(`[SKIP] Table "${name}" does not exist locally.`);
    return;
  }

  const localRows = await localClient.query(`SELECT * FROM "${name}";`);
  if (localRows.rows.length === 0) {
    console.log(`[0 ROWS] Table "${name}" has no data.`);
    return;
  }

  console.log(`\n Syncing "${name}" (${localRows.rows.length} rows)...`);

  let insertedCount = 0;
  for (const row of localRows.rows) {
    const columns = Object.keys(row).map((c) => `"${c}"`);
    const values = Object.values(row);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    const conflictTarget = pkey.map((k) => `"${k}"`).join(", ");

    const updateClauses = Object.keys(row)
      .filter((col) => !pkey.includes(col))
      .map((col) => `"${col}" = EXCLUDED."${col}"`);

    let query = "";
    if (updateClauses.length > 0) {
      query = `
        INSERT INTO "${name}" (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (${conflictTarget})
        DO UPDATE SET ${updateClauses.join(", ")};
      `;
    } else {
      query = `
        INSERT INTO "${name}" (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (${conflictTarget})
        DO NOTHING;
      `;
    }

    try {
      await remoteClient.query(query, values);
      insertedCount++;
    } catch (err) {
      console.warn(`  ⚠️ Row in "${name}" warning:`, err.message);
    }
  }

  console.log(
    `Table "${name}": ${insertedCount}/${localRows.rows.length} rows synced successfully.`,
  );
}

async function run() {
  console.log("==========================================");
  console.log(" Starting Database Sync: Local -> Supabase");
  console.log("==========================================");

  const localClient = new pg.Client({ connectionString: LOCAL_URL });
  await localClient.connect();
  console.log(" Connected to LOCAL database (localhost:5432/Dary)");

  let remoteClient;
  try {
    remoteClient = new pg.Client({
      connectionString: REMOTE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await remoteClient.connect();
    console.log(" Connected to SUPABASE database (Direct/Pooler)");
  } catch (err) {
    console.log(" Direct connection failed, trying pooler port 6543...");
    const poolerUrl = REMOTE_URL.replace(":5432/", ":6543/").concat(
      "?pgbouncer=true",
    );
    remoteClient = new pg.Client({
      connectionString: poolerUrl,
      ssl: { rejectUnauthorized: false },
    });
    await remoteClient.connect();
    console.log(" Connected to SUPABASE database (Port 6543)");
  }

  for (const table of TABLES) {
    await syncTable(localClient, remoteClient, table);
  }

  await localClient.end();
  await remoteClient.end();

  console.log("\n ALL LOCAL DATA SYNCED TO SUPABASE SUCCESSFULLY!");
  console.log(
    "Now refresh https://dary-student-housing.vercel.app/properties to see all properties!",
  );
}

run().catch((err) => {
  console.error("Sync Error:", err);
  process.exit(1);
});
