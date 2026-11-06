import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://neicfighjkzokoxojboz.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5laWNmaWdoamt6b2tveG9qYm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MjgxMDYsImV4cCI6MjEwOTUwNDEwNn0.mYSCQll3z-1PuMKmFf7a9_naEZzXHxJZNDZdoFKCUNA';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Isolated non-persisting client used when Master Admin provisions ready-to-use
 * Email + Password login credentials for a Pre-Created Artiste profile without
 * replacing the Admin's own active browser session.
 */
export function createIsolatedAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'gyidi-isolated-provision-client',
    },
  });
}
