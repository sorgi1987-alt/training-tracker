// Spec section 20: preserve an active workout's entered data if connectivity
// drops, and resync predictably once it returns — without a general-purpose
// offline database. Scope is deliberately narrow: only session-set edits,
// keyed by session id, storing just the latest intended value per field per
// set (not a request log) so retrying is always just "PATCH the current
// desired state" — simple to reason about, safe to repeat.
type SetPatch = Record<string, unknown>;

interface DraftEntry {
  exerciseId: string;
  patch: SetPatch;
}

interface SessionDraft {
  sets: Record<string, DraftEntry>;
}

const KEY_PREFIX = 'training-tracker:draft:';

function readDraft(sessionId: string): SessionDraft {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + sessionId);
    return raw ? JSON.parse(raw) : { sets: {} };
  } catch {
    return { sets: {} };
  }
}

function writeDraft(sessionId: string, draft: SessionDraft) {
  try {
    localStorage.setItem(KEY_PREFIX + sessionId, JSON.stringify(draft));
  } catch {
    // Storage full/unavailable — the in-memory UI state still reflects the
    // edit for this page view; only cross-refresh durability is lost.
  }
}

export function recordPendingSetPatch(sessionId: string, exerciseId: string, setId: string, patch: SetPatch) {
  const draft = readDraft(sessionId);
  draft.sets[setId] = { exerciseId, patch: { ...draft.sets[setId]?.patch, ...patch } };
  writeDraft(sessionId, draft);
}

export function clearPendingSetPatch(sessionId: string, setId: string) {
  const draft = readDraft(sessionId);
  if (!(setId in draft.sets)) return;
  delete draft.sets[setId];
  writeDraft(sessionId, draft);
}

export function clearAllPending(sessionId: string) {
  writeDraft(sessionId, { sets: {} });
}

export function getPendingCount(sessionId: string): number {
  return Object.keys(readDraft(sessionId).sets).length;
}

export function getPendingPatches(sessionId: string): Array<{ exerciseId: string; setId: string; patch: SetPatch }> {
  return Object.entries(readDraft(sessionId).sets).map(([setId, entry]) => ({
    setId,
    exerciseId: entry.exerciseId,
    patch: entry.patch
  }));
}

// Applies any locally-drafted (not yet confirmed synced) values over the
// server's copy so a refresh while offline shows what the user actually
// entered, not a stale server value.
export function mergeDraftIntoSets<T extends { id: string }>(sessionId: string, sets: T[]): T[] {
  const draft = readDraft(sessionId);
  if (Object.keys(draft.sets).length === 0) return sets;
  return sets.map((set) => (draft.sets[set.id] ? { ...set, ...draft.sets[set.id].patch } : set));
}
