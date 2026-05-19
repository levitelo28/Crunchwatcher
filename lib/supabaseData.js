import { createInitialState, defaultWorkoutAssistant } from "./defaults";
import { getEarnedBadges, getWeekNumber, getWeeklyStats, scoreDay } from "./scoring";
import { buildWeeklyReport } from "./report";
import { supabase } from "./supabaseClient";

export async function ensureProfile(user) {
  const profile = {
    id: user.id,
    user_id: user.id,
    email: user.email || null,
    phone: user.phone || null,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "user_id" });
  if (error) throw error;
}

export async function loadUserState(userId) {
  const initial = createInitialState();
  const [
    goalsResult,
    carbResult,
    checkInsResult,
    workoutsResult,
    exerciseResult,
    rewardsResult,
    reportsResult,
    templatesResult
  ] = await Promise.all([
    supabase.from("goals").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("carb_items").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("daily_checkins").select("*").eq("user_id", userId).order("day"),
    supabase.from("workouts").select("*").eq("user_id", userId).order("date", { ascending: false }),
    supabase.from("workout_exercises").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("rewards").select("*").eq("user_id", userId),
    supabase.from("weekly_reports").select("*").eq("user_id", userId),
    supabase.from("workout_templates").select("*").eq("user_id", userId).order("created_at")
  ]);

  const errors = [goalsResult, carbResult, checkInsResult, workoutsResult, exerciseResult, rewardsResult, reportsResult, templatesResult]
    .map((result) => result.error)
    .filter(Boolean);
  if (errors.length) throw errors[0];

  const goals = goalsResult.data
    ? {
        programLength: goalsResult.data.program_length,
        trackAlcohol: goalsResult.data.track_alcohol,
        trackSweets: goalsResult.data.track_sweets,
        water: goalsResult.data.water || initial.goals.water,
        exercise: goalsResult.data.exercise || initial.goals.exercise,
        customHabits: goalsResult.data.custom_habits || [],
        customTrackers: goalsResult.data.custom_trackers || [],
        reminderTime: goalsResult.data.reminder_time || "20:30",
        notificationsEnabled: false,
        setupComplete: true,
        carbItems: carbResult.data.map((item) => ({
          id: item.local_id || item.id,
          name: item.name,
          dailyMax: item.daily_max
        }))
      }
    : initial.goals;

  const checkIns = Array.from({ length: goals.programLength }, (_, index) => {
    const row = checkInsResult.data.find((entry) => entry.day === index + 1);
    return row
      ? {
          ...row.payload,
          day: row.day,
          date: row.checkin_date || row.payload?.date || "",
          completed: row.completed
        }
      : initial.checkIns[index] || {
          ...initial.checkIns[0],
          day: index + 1,
          completed: false
        };
  });

  const exercisesByWorkout = exerciseResult.data.reduce((acc, row) => {
    acc[row.workout_id] = acc[row.workout_id] || [];
    acc[row.workout_id].push({ id: row.local_id || row.id, ...row.payload });
    return acc;
  }, {});
  const workouts = workoutsResult.data.map((row) => ({
    id: row.id,
    date: row.date,
    name: row.name,
    type: row.type,
    duration: row.duration,
    intensity: row.intensity,
    energy: row.energy,
    notes: row.notes || "",
    performanceNote: row.performance_note || "",
    exercises: exercisesByWorkout[row.id] || []
  }));

  const templates = templatesResult.data.length
    ? templatesResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        duration: row.duration,
        intensity: row.intensity,
        exercises: row.exercises || []
      }))
    : defaultWorkoutAssistant.templates;

  return {
    ...initial,
    goals,
    checkIns,
    workoutAssistant: {
      ...defaultWorkoutAssistant,
      goals: goalsResult.data?.workout_goals || defaultWorkoutAssistant.goals,
      workouts,
      templates
    },
    remoteMeta: {
      rewards: rewardsResult.data,
      reports: reportsResult.data
    }
  };
}

