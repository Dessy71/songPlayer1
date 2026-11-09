import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Self-service account closure and deletion.
 *
 * Three actions:
 *   schedule — start the 30-day recovery window
 *   cancel   — change your mind during the window
 *   finalise — permanently remove personal data (only once the window passed)
 *
 * Runs with the service-role key because deleting an auth user is not
 * something a browser client is allowed to do.
 *
 * Music is never destroyed here. Published songs and albums are orphaned
 * (their artiste_id / uploaded_by links are cleared) so a catalogue cannot be
 * lost just because someone left. Storage objects are left alone for the same
 * reason.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/** How long someone has to change their mind before deletion is final. */
const RECOVERY_DAYS = 30;

export function createDeleteAccountHandler(
  env: (key: string) => string | undefined,
  clientFactory = createClient
) {
  return async (req: Request) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return json({});
    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

    try {
      const url = env('SUPABASE_URL');
      const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
      const anonKey = env('SUPABASE_ANON_KEY');
      if (!url || !serviceKey || !anonKey) {
        return json({ error: 'Account deletion is not configured.' }, 503);
      }

      const admin = clientFactory(url, serviceKey);

      // Identify the caller from their own token - this endpoint is strictly
      // self-service, so there is no way to point it at someone else.
      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader) return json({ error: 'Sign in required.' }, 401);

      const asUser = clientFactory(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await asUser.auth.getUser();
      if (userError || !userData?.user) {
        return json({ error: 'Your session has expired. Sign in again.' }, 401);
      }
      const uid = userData.user.id;

      const body = await req.json().catch(() => ({}));
      const action = typeof body?.action === 'string' ? body.action : '';

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id, delete_requested_at, avatar_url, role')
        .eq('id', uid)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return json({ error: 'Profile not found.' }, 404);

      if (action === 'schedule') {
        const { error } = await admin
          .from('profiles')
          .update({ delete_requested_at: new Date().toISOString() })
          .eq('id', uid);
        if (error) throw error;
        return json({ ok: true, delete_requested_at: new Date().toISOString() });
      }

      if (action === 'cancel') {
        const { error } = await admin
          .from('profiles')
          .update({ delete_requested_at: null })
          .eq('id', uid);
        if (error) throw error;
        return json({ ok: true, cancelled: true });
      }

      if (action !== 'finalise') {
        return json({ error: 'Unknown action.' }, 400);
      }

      // The recovery window is enforced here, not just in the UI.
      const requestedAt = profile.delete_requested_at
        ? new Date(profile.delete_requested_at).getTime()
        : null;
      if (requestedAt === null) {
        return json({ error: 'Deletion has not been scheduled.' }, 400);
      }
      const dueAt = requestedAt + RECOVERY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() < dueAt) {
        return json(
          {
            error: 'The recovery window has not ended yet.',
            due_at: new Date(dueAt).toISOString(),
          },
          400
        );
      }

      const problems: string[] = [];

      // 1. Orphan published work instead of destroying it. The song and album
      //    rows survive; only the link back to the person goes.
      for (const table of ['songs', 'albums']) {
        try {
          const { error } = await admin
            .from(table)
            .update({ artiste_id: null, uploaded_by: null })
            .or(`artiste_id.eq.${uid},uploaded_by.eq.${uid}`);
          if (error) problems.push(`${table}: ${error.message}`);
        } catch (err) {
          problems.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 2. Remove personal data. Each step is independent: a table that does
      //    not exist (or a column that moved) must not strand the account.
      const owned: Array<{ table: string; column: string }> = [
        { table: 'favorites', column: 'user_id' },
        { table: 'playlists', column: 'user_id' },
        { table: 'premiere_reminders', column: 'user_id' },
        { table: 'offline_library', column: 'user_id' },
        { table: 'recent_plays', column: 'user_id' },
        { table: 'app_sessions', column: 'user_id' },
        { table: 'broadcast_reads', column: 'profile_id' },
        { table: 'profile_claim_codes', column: 'profile_id' },
        { table: 'artiste_payout_details', column: 'artiste_id' },
        { table: 'live_stream_waitlist', column: 'user_id' },
      ];
      for (const { table, column } of owned) {
        try {
          const { error } = await admin.from(table).delete().eq(column, uid);
          // A missing table is expected on some projects; anything else is
          // worth surfacing.
          if (error && !/does not exist|relation/i.test(error.message)) {
            problems.push(`${table}: ${error.message}`);
          }
        } catch (err) {
          problems.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 3. Drop the profile row.
      try {
        const { error } = await admin.from('profiles').delete().eq('id', uid);
        if (error) problems.push(`profiles: ${error.message}`);
      } catch (err) {
        problems.push(`profiles: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 4. Finally the credential, so the account can never sign in again.
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(uid);
      if (authDeleteError) {
        problems.push(`auth: ${authDeleteError.message}`);
      }

      return json({ ok: problems.length === 0, deleted: true, problems });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('delete-account failed:', error instanceof Error ? (error.stack || error.message) : error);
      return json({ error: 'Account deletion failed.', detail }, 503);
    }
  };
}

Deno.serve(createDeleteAccountHandler((key) => Deno.env.get(key)));
