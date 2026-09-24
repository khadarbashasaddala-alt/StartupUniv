import { db, pool } from "./db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { users, type User } from "@shared/schema";

async function getOrCreateUser(email: string, data: {
  name: string;
  password: string;
  role: "ADMIN" | "LEARNER" | "MENTOR" | "UNIVERSITY" | "CORPORATE" | "FOUNDER" | "COFOUNDER";
  orgId?: string | null;
}): Promise<User> {
  const [inserted] = await db.insert(users).values({ email, ...data }).onConflictDoNothing().returning();
  if (inserted) return inserted as User;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      password: users.password,
      name: users.name,
      phone: users.phone,
      role: users.role,
      isAdmin: users.isAdmin,
      orgId: users.orgId,
      avatarUrl: users.avatarUrl,
      keycloakId: users.keycloakId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error(`Could not find or create user: ${email}`);
  return { ...row, passwordChangedAt: null } as User;
}


/**
 * Roles are reference data that `users.role` has a foreign key to, so they must exist
 * before any user is inserted — on a database built with `db:push` the table is created
 * empty. Runs the migration's SQL rather than repeating the role list here, keeping one
 * definition; it is idempotent, so this is a no-op on an already-migrated database.
 */
async function ensureRolesExist() {
  const sqlFile = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "scripts",
    "sql",
    "add-dynamic-roles.sql"
  );
  await pool.query(readFileSync(sqlFile, "utf8"));
}

async function seed() {
  console.log("🌱 Starting admin user creation...\n");

  console.log("🎭 Ensuring roles exist...");
  await ensureRolesExist();

  const hashedPassword = await bcrypt.hash("admin123", 10);

  // =====================
  // Create Admin User Only
  // =====================
  console.log("👤 Creating admin user...");

  const admin = await getOrCreateUser("admin@startupvarsity.com", {
    name: "Admin User",
    password: hashedPassword,
    role: "ADMIN",
  });
  console.log("  ✓ Admin: admin@startupvarsity.com / admin123");

  // =====================
  // Summary
  // =====================
  console.log("\n" + "=".repeat(50));
  console.log("✅ DATABASE SEEDED SUCCESSFULLY!");
  console.log("=".repeat(50));
  console.log("\n📊 Summary:");
  console.log("  • 1 Admin user only");
  
  console.log("\n🔐 Admin Account:");
  console.log("  Email:    admin@startupvarsity.com");
  console.log("  Password: admin123");
}

seed()
  .then(() => {
    console.log("✅ Seed script completed successfully!");
    process.exit(0);
  })
  .catch((error: any) => {
    console.error("❌ Seed error:", error);
    process.exit(1);
  });
