// The Lua demo's matchday (`luau:1746–2267`) as a v2 feed, for the domain tests.
//
// Teams, leagues, fixtures, the France and Argentina squads and their line-ups are copied from
// the Lua's DATA tables. The Lua simulates the rest (events, ratings); those parts are fixed
// here by hand and marked as such, so tests don't depend on the simulation (Part 5).

import { applyFeed, emptyState } from '../apply';
import { parseFeed } from '../schemas';
import type { DomainState } from '../types';
import type { LeagueBase } from '../standings';

/** Epoch ms the demo feed is applied at. */
export const DEMO_T0 = 1_790_000_000_000;

const T = (id: string, name: string, short: string, c1: string, c2: string) => ({ id, name, short, colors: [c1, c2] });

// `luau:1754–1765`
const teams = [
  T('fra', 'France', 'FRA', '#0055A4', '#EF4135'), T('arg', 'Argentina', 'ARG', '#74ACDF', '#F6B40E'),
  T('eng', 'England', 'ENG', '#CE1124', '#1D3E8A'), T('bra', 'Brazil', 'BRA', '#FFDF00', '#009C3B'),
  T('ger', 'Germany', 'GER', '#FFCE00', '#DD0000'), T('ned', 'Netherlands', 'NED', '#F36C21', '#21468B'),
  T('bel', 'Belgium', 'BEL', '#ED2939', '#FDDA24'), T('aut', 'Austria', 'AUT', '#C8102E', '#F4F4F4'),
  T('irl', 'Ireland', 'IRL', '#169B62', '#FF883E'), T('pol', 'Poland', 'POL', '#DC143C', '#F4F4F4'),
  T('nga', 'Nigeria', 'NGA', '#008751', '#F4F4F4'), T('sen', 'Senegal', 'SEN', '#00853F', '#FDEF42'),
  T('civ', 'Ivory Coast', 'CIV', '#F77F00', '#009E60'), T('mli', 'Mali', 'MLI', '#14B53A', '#FCD116'),
  T('swe', 'Sweden', 'SWE', '#006AA7', '#FECC02'), T('den', 'Denmark', 'DEN', '#C8102E', '#F4F4F4'),
  T('esp', 'Spain', 'ESP', '#AA151B', '#F1BF00'), T('por', 'Portugal', 'POR', '#DA291C', '#046A38'),
  T('col', 'Colombia', 'COL', '#FCD116', '#003893'), T('mex', 'Mexico', 'MEX', '#006847', '#CE1126'),
  T('ita', 'Italy', 'ITA', '#0066B3', '#009246'), T('jpn', 'Japan', 'JPN', '#1C3F94', '#BC002D'),
  T('mar', 'Morocco', 'MAR', '#C1272D', '#006233'),
];

// `luau:1799–1810`. No `table`: the Lua counts these from `teams` and `prior` (DEMO_BASES).
const leagues = [
  { id: 'wns', country: 'World', name: 'Nations Series', matchday: 2 },
  { id: 'nla', country: 'Europe', name: 'Nations League A', matchday: 2 },
  { id: 'nlb', country: 'Europe', name: 'Nations League B', matchday: 2 },
  { id: 'afq', country: 'Africa', name: 'AFCON Qualifiers', matchday: 3 },
  { id: 'fri', country: 'World', name: 'Friendlies', matchday: 1 },
];

const r = (home: string, away: string, h: number, a: number) => ({ home, away, score: [h, a] as const });

/** The Lua's `LEAGUES[k].teams` and `.prior` (`luau:1799–1810`). */
export const DEMO_BASES: Readonly<Record<string, LeagueBase>> = {
  wns: { teams: ['fra', 'arg', 'eng', 'bra'], prior: [r('fra', 'eng', 1, 1), r('arg', 'bra', 2, 0)] },
  nla: { teams: ['ger', 'ned', 'bel', 'aut'], prior: [r('ger', 'bel', 2, 1), r('ned', 'aut', 0, 0)] },
  nlb: { teams: ['irl', 'pol', 'swe', 'den'], prior: [r('irl', 'swe', 0, 1), r('pol', 'den', 2, 2)] },
  afq: {
    teams: ['nga', 'sen', 'civ', 'mli'],
    prior: [r('nga', 'mli', 2, 0), r('sen', 'civ', 1, 1), r('civ', 'nga', 1, 1), r('mli', 'sen', 1, 3)],
  },
  fri: { teams: [], prior: [] },
};

// `luau:2117–2118`
const lineups = {
  home: { formation: '4-2-3-1', xi: [16, 19, 17, 4, 5, 14, 8, 20, 7, 11, 10], bench: [1, 23, 2, 3, 15, 21, 26, 6, 13, 18, 24, 25, 9, 12, 22] },
  away: { formation: '4-3-3', xi: [23, 3, 6, 13, 26, 20, 24, 7, 9, 22, 10], bench: [1, 12, 2, 4, 19, 25, 5, 8, 11, 14, 15, 16, 17, 18, 21] },
};

