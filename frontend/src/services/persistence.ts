import type { AdaptedContentPackage, Achievement } from '../types/types';
import { requireSupabase } from './supabase';

export interface LearningState {
  quizState: QuizState;
  currentStep: 1 | 2 | 3;
  activeStationIndex: number;
  completedStations: Record<number, boolean>;
  cognitiveShields: number;
  xp: number;
  achievements: Achievement[];
}
export interface QuizState {
  currentQuestionIndex: number;
  selectedOption: number | null;
  isEvaluated: boolean;
  userAnswers: Record<number, boolean>;
  selectedAnswers: Record<number, number>;
  isQuizCompleted: boolean;
}
export const EMPTY_QUIZ: QuizState = { currentQuestionIndex: 0, selectedOption: null,
  isEvaluated: false, userAnswers: {}, selectedAnswers: {}, isQuizCompleted: false };
export interface PackageRow { id: string; title: string; payload: AdaptedContentPackage }
export async function owner() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('La sesión terminó. Vuelve a ingresar.');
  return data.user;
}
export async function listPackages(): Promise<PackageRow[]> {
  const user = await owner();
  const { data, error } = await requireSupabase().from('learning_packages')
    .select('id,title,payload').eq('user_id', user.id)
    .contains('parameters', { application: 'fullstack-v2' }).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}
export async function createPackage(payload: AdaptedContentPackage, parameters: Record<string, unknown>, expectedOwner: string): Promise<PackageRow> {
  const user = await owner();
  if (user.id !== expectedOwner) throw new Error('La cuenta cambió durante la generación.');
  const { data, error } = await requireSupabase().from('learning_packages').insert({
    user_id: user.id, title: payload.contenido_adaptado.titulo, payload,
    parameters: { ...parameters, application: 'fullstack-v2' }, storage_provider: 'supabase',
  }).select('id,title,payload').single();
  if (error) throw error;
  return data;
}
export async function readState(packageId: string) {
  const user = await owner(); const db = requireSupabase();
  const [progress, state] = await Promise.all([
    db.from('learning_progress').select('*').eq('user_id', user.id).eq('package_id', packageId).maybeSingle(),
    db.from('user_state').select('*').eq('user_id', user.id).single(),
  ]);
  if (progress.error) throw progress.error;
  if (state.error) throw state.error;
  return { progress: progress.data, state: state.data };
}
export async function writeState(userId: string, packageId: string | null, state: LearningState) {
  const user = await owner();
  if (user.id !== userId) throw new Error('La cuenta cambió; no se guardó el estado anterior.');
  const db = requireSupabase();
  if (packageId) {
    const { error } = await db.from('learning_progress').upsert({
      user_id: userId, package_id: packageId, current_step: state.currentStep,
      active_station_index: state.activeStationIndex, completed_stations: state.completedStations,
      cognitive_shields: state.cognitiveShields,
      quiz_answers: state.quizState,
    }, { onConflict: 'user_id,package_id' });
    if (error) throw error;
  }
  const { error } = await db.from('user_state').upsert({ user_id: userId, xp: state.xp,
    achievements: state.achievements, preferences: { last_package_id: packageId }, last_activity_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
