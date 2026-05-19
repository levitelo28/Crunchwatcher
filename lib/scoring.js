export function scoreDay(checkIn, goals, previousCheckIns = []) {
  if (!checkIn?.completed) {
    return {
      total: 0,
      alcohol: 0,
      carbs: 0,
      water: 0,
      sweets: 0,
      exercise: 0,
      habits: 0,
      exerciseStreakBonus: 0
    };
  }

  const alcohol = !goals.trackAlcohol || !checkIn.alcoholConsumed ? 20 : 0;
  const sweets = !goals.trackSweets || !checkIn.sweetsConsumed ? 15 : 0;
  const waterRatio = Math.min((Number(checkIn.waterConsumed) || 0) / Math.max(goals.water.amount, 1), 1);
  const water = Math.round(waterRatio * 20);

  // Carb credit falls smoothly when an item goes over its daily max.
  // Example: max 3, consumed 6 earns half credit for that item.
  const carbScores = goals.carbItems.map((goal) => {
    const consumed = Number(checkIn.carbs.find((item) => item.id === goal.id)?.quantity || 0);
    if (goal.dailyMax <= 0) return consumed <= 0 ? 1 : 0;
    return Math.max(0, Math.min(1, goal.dailyMax / Math.max(consumed, goal.dailyMax)));
  });
  const carbs = Math.round((carbScores.reduce((sum, value) => sum + value, 0) / Math.max(carbScores.length, 1)) * 20);

  const durationGoal = goals.exercise.durationGoal || 0;
  const durationMet = durationGoal === 0 || Number(checkIn.exercise.duration || 0) >= durationGoal;
  const exerciseBase = checkIn.exercise.completed ? (durationMet ? 18 : 14) : 0;
  // Two completed workout days immediately before today unlock the small
  // exercise streak bonus while keeping the daily score capped at 100.
  const recentExerciseDays = previousCheckIns
    .slice(-2)
    .filter((entry) => entry.completed && entry.exercise.completed).length;
  const exerciseStreakBonus = checkIn.exercise.completed && recentExerciseDays >= 2 ? 2 : 0;
  const exercise = Math.min(20, exerciseBase + exerciseStreakBonus);

  const habitValues = goals.customHabits.map((habit) => Boolean(checkIn.habits?.[habit.id]));
  const habits = habitValues.length
    ? Math.round((habitValues.filter(Boolean).length / habitValues.length) * 5)
    : 5;

  return {
    total: Math.min(100, alcohol + carbs + water + sweets + exercise + habits),
    alcohol,
    carbs,
    water,
    sweets,
    exercise,
    habits,
    exerciseStreakBonus
  };
}

export function getWeekNumber(day) {
  return Math.ceil(day / 7);
}

export function getWeekCheckIns(checkIns, week) {
  const start = (week - 1) * 7;
  return checkIns.slice(start, start + 7);
}

export function calculateStreak(checkIns, goals) {
  let streak = 0;
  for (let index = 0; index < checkIns.length; index += 1) {
    const entry = checkIns[index];
    if (entry.completed && scoreDay(entry, goals, checkIns.slice(0, index)).total >= 70) {
      streak += 1;
    } else if (entry.completed) {
      streak = 0;
    }
  }
  return streak;
}

export function getWeeklyStats(checkIns, goals, week) {
  const weekEntries = getWeekCheckIns(checkIns, week);
  const completed = weekEntries.filter((entry) => entry.completed);
  const scored = weekEntries.map((entry) => ({
    entry,
    score: scoreDay(entry, goals, checkIns.slice(0, entry.day - 1)).total
  }));
  const completedScores = scored.filter(({ entry }) => entry.completed);
  const totalWorkouts = completed.filter((entry) => entry.exercise.completed).length;
  const waterHits = completed.filter((entry) => Number(entry.waterConsumed) >= goals.water.amount).length;
  const carbHits = completed.filter((entry) =>
    goals.carbItems.every((goal) => Number(entry.carbs.find((item) => item.id === goal.id)?.quantity || 0) <= goal.dailyMax)
  ).length;
  const best = completedScores.reduce((bestEntry, current) => {
    if (!bestEntry || current.score > bestEntry.score) return current;
    return bestEntry;
  }, null);

  return {
    entries: scored,
    average: completedScores.length
      ? Math.round(completedScores.reduce((sum, item) => sum + item.score, 0) / completedScores.length)
      : 0,
    bestDay: best,
    streak: calculateStreak(checkIns, goals),
    alcoholFreeDays: completed.filter((entry) => !entry.alcoholConsumed).length,
    sugarFreeDays: completed.filter((entry) => !entry.sweetsConsumed).length,
    waterHits,
    carbHits,
    exerciseHits: totalWorkouts,
    completedDays: completed.length,
    totalWorkouts,
    totalExerciseMinutes: completed.reduce((sum, entry) => sum + Number(entry.exercise.duration || 0), 0)
  };
}

export function getEarnedBadges(checkIns, goals) {
  const weeks = Array.from({ length: Math.ceil(goals.programLength / 7) }, (_, index) =>
    getWeeklyStats(checkIns, goals, index + 1)
  );
  const streak = calculateStreak(checkIns, goals);
  const totalWorkouts = checkIns.filter((entry) => entry.completed && entry.exercise.completed).length;
  const completedDays = checkIns.filter((entry) => entry.completed).length;

  return {
    streak3: streak >= 3,
    streak7: streak >= 7,
    waterWeek: weeks.some((week) => week.completedDays >= 7 && week.waterHits >= 7),
    alcoholWeek: weeks.some((week) => week.completedDays >= 7 && week.alcoholFreeDays >= 7),
    sugarWeek: weeks.some((week) => week.completedDays >= 7 && week.sugarFreeDays >= 7),
    workoutWarrior: weeks.some((week) => week.totalWorkouts >= 5),
    tenWorkouts: totalWorkouts >= 10,
    weekly90: weeks.some((week) => week.average >= 90),
    complete30: completedDays >= goals.programLength
  };
}

export function scoreColor(score) {
  if (score >= 85) return "border-ink bg-ink text-cream";
  if (score >= 70) return "border-ink bg-paper text-ink";
  return "border-line bg-cream text-muted";
}