// By hand (the Lua simulates these): France 2–1 Argentina at 58'.
const fraArgEvents = [
  { id: 'e1', seq: 1, kind: 'goal', side: 'home', minute: 12, player: 10, other: 7, style: 'through', score: [1, 0] },
  { id: 'e2', seq: 2, kind: 'yellow', side: 'away', minute: 21, player: 24 },
  { id: 'e3', seq: 3, kind: 'goal', side: 'away', minute: 33, player: 10, score: [1, 1] },
  { id: 'e4', seq: 4, kind: 'corner', side: 'home', minute: 40 },
  { id: 'e5', seq: 5, kind: 'sub', side: 'away', minute: 46, player: 21, other: 22 },
  { id: 'e6', seq: 6, kind: 'goal', side: 'home', minute: 52, player: 11, score: [2, 1] },
  { id: 'e7', seq: 7, kind: 'shot', side: 'away', minute: 55, player: 9 },
];

// By hand (the Lua models these): provider ratings for tonight's leaders.
const fraArgPlayers = {
  home: { '10': { rating: 8.4, minutes: 58 }, '11': { rating: 7.9 }, '7': { rating: 7.3 }, '16': { rating: 6.8 }, '9': { rating: 6.5 } },
  away: { '10': { rating: 7.6 }, '22': { rating: 6.6 }, '9': { rating: 7.3 }, '24': { rating: 5.9 }, '23': { rating: 0 }, '21': { rating: 6.9 } },
};
const engBraPlayers = { home: { '1': { rating: 7.1 } }, away: { '9': { rating: 8.1 }, '30': { rating: 9.9 } } };

type Fixture = [day: number, league: string, home: string, away: string, hs: number, as: number, status: string, minute: number, kickoff?: string];

// `luau:1817–1830` (Lua days 0/1/2 are the feed's -1/0/1).
const fixtures: Fixture[] = [
  [1, 'wns', 'fra', 'arg', 2, 1, 'live', 58],
  [1, 'wns', 'eng', 'bra', 0, 1, 'live', 63],
  [1, 'nla', 'ger', 'ned', 1, 1, 'live', 76],
  [1, 'nla', 'bel', 'aut', 0, 2, 'live', 47],
  [1, 'nlb', 'irl', 'pol', 2, 1, 'live', 66],
  [1, 'afq', 'nga', 'sen', 0, 0, 'ns', 0, '21:00'],
  [1, 'afq', 'civ', 'mli', 0, 0, 'ns', 0, '23:30'],
  [0, 'nlb', 'swe', 'den', 2, 2, 'ft', 90],
  [0, 'fri', 'esp', 'por', 1, 0, 'ft', 90],
  [0, 'fri', 'col', 'mex', 0, 3, 'ft', 90],
  [2, 'fri', 'ita', 'jpn', 0, 0, 'ns', 0, '20:45'],
  [2, 'fri', 'mar', 'col', 0, 0, 'ns', 0, '18:00'],
];

const STATUS: Record<string, string> = { live: 'live', ns: 'scheduled', ft: 'finished' };

