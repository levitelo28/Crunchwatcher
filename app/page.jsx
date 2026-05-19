"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ClipboardList, Dumbbell, Home, Medal, Moon, Settings, Share2, Sun, Upload } from "lucide-react";
import { createEmptyCheckIn, createInitialState, defaultWorkoutAssistant, STORAGE_KEY } from "../lib/defaults";
import { AuthProvider, useAuth } from "../lib/auth";
import { getEarnedBadges, getWeekNumber, getWeeklyStats, scoreColor, scoreDay } from "../lib/scoring";
import { badgeLabels, buildWeeklyReport } from "../lib/report";
import { ensureProfile, importLocalState, loadUserState, saveUserState } from "../lib/supabaseData";
import { createExercise, createWorkout, getRecovery, getSuggestedWeight, getWorkoutStats, recommendWorkout, workoutTypes } from "../lib/workouts";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "today", label: "Today", icon: ClipboardList },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "workout", label: "Workout Assistant", icon: Dumbbell },
  { id: "report", label: "Report", icon: Share2 },
  { id: "rewards", label: "Rewards", icon: Medal },
  { id: "settings", label: "Settings", icon: Settings }
];

export default function CrunchWatcherApp() {
  return (
    <AuthProvider>
      <CrunchWatcherContent />
    </AuthProvider>
  );
}

