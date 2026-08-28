export type ExerciseMatchType = 'exact' | 'alias' | 'normalized';

export interface ImportSetInput {
  type?: string;
  targetReps?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetRIR?: number;
  targetRPE?: number;
  targetWeight?: number;
  duration?: number;
  distance?: number;
  notes?: string;
}

export interface ImportExercisePreview {
  importName: string;
  restSeconds: number | null;
  notes: string | null;
  match: { exerciseId: string; name: string; matchType: ExerciseMatchType } | null;
  sets: ImportSetInput[];
}

export interface ImportWorkoutPreview {
  name: string;
  description: string | null;
  notes: string | null;
  estimatedDurationMinutes: number | null;
  exercises: ImportExercisePreview[];
}

export interface ImportValidateResponse {
  errors: string[];
  plan: { name: string; description: string | null; durationWeeks: number | null; startDate: string | null };
  workouts: ImportWorkoutPreview[];
}
