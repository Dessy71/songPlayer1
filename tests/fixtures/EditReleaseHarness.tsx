import React, { useState } from 'react';
import { EditReleaseModal } from '../../src/components/EditReleaseModal';
import type { Album, Song } from '../../src/types/music';

/**
 * Mounts the release editor the way the app actually does, including the two
 * things that used to wipe the form:
 *
 *   - `albumTracks` is built inline by several call sites (AlbumView sorts it
 *     on every render), so it is a new array - and new objects - each time.
 *   - the parent re-renders on a timer and after background refreshes, and a
 *     refresh replaces every song object with a new one.
 *
 * This harness deliberately reproduces both, and hands the re-render trigger
 * back to the caller so a test can drive a real parent re-render.
 */

interface HarnessProps {
  song?: Song | null;
  album?: Album | null;
  albumTracks?: Song[];
}

const Harness: React.FC<HarnessProps> = ({ song, album, albumTracks }) => {
  const [, setTick] = useState(0);

  return (
    <EditReleaseModal
      isOpen={Boolean(song || album)}
      song={song ? { ...song } : null}
      album={album ? { ...album } : null}
      albumTracks={albumTracks ? albumTracks.map((t) => ({ ...t })) : []}
      onSaved={() => undefined}
      onDeleted={() => undefined}
    />
  );
};

export default Harness;
