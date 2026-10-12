-- pgcrypto is preinstalled by Supabase; keep fresh PostgreSQL replay self-contained.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

SET local check_function_bodies = off;

CREATE TABLE "access_private"."mutation_keys" (
  "id"     text  NOT NULL,
  "secret" bytea NOT NULL,
  CONSTRAINT "mutation_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "mutation_keys_secret_check" CHECK ((octet_length(secret) = 32))
);

ALTER TABLE "access_private"."mutation_keys"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION access_private.commit_owner_change (
  message   text,
  signature text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  SET "TimeZone" TO 'UTC'
  AS $function$
declare actor uuid=auth.uid(); m jsonb; k bytea; p public.properties; book public.accounting_books; at timestamptz; result jsonb; receipt jsonb; aid text; inv jsonb; ln jsonb; pos integer; lpos integer; oldbase text;
begin
 if actor is null then raise exception using errcode='42501',message='AUTH';end if;
 if octet_length(message)>10000000 then raise exception using errcode='22023',message='TOO_LARGE';end if;
 m=message::jsonb;
 select secret into k from access_private.mutation_keys where id=m->>'keyId';
 if k is null or message is null or m->>'expires' is null or signature is null or signature<>encode(extensions.hmac(convert_to(message,'UTF8'),k,'sha256'),'hex') or m->>'actor' is distinct from actor::text or (m->>'expires')::bigint<extract(epoch from clock_timestamp()) or (m->>'expires')::bigint>extract(epoch from clock_timestamp())+180 then raise exception using errcode='42501',message='INVALID_TICKET';end if;
 if m->>'kind' is null or m->>'inputHash' is null or m->>'kind' not in ('property','book') or coalesce(m->>'requestId','')='' then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 aid='hu60:owner:'||actor::text||':'||(m->>'requestId');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('owner:'||actor::text,0));
 select payload into receipt from public.audit_events where id=aid and user_id=actor;
 if found then
  if receipt->>'inputHash' is distinct from m->>'inputHash' then raise exception using errcode='40001',message='REQUEST_CONFLICT';end if;
  return receipt->'result'||jsonb_build_object('replayed',true);
 end if;
 -- Lock properties before the book, matching scenario transactions.
 perform 1 from public.properties x where x.user_id=actor order by x.id for update;
 select * into book from public.accounting_books where user_id=actor for update;
 if book.updated_at is distinct from (m->>'bookVersion')::timestamptz then raise exception using errcode='40001',message='BOOK_CONFLICT';end if;
 at=greatest(clock_timestamp(),coalesce(book.updated_at,'1970-01-01')+interval '1 millisecond');
 if m->>'kind'='property' then
  select * into p from public.properties where id=m->'property'->>'id' and user_id=actor;
  if exists(select 1 from public.property_deletions where id=m->'property'->>'id') or exists(select 1 from public.properties where id=m->'property'->>'id' and user_id<>actor) then raise exception using errcode='42501',message='PROPERTY_UNAVAILABLE';end if;
  if p.updated_at is distinct from (m->>'propertyVersion')::timestamptz then raise exception using errcode='40001',message='PROPERTY_CONFLICT';end if;
  select scenario_id into oldbase from public.analysis_baselines where property_id=m->'property'->>'id' and user_id=actor;
  if oldbase is distinct from m->>'baselineId' then raise exception using errcode='40001',message='BASELINE_CHANGED';end if;
  at=greatest(at,coalesce(p.updated_at,'1970-01-01')+interval '1 millisecond');
  if p.id is not null and not exists(select 1 from public.investment_projects where property_id=p.id and user_id=actor) then
   insert into public.property_baselines values(p.id,actor,p.payload::text,p.updated_at::text,at) on conflict do nothing;
   insert into public.opening_balances(user_id,property_id,line_id,amount,source) select actor,p.id,j.key,(j.value->>'actual')::numeric,'legacy_manual_total' from jsonb_each(coalesce(p.payload->'lines','{}')) j where jsonb_typeof(j.value->'actual')='number' on conflict do nothing;
  end if;
  insert into public.properties(id,user_id,payload,updated_at) values(m->'property'->>'id',actor,(m->'property')-'updatedAt',at) on conflict(id) do update set payload=excluded.payload,updated_at=excluded.updated_at where public.properties.user_id=actor;
  if not found then raise exception using errcode='42501',message='PROPERTY_UNAVAILABLE';end if;
  insert into public.investment_projects(property_id,user_id,schema_version,origin,created_at) values(m->'property'->>'id',actor,1,case when p.id is null then 'new' else 'legacy' end,at) on conflict do nothing;
  result=jsonb_build_object('updatedAt',at,'id',m->'property'->>'id');
 else
  if (select count(*) from public.properties where user_id=actor)<>jsonb_array_length(m->'properties') or exists(select 1 from jsonb_array_elements(m->'properties') j left join public.properties x on x.id=j->>'id' and x.user_id=actor where x.id is null or x.updated_at is distinct from (j->>'version')::timestamptz) then raise exception using errcode='40001',message='PROPERTY_CONFLICT';end if;
  if m->'sourceDraft' is not null and m->'sourceDraft'<>'null'::jsonb and not exists(select 1 from public.expense_drafts d where d.user_id=actor and d.id=m->'sourceDraft'->>'id' and d.updated_at=(m->'sourceDraft'->>'version')::timestamptz) then raise exception using errcode='40001',message='DRAFT_CHANGED';end if;
  if m->'saleBase' is not null and m->'saleBase'<>'null'::jsonb and (select scenario_id from public.analysis_baselines where user_id=actor and property_id=m->'saleBase'->>'propertyId') is distinct from m->'saleBase'->>'id' then raise exception using errcode='40001',message='BASELINE_CHANGED';end if;
  if book.user_id is not null and not coalesce((book.payload->>'invoiceStorage')::integer=1,false) then insert into public.expense_legacy_backup values(actor,book.payload::text,book.updated_at::text,at) on conflict do nothing;end if;
  insert into public.accounting_books values(actor,m->'storedBook',at) on conflict(user_id) do update set payload=excluded.payload,updated_at=excluded.updated_at;
  delete from public.expense_allocations where user_id=actor;delete from public.expense_lines where user_id=actor;delete from public.expense_invoices where user_id=actor;delete from public.expense_classification_history where user_id=actor;
  for inv,pos in select value,ordinality-1 from jsonb_array_elements(m->'book'->'invoices') with ordinality loop
   insert into public.expense_invoices(user_id,id,position,request_id,payload) values(actor,inv->>'id',pos,nullif(inv->'detail'->>'requestId',''),jsonb_set(inv,'{lines}','[]'));
   for ln,lpos in select value,ordinality-1 from jsonb_array_elements(inv->'lines') with ordinality loop
    insert into public.expense_lines(user_id,id,invoice_id,property_id,position,payload) values(actor,ln->>'id',inv->>'id',ln->>'propertyId',lpos,case when ln ? 'classification' then jsonb_set(ln,'{classification,splits}','[]') else ln end);
    insert into public.expense_allocations(user_id,line_id,position,payload) select actor,ln->>'id',ordinality-1,value from jsonb_array_elements(coalesce(ln->'classification'->'splits','[]')) with ordinality;
   end loop;
  end loop;
  insert into public.expense_classification_history(user_id,id,position,payload) select actor,value->>'id',ordinality-1,value from jsonb_array_elements(coalesce(m->'book'->'classification'->'invoiceHistory','[]')) with ordinality;
  result=jsonb_build_object('version',at);
 end if;
 result=result||jsonb_build_object('replayed',false);
 insert into public.audit_events(id,user_id,property_id,module,payload,created_at) values(aid,actor,coalesce(m->>'propertyId',''),m->>'module',(m->'audit')||jsonb_build_object('actor',actor,'at',at,'inputHash',m->>'inputHash','result',result),at);
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.commit_validated_owner_change (
  message   text,
  signature text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select access_private.commit_owner_change(message,signature)$function$;

REVOKE ALL ON FUNCTION "public"."commit_validated_owner_change"(text, text) FROM PUBLIC, "anon", "service_role";

REVOKE ALL ON FUNCTION "access_private"."commit_owner_change"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."commit_owner_change"(text, text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."commit_validated_owner_change"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."commit_validated_owner_change"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."commit_validated_owner_change"(text, text) TO "postgres";

