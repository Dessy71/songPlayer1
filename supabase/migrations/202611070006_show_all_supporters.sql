-- Show ALL verified supporters on artiste profile pages.
-- Previously the artiste_supporters() RPC filtered on o.publicly_visible, which
-- excluded supporters who paid while the default was anonymous. Now every
-- verified supporter appears with their profile picture (or initials badge if
-- no photo is set), ranked by total contribution.
--
-- The publicly_visible column is kept in support_payment_orders for the checkbox
-- preference, but it no longer gates display on the artiste page.
CREATE OR REPLACE FUNCTION public.artiste_supporters(p_artiste_id uuid)
RETURNS TABLE(
  display_name text,
  avatar_url text,
  total_amount_subunits bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $function$
  SELECT
    coalesce(p.display_name, p.username, 'Supporter'),
    p.avatar_url,
    coalesce(sum(o.amount_subunits), 0)::bigint AS total_amount_subunits
  FROM public.profiles p
  JOIN public.support_payment_orders o
    ON o.user_id = coalesce(p.claimed_user_id, p.id)
  WHERE o.artiste_id = p_artiste_id
    AND o.status = 'verified'
  GROUP BY p.id, p.display_name, p.username, p.avatar_url
  ORDER BY total_amount_subunits DESC, o.created_at ASC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.artiste_supporters(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.artiste_supporters(uuid) TO anon, authenticated;
