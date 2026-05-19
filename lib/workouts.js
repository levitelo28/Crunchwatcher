export const workoutTypes = ["Push", "Pull", "Legs", "Full body", "Running", "HIIT", "Recovery", "Custom"];
export const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio"];

export const typeMuscles = {
  Push: ["Chest", "Shoulders", "Arms"],
  Pull: ["Back", "Arms"],
  Legs: ["Legs", "Core"],
  "Full body": ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"],
  Running: ["Legs", "Cardio"],
  HIIT: ["Legs", "Core", "Cardio"],
  Recovery: ["Cardio"],
  Custom: []
};

export function createWorkout(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    name: "",
    type: "Full body",
    duration: 30,
    intensity: "moderate",
    energy: 3,
    notes: "",
    performanceNote: "",
    exercises: [createExercise()],
    ...overrides
  };
}

export function createExercise(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "",
    sets: "",
    reps: "",
    weight: "",
    distance: "",
    pace: "",
    time: "",
    heartRate: "",
    rpe: 7,
    notes: "",
    ...overrides
  };
}

export function getWorkoutStats(workouts = []) {
  const sorted = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const weekStart = startOfWeek(new Date());
  const weekWorkouts = sorted.filter((workout) => new Date(workout.date) >= weekStart);
  const runningWorkouts = weekWorkouts.filter((workout) => workout.type === "Running");
  const allRunning = sorted.filter((workout) => workout.type === "Running");
  const weeklyMileage = runningWorkouts.reduce((sum, workout) => sum + workoutDistance(workout), 0);
  const totalMinutes = weekWorkouts.reduce((sum, workout) => sum + Number(workout.duration || 0), 0);
  const longestRun = Math.max(0, ...allRunning.map(workoutDistance));
  const fastestPace = getFastestPace(allRunning);
  const personalRecords = getPersonalRecords(sorted);

  return {
    sorted,
    weekWorkouts,
    weeklyCount: weekWorkouts.length,
    totalMinutes,
    weeklyMileage,
    lastWorkout: sorted[0],
    longestRun,
    fastestPace,
    averagePace: averagePace(allRunning),
    personalRecords,
    streak: workoutStreak(sorted)
  };
}

export function getRecovery(workouts = []) {
  const now = new Date();
  return muscleGroups.map((muscle) => {
    const recent = workouts
      .filter((workout) => (typeMuscles[workout.type] || []).includes(muscle))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const days = recent ? daysBetween(new Date(recent.date), now) : 7;
    const recoveryHours = muscle === "Cardio" ? 36 : muscle === "Legs" ? 72 : 48;
    const percent = Math.min(100, Math.round((days * 24 / recoveryHours) * 100));
    const status = percent >= 85 ? "Fresh" : percent >= 60 ? "Moderate fatigue" : percent >= 35 ? "Recovering" : "Overworked";
    return { muscle, percent, status, daysSince: Math.round(days) };
  });
}

