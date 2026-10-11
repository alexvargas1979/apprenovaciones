SET local check_function_bodies = off;

CREATE SCHEMA "access_private";

CREATE OR REPLACE FUNCTION access_private.line_centers (
  owner_id uuid,
  line_id  text,
  seen     text[] DEFAULT ARRAY[]::text[]
)
  RETURNS text[]
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare line jsonb; value jsonb; source_line text; result text[];
begin
 if line_id=any(seen) or cardinality(seen)>=40 then return null;end if;
 select payload into line from public.expense_lines l where l.user_id=owner_id and l.id=line_id;
 if line is null then return null;end if;
 source_line=nullif(line->>'sourceLineId','');
 if source_line is not null then return access_private.line_centers(owner_id,source_line,seen||line_id);end if;
 select payload->'value' into value from public.expense_classification_history h where h.user_id=owner_id and h.payload->>'lineId'=line_id order by position desc,id desc limit 1;
 if value is not null then
  if jsonb_typeof(value->'splits') is distinct from 'array' then return null;end if;
  select array_agg(s->>'centerId') into result from jsonb_array_elements(value->'splits') s;
 elsif line->'classification' is not null and line->'classification'<>'null'::jsonb then
  select array_agg(a.payload->>'centerId' order by position) into result from public.expense_allocations a where a.user_id=owner_id and a.line_id=line_centers.line_id;
 else result=array['']::text[];
 end if;
 -- Empty/malformed classification is not universal authorization.
 if result is null or cardinality(result)=0 or array_position(result,null) is not null then return null;end if;
 return result;
end $function$;

