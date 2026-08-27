export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  equipment: string | null;
  category: string | null;
  instructions: string | null;
  metricType: string;
  scope: 'system' | 'user';
  isOwn: boolean;
}
