// Domain types. Pure data: no React, nothing from the rest of the app.
// The wire shapes these come from are in docs/DATA-CONTRACT.md.

export type Side = 'home' | 'away';
/** `[home, away]`. */
export type Score = readonly [number, number];
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type GoalStyle = 'through' | 'cutback' | 'header' | 'solo';

/** Event kinds kept in a match's event list. */
export type StoredKind =
  | 'goal'
  | 'goalCancelled'
  | 'yellow'
  | 'red'
  | 'sub'
  | 'shot'
  | 'miss'
  | 'blocked'
  | 'bigChance'
  | 'corner'
  | 'foul'
  | 'offside';

/** Event kinds that change the match but are not kept in its event list. */
export type SignalKind = 'kickoff' | 'fulltime' | 'minute' | 'action';

export type EventKind = StoredKind | SignalKind;

/** A flag drawing command, `["h", c1, c2, …]` etc. Kept as sent; `ui/Crest` reads it. */
export type FlagCommand = readonly (string | number)[];

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  readonly colors: readonly [string, string];
  readonly flag?: readonly FlagCommand[];
  readonly coach?: string;
}

export interface TableRow {
  readonly team: string;
  readonly p: number;
  readonly w: number;
  readonly d: number;
  readonly l: number;
  readonly gf: number;
  readonly ga: number;
  readonly pts: number;
}

export interface League {
  readonly id: string;
  readonly country: string;
  readonly name: string;
  readonly matchday: number;
  readonly qualify: number;
  readonly qualifyLabel: string;
  /** As sent. Absent means the table is counted from the matches. */
  readonly table?: readonly TableRow[];
}

export interface Player {
  /** `<team>:<n>`, see `playerKey`. */
  readonly id: string;
  readonly team: string;
  readonly n: number;
  readonly first: string;
  readonly last: string;
  readonly short: string;
  readonly pos: string;
  readonly role: string;
  readonly club: string;
  readonly born: string;
  readonly height: number;
}

export interface Venue {
  readonly name: string;
  readonly city: string;
  readonly referee: string;
  readonly attendance: string;
}

export interface Lineup {
  readonly formation: string;
  readonly xi: readonly number[];
  readonly bench: readonly number[];
}

export interface MatchEvent {
  /** Stable per match. The dedupe key. */
  readonly id: string;
  /** Position in the match's stream; 0 when the source sent none. */
  readonly seq: number;
  readonly kind: StoredKind;
  readonly side: Side;
  readonly minute: number;
  readonly player?: number;
  readonly other?: number;
  readonly name?: string;
  readonly otherName?: string;
  readonly style?: GoalStyle;
  readonly xg?: number;
  readonly text?: string;
  /** The match's score after this event. */
  readonly score?: Score;
  /** goalCancelled: the id of the goal it cancels. */
  readonly ref?: string;
  /** goal: a later goalCancelled took it off the board. */
  readonly cancelled?: boolean;
}

/** `[home, away]` pairs, plus possession. */
export interface MatchStats {
  readonly possession: number;
  readonly pairs: Readonly<Record<string, readonly [number, number]>>;
}

export type PlayerLine = Readonly<Record<string, number>>;

/** The clock as last synced. Read it through `liveMinute`, never directly. */
export interface Clock {
  readonly minute: number;
  readonly second: number;
  /** Epoch ms at which `minute:second` was true. */
  readonly at: number;
  /** Local review control: hold this live clock until the next source sync. */
  readonly paused?: boolean;
}

export interface PlayerAction {
  readonly side: Side;
  readonly player: number;
  readonly text: string;
  readonly act: string;
  readonly onBall: boolean;
  readonly at: number;
}

export interface Match {
  readonly id: number;
  /** Highest `seq` applied to this match, from a snapshot or an event. */
  readonly seq: number;
  /** -1 yesterday, 0 today, 1 tomorrow. */
  readonly day: number;
  readonly league: string;
  readonly home: string;
  readonly away: string;
  readonly score: Score;
  readonly status: MatchStatus;
  readonly clock: Clock;
  readonly kickoff: string;
  readonly featured: boolean;
  readonly favourite: boolean;
  readonly venue?: Venue;
  readonly lineups?: { readonly home?: Lineup; readonly away?: Lineup };
  /** Ordered by `seq`, then by arrival. */
  readonly events: readonly MatchEvent[];
  readonly stats?: MatchStats;
  /** One value per minute, -1 (away) to 1 (home). Absent means derive it from the events. */
  readonly momentum?: readonly number[];
  readonly players?: {
    readonly home: Readonly<Record<string, PlayerLine>>;
    readonly away: Readonly<Record<string, PlayerLine>>;
  };
  /** What the followed player is doing right now. */
  readonly action?: PlayerAction;
  /** Goals taken back so far. Keeps goal moment ids unique after a VAR cancel. */
  readonly cancels: number;
  /** Ids of the moments this match has already produced. */
  readonly played: readonly string[];
}