export async function saveUserState(userId, state) {
  const now = new Date().toISOString();
  const goalPayload = {
    user_id: userId,
    program_length: Number(state.goals.programLength) || 30,
    track_alcohol: Boolean(state.goals.trackAlcohol),
    track_sweets: Boolean(state.goals.trackSweets),
    water: state.goals.water,
    exercise: state.goals.exercise,
    custom_habits: state.goals.customHabits || [],
    custom_trackers: state.goals.customTrackers || [],
    reminder_time: state.goals.reminderTime,
    workout_goals: state.workoutAssistant?.goals || defaultWorkoutAssistant.goals,
    updated_at: now
  };

  const { error: goalError } = await supabase.from("goals").upsert(goalPayload, { onConflict: "user_id" });
  if (goalError) throw goalError;

  await replaceRows("carb_items", userId, (state.goals.carbItems || []).map((item) => ({
    user_id: userId,
    local_id: String(item.id),
    name: item.name,
    daily_max: Number(item.dailyMax) || 0,
    updated_at: now
  })));

  await replaceRows("daily_checkins", userId, (state.checkIns || []).map((entry) => ({
    user_id: userId,
    day: entry.day,
    checkin_date: entry.date || null,
    completed: Boolean(entry.completed),
    score: scoreDay(entry, state.goals, state.checkIns.slice(0, entry.day - 1)).total,
    payload: entry,
    updated_at: now
  })));

  const workouts = state.workoutAssistant?.workouts || [];
  await replaceRows("workouts", userId, workouts.map((workout) => ({
    id: isUuid(workout.id) ? workout.id : undefined,
    user_id: userId,
    date: workout.date,
    name: workout.name,
    type: workout.type,
    duration: Number(workout.duration) || 0,
    intensity: workout.intensity,
    energy: Number(workout.energy) || null,
    notes: workout.notes || null,
    performance_note: workout.performanceNote || null,
    updated_at: now
  })));

  const { data: savedWorkouts, error: workoutReloadError } = await supabase
    .from("workouts")
    .select("id,name,date")
    .eq("user_id", userId);
  if (workoutReloadError) throw workoutReloadError;

  const workoutIdByKey = new Map(savedWorkouts.map((workout) => [`${workout.name}|${workout.date}`, workout.id]));
  await replaceRows("workout_exercises", userId, workouts.flatMap((workout) => {
    const workoutId = isUuid(workout.id) ? workout.id : workoutIdByKey.get(`${workout.name}|${workout.date}`);
    return (workout.exercises || []).map((exercise, index) => ({
      user_id: userId,
      workout_id: workoutId,
      local_id: String(exercise.id || index),
      name: exercise.name || "",
      sets: numberOrNull(exercise.sets),
      reps: numberOrNull(exercise.reps),
      weight: numberOrNull(exercise.weight),
      distance: numberOrNull(exercise.distance),
      pace: exercise.pace || null,
      time: exercise.time || null,
      rpe: numberOrNull(exercise.rpe),
      notes: exercise.notes || null,
      payload: exercise,
      updated_at: now
    }));
  }).filter((exercise) => exercise.workout_id));

  await replaceRows("workout_templates", userId, (state.workoutAssistant?.templates || []).map((template) => ({
    id: isUuid(template.id) ? template.id : undefined,
    user_id: userId,
    name: template.name,
    type: template.type,
    duration: Number(template.duration) || 0,
    intensity: template.intensity || "moderate",
    exercises: template.exercises || [],
    updated_at: now
  })));

  await saveRewardsAndReports(userId, state, now);
}

export async function importLocalState(userId, localState) {
  await saveUserState(userId, localState);
}

async function replaceRows(table, userId, rows) {
  const { error: deleteError } = await supabase.from(table).delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error: insertError } = await supabase.from(table).insert(rows);
  if (insertError) throw insertError;
}

async function saveRewardsAndReports(userId, state, now) {
  const rewards = getEarnedBadges(state.checkIns, state.goals);
  const rewardRows = Object.entries(rewards).map(([badge_key, earned]) => ({
    user_id: userId,
    badge_key,
    earned,
    earned_at: earned ? now : null,
    updated_at: now
  }));
  await replaceRows("rewards", userId, rewardRows);

  const weekCount = Math.ceil((state.goals.programLength || 30) / 7);
  const reportRows = Array.from({ length: weekCount }, (_, index) => {
    const week = index + 1;
    const stats = getWeeklyStats(state.checkIns, state.goals, week);
    return {
      user_id: userId,
      week_number: week,
      average_score: stats.average,
      report_text: buildWeeklyReport(state.checkIns, state.goals, week, rewards),
      payload: stats,
      updated_at: now
    };
  });
  await replaceRows("weekly_reports", userId, reportRows);
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && value !== "" ? number : null;
}
