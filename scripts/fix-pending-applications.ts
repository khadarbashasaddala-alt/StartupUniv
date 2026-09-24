/**
 * Script to fix pending applications for users who are already assigned to teams
 * 
 * This script:
 * 1. Finds all users with role assignments (they are in teams)
 * 2. Updates their pending problem statement applications to REJECTED
 * 3. Updates their pending team member applications (sent and received) to REJECTED
 * 
 * Run with: npx tsx scripts/fix-pending-applications.ts
 */

import { db } from "../server/db";
import { problemStatementApplications, teamMemberApplications, roleAssignments } from "../shared/schema";
import { eq, and, inArray } from "drizzle-orm";

async function fixPendingApplications() {
  console.log("🔧 Starting to fix pending applications for users already in teams...\n");

  // Get all users who have role assignments (meaning they're in teams)
  const allAssignments = await db.select().from(roleAssignments);
  const usersInTeams = [...new Set(allAssignments.map(a => a.userId))];
  
  console.log(`📊 Found ${usersInTeams.length} users with team assignments\n`);

  if (usersInTeams.length === 0) {
    console.log("✅ No users in teams. Nothing to fix.");
    return;
  }

  // Count before changes
  const pendingPsBefore = await db.select().from(problemStatementApplications)
    .where(and(
      inArray(problemStatementApplications.applicantId, usersInTeams),
      eq(problemStatementApplications.status, "PENDING")
    ));
  
  const pendingTmSentBefore = await db.select().from(teamMemberApplications)
    .where(and(
      inArray(teamMemberApplications.founderId, usersInTeams),
      eq(teamMemberApplications.status, "PENDING")
    ));
  
  const pendingTmReceivedBefore = await db.select().from(teamMemberApplications)
    .where(and(
      inArray(teamMemberApplications.targetUserId, usersInTeams),
      eq(teamMemberApplications.status, "PENDING")
    ));

  console.log(`📋 Current pending applications for users in teams:`);
  console.log(`   - Problem statement applications: ${pendingPsBefore.length}`);
  console.log(`   - Team member applications (sent): ${pendingTmSentBefore.length}`);
  console.log(`   - Team member applications (received): ${pendingTmReceivedBefore.length}\n`);

  // Update problem statement applications
  const psUpdated = await db.update(problemStatementApplications)
    .set({ status: "REJECTED" })
    .where(and(
      inArray(problemStatementApplications.applicantId, usersInTeams),
      eq(problemStatementApplications.status, "PENDING")
    ))
    .returning();

  // Update team member applications (sent by users in teams)
  const tmSentUpdated = await db.update(teamMemberApplications)
    .set({ status: "REJECTED" as any })
    .where(and(
      inArray(teamMemberApplications.founderId, usersInTeams),
      eq(teamMemberApplications.status, "PENDING")
    ))
    .returning();

  // Update team member applications (received by users in teams)
  const tmReceivedUpdated = await db.update(teamMemberApplications)
    .set({ status: "REJECTED" as any })
    .where(and(
      inArray(teamMemberApplications.targetUserId, usersInTeams),
      eq(teamMemberApplications.status, "PENDING")
    ))
    .returning();

  console.log(`✅ Updated applications:`);
  console.log(`   - Problem statement applications: ${psUpdated.length}`);
  console.log(`   - Team member applications (sent): ${tmSentUpdated.length}`);
  console.log(`   - Team member applications (received): ${tmReceivedUpdated.length}`);
  console.log(`\n🎉 Done! All pending applications for users in teams have been set to REJECTED.`);
}

fixPendingApplications()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error fixing applications:", error);
    process.exit(1);
  });