function CrunchWatcherContent() {
  const auth = useAuth();
  const [state, setState] = useState(createInitialState);
  const [activeView, setActiveView] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState("Loading account...");
  const [remoteError, setRemoteError] = useState("");
  const [localImportState, setLocalImportState] = useState(null);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.configured || !auth.user) {
      setLoaded(false);
      return;
    }

    let active = true;
    async function loadRemoteState() {
      try {
        setRemoteStatus("Loading your training log...");
        setRemoteError("");
        await ensureProfile(auth.user);
        const remoteState = await loadUserState(auth.user.id);
        const localRaw = window.localStorage.getItem(STORAGE_KEY);
        setState(normalizeSavedState(remoteState));
        if (localRaw) setLocalImportState(normalizeSavedState(JSON.parse(localRaw)));
        if (active) {
          setLoaded(true);
          setRemoteStatus("Saved to Supabase");
        }
      } catch (error) {
        if (active) {
          setRemoteError(error.message);
          setRemoteStatus("Could not load Supabase data");
        }
      }
    }

    loadRemoteState();
    return () => {
      active = false;
    };
  }, [auth.loading, auth.configured, auth.user]);

  useEffect(() => {
    if (!loaded || !auth.user) return undefined;
    document.documentElement.classList.toggle("dark", state.darkMode);
    const timer = window.setTimeout(async () => {
      try {
        setRemoteStatus("Saving...");
        await saveUserState(auth.user.id, state);
        setRemoteStatus("Saved to Supabase");
        setRemoteError("");
      } catch (error) {
        setRemoteError(error.message);
        setRemoteStatus("Save failed");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [state, loaded, auth.user]);

  useEffect(() => {
    if (!loaded || !state.goals.notificationsEnabled) return undefined;
    const timer = window.setInterval(() => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = state.checkIns[state.activeDay - 1];
      if (current === state.goals.reminderTime && today && !today.completed && Notification.permission === "granted") {
        new Notification("Crunch Watcher", { body: "Your daily check-in is ready." });
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loaded, state]);

  const currentDay = state.checkIns[state.activeDay - 1] || state.checkIns[0];
  const currentScore = scoreDay(currentDay, state.goals, state.checkIns.slice(0, state.activeDay - 1)).total;
  const week = getWeekNumber(state.activeDay);
  const weeklyStats = useMemo(
    () => getWeeklyStats(state.checkIns, state.goals, week),
    [state.checkIns, state.goals, week]
  );
  const earnedBadges = useMemo(() => getEarnedBadges(state.checkIns, state.goals), [state.checkIns, state.goals]);

  function updateGoals(nextGoals) {
    setState((current) => {
      const programLength = Number(nextGoals.programLength) || 30;
      const nextCheckIns = Array.from({ length: programLength }, (_, index) => {
        const existing = current.checkIns[index] || createEmptyCheckIn(index + 1, nextGoals);
        return {
          ...existing,
          day: index + 1,
          carbs: nextGoals.carbItems.map((goal) => {
            const old = existing.carbs?.find((item) => item.id === goal.id || item.name === goal.name);
            return { id: goal.id, name: goal.name, quantity: old?.quantity || 0 };
          }),
          habits: nextGoals.customHabits.reduce(
            (acc, habit) => ({ ...acc, [habit.id]: Boolean(existing.habits?.[habit.id]) }),
            {}
          ),
          trackers: (nextGoals.customTrackers || []).reduce(
            (acc, tracker) => ({ ...acc, [tracker.id]: Number(existing.trackers?.[tracker.id] || 0) }),
            {}
          ),
          photos: existing.photos || []
        };
      });
      return {
        ...current,
        goals: { ...nextGoals, programLength },
        checkIns: nextCheckIns,
        activeDay: Math.min(current.activeDay, programLength)
      };
    });
  }

  function updateCheckIn(day, updates) {
    setState((current) => ({
      ...current,
      activeDay: day,
      checkIns: current.checkIns.map((entry) => (entry.day === day ? { ...entry, ...updates } : entry))
    }));
  }

  function updateWorkoutAssistant(updater) {
    setState((current) => ({
      ...current,
      workoutAssistant:
        typeof updater === "function"
          ? updater(current.workoutAssistant || defaultWorkoutAssistant)
          : updater
    }));
  }

  if (auth.loading) return <LoadingScreen message="Checking your account..." />;
  if (!auth.configured) return <LoginScreen auth={auth} />;
  if (!auth.user) return <LoginScreen auth={auth} />;
  if (!loaded) return <LoadingScreen message={remoteStatus} error={remoteError} />;

  return (
    <main className="min-h-screen bg-cream pb-24 text-ink">
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button onClick={() => setActiveView("dashboard")} className="flex items-center gap-3 text-left">
            <span className="grid size-11 place-items-center rounded-full border-2 border-ink bg-paper">
              <Dumbbell size={22} strokeWidth={2.6} />
            </span>
            <span>
              <span className="athletic-title block text-lg leading-tight">Crunch Watcher</span>
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">Day {state.activeDay} of {state.goals.programLength}</span>
            </span>
          </button>
          <button
            className="grid size-10 place-items-center rounded-sm border-2 border-ink bg-cream"
            onClick={() => setState((current) => ({ ...current, darkMode: !current.darkMode }))}
            aria-label="Toggle dark mode"
          >
            {state.darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="outline-button hidden sm:block" onClick={auth.signOut}>Sign Out</button>
        </div>
      </header>

      {!state.goals.setupComplete ? (
        <SetupScreen goals={state.goals} onSave={(goals) => updateGoals({ ...goals, setupComplete: true })} />
      ) : (
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <Navigation activeView={activeView} setActiveView={setActiveView} />
          </aside>
          <section className="min-w-0">
            <AccountStatus
              status={remoteStatus}
              error={remoteError}
              localImportState={localImportState}
              onImport={async () => {
                try {
                  setRemoteStatus("Importing local data...");
                  await importLocalState(auth.user.id, localImportState);
                  const imported = await loadUserState(auth.user.id);
                  setState(normalizeSavedState(imported));
                  window.localStorage.setItem(`${STORAGE_KEY}-imported-${Date.now()}`, JSON.stringify(localImportState));
                  window.localStorage.removeItem(STORAGE_KEY);
                  setLocalImportState(null);
                  setRemoteStatus("Local data imported");
                } catch (error) {
                  setRemoteError(error.message);
                }
              }}
              onDismissImport={() => setLocalImportState(null)}
            />
            {!currentDay.completed && <ReminderBanner goals={state.goals} setState={setState} />}
            {activeView === "dashboard" && (
              <Dashboard
                goals={state.goals}
                checkIns={state.checkIns}
                activeDay={state.activeDay}
                setActiveDay={(day) => setState((current) => ({ ...current, activeDay: day }))}
                setActiveView={setActiveView}
                weeklyStats={weeklyStats}
                currentScore={currentScore}
              />
            )}
            {activeView === "today" && (
              <DailyCheckIn
                goals={state.goals}
                checkIn={currentDay}
                score={currentScore}
                onChange={(updates) => updateCheckIn(state.activeDay, updates)}
              />
            )}
            {activeView === "timeline" && (
              <Timeline
                goals={state.goals}
                checkIns={state.checkIns}
                activeDay={state.activeDay}
                onSelect={(day) => {
                  setState((current) => ({ ...current, activeDay: day }));
                  setActiveView("today");
                }}
              />
            )}
            {activeView === "report" && (
              <WeeklyReport checkIns={state.checkIns} goals={state.goals} week={week} earnedBadges={earnedBadges} />
            )}
            {activeView === "workout" && (
              <WorkoutAssistant
                workoutAssistant={state.workoutAssistant || defaultWorkoutAssistant}
                onChange={updateWorkoutAssistant}
              />
            )}
            {activeView === "rewards" && <Rewards earnedBadges={earnedBadges} />}
            {activeView === "settings" && <SettingsScreen goals={state.goals} onSave={updateGoals} />}
          </section>
        </div>
      )}

      {state.goals.setupComplete && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-cream/95 px-2 pb-2 pt-1 backdrop-blur lg:hidden">
          <Navigation activeView={activeView} setActiveView={setActiveView} compact />
        </div>
      )}
      <button className="fixed bottom-24 right-3 z-40 rounded-sm border-2 border-ink bg-cream px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] sm:hidden" onClick={auth.signOut}>
        Sign Out
      </button>
    </main>
  );
}

function LoginScreen({ auth }) {
  const [mode, setMode] = useState("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function validateCreateAccount() {
    if (!email.trim() || !password) return "Email and password are required.";
    if (password.length < 8) return "Password too short. Use at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }

  function validateLogin() {
    if (!email.trim() || !password) return "Email and password are required.";
    return "";
  }

  async function submitAuth() {
    const validationMessage = mode === "create" ? validateCreateAccount() : validateLogin();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      if (mode === "create") {
        const result = await auth.signUpWithEmail(email.trim(), password);
        if (result.ok && result.needsConfirmation) {
          setMessage("Account created. Check your email to confirm, then log in.");
        }
      } else {
        await auth.signInWithEmail(email.trim(), password);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto grid max-w-md gap-4">
        <div className="border-b-2 border-ink pb-4 text-center">
          <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full border-2 border-ink bg-paper">
            <Dumbbell size={30} />
          </div>
          <h1 className="athletic-title text-4xl">Crunch Watcher</h1>
          <p className="mt-2 text-sm font-bold text-muted">Sign in to sync your training log, check-ins, rewards, and reports.</p>
        </div>

        {!auth.configured && (
          <div className="card">
            <h2 className="athletic-title text-xl">Supabase setup required</h2>
            <p className="mt-2 text-sm font-bold text-muted">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, then restart the app.
            </p>
          </div>
        )}

        {auth.configured && (
          <div className="card grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={mode === "create" ? "touch-button" : "outline-button"}
                onClick={() => {
                  setMode("create");
                  setMessage("");
                }}
              >
                Create Account
              </button>
              <button
                className={mode === "login" ? "touch-button" : "outline-button"}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Log In
              </button>
            </div>

            <div className="border-t-2 border-line pt-3">
              <h2 className="athletic-title text-lg">{mode === "create" ? "Create Account" : "Log In"}</h2>
              <div className="mt-3 grid gap-2">
                <LabeledInput label="Email" type="email" value={email} onChange={setEmail} />
                <LabeledInput label="Password" type="password" value={password} onChange={setPassword} />
                {mode === "create" && (
                  <LabeledInput label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
                )}
                <button className="touch-button" onClick={submitAuth} disabled={submitting}>
                  {submitting ? "Working..." : mode === "create" ? "Create Account" : "Log In"}
                </button>
              </div>
            </div>
            {(auth.error || message) && <p className="text-sm font-bold text-muted">{auth.error || message}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function LoadingScreen({ message, error }) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-4 text-ink">
      <div className="card max-w-md text-center">
        <Dumbbell className="mx-auto mb-3" size={34} />
        <h1 className="athletic-title text-3xl">Crunch Watcher</h1>
        <p className="mt-2 text-sm font-bold text-muted">{message}</p>
        {error && <p className="mt-2 text-sm font-black text-ink">{error}</p>}
      </div>
    </main>
  );
}

function AccountStatus({ status, error, localImportState, onImport, onDismissImport }) {
  return (
    <div className="mb-4 grid gap-2">
      <div className="rounded-sm border-2 border-line bg-paper px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
        {status}
        {error && <span className="ml-2 text-ink">/ {error}</span>}
      </div>
      {localImportState && (
        <div className="rounded-sm border-2 border-ink bg-paper p-3">
          <h2 className="athletic-title text-lg">Import saved local data?</h2>
          <p className="mt-1 text-sm font-bold text-muted">
            Old local Crunch Watcher data was found on this device. Import it into this Supabase account?
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button className="touch-button" onClick={onImport}>Import Local Data</button>
            <button className="outline-button" onClick={onDismissImport}>Not Now</button>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSavedState(saved) {
  const goals = {
    ...saved.goals,
    water: {
      ...saved.goals.water,
      amount: saved.goals.water?.unit === "cups" && Number(saved.goals.water?.amount) === 8 ? 64 : saved.goals.water?.amount,
      unit: ["Oz", "Liters", "Gallons"].includes(saved.goals.water?.unit) ? saved.goals.water.unit : "Oz"
    },
    customTrackers: saved.goals.customTrackers || []
  };
  const programLength = Number(goals.programLength) || 30;
  const checkIns = Array.from({ length: programLength }, (_, index) => {
    const existing = saved.checkIns?.[index] || createEmptyCheckIn(index + 1, goals);
    return {
      ...existing,
      day: index + 1,
      carbs: goals.carbItems.map((goal) => {
        const old = existing.carbs?.find((item) => item.id === goal.id || item.name === goal.name);
        return { id: goal.id, name: goal.name, quantity: old?.quantity || 0 };
      }),
      habits: goals.customHabits.reduce(
        (acc, habit) => ({ ...acc, [habit.id]: Boolean(existing.habits?.[habit.id]) }),
        {}
      ),
      photos: existing.photos || [],
      trackers: (goals.customTrackers || []).reduce(
        (acc, tracker) => ({ ...acc, [tracker.id]: Number(existing.trackers?.[tracker.id] || 0) }),
        {}
      )
    };
  });

  return {
    ...saved,
    goals: { ...goals, programLength },
    checkIns,
    activeDay: Math.min(saved.activeDay || 1, programLength),
    workoutAssistant: normalizeWorkoutAssistant(saved.workoutAssistant)
  };
}

function normalizeWorkoutAssistant(workoutAssistant) {
  return {
    ...defaultWorkoutAssistant,
    ...(workoutAssistant || {}),
    goals: {
      ...defaultWorkoutAssistant.goals,
      ...(workoutAssistant?.goals || {})
    },
    workouts: workoutAssistant?.workouts || [],
    templates: workoutAssistant?.templates?.length ? workoutAssistant.templates : defaultWorkoutAssistant.templates
  };
}

function Navigation({ activeView, setActiveView, compact = false }) {
  return (
    <nav className={compact ? "grid grid-cols-7 gap-1" : "card grid gap-1"}>
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveView(id)}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-sm px-2 text-[10px] font-black uppercase tracking-[0.08em] transition lg:justify-start lg:px-3 lg:text-xs ${
            activeView === id
              ? "bg-ink text-cream"
              : "text-muted hover:bg-ink/5"
          }`}
        >
          <Icon size={18} />
          <span className={compact ? "sr-only" : ""}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function SetupScreen({ goals, onSave }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-5 border-b-2 border-ink pb-4 text-center">
        <p className="section-label">Setup / Est 2022</p>
        <h1 className="athletic-title mt-2 text-3xl leading-tight sm:text-5xl">Build your Daily accountability plan</h1>
      </div>
      <GoalEditor goals={goals} onSave={onSave} saveLabel="Start tracking" />
    </div>
  );
}

function SettingsScreen({ goals, onSave }) {
  return (
    <div className="grid gap-4">
      <ScreenTitle title="Build your Daily accountability plan" subtitle="Tune the goals without losing past check-ins." />
      <GoalEditor goals={goals} onSave={onSave} saveLabel="Save goals" />
    </div>
  );
}

function GoalEditor({ goals, onSave, saveLabel }) {
  const [draft, setDraft] = useState(() => ({
    ...goals,
    water: {
      ...goals.water,
      unit: ["Oz", "Liters", "Gallons"].includes(goals.water.unit) ? goals.water.unit : "Oz"
    },
    customTrackers: goals.customTrackers || []
  }));

  function update(path, value) {
    setDraft((current) => {
      const next = structuredClone(current);
      let target = next;
      path.slice(0, -1).forEach((key) => {
        target = target[key];
      });
      target[path[path.length - 1]] = value;
      return next;
    });
  }

  function addCarb() {
    const name = "New item";
    update(["carbItems"], [...draft.carbItems, { id: crypto.randomUUID(), name, dailyMax: 1 }]);
  }

  function addHabit() {
    update(["customHabits"], [...draft.customHabits, { id: crypto.randomUUID(), name: "New habit" }]);
  }

  function addTracker() {
    update(["customTrackers"], [...(draft.customTrackers || []), { id: crypto.randomUUID(), name: "New tracker", dailyGoal: 1 }]);
  }

  return (
    <div className="grid gap-4">
      <div className="card grid gap-3 sm:grid-cols-2">
        <LabeledInput label="Days" type="number" value={draft.programLength} onChange={(value) => update(["programLength"], Number(value))} />
        <LabeledInput label="Daily water goal" type="number" value={draft.water.amount} onChange={(value) => update(["water", "amount"], Number(value))} />
        <label className="grid gap-1 text-sm font-bold">
          Water unit
          <select className="field" value={draft.water.unit} onChange={(event) => update(["water", "unit"], event.target.value)}>
            <option>Oz</option>
            <option>Liters</option>
            <option>Gallons</option>
          </select>
        </label>
        <LabeledInput label="Workouts per week" type="number" value={draft.exercise.workoutsPerWeek} onChange={(value) => update(["exercise", "workoutsPerWeek"], Number(value))} />
        <LabeledInput label="Daily movement goal" value={draft.exercise.dailyMovement} onChange={(value) => update(["exercise", "dailyMovement"], value)} />
        <LabeledInput label="Duration goal minutes" type="number" value={draft.exercise.durationGoal} onChange={(value) => update(["exercise", "durationGoal"], Number(value))} />
        <Toggle label="Track alcohol" checked={draft.trackAlcohol} onChange={(value) => update(["trackAlcohol"], value)} />
        <Toggle label="Track sugars/sweets" checked={draft.trackSweets} onChange={(value) => update(["trackSweets"], value)} />
      </div>

      <div className="card grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="athletic-title text-lg">Carb-heavy goals</h2>
          <button className="touch-button" onClick={addCarb}>Add</button>
        </div>
        {draft.carbItems.map((item, index) => (
          <div className="grid grid-cols-[1fr_92px_44px] gap-2" key={item.id}>
            <input className="field" value={item.name} onChange={(event) => {
              const items = [...draft.carbItems];
              items[index] = { ...item, name: event.target.value };
              update(["carbItems"], items);
            }} />
            <input className="field" type="number" min="0" value={item.dailyMax} onChange={(event) => {
              const items = [...draft.carbItems];
              items[index] = { ...item, dailyMax: Number(event.target.value) };
              update(["carbItems"], items);
            }} />
            <button className="rounded-sm border-2 border-ink bg-cream font-black" onClick={() => update(["carbItems"], draft.carbItems.filter((_, itemIndex) => itemIndex !== index))}>x</button>
          </div>
        ))}
      </div>

      <div className="card grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="athletic-title text-lg">Bonus habits</h2>
          <button className="touch-button" onClick={addHabit}>Add</button>
        </div>
        {draft.customHabits.map((habit, index) => (
          <div className="grid grid-cols-[1fr_44px] gap-2" key={habit.id}>
            <input className="field" value={habit.name} onChange={(event) => {
              const habits = [...draft.customHabits];
              habits[index] = { ...habit, name: event.target.value };
              update(["customHabits"], habits);
            }} />
            <button className="rounded-sm border-2 border-ink bg-cream font-black" onClick={() => update(["customHabits"], draft.customHabits.filter((_, habitIndex) => habitIndex !== index))}>x</button>
          </div>
        ))}
      </div>

      <div className="card grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="athletic-title text-lg">Other things to track</h2>
          <button className="touch-button" onClick={addTracker}>Add</button>
        </div>
        {(draft.customTrackers || []).map((tracker, index) => (
          <div className="grid grid-cols-[1fr_92px_44px] gap-2" key={tracker.id}>
            <input className="field" value={tracker.name} onChange={(event) => {
              const trackers = [...(draft.customTrackers || [])];
              trackers[index] = { ...tracker, name: event.target.value };
              update(["customTrackers"], trackers);
            }} />
            <input className="field" type="number" min="0" value={tracker.dailyGoal} onChange={(event) => {
              const trackers = [...(draft.customTrackers || [])];
              trackers[index] = { ...tracker, dailyGoal: Number(event.target.value) };
              update(["customTrackers"], trackers);
            }} />
            <button className="rounded-sm border-2 border-ink bg-cream font-black" onClick={() => update(["customTrackers"], (draft.customTrackers || []).filter((_, trackerIndex) => trackerIndex !== index))}>x</button>
          </div>
        ))}
      </div>

      <button className="touch-button w-full" onClick={() => onSave(draft)}>{saveLabel}</button>
    </div>
  );
}

function Dashboard({ goals, checkIns, activeDay, setActiveDay, setActiveView, weeklyStats, currentScore }) {
  const today = checkIns[activeDay - 1];
  const remainingCarbs = goals.carbItems.map((goal) => {
    const used = Number(today.carbs.find((item) => item.id === goal.id)?.quantity || 0);
    return `${goal.name}: ${Math.max(goal.dailyMax - used, 0)} left`;
  });
  const message = currentScore >= 85 ? "Strong pace. Keep stacking clean days." : currentScore >= 70 ? "Solid day. One small upgrade gets you green." : "Start with water and movement today.";

  return (
    <div className="grid gap-4">
      <ScreenTitle title="Today’s Check-In" subtitle={message} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Day ${activeDay} of ${goals.programLength}`} value={today.completed ? `${currentScore}/100` : "Open"} hint={today.completed ? "Checked in" : "Check-in open"} />
        <StatCard label="Current streak" value={`${weeklyStats.streak} days`} hint="70+ score days" />
        <StatCard label="Weekly average" value={weeklyStats.completedDays ? `${weeklyStats.average}/100` : "No score"} hint={`Week ${getWeekNumber(activeDay)} / ${weeklyStats.completedDays} logged`} />
        <StatCard label="Workouts" value={`${weeklyStats.totalWorkouts}/${goals.exercise.workoutsPerWeek}`} hint="This week" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card grid gap-4">
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink pb-3">
            <h2 className="athletic-title text-xl">Training Log</h2>
            <button className="touch-button" onClick={() => setActiveView("today")}>Check in</button>
          </div>
          <Progress label="Water" value={today.waterConsumed} max={goals.water.amount} suffix={goals.water.unit} />
          <Progress label="Exercise minutes" value={today.exercise.duration} max={goals.exercise.durationGoal || 30} suffix="min" />
          <div>
            <p className="section-label mb-2">Remaining carb allowance</p>
            <div className="flex flex-wrap gap-2">
              {remainingCarbs.map((item) => <span key={item} className="rounded-sm border-2 border-ink bg-cream px-3 py-2 text-xs font-black uppercase tracking-[0.08em]">{item}</span>)}
            </div>
          </div>
        </div>
        <DayPicker checkIns={checkIns} activeDay={activeDay} programLength={goals.programLength} setActiveDay={setActiveDay} />
      </div>
    </div>
  );
}

function DailyCheckIn({ goals, checkIn, score, onChange }) {
  function setExercise(patch) {
    onChange({ exercise: { ...checkIn.exercise, ...patch } });
  }

  async function addPhotos(files) {
    const selected = Array.from(files || []).slice(0, 4);
    const photos = await Promise.all(
      selected.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, dataUrl: reader.result });
            reader.readAsDataURL(file);
          })
      )
    );
    onChange({ photos: [...(checkIn.photos || []), ...photos] });
  }

  return (
    <div className="grid gap-4">
      <ScreenTitle title={`Day ${checkIn.day} of ${goals.programLength} Training Log`} subtitle="Enter what happened. The score updates instantly." />
      <div className="card grid gap-4">
        <div className={`grid aspect-square w-32 place-items-center rounded-full border-4 border-ink ${scoreColor(score)}`}>
          <div className="text-center">
            <p className="athletic-title text-4xl">{score}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">out of 100</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.trackAlcohol && <Toggle label="No Alcohol Consumed" checked={!checkIn.alcoholConsumed} onChange={(value) => onChange({ alcoholConsumed: !value })} />}
          {goals.trackSweets && <Toggle label="No Artificial Sugars/Sweets Consumed" checked={!checkIn.sweetsConsumed} onChange={(value) => onChange({ sweetsConsumed: !value })} />}
          <LabeledInput label={`Water consumed (${goals.water.unit})`} type="number" value={checkIn.waterConsumed} onChange={(value) => onChange({ waterConsumed: Number(value) })} />
          <label className="grid gap-1 text-sm font-bold">
            Mood / energy
            <input className="accent-ink" type="range" min="1" max="5" value={checkIn.mood} onChange={(event) => onChange({ mood: Number(event.target.value) })} />
            <span className="text-sm font-bold text-muted">{checkIn.mood}/5</span>
          </label>
        </div>
      </div>

      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Carb-heavy items</h2>
        {goals.carbItems.map((goal) => {
          const carb = checkIn.carbs.find((item) => item.id === goal.id) || { quantity: 0 };
          return (
            <ProgressInput
              key={goal.id}
              label={goal.name}
              value={carb.quantity}
              max={goal.dailyMax}
              onChange={(value) => onChange({
                carbs: checkIn.carbs.map((item) => item.id === goal.id ? { ...item, quantity: Number(value) } : item)
              })}
            />
          );
        })}
      </div>

      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Exercise</h2>
        <Toggle label="Workout completed" checked={checkIn.exercise.completed} onChange={(value) => setExercise({ completed: value })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <LabeledInput label="Workout type" value={checkIn.exercise.type} onChange={(value) => setExercise({ type: value })} />
          <LabeledInput label="Duration minutes" type="number" value={checkIn.exercise.duration} onChange={(value) => setExercise({ duration: Number(value) })} />
          <label className="grid gap-1 text-sm font-bold">
            Intensity
            <select className="field" value={checkIn.exercise.intensity} onChange={(event) => setExercise({ intensity: event.target.value })}>
              <option>light</option>
              <option>moderate</option>
              <option>hard</option>
            </select>
          </label>
        </div>
      </div>

      {!!goals.customHabits.length && (
        <div className="card grid gap-3">
          <h2 className="athletic-title text-lg">Bonus habits</h2>
          {goals.customHabits.map((habit) => (
            <Toggle
              key={habit.id}
              label={habit.name}
              checked={Boolean(checkIn.habits?.[habit.id])}
              onChange={(value) => onChange({ habits: { ...checkIn.habits, [habit.id]: value } })}
            />
          ))}
        </div>
      )}

      {!!(goals.customTrackers || []).length && (
        <div className="card grid gap-3">
          <h2 className="athletic-title text-lg">Other trackers</h2>
          {(goals.customTrackers || []).map((tracker) => (
            <ProgressInput
              key={tracker.id}
              label={tracker.name}
              value={checkIn.trackers?.[tracker.id] || 0}
              max={tracker.dailyGoal || 1}
              onChange={(value) => onChange({ trackers: { ...(checkIn.trackers || {}), [tracker.id]: Number(value) } })}
            />
          ))}
        </div>
      )}

      <div className="card grid gap-3">
        <div className="grid gap-3">
          <h2 className="athletic-title text-lg">Progress photos</h2>
          <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-sm border-2 border-dashed border-ink bg-cream px-4 text-sm font-black uppercase tracking-[0.1em]">
            <Upload size={18} />
            Upload pictures
            <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files)} />
          </label>
          {!!checkIn.photos?.length && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {checkIn.photos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden rounded-sm border-2 border-ink bg-cream">
                  <img src={photo.dataUrl} alt={photo.name || "Daily check-in upload"} className="aspect-square w-full object-cover" />
                  <button
                    className="absolute right-1 top-1 rounded-sm bg-ink px-2 py-1 text-xs font-black text-cream opacity-90"
                    onClick={() => onChange({ photos: checkIn.photos.filter((item) => item.id !== photo.id) })}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="grid gap-1 text-sm font-bold">
          Notes
          <textarea className="field min-h-28 py-3" value={checkIn.notes} onChange={(event) => onChange({ notes: event.target.value })} />
        </label>
        <button className="touch-button" onClick={() => onChange({ completed: true, date: new Date().toISOString() })}>Save day</button>
      </div>
    </div>
  );
}

function Timeline({ goals, checkIns, activeDay, onSelect }) {
  return (
    <div className="grid gap-4">
      <ScreenTitle title="Training Log" subtitle="A minimalist 30-day record of completed and missed sessions." />
      <div className="card grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-10">
        {checkIns.map((entry) => {
          const score = scoreDay(entry, goals, checkIns.slice(0, entry.day - 1)).total;
          return (
            <button
              key={entry.day}
              onClick={() => onSelect(entry.day)}
              className={`aspect-square rounded-sm border-2 text-sm font-black ${entry.completed ? scoreColor(score) : "border-line bg-cream text-muted"} ${activeDay === entry.day ? "ring-2 ring-ink ring-offset-2 ring-offset-cream" : ""}`}
            >
              {entry.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyReport({ checkIns, goals, week, earnedBadges }) {
  const stats = getWeeklyStats(checkIns, goals, week);
  const report = buildWeeklyReport(checkIns, goals, week, earnedBadges);
  const [copied, setCopied] = useState(false);
  const reportPhotos = stats.entries.flatMap(({ entry }) =>
    (entry.photos || []).map((photo) => ({ ...photo, day: entry.day }))
  );

  async function copyReport() {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function shareReport() {
    if (navigator.share) {
      await navigator.share({ title: `Crunch Watcher Week ${week}`, text: report });
      return;
    }
    await copyReport();
  }

  return (
    <div className="grid gap-4">
      <ScreenTitle title="Crunch Watcher Weekly Report" subtitle={`Week ${week} printable scorecard.`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average" value={`${stats.average}/100`} hint="Completed days only" />
        <StatCard label="Alcohol-free" value={`${stats.alcoholFreeDays}/${stats.completedDays || 7}`} hint="This week" />
        <StatCard label="Sugar-free" value={`${stats.sugarFreeDays}/${stats.completedDays || 7}`} hint="This week" />
        <StatCard label="Minutes" value={stats.totalExerciseMinutes} hint={`${stats.totalWorkouts} workouts`} />
      </div>
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Daily scores</h2>
        {stats.entries.map(({ entry, score }) => (
          <Progress key={entry.day} label={`Day ${entry.day}`} value={entry.completed ? score : 0} max={100} suffix={entry.completed ? "score" : "missed"} />
        ))}
      </div>
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Copy-ready report</h2>
        <pre className="whitespace-pre-wrap rounded-sm border-2 border-line bg-cream p-3 text-sm font-bold leading-6">{report}</pre>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="touch-button" onClick={copyReport}>{copied ? "Copied" : "Copy Report"}</button>
          <button className="outline-button" onClick={shareReport}>Share Report</button>
        </div>
      </div>
      {!!reportPhotos.length && (
        <div className="card grid gap-3">
          <h2 className="athletic-title text-lg">Report photos</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {reportPhotos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-sm border-2 border-ink bg-cream">
                <img src={photo.dataUrl} alt={photo.name || `Day ${photo.day} upload`} className="aspect-square w-full object-cover" />
                <figcaption className="px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-muted">Day {photo.day}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Rewards earned this week</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(earnedBadges).filter(([, earned]) => earned).length ? (
            Object.entries(earnedBadges)
              .filter(([, earned]) => earned)
              .map(([key]) => <span key={key} className="rounded-full border-2 border-ink bg-cream px-3 py-2 text-xs font-black uppercase tracking-[0.1em]">{badgeLabels[key]}</span>)
          ) : (
            <span className="text-sm font-bold text-muted">No badges earned yet.</span>
          )}
        </div>
      </div>
      <div className="rounded-sm border-4 border-ink bg-paper p-5 text-ink shadow-soft">
        <p className="section-label">Download / Share Image</p>
        <h2 className="athletic-title mt-2 text-4xl">Week {week}: {stats.average}/100</h2>
        <p className="mt-3 border-t-2 border-ink pt-3 text-sm font-black uppercase tracking-[0.12em]">{stats.totalWorkouts} workouts / {stats.waterHits} water hits / {stats.streak} day streak</p>
      </div>
    </div>
  );
}

function WorkoutAssistant({ workoutAssistant, onChange }) {
  const [tab, setTab] = useState("today");
  const stats = useMemo(() => getWorkoutStats(workoutAssistant.workouts), [workoutAssistant.workouts]);
  const recovery = useMemo(() => getRecovery(workoutAssistant.workouts), [workoutAssistant.workouts]);
  const recommendation = useMemo(() => recommendWorkout(workoutAssistant), [workoutAssistant]);
  const tabs = ["today", "history", "templates", "progress", "recovery"];

  function saveWorkout(workout) {
    onChange((current) => ({
      ...current,
      workouts: [{ ...workout, id: workout.id || crypto.randomUUID(), date: workout.date || new Date().toISOString() }, ...current.workouts]
    }));
  }

  function saveTemplate(template) {
    onChange((current) => ({
      ...current,
      templates: current.templates.some((item) => item.id === template.id)
        ? current.templates.map((item) => (item.id === template.id ? template : item))
        : [{ ...template, id: template.id || crypto.randomUUID() }, ...current.templates]
    }));
  }

  return (
    <div className="grid gap-4">
      <ScreenTitle title="Workout Assistant" subtitle="Smart training recommendations, logging, recovery, and progress." />
      <div className="card grid grid-cols-5 gap-1">
        {tabs.map((item) => (
          <button
            key={item}
            className={`min-h-11 rounded-sm px-2 text-[10px] font-black uppercase tracking-[0.08em] ${tab === item ? "bg-ink text-cream" : "bg-cream text-muted"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "today" && (
        <WorkoutToday
          workoutAssistant={workoutAssistant}
          recommendation={recommendation}
          recovery={recovery}
          stats={stats}
          onChange={onChange}
          onSaveWorkout={saveWorkout}
        />
      )}
      {tab === "history" && <WorkoutHistory workouts={workoutAssistant.workouts} stats={stats} />}
      {tab === "templates" && (
        <WorkoutTemplates
          templates={workoutAssistant.templates}
          onSaveTemplate={saveTemplate}
          onUseTemplate={(template) => {
            saveWorkout(createWorkout({
              name: template.name,
              type: template.type,
              duration: template.duration,
              intensity: template.intensity,
              exercises: template.exercises.map((exercise) => ({ ...exercise, id: crypto.randomUUID() })),
              notes: "Repeated from template."
            }));
            setTab("history");
          }}
        />
      )}
      {tab === "progress" && <WorkoutProgress stats={stats} workouts={workoutAssistant.workouts} />}
      {tab === "recovery" && <WorkoutRecovery recovery={recovery} recommendation={recommendation} />}
    </div>
  );
}

function WorkoutToday({ workoutAssistant, recommendation, recovery, stats, onChange, onSaveWorkout }) {
  const [draft, setDraft] = useState(() => createWorkout({
    name: recommendation.title,
    type: recommendation.type,
    intensity: recommendation.intensity,
    energy: workoutAssistant.goals.energyLevel
  }));
  const [exerciseName, setExerciseName] = useState("");
  const suggestedWeight = exerciseName ? getSuggestedWeight(workoutAssistant.workouts, exerciseName) : "";

  function updateDraft(path, value) {
    setDraft((current) => {
      const next = structuredClone(current);
      let target = next;
      path.slice(0, -1).forEach((key) => {
        target = target[key];
      });
      target[path[path.length - 1]] = value;
      return next;
    });
  }

  function updateGoal(key, value) {
    onChange((current) => ({ ...current, goals: { ...current.goals, [key]: value } }));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card grid gap-3">
          <p className="section-label">Recommended today</p>
          <h2 className="athletic-title text-4xl">{recommendation.title}</h2>
          <p className="text-sm font-bold text-muted">{recommendation.reason}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard label="Intensity" value={recommendation.intensity} hint="Suggested" />
            <StatCard label="Weekly count" value={`${stats.weeklyCount}/${workoutAssistant.goals.weeklyFrequency}`} hint="Logged" />
            <StatCard label="Last workout" value={stats.lastWorkout?.type || "None"} hint={stats.lastWorkout ? new Date(stats.lastWorkout.date).toLocaleDateString() : "Start today"} />
          </div>
          <div className="rounded-sm border-2 border-ink bg-cream p-3">
            <p className="section-label">Suggested focus</p>
            <p className="mt-1 text-lg font-black">{recommendation.focus}</p>
          </div>
        </div>
        <div className="card grid gap-3">
          <h2 className="athletic-title text-lg">Training Goals</h2>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Primary goal
            <select className="field" value={workoutAssistant.goals.primaryGoal} onChange={(event) => updateGoal("primaryGoal", event.target.value)}>
              {["Build muscle", "Lose fat", "Improve endurance", "Improve strength", "General health"].map((goal) => <option key={goal}>{goal}</option>)}
            </select>
          </label>
          <LabeledInput label="Workout frequency" type="number" value={workoutAssistant.goals.weeklyFrequency} onChange={(value) => updateGoal("weeklyFrequency", Number(value))} />
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Energy today
            <input className="accent-ink" type="range" min="1" max="5" value={workoutAssistant.goals.energyLevel} onChange={(event) => updateGoal("energyLevel", Number(event.target.value))} />
            <span className="text-sm font-bold text-muted">{workoutAssistant.goals.energyLevel}/5</span>
          </label>
        </div>
      </div>

      <div className="card grid gap-3">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink pb-3">
          <h2 className="athletic-title text-xl">Log Workout</h2>
          <button className="outline-button" onClick={() => setDraft(createWorkout({ ...draft, name: stats.lastWorkout?.name || recommendation.title, type: stats.lastWorkout?.type || recommendation.type, exercises: stats.lastWorkout?.exercises?.map((exercise) => ({ ...exercise, id: crypto.randomUUID() })) || [createExercise()] }))}>Repeat Last</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <LabeledInput label="Workout name" value={draft.name} onChange={(value) => updateDraft(["name"], value)} />
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Workout type
            <select className="field" value={draft.type} onChange={(event) => updateDraft(["type"], event.target.value)}>
              {workoutTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <LabeledInput label="Duration" type="number" value={draft.duration} onChange={(value) => updateDraft(["duration"], Number(value))} />
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Intensity
            <select className="field" value={draft.intensity} onChange={(event) => updateDraft(["intensity"], event.target.value)}>
              <option>light</option>
              <option>moderate</option>
              <option>hard</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <LabeledInput label="Exercise name" value={exerciseName} onChange={setExerciseName} />
            <button
              className="touch-button"
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  exercises: [...current.exercises, createExercise({ name: exerciseName, weight: suggestedWeight })]
                }));
                setExerciseName("");
              }}
            >
              Add Exercise
            </button>
          </div>
          {suggestedWeight && <p className="text-sm font-bold text-muted">Progressive overload suggestion: try {suggestedWeight} lb.</p>}
          {draft.exercises.map((exercise, index) => (
            <ExerciseEditor
              key={exercise.id}
              exercise={exercise}
              onChange={(nextExercise) => setDraft((current) => ({
                ...current,
                exercises: current.exercises.map((item) => (item.id === exercise.id ? nextExercise : item))
              }))}
              onRemove={() => setDraft((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }))}
            />
          ))}
        </div>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
          Performance notes
          <textarea className="field min-h-24 py-3" value={draft.performanceNote} onChange={(event) => updateDraft(["performanceNote"], event.target.value)} placeholder="Felt strong, low energy, bad sleep, knee pain..." />
        </label>
        <button className="touch-button" onClick={() => onSaveWorkout(draft)}>Save Workout</button>
      </div>

      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Recovery Status</h2>
        {recovery.map((item) => <Progress key={item.muscle} label={`${item.muscle} - ${item.status}`} value={item.percent} max={100} suffix="%" />)}
      </div>
    </div>
  );
}

function ExerciseEditor({ exercise, onChange, onRemove }) {
  function setField(key, value) {
    onChange({ ...exercise, [key]: value });
  }

  return (
    <div className="rounded-sm border-2 border-line bg-cream p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <input className="field" value={exercise.name} placeholder="Exercise" onChange={(event) => setField("name", event.target.value)} />
        <button className="outline-button" onClick={onRemove}>Remove</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <LabeledInput label="Sets" type="number" value={exercise.sets} onChange={(value) => setField("sets", value)} />
        <LabeledInput label="Reps" type="number" value={exercise.reps} onChange={(value) => setField("reps", value)} />
        <LabeledInput label="Weight" type="number" value={exercise.weight} onChange={(value) => setField("weight", value)} />
        <LabeledInput label="RPE" type="number" value={exercise.rpe} onChange={(value) => setField("rpe", value)} />
        <LabeledInput label="Distance" type="number" value={exercise.distance} onChange={(value) => setField("distance", value)} />
        <LabeledInput label="Pace" value={exercise.pace} onChange={(value) => setField("pace", value)} />
        <LabeledInput label="Time" value={exercise.time} onChange={(value) => setField("time", value)} />
        <LabeledInput label="Heart rate" type="number" value={exercise.heartRate} onChange={(value) => setField("heartRate", value)} />
      </div>
      <textarea className="field mt-2 min-h-16 py-3" value={exercise.notes} placeholder="Exercise notes" onChange={(event) => setField("notes", event.target.value)} />
    </div>
  );
}

function WorkoutHistory({ workouts, stats }) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [query, setQuery] = useState("");
  const filtered = stats.sorted.filter((workout) => {
    const typeMatch = typeFilter === "All" || workout.type === typeFilter;
    const textMatch = !query || `${workout.name} ${workout.type} ${workout.notes} ${workout.performanceNote}`.toLowerCase().includes(query.toLowerCase());
    return typeMatch && textMatch;
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="This week" value={stats.weeklyCount} hint="Workouts" />
        <StatCard label="Weekly volume" value={stats.totalMinutes} hint="Minutes" />
        <StatCard label="Mileage" value={stats.weeklyMileage.toFixed(1)} hint="Miles" />
        <StatCard label="Streak" value={stats.streak} hint="Days" />
      </div>
      <div className="card grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Filter by type
            <select className="field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {["All", ...workoutTypes].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <LabeledInput label="Filter by muscle/date/text" value={query} onChange={setQuery} />
        </div>
        {filtered.length ? filtered.map((workout) => <WorkoutSummary key={workout.id} workout={workout} />) : <p className="text-sm font-bold text-muted">No workouts match this filter.</p>}
      </div>
    </div>
  );
}

function WorkoutSummary({ workout }) {
  const totalDistance = (workout.exercises || []).reduce((sum, exercise) => sum + Number(exercise.distance || 0), 0);
  const bestLift = (workout.exercises || []).filter((exercise) => Number(exercise.weight)).sort((a, b) => Number(b.weight) - Number(a.weight))[0];

  return (
    <article className="rounded-sm border-2 border-line bg-cream p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">{new Date(workout.date).toLocaleDateString()} / {workout.type}</p>
          <h3 className="athletic-title text-xl">{workout.name || workout.type}</h3>
        </div>
        <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-black uppercase tracking-[0.1em]">{workout.intensity}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-muted">{workout.duration} min / {workout.exercises?.length || 0} exercises{totalDistance ? ` / ${totalDistance} mi` : ""}{bestLift ? ` / Best lift ${bestLift.name} ${bestLift.weight} lb` : ""}</p>
      {workout.performanceNote && <p className="mt-2 border-t-2 border-line pt-2 text-sm font-bold">{workout.performanceNote}</p>}
    </article>
  );
}

function WorkoutTemplates({ templates, onSaveTemplate, onUseTemplate }) {
  const [draft, setDraft] = useState(() => ({ ...templates[0], id: "" }));

  function duplicate(template) {
    setDraft({ ...template, id: "", name: `${template.name} Copy`, exercises: template.exercises.map((exercise) => ({ ...exercise, id: crypto.randomUUID() })) });
  }

  return (
    <div className="grid gap-4">
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Save Template</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <LabeledInput label="Template name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
            Type
            <select className="field" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>
              {workoutTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <LabeledInput label="Duration" type="number" value={draft.duration} onChange={(value) => setDraft((current) => ({ ...current, duration: Number(value) }))} />
        </div>
        <button className="touch-button" onClick={() => onSaveTemplate(draft)}>Save Template</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <div className="card grid gap-3" key={template.id}>
            <p className="section-label">{template.type} / {template.duration} min</p>
            <h2 className="athletic-title text-2xl">{template.name}</h2>
            <p className="text-sm font-bold text-muted">{template.exercises.length} exercises saved</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <button className="touch-button" onClick={() => onUseTemplate(template)}>Use</button>
              <button className="outline-button" onClick={() => setDraft(template)}>Edit</button>
              <button className="outline-button" onClick={() => duplicate(template)}>Duplicate</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutProgress({ stats, workouts }) {
  const lastSix = [...stats.sorted].reverse().slice(-6);
  const maxMinutes = Math.max(30, ...lastSix.map((workout) => Number(workout.duration || 0)));

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Workout streak" value={stats.streak} hint="Days" />
        <StatCard label="Longest run" value={stats.longestRun || 0} hint="Miles" />
        <StatCard label="Fastest pace" value={stats.fastestPace} hint="Per mile" />
        <StatCard label="Avg pace" value={stats.averagePace} hint="Running" />
      </div>
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Training Trend</h2>
        <div className="flex h-36 items-end gap-2 border-b-2 border-ink">
          {lastSix.map((workout) => (
            <div key={workout.id} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full border-2 border-ink bg-ink" style={{ height: `${Math.max(8, (Number(workout.duration || 0) / maxMinutes) * 120)}px` }} />
              <span className="text-[10px] font-black uppercase tracking-[0.08em]">{workout.type.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card grid gap-3">
        <h2 className="athletic-title text-lg">Personal Records</h2>
        {stats.personalRecords.length ? stats.personalRecords.map((record) => (
          <div key={record.label} className="flex items-center justify-between border-b-2 border-line py-2">
            <span className="font-black">{record.label}</span>
            <span className="athletic-title text-xl">{record.value} {record.unit}</span>
          </div>
        )) : <p className="text-sm font-bold text-muted">Log lifts or runs to unlock PRs.</p>}
      </div>
    </div>
  );
}

function WorkoutRecovery({ recovery, recommendation }) {
  return (
    <div className="grid gap-4">
      <div className="card">
        <p className="section-label">Smart recovery suggestion</p>
        <h2 className="athletic-title mt-1 text-3xl">{recommendation.title}</h2>
        <p className="mt-2 text-sm font-bold text-muted">{recommendation.reason}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {recovery.map((item) => (
          <div className="card grid gap-3" key={item.muscle}>
            <div className="flex items-center justify-between">
              <h2 className="athletic-title text-xl">{item.muscle}</h2>
              <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-black uppercase tracking-[0.1em]">{item.status}</span>
            </div>
            <Progress label={`${item.percent}% recovered`} value={item.percent} max={100} suffix="%" />
            <p className="text-sm font-bold text-muted">{item.daysSince} days since directly trained.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rewards({ earnedBadges }) {
  const descriptions = {
    streak3: "Score 70+ for 3 consecutive completed days.",
    streak7: "Score 70+ for 7 consecutive completed days.",
    waterWeek: "Hit water every day in a completed week.",
    alcoholWeek: "Avoid alcohol for a full completed week.",
    sugarWeek: "Avoid sugars/sweets for a full completed week.",
    workoutWarrior: "Complete 5 workouts in a week.",
    tenWorkouts: "Complete 10 workouts total.",
    weekly90: "Average 90+ in any week.",
    complete30: "Complete every day in the program."
  };
  const earnedLabels = Object.entries(earnedBadges)
    .filter(([, earned]) => earned)
    .map(([key]) => badgeLabels[key]);

  async function shareRewards() {
    const text = `Crunch Watcher Rewards:\n${earnedLabels.length ? earnedLabels.map((label) => `- ${label}`).join("\n") : "No badges earned yet."}`;
    if (navigator.share) {
      await navigator.share({ title: "Crunch Watcher Rewards", text });
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ScreenTitle title="Rewards" subtitle="Earned badges light up as your streaks build." />
        <button className="touch-button" onClick={shareRewards}>Share Rewards</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(badgeLabels).map(([key, label]) => (
          <div key={key} className={`card ${earnedBadges[key] ? "bg-paper" : "bg-cream opacity-55"}`}>
            <div className="flex items-start gap-3">
              <span className={`grid size-14 shrink-0 place-items-center rounded-full border-2 border-ink ${earnedBadges[key] ? "bg-ink text-cream" : "bg-cream text-ink"}`}>
                <Medal size={21} />
              </span>
              <div>
                <h2 className="athletic-title text-base">{label}</h2>
                <p className="mt-1 text-sm font-bold text-muted">{descriptions[key]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReminderBanner({ goals, setState }) {
  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setState((current) => ({
      ...current,
      goals: { ...current.goals, notificationsEnabled: permission === "granted" }
    }));
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-sm border-2 border-ink bg-paper p-3 text-sm">
      <div className="flex items-center gap-2">
        <Bell size={18} />
        <span className="font-black uppercase tracking-[0.08em]">Today’s check-in is still open. Reminder set for {goals.reminderTime}.</span>
      </div>
      <button className="touch-button" onClick={enableNotifications}>Notify</button>
    </div>
  );
}

function DayPicker({ checkIns, activeDay, programLength, setActiveDay }) {
  return (
    <div className="card">
      <h2 className="athletic-title mb-3 text-lg">Jump to day / {programLength}</h2>
      <div className="grid grid-cols-6 gap-2">
        {checkIns.map((entry) => (
          <button
            key={entry.day}
            className={`aspect-square rounded-sm border-2 text-sm font-black ${activeDay === entry.day ? "border-ink bg-ink text-cream" : "border-line bg-cream text-ink"}`}
            onClick={() => setActiveDay(entry.day)}
          >
            {entry.day}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScreenTitle({ title, subtitle }) {
  return (
    <div className="border-b-2 border-ink pb-3">
      <p className="section-label">Crunch Watcher / Est 2022</p>
      <h1 className="athletic-title mt-1 text-2xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-1 text-sm font-bold text-muted">{subtitle}</p>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="section-label">{label}</p>
      <p className="athletic-title mt-2 text-4xl">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-muted">{hint}</p>
    </div>
  );
}

function Progress({ label, value, max, suffix }) {
  const percent = Math.min(100, Math.round((Number(value || 0) / Math.max(Number(max || 1), 1)) * 100));
  return (
    <div>
      <div className="mb-2 flex justify-between gap-3 text-sm font-bold">
        <span>{label}</span>
        <span className="text-muted">{value}/{max} {suffix}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-cream">
        <div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ProgressInput({ label, value, max, onChange }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold">{label}</label>
        <span className="text-sm font-bold text-muted">Max {max}</span>
      </div>
      <input className="field" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} />
      <Progress label="Allowance" value={Math.max(max - value, 0)} max={max || 1} suffix="left" />
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em]">
      {label}
      <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className={`flex min-h-12 items-center justify-between gap-3 rounded-sm border-2 px-3 text-sm font-black uppercase tracking-[0.08em] ${checked ? "border-ink bg-ink text-cream" : "border-ink bg-cream text-ink"}`}>
      <span>{label}</span>
      <input className="size-5 accent-ink" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
