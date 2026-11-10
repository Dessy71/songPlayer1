import React from 'react';
import { EditArtisteModal } from '../../src/components/EditArtisteModal';
import type { UserProfile } from '../../src/types/music';

/**
 * Mounts the artiste editor the way the app actually does, including the thing
 * that used to wipe the form: `artiste` is an object, and a parent refresh
 * hands the modal a brand new object holding the same values. Depending on that
 * object directly re-ran the sync effect on every parent render, so a clock
 * tick or a background profile refresh threw away whatever had been typed.
 *
 * The harness deliberately rebuilds the object on every render, so a plain
 * parent re-render is enough to reproduce it.
 */

interface HarnessProps {
  artiste?: UserProfile | null;
  isAdminViewer?: boolean;
  isOpen?: boolean;
}

const Harness: React.FC<HarnessProps> = ({ artiste, isAdminViewer = true, isOpen = true }) => (
  <EditArtisteModal
    isOpen={isOpen}
    onClose={() => undefined}
    artiste={artiste ? { ...artiste } : null}
    isAdminViewer={isAdminViewer}
  />
);

export default Harness;
