import { TEAMS } from '../../data/demo/data';
import type { Team } from '../../domain';
import { Glass, PhotoTile, PHOTO_SIZES, photoSources, PlayerPhoto, type PhotoKind } from '../../ui';
// the pipeline's own manifest (scripts/slice-atlas.ts), bundled into the kit's chunk only
import manifest from '../../../public/img/players/manifest.json';
import { Section } from './Section';
import styles from './Part8.module.css';

/*
 * Part 8 on /dev/kit: the photos cut from the squad atlases, through PlayerPhoto, and each
 * kind (bust, head, frost) on its own at its @1x box, so the screen's density picks the file.
 */

type Entry = { team: string; n: number; name: string; cell: number; path: string };

const hex = (n: number) => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;
const TEAM: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, { id: t.id, name: t.name, short: t.short, colors: [hex(t.c1), hex(t.c2)] }]));

const byTeam = (team: string) => Object.values(manifest.players).filter((p) => p.team === team).sort((a, b) => a.cell - b.cell);
const entry = (id: string) => (manifest.players as Record<string, Entry>)[id]!;

/** A goalkeeper, a patterned shirt, crossed arms and a coach: the cells most likely to show a problem. */
const SHOWCASE: Entry[] = [entry('fra:10'), entry('arg:10'), entry('fra:20'), entry('arg:23'), manifest.coaches.fra, manifest.coaches.arg];

function Photo({ p, kind, w, h }: { p: Entry; kind: PhotoKind; w?: number; h?: number }) {
  const s = photoSources(p.path, kind);
  const [w1, h1] = PHOTO_SIZES[kind][1];
  const width = w ?? w1;
  return (
    <picture>
      {s.sources.map((x) => (
        <source key={x.type} type={x.type} srcSet={x.srcSet} sizes={`${width}px`} />
      ))}
      <img className={styles.raw} src={s.src} srcSet={s.srcSet} sizes={`${width}px`} width={width} height={h ?? h1} alt={`${p.name}, ${kind}`} decoding="async" />
    </picture>
  );
}

export function Part8() {
  return (
    <>
      <header className={styles.partHead}>
        <h2 className={styles.partTitle}>Part 8 · Image pipeline</h2>
      </header>
      <div className={styles.grid}>
        <Section title="Squad photos" wide note="Every France and Argentina photo, cut from squad_fra / squad_arg at the Lua's cells (luau:1461-1508), in PhotoTile at 52, by shirt number. The coaches (no number, so no PlayerPhoto) are below.">
          {['fra', 'arg'].map((team) => (
            <ul key={team} className={styles.squad} data-testid={`photos-${team}`}>
              {byTeam(team).map((p) => (
                <li key={p.path} data-player={`${p.team}:${p.n}`}>
                  <PhotoTile team={TEAM[team]!} n={p.n} size={52} alt={p.name} {...photoSources(p.path)} />
                  <span className={styles.caption}>{p.n}</span>
                </li>
              ))}
            </ul>
          ))}
        </Section>

        <Section title="Photos in place" note="The face crop of the bust standing on the box's bottom (luau:3654): list tiles at 42 and 52, a card at 84 and a large card at 140.">
          {SHOWCASE.slice(0, 2).map((p) => (
            <div key={p.path} className={styles.row}>
              <PhotoTile team={TEAM[p.team]!} n={p.n} size={42} alt={p.name} {...photoSources(p.path)} />
              <PhotoTile team={TEAM[p.team]!} n={p.n} size={52} alt={p.name} {...photoSources(p.path)} />
              <Glass radius={18} className={styles.card}>
                <PlayerPhoto team={TEAM[p.team]!} n={p.n} width={84} alt={p.name} {...photoSources(p.path)} />
              </Glass>
              <Glass radius={26} className={styles.card}>
                <PlayerPhoto team={TEAM[p.team]!} n={p.n} width={140} alt={p.name} {...photoSources(p.path)} />
              </Glass>
            </div>
          ))}
        </Section>

        <Section title="Bust, head, frost" wide note="Each kind at its @1x box: bust 144 × 180 here (half), head 112, frost 72 × 90 and the frost stretched to the bust box as the Lua draws it (luau:6134).">
          <ul className={styles.kinds} data-testid="photo-kinds">
            {SHOWCASE.map((p) => (
              <li key={p.path}>
                <span className={styles.kindRow}>
                  <Photo p={p} kind="bust" w={144} h={180} />
                  <Photo p={p} kind="head" />
                  <Photo p={p} kind="frost" />
                  <Photo p={p} kind="frost" w={144} h={180} />
                </span>
                <span className={styles.caption}>
                  {p.name} · {p.team}:{p.n}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
