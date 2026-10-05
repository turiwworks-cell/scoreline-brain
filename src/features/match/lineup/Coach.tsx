import { memo, useState } from 'react';
import type { Team } from '../../../domain';
import { PhotoTile, type PhotoSources } from '../../../ui';
import { H4 } from '../H4';
import { initials } from './model';
import styles from './Lineup.module.css';

/*
 * The coach (coachRow, luau:5548): the same photo tile as a player, his name and "Head coach".
 * With no photo, or one that fails to load, a disc with his initials stands in. A team the feed
 * sent no coach for has no section.
 */

export const Coach = memo(function Coach({ team, photo }: { team: Team; photo: PhotoSources | undefined }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!team.coach) return null;
  const show = photo !== undefined && failed !== photo.src;
  return (
    <section aria-label="Coach">
      <H4 left="Coach" />
      <div className={styles.coach}>
        {show ? (
          <PhotoTile
            className={styles.coachPhoto}
            size={52}
            team={team}
            n={0}
            coach
            src={photo.src}
            srcSet={photo.srcSet}
            sources={photo.sources}
            alt=""
            loading="lazy"
            onFail={() => setFailed(photo.src)}
          />
        ) : (
          <span className={styles.coachDisc} aria-hidden="true">
            {initials(team.coach)}
          </span>
        )}
        <p className={styles.coachName}>{team.coach}</p>
        <p className={styles.coachRole}>Head coach</p>
      </div>
    </section>
  );
});
