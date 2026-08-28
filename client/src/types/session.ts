export interface SessionSet {
  id: string;
  orderIndex: number;
  type: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  duration: number | null;
  distance: number | null;
  completed: boolean;
  skipped: boolean;
  notes: string | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
}

export interface PreviousSetPerformance {
  type: string;
  weight: number | null;
  reps: number | null;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  plannedExerciseId: string | null;
  plannedExerciseName: string | null;
  actualExerciseId: string;
  actualExerciseName: string | null;
  actualExerciseEquipment: string | null;
  plannedOrder: number | null;
  actualOrder: number;
  substituted: boolean;
  skipped: boolean;
  notes: string | null;
  restSeconds: number | null;
  previousPerformance: PreviousSetPerformance[];
  sets: SessionSet[];
}

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export interface WorkoutSession {
  id: string;
  planId: string | null;
  planWorkoutId: string | null;
  name: string;
  status: SessionStatus;
  startedTime: string;
  completedTime: string | null;
  durationSeconds: number | null;
  notes: string | null;
  exercises?: SessionExercise[];
}
