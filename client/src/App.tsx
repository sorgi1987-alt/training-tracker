import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layouts/AppShell';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Exercises } from './pages/Exercises';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { NewExercise } from './pages/NewExercise';
import { Plans } from './pages/Plans';
import { NewPlan } from './pages/NewPlan';
import { PlanDetail } from './pages/PlanDetail';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { Workout } from './pages/Workout';
import { History } from './pages/History';
import { SessionDetail } from './pages/SessionDetail';
import { More } from './pages/More';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/new" element={<NewExercise />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/new" element={<NewPlan />} />
          <Route path="/plans/:id" element={<PlanDetail />} />
          <Route path="/plans/:planId/workouts/:workoutId" element={<WorkoutDetail />} />
          <Route path="/more" element={<More />} />
        </Route>
      </Route>
    </Routes>
  );
}
