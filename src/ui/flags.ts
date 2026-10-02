import type { FlagCommand, Team } from '../domain';

/*
 * The built-in flags (FLAGS, luau:1771-1795), verbatim, in a 30 x 30 box.
 * Ops: h / v stripes, r rect, c circle, cs ring, s star, p5 pentagram, d diamond, a arc,
 * rr rounded rect. A team's own `flag` (teams[].flag) wins over these (applyTeams, luau:7712).
 */
export const FLAGS: Readonly<Record<string, readonly FlagCommand[]>> = {
  fra: [['v', '#0055A4', '#FFFFFF', '#EF4135']],
  arg: [['h', '#74ACDF', '#FFFFFF', '#74ACDF'], ['c', 15, 15, 3.1, '#F6B40E']],
  eng: [['r', 0, 0, 30, 30, '#FFFFFF'], ['r', 12.4, 0, 5.2, 30, '#CE1124'], ['r', 0, 12.4, 30, 5.2, '#CE1124']],
  bra: [['r', 0, 0, 30, 30, '#009C3B'], ['d', '#FFDF00'], ['c', 15, 15, 5.4, '#002776']],
  ger: [['h', '#2A2A2A', '#DD0000', '#FFCE00']],
  ned: [['h', '#AE1C28', '#FFFFFF', '#21468B']],
  ita: [['v', '#009246', '#FFFFFF', '#CE2B37']],
  bel: [['v', '#2A2A2A', '#FDDA24', '#EF3340']],
  aut: [['h', '#EF3340', '#FFFFFF', '#EF3340']],
  irl: [['v', '#169B62', '#FFFFFF', '#FF883E']],
  pol: [['h', '#FFFFFF', '#DC143C']],
  jpn: [['r', 0, 0, 30, 30, '#FFFFFF'], ['c', 15, 15, 7.2, '#BC002D']],
  col: [['r', 0, 0, 30, 15.2, '#FCD116'], ['r', 0, 15, 30, 7.7, '#003893'], ['r', 0, 22.5, 30, 7.5, '#CE1126']],
  nga: [['v', '#008751', '#FFFFFF', '#008751']],
  sen: [['v', '#00853F', '#FDEF42', '#E31B23'], ['s', 15, 15, 3.6, '#00853F']],
  civ: [['v', '#F77F00', '#FFFFFF', '#009E60']],
  mli: [['v', '#14B53A', '#FCD116', '#CE1126']],
  swe: [['r', 0, 0, 30, 30, '#006AA7'], ['r', 8.5, 0, 5.5, 30, '#FECC02'], ['r', 0, 12.25, 30, 5.5, '#FECC02']],
  den: [['r', 0, 0, 30, 30, '#C8102E'], ['r', 8.5, 0, 5.5, 30, '#FFFFFF'], ['r', 0, 12.25, 30, 5.5, '#FFFFFF']],
  esp: [['r', 0, 0, 30, 30, '#AA151B'], ['r', 0, 7.5, 30, 15, '#F1BF00']],
  por: [
    ['r', 0, 0, 12.2, 30, '#046A38'],
    ['r', 12, 0, 18, 30, '#DA291C'],
    ['cs', 12, 15, 5, 1.6, '#FFE000'],
    ['rr', 10.2, 12.6, 3.6, 4.6, 0.8, '#FFFFFF', '#DA291C'],
  ],
  mar: [['r', 0, 0, 30, 30, '#C1272D'], ['p5', 15, 15.6, 6.4, '#006233', 1.15]],
  mex: [['v', '#006847', '#FFFFFF', '#CE1126'], ['c', 15, 15, 3.2, '#8C5A2B'], ['a', '#006847']],
};

/** No flag sent and none built in: a disc in the first colour, ringed in the second (luau:7722). */
export function defaultFlag(c1: string, c2: string): readonly FlagCommand[] {
  return [['r', 0, 0, 30, 30, c1], ['cs', 15, 15, 8.5, 2.6, c2]];
}

export type CrestTeam = Pick<Team, 'id' | 'colors' | 'flag'>;

/** The flag a team is drawn with (applyTeams, luau:7712-7723). */
export function flagOf(team: CrestTeam): readonly FlagCommand[] {
  if (team.flag && team.flag.length > 0) return team.flag;
  return FLAGS[team.id] ?? defaultFlag(team.colors[0], team.colors[1]);
}
