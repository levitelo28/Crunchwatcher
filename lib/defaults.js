export const STORAGE_KEY = "crunch-watcher-state-v1";

export const defaultGoals = {
  programLength: 30,
  trackAlcohol: true,
  carbItems: [
    { id: "bread", name: "Bread", dailyMax: 3 },
    { id: "rice", name: "Rice bowls", dailyMax: 1 },
    { id: "chips", name: "Chips", dailyMax: 1 }
  ],
  water: { amount: 64, unit: "Oz" },
  trackSweets: true,
  exercise: {
    workoutsPerWeek: 4,
    dailyMovement: "30 min walk",
    durationGoal: 30
  },
  customHabits: [
    { id: "sleep", name: "Sleep by 11 PM" },
    { id: "steps", name: "Walk 10k steps" }
  ],
  customTrackers: [
    { id: "protein", name: "Protein servings", dailyGoal: 3 }
  ],
  reminderTime: "20:30",
  notificationsEnabled: false,
  workoutReminderTime: "18:00",
  setupComplete: false
};

export const defaultWorkoutAssistant = {
  goals: {
    primaryGoal: "General health",
    weeklyFrequency: 4,
    energyLevel: 3
  },
  workouts: [],
  templates: [
    {
      id: "push-a",
      name: "Push Day A",
      type: "Push",
      duration: 45,
      intensity: "moderate",
      exercises: [
        { id: "bench", name: "Bench Press", sets: 3, reps: 5, weight: 135, distance: "", pace: "", time: "", rpe: 7, notes: "" },
        { id: "press", name: "Shoulder Press", sets: 3, reps: 8, weight: 65, distance: "", pace: "", time: "", rpe: 7, notes: "" }
      ]
    },
    {
      id: "tempo-run",
      name: "Moderate Tempo Run",
      type: "Running",
      duration: 35,
      intensity: "moderate",
      exercises: [
        { id: "run", name: "Tempo Run", sets: "", reps: "", weight: "", distance: 3, pace: "8:30", time: "25:30", rpe: 7, notes: "" }
      ]
    }
  ]
};

export function createEmptyCheckIn(day, goals = defaultGoals) {
  return {
    day,
    date: "",
    alcoholConsumed: false,
    carbs: goals.carbItems.map((item) => ({ id: item.id, name: item.name, quantity: 0 })),
    waterConsumed: 0,
    sweetsConsumed: false,
    exercise: {
      completed: false,
      type: "",
      duration: 0,
      intensity: "moderate"
    },
    habits: goals.customHabits.reduce((acc, habit) => ({ ...acc, [habit.id]: false }), {}),
    mood: 3,
    notes: "",
    photos: [],
    trackers: (goals.customTrackers || []).reduce((acc, tracker) => ({ ...acc, [tracker.id]: 0 }), {}),
    completed: false
  };
}

export function createInitialState() {
  return {
    goals: defaultGoals,
    checkIns: Array.from({ length: defaultGoals.programLength }, (_, index) =>
      createEmptyCheckIn(index + 1, defaultGoals)
    ),
    activeDay: 1,
    darkMode: false,
    workoutAssistant: defaultWorkoutAssistant
  };
}
