import type { StoredKind } from './types';

// Shared by the reducer and boundary schemas. The reducer must not pull validation into the
// initial app bundle just to check an event kind; Sources own validation at the network edge.
export const STORED_KINDS: readonly StoredKind[] = ['goal', 'goalCancelled', 'yellow', 'red', 'sub', 'shot', 'miss', 'blocked', 'bigChance', 'corner', 'foul', 'offside'];