export function recommendWorkout(workoutAssistant) {
  const workouts = workoutAssistant.workouts || [];
  const stats = getWorkoutStats(workouts);
  const recovery = getRecovery(workouts);
  const energy = Number(workoutAssistant.goals?.energyLevel || 3);
  const goal = workoutAssistant.goals?.primaryGoal || "General health";
  const last = stats.lastWorkout;
  const daysSinceLast = last ? daysBetween(new Date(last.date), new Date()) : 99;
  const lowRecovery = recovery.filter((item) => item.percent < 60).map((item) => item.muscle);
  const lastType = last?.type;

  if (energy <= 2 || lowRecovery.length >= 4) {
    return {
      type: "Recovery",
      title: "Recovery Day",
      intensity: "light",
      reason: "Low energy or multiple fatigued muscle groups. Keep blood moving and protect tomorrow.",
      focus: "Mobility, easy cardio, stretching"
    };
  }

  if (daysSinceLast >= 4) {
    return {
      type: "Full body",
      title: "Light Full Body",
      intensity: "light",
      reason: "You have several days off the log. Rebuild rhythm without forcing volume.",
      focus: "Technique, easy sets, finish fresh"
    };
  }

  if (goal === "Improve endurance" || goal === "Lose fat") {
    const cardio = recovery.find((item) => item.muscle === "Cardio");
    if (cardio?.percent >= 60 && lastType !== "Running") {
      return {
        type: "Running",
        title: goal === "Improve endurance" ? "Moderate Intensity Run" : "Steady Cardio",
        intensity: "moderate",
        reason: "Cardio is recovered and your goal favors aerobic consistency.",
        focus: "Smooth pace, controlled breathing"
      };
    }
  }

  const rotation = goal === "Improve strength" || goal === "Build muscle"
    ? ["Push", "Pull", "Legs"]
    : ["Full body", "Running", "Push", "Pull", "Legs"];
  const available = rotation.find((type) => type !== lastType && (typeMuscles[type] || []).every((muscle) => !lowRecovery.includes(muscle)));

  return {
    type: available || "Recovery",
    title: available ? `${available} Day` : "Recovery Day",
    intensity: energy >= 4 ? "hard" : "moderate",
    reason: available
      ? `${available} is the best fit based on recent training and recovery balance.`
      : "Most primary muscle groups are still recovering.",
    focus: available === "Legs" ? "Controlled lower-body volume" : available === "Running" ? "Moderate aerobic work" : "Progressive, clean reps"
  };
}

export function getSuggestedWeight(workouts, exerciseName) {
  const matching = [...workouts]
    .flatMap((workout) => workout.exercises || [])
    .filter((exercise) => exercise.name?.toLowerCase() === exerciseName?.toLowerCase() && Number(exercise.weight));
  if (!matching.length) return "";
  const best = Math.max(...matching.map((exercise) => Number(exercise.weight)));
  return Math.round(best + 5);
}

function getPersonalRecords(workouts) {
  const records = {};
  workouts.forEach((workout) => {
    (workout.exercises || []).forEach((exercise) => {
      if (Number(exercise.weight)) {
        const key = exercise.name || "Lift";
        const current = records[key];
        if (!current || Number(exercise.weight) > current.value) {
          records[key] = { label: key, value: Number(exercise.weight), unit: "lb" };
        }
      }
      if (Number(exercise.distance)) {
        const key = `${exercise.name || "Run"} distance`;
        const current = records[key];
        if (!current || Number(exercise.distance) > current.value) {
          records[key] = { label: key, value: Number(exercise.distance), unit: "mi" };
        }
      }
    });
  });
  return Object.values(records).slice(0, 6);
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function daysBetween(start, end) {
  return Math.max(0, (end - start) / 86400000);
}

function workoutDistance(workout) {
  return (workout.exercises || []).reduce((sum, exercise) => sum + Number(exercise.distance || 0), 0);
}

function paceToSeconds(pace) {
  if (!pace || typeof pace !== "string" || !pace.includes(":")) return null;
  const [minutes, seconds] = pace.split(":").map(Number);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return minutes * 60 + seconds;
}

function secondsToPace(seconds) {
  if (!seconds) return "N/A";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getFastestPace(workouts) {
  const paces = workouts.flatMap((workout) => (workout.exercises || []).map((exercise) => paceToSeconds(exercise.pace))).filter(Boolean);
  return paces.length ? secondsToPace(Math.min(...paces)) : "N/A";
}

function averagePace(workouts) {
  const paces = workouts.flatMap((workout) => (workout.exercises || []).map((exercise) => paceToSeconds(exercise.pace))).filter(Boolean);
  return paces.length ? secondsToPace(paces.reduce((sum, pace) => sum + pace, 0) / paces.length) : "N/A";
}

function workoutStreak(workouts) {
  const uniqueDays = new Set(workouts.map((workout) => new Date(workout.date).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (uniqueDays.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
