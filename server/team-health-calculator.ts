import { storage } from "./storage.js";

interface HealthMetrics {
  completionRate: number;
  weightedCompletionRate: number;
  onTimeCompletionRate: number;
  sprintProgress: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

/**
 * Calculate comprehensive team health metrics
 */
async function calculateHealthMetrics(teamId: string): Promise<HealthMetrics> {
  const now = new Date();
  
  // Get all sprints for this team
  const sprints = await storage.getSprintsByTeam(teamId);
  
  // Get all tasks for this team (both sprint and standalone)
  const [sprintTasks, standaloneTasks] = await Promise.all([
    getSprintTasks(teamId, sprints),
    storage.getTasksByTeam(teamId)
  ]);
  
  // Filter standalone tasks (those without sprintId)
  const actualStandaloneTasks = standaloneTasks.filter(task => !task.sprintId);
  const allTasks = [...sprintTasks, ...actualStandaloneTasks];
  
  if (allTasks.length === 0) {
    // A team with no tasks has completed nothing — completionRate must be 0, or
    // the UI reports "Green — 100% complete" for a brand-new team, which every
    // team in a fresh cohort would show the moment it is created.
    //
    // The other three rates stay at 1 deliberately: there is nothing late,
    // nothing overdue and no sprint behind schedule, so there is no failure to
    // report. With weights 40 + 25 + 20 + 15, that puts healthScore at exactly
    // 85 — still Green — so a new team is not painted Red for having no work
    // yet. Callers that want to distinguish "no data" from "nothing done"
    // should check totalTasks === 0.
    return {
      completionRate: 0,
      weightedCompletionRate: 1,
      onTimeCompletionRate: 1,
      sprintProgress: 1,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0
    };
  }

  // Calculate basic metrics
  const completedTasks = allTasks.filter(t => t.status === "DONE").length;
  const completionRate = completedTasks / allTasks.length;

  // Calculate weighted completion (considering task priorities and points)
  const weightedMetrics = calculateWeightedCompletion(allTasks);
  
  // Calculate on-time completion
  const onTimeMetrics = calculateOnTimeCompletion(allTasks, now);
  
  // Calculate sprint progress
  const sprintProgress = calculateSprintProgress(sprints, now);

  return {
    completionRate,
    weightedCompletionRate: weightedMetrics.weightedRate,
    onTimeCompletionRate: onTimeMetrics.onTimeRate,
    sprintProgress,
    totalTasks: allTasks.length,
    completedTasks,
    overdueTasks: onTimeMetrics.overdueCount
  };
}

/**
 * Get tasks from all sprints for a team
 */
async function getSprintTasks(teamId: string, sprints: any[]): Promise<any[]> {
  const sprintTasksPromises = sprints.map(sprint => 
    storage.getTasksBySprint(sprint.id)
  );
  const sprintTasksArrays = await Promise.all(sprintTasksPromises);
  return sprintTasksArrays.flat();
}

/**
 * Calculate weighted completion rate considering priorities and story points
 */
function calculateWeightedCompletion(tasks: any[]): { weightedRate: number } {
  if (tasks.length === 0) return { weightedRate: 1 };

  let totalWeight = 0;
  let completedWeight = 0;

  for (const task of tasks) {
    const priorityWeight = getPriorityWeight(task.priority);
    const pointsWeight = task.points || 1;
    const taskWeight = priorityWeight * pointsWeight;
    
    totalWeight += taskWeight;
    
    if (task.status === "DONE") {
      completedWeight += taskWeight;
    }
  }

  return { weightedRate: totalWeight > 0 ? completedWeight / totalWeight : 1 };
}

/**
 * Get priority weight for task
 */
function getPriorityWeight(priority: string): number {
  switch (priority?.toUpperCase()) {
    case "HIGH": return 3;
    case "MEDIUM": return 2;
    case "LOW": return 1;
    default: return 2;
  }
}

/**
 * Calculate on-time completion rate
 */
function calculateOnTimeCompletion(tasks: any[], now: Date): { onTimeRate: number; overdueCount: number } {
  if (tasks.length === 0) return { onTimeRate: 1, overdueCount: 0 };

  let overdueCount = 0;
  let completedOnTime = 0;
  let totalCompleted = 0;

  for (const task of tasks) {
    if (task.status === "DONE") {
      totalCompleted++;
      
      // Check if task was completed on time
      if (task.endDate) {
        const dueDate = new Date(task.endDate);
        if (dueDate < now) {
          completedOnTime++;
        }
      } else {
        completedOnTime++; // No due date, assume on time
      }
    } else if (task.endDate && new Date(task.endDate) < now) {
      // Task is overdue
      overdueCount++;
    }
  }

  const onTimeRate = totalCompleted > 0 ? completedOnTime / totalCompleted : 1;
  return { onTimeRate, overdueCount };
}

/**
 * Calculate sprint progress based on current sprint timeline
 */
function calculateSprintProgress(sprints: any[], now: Date): number {
  if (sprints.length === 0) return 1;

  // Find current sprint (most recent non-passed sprint)
  const currentSprint = sprints
    .filter(s => !s.passed)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

  if (!currentSprint) {
    // All sprints passed, check the last one
    const lastSprint = sprints[sprints.length - 1];
    return lastSprint?.passed ? 1 : 0.5;
  }

  const startDate = new Date(currentSprint.startDate);
  const endDate = new Date(currentSprint.endDate);
  
  // If sprint hasn't started
  if (now < startDate) return 1;
  
  // If sprint has ended
  if (now > endDate) return currentSprint.passed ? 1 : 0.3;
  
  // Calculate progress through sprint timeline
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const timeProgress = elapsed / totalDuration;
  
  // Bonus for being on schedule
  return Math.min(1, timeProgress + 0.1);
}

/**
 * Calculate team health based on comprehensive metrics
 * Returns: "G" (Green), "A" (Amber), or "R" (Red)
 */
export async function calculateTeamHealth(teamId: string): Promise<"G" | "A" | "R"> {
  try {
    const metrics = await calculateHealthMetrics(teamId);
    
    // Calculate health score (0-100)
    let healthScore = 0;
    
    // Weighted completion rate (40% of score)
    healthScore += metrics.weightedCompletionRate * 40;
    
    // On-time completion rate (25% of score)
    healthScore += metrics.onTimeCompletionRate * 25;
    
    // Sprint progress (20% of score)
    healthScore += metrics.sprintProgress * 20;
    
    // Basic completion rate (15% of score)
    healthScore += metrics.completionRate * 15;
    
    // Penalties for critical issues
    if (metrics.overdueTasks > 0) {
      healthScore -= Math.min(20, metrics.overdueTasks * 5);
    }
    
    // Ensure score is within bounds
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    // Map score to health status with more nuanced thresholds
    if (healthScore >= 85) return "G";  // 85+ = Green (excellent)
    if (healthScore >= 65) return "A";  // 65-84 = Amber (good but needs attention)
    return "R";                        // <65 = Red (needs intervention)

  } catch (error) {
    console.error(`Error calculating health for team ${teamId}:`, error);
    return "G"; // Default to green on error
  }
}

/**
 * Update health for a single team
 */
export async function updateTeamHealth(teamId: string): Promise<string> {
  const newHealth = await calculateTeamHealth(teamId);
  await storage.updateTeam(teamId, { health: newHealth });
  return newHealth;
}

/**
 * Get detailed health metrics for debugging/monitoring
 */
export async function getTeamHealthMetrics(teamId: string): Promise<HealthMetrics & { healthScore: number; healthStatus: "G" | "A" | "R" }> {
  const metrics = await calculateHealthMetrics(teamId);
  
  // Calculate health score (0-100)
  let healthScore = 0;
  
  // Weighted completion rate (40% of score)
  healthScore += metrics.weightedCompletionRate * 40;
  
  // On-time completion rate (25% of score)
  healthScore += metrics.onTimeCompletionRate * 25;
  
  // Sprint progress (20% of score)
  healthScore += metrics.sprintProgress * 20;
  
  // Basic completion rate (15% of score)
  healthScore += metrics.completionRate * 15;
  
  // Penalties for critical issues
  if (metrics.overdueTasks > 0) {
    healthScore -= Math.min(20, metrics.overdueTasks * 5);
  }
  
  // Ensure score is within bounds
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  // Map score to health status
  let healthStatus: "G" | "A" | "R";
  if (healthScore >= 85) healthStatus = "G";
  else if (healthScore >= 65) healthStatus = "A";
  else healthStatus = "R";
  
  return {
    ...metrics,
    healthScore,
    healthStatus
  };
}

/**
 * Update health for all teams in a cohort
 */
export async function updateAllTeamsHealth(cohortId?: string): Promise<{ updated: number; results: any[] }> {
  const teams = cohortId 
    ? await storage.getTeamsByCohort(cohortId)
    : await storage.getTeams();

  const results = [];
  let updated = 0;

  for (const team of teams) {
    try {
      const oldHealth = team.health;
      const newHealth = await calculateTeamHealth(team.id);
      
      if (oldHealth !== newHealth) {
        await storage.updateTeam(team.id, { health: newHealth });
        updated++;
      }
      
      results.push({
        teamId: team.id,
        teamName: team.name,
        oldHealth,
        newHealth,
        changed: oldHealth !== newHealth
      });
    } catch (error: any) {
      console.error(`Failed to update health for team ${team.id}:`, error);
      results.push({
        teamId: team.id,
        teamName: team.name,
        error: error.message || String(error)
      });
    }
  }

  return { updated, results };
}
