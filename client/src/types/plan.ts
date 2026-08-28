export interface PlanSet {
  id: string;
  orderIndex: number;
  type: string;
  targetReps: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRIR: number | null;
  targetRPE: number | null;
  targetWeight: number | null;
  duration: number | null;
  distance: number | null;
  notes: string | null;
}

export interface PlanExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string | null;
  exercisePrimaryMuscle: string | null;
  exerciseEquipment: string | null;
  orderIndex: number;
  notes: string | null;
  restSeconds: number | null;
  sets: PlanSet[];
}

export interface PlanWorkout {
  id: string;
  planId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  notes: string | null;
  estimatedDurationMin: number | null;
  exercises: PlanExercise[];
}

export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  durationWeeks: number | null;
  startDate: string | null;
  status: PlanStatus;
  schemaVersion: string;
  planVersion: number;
  createdTime: string;
  modifiedTime: string;
  workouts?: PlanWorkout[];
}
