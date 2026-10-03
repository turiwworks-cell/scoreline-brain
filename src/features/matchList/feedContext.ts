import { createContext } from 'react';

export interface Feed {
  /** counts day changes; every block replays its entrance when this moves */
  readonly epoch: number;
  /** 1 when the new day lies to the right of the old one, -1 to the left */
  readonly dir: 1 | -1;
  /** a day change is still playing: a block that mounts now comes in with the rest */
  readonly fresh: boolean;
}

export const FeedContext = createContext<Feed>({ epoch: 0, dir: 1, fresh: false });