/** The demo feed, wire-shaped. Match ids are the fixture's place in the list, as in the Lua. */
export function demoFeedJson() {
  return {
    version: 2,
    days: ['Sat 19', 'Yesterday', 'Today', 'Tomorrow', 'Wed 23'],
    teams,
    leagues,
    squads: {
      fra: {
        players: [
          { n: 1, first: 'Brice', last: 'Samba', short: 'Samba', pos: 'GK' },
          { n: 2, first: 'Malo', last: 'Gusto', short: 'Gusto', pos: 'DF' },
          { n: 3, first: 'Lucas', last: 'Digne', short: 'Digne', pos: 'DF' },
          { n: 4, first: 'Dayot', last: 'Upamecano', short: 'Upamecano', pos: 'DF' },
          { n: 5, first: 'Jules', last: 'Koundé', short: 'Koundé', pos: 'DF' },
          { n: 6, first: 'Manu', last: 'Koné', short: 'Koné', pos: 'MF' },
          { n: 7, first: 'Ousmane', last: 'Dembélé', short: 'Dembélé', pos: 'FW' },
          { n: 8, first: 'Aurélien', last: 'Tchouaméni', short: 'Tchouaméni', pos: 'MF' },
          { n: 9, first: 'Marcus', last: 'Thuram', short: 'Thuram', pos: 'FW' },
          { n: 10, first: 'Kylian', last: 'Mbappé', short: 'Mbappé', pos: 'FW' },
          { n: 11, first: 'Michael', last: 'Olise', short: 'Olise', pos: 'FW' },
          { n: 12, first: 'Bradley', last: 'Barcola', short: 'Barcola', pos: 'FW' },
          { n: 13, first: "N'Golo", last: 'Kanté', short: 'Kanté', pos: 'MF' },
          { n: 14, first: 'Adrien', last: 'Rabiot', short: 'Rabiot', pos: 'MF' },
          { n: 15, first: 'Ibrahima', last: 'Konaté', short: 'Konaté', pos: 'DF' },
          { n: 16, first: 'Mike', last: 'Maignan', short: 'Maignan', pos: 'GK' },
          { n: 17, first: 'William', last: 'Saliba', short: 'Saliba', pos: 'DF' },
          { n: 18, first: 'Warren', last: 'Zaïre-Emery', short: 'Zaïre-Emery', pos: 'MF' },
          { n: 19, first: 'Theo', last: 'Hernández', short: 'T. Hernández', pos: 'DF' },
          { n: 20, first: 'Désiré', last: 'Doué', short: 'Doué', pos: 'FW' },
          { n: 21, first: 'Lucas', last: 'Hernández', short: 'L. Hernández', pos: 'DF' },
          { n: 22, first: 'Jean-Philippe', last: 'Mateta', short: 'Mateta', pos: 'FW' },
          { n: 23, first: 'Robin', last: 'Risser', short: 'Risser', pos: 'GK' },
          { n: 24, first: 'Rayan', last: 'Cherki', short: 'Cherki', pos: 'MF' },
          { n: 25, first: 'Maghnes', last: 'Akliouche', short: 'Akliouche', pos: 'MF' },
          { n: 26, first: 'Maxence', last: 'Lacroix', short: 'Lacroix', pos: 'DF' },
        ],
      },
      arg: {
        players: [
          { n: 1, first: 'Juan', last: 'Musso', short: 'Musso', pos: 'GK' },
          { n: 2, first: 'Marcos', last: 'Senesi', short: 'Senesi', pos: 'DF' },
          { n: 3, first: 'Nicolás', last: 'Tagliafico', short: 'Tagliafico', pos: 'DF' },
          { n: 4, first: 'Gonzalo', last: 'Montiel', short: 'Montiel', pos: 'DF' },
          { n: 5, first: 'Leandro', last: 'Paredes', short: 'Paredes', pos: 'MF' },
          { n: 6, first: 'Lisandro', last: 'Martínez', short: 'Li. Martínez', pos: 'DF' },
          { n: 7, first: 'Rodrigo', last: 'De Paul', short: 'De Paul', pos: 'MF' },
          { n: 8, first: 'Valentín', last: 'Barco', short: 'Barco', pos: 'MF' },
          { n: 9, first: 'Julián', last: 'Álvarez', short: 'Álvarez', pos: 'FW' },
          { n: 10, first: 'Lionel', last: 'Messi', short: 'Messi', pos: 'FW' },
          { n: 11, first: 'Giovani', last: 'Lo Celso', short: 'Lo Celso', pos: 'MF' },
          { n: 12, first: 'Gerónimo', last: 'Rulli', short: 'Rulli', pos: 'GK' },
          { n: 13, first: 'Cristian', last: 'Romero', short: 'Romero', pos: 'DF' },
          { n: 14, first: 'Exequiel', last: 'Palacios', short: 'Palacios', pos: 'MF' },
          { n: 15, first: 'Nicolás', last: 'González', short: 'N. González', pos: 'MF' },
          { n: 16, first: 'Thiago', last: 'Almada', short: 'Almada', pos: 'FW' },
          { n: 17, first: 'Giuliano', last: 'Simeone', short: 'G. Simeone', pos: 'FW' },
          { n: 18, first: 'Nico', last: 'Paz', short: 'Nico Paz', pos: 'FW' },
          { n: 19, first: 'Nicolás', last: 'Otamendi', short: 'Otamendi', pos: 'DF' },
          { n: 20, first: 'Alexis', last: 'Mac Allister', short: 'Mac Allister', pos: 'MF' },
          { n: 21, first: 'José Manuel', last: 'López', short: 'López', pos: 'FW' },
          { n: 22, first: 'Lautaro', last: 'Martínez', short: 'Lautaro', pos: 'FW' },
          { n: 23, first: 'Emiliano', last: 'Martínez', short: 'E. Martínez', pos: 'GK' },
          { n: 24, first: 'Enzo', last: 'Fernández', short: 'E. Fernández', pos: 'MF' },
          { n: 25, first: 'Facundo', last: 'Medina', short: 'Medina', pos: 'DF' },
          { n: 26, first: 'Nahuel', last: 'Molina', short: 'Molina', pos: 'DF' },
        ],
      },
    },
    matches: fixtures.map(([day, league, home, away, hs, as, status, minute, kickoff], i) => ({
      id: i + 1,
      seq: 1,
      day: day - 1,
      league,
      home,
      away,
      score: [hs, as],
      status: STATUS[status],
      minute,
      second: 0,
      kickoff: kickoff ?? '',
      // The Lua features France v Argentina and makes it the one favourite (`luau:2410`, `8501`).
      featured: i === 0,
      favourite: i === 0,
      ...(i === 0 ? { lineups, events: fraArgEvents, players: fraArgPlayers } : {}),
      ...(i === 1 ? { players: engBraPlayers } : {}),
    })),
  };
}

/** The state after the demo feed, applied at DEMO_T0. */
export function demoState(): DomainState {
  return applyFeed(emptyState(), parseFeed(demoFeedJson()), DEMO_T0).state;
}
