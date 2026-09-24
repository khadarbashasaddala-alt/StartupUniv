import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  // Check existing cohorts
  const cohorts = await db.execute(sql`SELECT id, name, is_active, is_open_for_registration FROM cohorts`);
  console.log("Existing cohorts:");
  console.log(JSON.stringify(cohorts.rows, null, 2));
  
  // Update all active cohorts to be open for registration
  console.log("\nUpdating all active cohorts to be open for registration...");
  await db.execute(sql`UPDATE cohorts SET is_open_for_registration = true WHERE is_active = true`);
  
  // Check again
  const updated = await db.execute(sql`SELECT id, name, is_active, is_open_for_registration FROM cohorts`);
  console.log("\nUpdated cohorts:");
  console.log(JSON.stringify(updated.rows, null, 2));
  
  process.exit(0);
}

run();