export interface NextFixture {
  readonly opponent: string;
  readonly date: string;
  readonly time: string;
  /** Epoch ms of the kick-off. */
  readonly at: number;
}

export interface DomainState {
  /** False until the first feed: that feed sets the stage without moments. */
  readonly loaded: boolean;
  readonly days: readonly string[];
  readonly teams: Readonly<Record<string, Team>>;
  readonly leagues: Readonly<Record<string, League>>;
  readonly players: Readonly<Record<string, Player>>;
  readonly matches: Readonly<Record<number, Match>>;
  /** Match ids in feed order. */
  readonly matchOrder: readonly number[];
  readonly next: Readonly<Record<string, NextFixture>>;
  /** Events that arrived before their match's snapshot, by match id. */
  readonly pending: Readonly<Record<number, readonly LiveEvent[]>>;
}

export type MomentKind = 'goal' | 'goalCancelled' | 'red' | 'kickoff' | 'fulltime';

/** Something worth a scene, a toast or an announcement. Played at most once. */
export interface Moment {
  readonly id: string;
  readonly kind: MomentKind;
  readonly matchId: number;
  readonly side?: Side;
  /** The event behind it, when there is one. A goal seen only as a score change has none. */
  readonly event?: MatchEvent;
  readonly score: Score;
  readonly minute: number;
}

export interface Applied {
  readonly state: DomainState;
  readonly moments: readonly Moment[];
}

// ── Parsed wire shapes (what the schemas produce) ─────────────────────────────

export interface FeedMatch {
  readonly id: number;
  readonly seq: number;
  readonly day: number;
  readonly league: string;
  readonly home: string;
  readonly away: string;
  readonly score: Score;
  readonly status: MatchStatus;
  readonly minute: number;
  readonly second: number;
  readonly kickoff: string;
  readonly featured: boolean;
  readonly favourite: boolean;
  readonly venue?: Venue;
  readonly lineups?: { readonly home?: Lineup; readonly away?: Lineup };
  readonly events: readonly WireEvent[];
  readonly stats?: MatchStats;
  readonly momentum?: readonly number[];
  readonly players?: Match['players'];
}

/** An event as it appears in a feed's `matches[].events`. */
export interface WireEvent {
  readonly id: string;
  readonly seq?: number;
  readonly kind: StoredKind;
  readonly side: Side;
  readonly minute?: number;
  readonly player?: number;
  readonly other?: number;
  readonly name?: string;
  readonly otherName?: string;
  readonly style?: GoalStyle;
  readonly xg?: number;
  readonly text?: string;
  readonly score?: Score;
  readonly ref?: string;
}

/** The standalone `event` message. */
export interface LiveEvent {
  readonly id?: string;
  readonly seq?: number;
  readonly match: number;
  readonly kind: EventKind;
  readonly side: Side;
  readonly minute?: number;
  readonly second?: number;
  readonly player?: number;
  readonly other?: number;
  readonly name?: string;
  readonly otherName?: string;
  readonly style?: GoalStyle;
  readonly xg?: number;
  readonly text?: string;
  readonly score?: Score;
  readonly ref?: string;
  readonly act?: string;
  readonly onBall?: boolean;
}

export interface FeedSquad {
  readonly coach?: string;
  readonly players: readonly Omit<Player, 'id' | 'team'>[];
}

export interface Feed {
  readonly version: number;
  readonly days?: readonly string[];
  readonly teams: readonly Omit<Team, 'coach'>[];
  readonly leagues: readonly League[];
  readonly squads: Readonly<Record<string, FeedSquad>>;
  readonly matches: readonly FeedMatch[];
  readonly next: Readonly<Record<string, { readonly opponent: string; readonly date: string; readonly time: string; readonly in: number }>>;
}