CREATE OR REPLACE FUNCTION access_private.shared_invoice (
  grant_id   text,
  invoice_id text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare g public.team_members; inv jsonb; line record; centers text[]; allowed_centers text[]; result jsonb='[]'::jsonb; total numeric=0;
begin
 if auth.uid() is null then return null;end if;
 select * into g from public.team_members t where t.id=grant_id and t.member_id=auth.uid() and t.payload->>'status'='Activo';
 if not found or jsonb_typeof(g.payload->'propertyIds') is distinct from 'array' or jsonb_typeof(g.payload#>'{expenses,permissions}') is distinct from 'array'
 or not(g.payload#>'{expenses,permissions}' ?| array['upload','draft','classify','review','approve','pay']) then return null;end if;
 select payload into inv from public.expense_invoices i where i.user_id=g.owner_id and i.id=invoice_id;
 if inv is null then return null;end if;
 if g.payload#>'{expenses,allCenters}' is distinct from 'true'::jsonb then
  if jsonb_typeof(g.payload#>'{expenses,centerIds}') is distinct from 'array' then return null;end if;
  select array_agg(x) into allowed_centers from jsonb_array_elements_text(g.payload#>'{expenses,centerIds}') x;
  if allowed_centers is null then return null;end if;
 end if;
 for line in select * from public.expense_lines l where l.user_id=g.owner_id and l.invoice_id=shared_invoice.invoice_id order by l.position,l.id loop
  if not(g.payload->'propertyIds' ? line.property_id) then return null;end if;
  if g.payload#>'{expenses,allCenters}' is distinct from 'true'::jsonb then
   centers=access_private.line_centers(g.owner_id,line.id);
   if centers is null or not(centers <@ allowed_centers) then return null;end if;
  end if;
  total=total+line.subtotal+line.tax;
  result=result||jsonb_build_array(jsonb_build_object('id',line.id,'propertyId',line.property_id,'description',line.payload->>'description','subtotal',line.subtotal,'tax',line.tax));
 end loop;
 if jsonb_array_length(result)=0 then return null;end if;
 return jsonb_build_object('id',invoice_id,'number',inv->>'number','date',inv->>'date','due',inv->>'due','total',total,'lines',result);
end $function$;

CREATE OR REPLACE FUNCTION access_private.shared_property (
  grant_id    text,
  property_id text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare g public.team_members; p jsonb; tasks jsonb; role_name text;
begin
 if auth.uid() is null then return null;end if;
 select * into g from public.team_members t where t.id=grant_id and t.member_id=auth.uid() and t.payload->>'status'='Activo';
 if not found or jsonb_typeof(g.payload->'propertyIds') is distinct from 'array' or not(g.payload->'propertyIds' ? property_id) then return null;end if;
 role_name=g.payload->>'role';if role_name is null or role_name not in ('Analista','Responsable de obra','Administración','Contratista') then return null;end if;
 select payload into p from public.properties where id=property_id and user_id=g.owner_id;
 if p is null then return null;end if;
 if role_name in ('Contratista','Responsable de obra') then
  select payload#>array['delivery',property_id,'tasks'] into tasks from public.accounting_books where user_id=g.owner_id;
  if jsonb_typeof(tasks) is distinct from 'array' then tasks='[]'::jsonb;end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','name',t->>'name','kind',t->>'kind','start',t->>'start','end',t->>'end','actualStart',t->>'actualStart','actualEnd',t->>'actualEnd','progress',t->'progress')),'[]'::jsonb) into tasks from jsonb_array_elements(tasks) t
  where role_name<>'Contratista' or (jsonb_typeof(g.payload->'taskIds')='array' and g.payload->'taskIds' ? (t->>'id'));
 end if;
 return jsonb_build_object('id',property_id,'name',p->>'name','county',p->>'county','address',p#>>'{values,5}','role',role_name) || case when tasks is null then '{}'::jsonb else jsonb_build_object('tasks',tasks) end;
end $function$;

CREATE OR REPLACE FUNCTION public.shared_invoice_summary (
  grant_id   text,
  invoice_id text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select access_private.shared_invoice(grant_id,invoice_id);
$function$;

REVOKE ALL ON FUNCTION "public"."shared_invoice_summary"(text, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.shared_property_summary (
  grant_id    text,
  property_id text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select access_private.shared_property(grant_id,property_id);
$function$;

REVOKE ALL ON FUNCTION "public"."shared_property_summary"(text, text) FROM PUBLIC, "anon", "service_role";

CREATE POLICY "owner_delete" ON "public"."accounting_books"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."accounting_books"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."accounting_books"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."accounting_books"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."analysis_baselines"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."analysis_baselines"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."analysis_baselines"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."analysis_baselines"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."analysis_scenarios"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."analysis_scenarios"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."analysis_scenarios"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."analysis_scenarios"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."audit_events"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."expense_allocations"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."expense_allocations"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_allocations"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."expense_allocations"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_classification_history"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."expense_drafts"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."expense_drafts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_drafts"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."expense_drafts"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."expense_invoices"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."expense_invoices"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_invoices"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."expense_invoices"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_legacy_backup"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."expense_lines"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."expense_lines"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_lines"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."expense_lines"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."expense_reports"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."expense_reports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."expense_reports"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."expense_reports"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."investment_projects"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."investment_projects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."investment_projects"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."investment_projects"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."opening_balances"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."opening_balances"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."opening_balances"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."opening_balances"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."properties"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."properties"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."properties"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."properties"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."property_baselines"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."property_deletions"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."property_documents"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."property_documents"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."property_documents"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."property_documents"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_delete" ON "public"."team_contributions"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_insert" ON "public"."team_contributions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_select" ON "public"."team_contributions"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_update" ON "public"."team_contributions"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_delete" ON "public"."team_members"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_insert" ON "public"."team_members"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_select" ON "public"."team_members"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_update" ON "public"."team_members"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = owner_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "owner_delete" ON "public"."workbook_imports"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_insert" ON "public"."workbook_imports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_select" ON "public"."workbook_imports"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "owner_update" ON "public"."workbook_imports"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON FUNCTION "access_private"."line_centers"(uuid, text, text[]) FROM PUBLIC;

REVOKE ALL ON FUNCTION "access_private"."shared_invoice"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."shared_invoice"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "access_private"."shared_property"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."shared_property"(text, text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."shared_invoice_summary"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."shared_invoice_summary"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."shared_invoice_summary"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."shared_property_summary"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."shared_property_summary"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."shared_property_summary"(text, text) TO "postgres";

GRANT USAGE ON SCHEMA "access_private" TO "authenticated";

REVOKE ALL ON TABLE "public"."accounting_books" FROM "authenticated";

GRANT SELECT ON TABLE "public"."accounting_books" TO "authenticated";

REVOKE ALL ON TABLE "public"."analysis_baselines" FROM "authenticated";

GRANT SELECT ON TABLE "public"."analysis_baselines" TO "authenticated";

REVOKE ALL ON TABLE "public"."analysis_scenarios" FROM "authenticated";

GRANT SELECT ON TABLE "public"."analysis_scenarios" TO "authenticated";

REVOKE ALL ON TABLE "public"."audit_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."audit_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_allocations" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_allocations" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_classification_history" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_classification_history" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_drafts" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_drafts" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_invoices" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_invoices" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_legacy_backup" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_legacy_backup" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_lines" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_lines" TO "authenticated";

REVOKE ALL ON TABLE "public"."expense_reports" FROM "authenticated";

GRANT SELECT ON TABLE "public"."expense_reports" TO "authenticated";

REVOKE ALL ON TABLE "public"."investment_projects" FROM "authenticated";

GRANT SELECT ON TABLE "public"."investment_projects" TO "authenticated";

REVOKE ALL ON TABLE "public"."opening_balances" FROM "authenticated";

GRANT SELECT ON TABLE "public"."opening_balances" TO "authenticated";

REVOKE ALL ON TABLE "public"."properties" FROM "authenticated";

GRANT SELECT ON TABLE "public"."properties" TO "authenticated";

REVOKE ALL ON TABLE "public"."property_baselines" FROM "authenticated";

GRANT SELECT ON TABLE "public"."property_baselines" TO "authenticated";

REVOKE ALL ON TABLE "public"."property_deletions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."property_deletions" TO "authenticated";

REVOKE ALL ON TABLE "public"."property_documents" FROM "authenticated";

GRANT SELECT ON TABLE "public"."property_documents" TO "authenticated";

REVOKE ALL ON TABLE "public"."team_contributions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."team_contributions" TO "authenticated";

REVOKE ALL ON TABLE "public"."team_members" FROM "authenticated";

GRANT SELECT ON TABLE "public"."team_members" TO "authenticated";

REVOKE ALL ON TABLE "public"."workbook_imports" FROM "authenticated";

GRANT SELECT ON TABLE "public"."workbook_imports" TO "authenticated";

