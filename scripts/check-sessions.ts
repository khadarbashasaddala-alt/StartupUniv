import { pool } from '../server/db';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

const r = await pool.query("SELECT COUNT(*) as cnt FROM session");
console.log('Sessions in PostgreSQL:', r.rows[0].count || r.rows[0].cnt);

const r2 = await pool.query("SELECT sid, sess::text, expire FROM session ORDER BY expire DESC");
for (const row of r2.rows) {
  const sess = JSON.parse(row.sess);
  let userName = 'N/A';
  if (sess.userId) {
    const [u] = await db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, sess.userId));
    if (u) userName = `${u.name} (${u.email}) [${u.role}]`;
  }
  console.log(`Session: ${row.sid.substring(0,20)} | userId: ${sess.userId || 'MISSING'} | user: ${userName} | expires: ${row.expire}`);
}
process.exit(0);
