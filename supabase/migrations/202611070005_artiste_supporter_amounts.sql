-- Rank verified, publicly-visible supporters by the total amount they have
-- given to each artiste. The top three supporters receive a medal badge
-- (gold / silver / bronze) on the artiste profile page; everyone else is
-- listed without a medal but still in descending contribution order.
--
-- This is SECURITY DEFINER so the caller can read support_payment_orders even
-- though the table's RLS only lets a user read their own orders. No amounts
-- are revealed for anonymous supporters (publicly_visible = false rows are
-- excluded entirely).
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
    AND o.publicly_visible
  GROUP BY p.id, p.display_name, p.username, p.avatar_url
  ORDER BY total_amount_subunits DESC, o.created_at ASC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.artiste_supporters(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.artiste_supporters(uuid) TO anon, authenticated;
