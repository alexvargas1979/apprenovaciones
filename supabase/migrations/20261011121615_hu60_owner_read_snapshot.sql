SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.owner_workspace_snapshot()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
select jsonb_build_object(
 'properties',(select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id),'[]') from public.properties p where p.user_id=(select auth.uid())),
 'book',(select to_jsonb(b) from public.accounting_books b where b.user_id=(select auth.uid())),
 'invoices',(select coalesce(jsonb_agg(to_jsonb(i) order by i.position,i.id),'[]') from public.expense_invoices i where i.user_id=(select auth.uid())),
 'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.position,l.id),'[]') from public.expense_lines l where l.user_id=(select auth.uid())),
 'allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.position),'[]') from public.expense_allocations a where a.user_id=(select auth.uid())),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.position,h.id),'[]') from public.expense_classification_history h where h.user_id=(select auth.uid())),
 'baselines',(select coalesce(jsonb_agg(jsonb_build_object('property_id',b.property_id,'captured_at',b.captured_at)),'[]') from public.property_baselines b where b.user_id=(select auth.uid())),
 'opening',(select coalesce(jsonb_agg(jsonb_build_object('property_id',o.property_id,'amount',o.amount)),'[]') from public.opening_balances o where o.user_id=(select auth.uid()))
);$function$;

REVOKE ALL ON FUNCTION "public"."owner_workspace_snapshot"() FROM PUBLIC, "anon", "service_role";

GRANT EXECUTE ON FUNCTION "public"."owner_workspace_snapshot"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."owner_workspace_snapshot"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owner_workspace_snapshot"() TO "postgres";

