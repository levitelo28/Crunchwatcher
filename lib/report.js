import { getWeeklyStats } from "./scoring";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildWeeklyReport(checkIns, goals, week, earnedBadges) {
  const stats = getWeeklyStats(checkIns, goals, week);
  const bestDay = stats.bestDay
    ? dayNames[(stats.bestDay.entry.day - 1) % 7]
    : "Not yet";
  const earned = Object.entries(earnedBadges)
    .filter(([, value]) => value)
    .map(([key]) => badgeLabels[key])
    .slice(-2);
  const photoCount = stats.entries.reduce((sum, { entry }) => sum + (entry.photos?.length || 0), 0);

  return `Crunch Watcher - Week ${week} Report:
Average Score: ${stats.average}/100
Alcohol-Free Days: ${stats.alcoholFreeDays}/${stats.completedDays || 7}
Sugar-Free Days: ${stats.sugarFreeDays}/${stats.completedDays || 7}
Water Goal Hit: ${stats.waterHits}/${stats.completedDays || 7}
Workouts Completed: ${stats.totalWorkouts}
Exercise Minutes: ${stats.totalExerciseMinutes}
Best Day: ${bestDay}
Current Streak: ${stats.streak} days
Progress Photos: ${photoCount}
Badge Earned: ${earned.length ? earned.join(", ") : "Still chasing the next one"}`;
}

export const badgeLabels = {
  streak3: "3-Day Streak",
  streak7: "7-Day Streak",
  waterWeek: "Perfect Water Week",
  alcoholWeek: "Alcohol-Free Week",
  sugarWeek: "Sugar-Free Week",
  workoutWarrior: "Workout Warrior",
  tenWorkouts: "10 Workout Milestone",
  weekly90: "90+ Weekly Average",
  complete30: "Completed 30 Days"
};
