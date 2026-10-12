SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION access_private.stress_scenario (
  actor                 uuid,
  property_id           text,
  expected_version      timestamp with time zone,
  expected_book_version timestamp with time zone,
  label                 text,
  request_id            uuid,
  stress_index          integer,
  snapshot              jsonb                    DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  SET "TimeZone" TO 'UTC'
  AS $function$
declare p public.properties; book_at timestamptz; command jsonb; receipt jsonb; result jsonb; audit_id text; new_id text; at timestamptz=clock_timestamp();
begin
 -- Only the server role has EXECUTE. Identity comes from server getUser(), never HTTP input.
 if actor is null or (auth.uid() is not null and auth.uid()<>actor) or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())) then raise exception using errcode='42501',message='ACTOR_UNAVAILABLE';end if;
 if stress_index is null or stress_index not between 0 and 5 then raise exception using errcode='22023',message='INVALID_STRESS_INDEX';end if;
 if property_id is null or char_length(property_id) not between 1 and 80 or expected_version is null or not isfinite(expected_version) or (expected_book_version is not null and not isfinite(expected_book_version)) or label is null or char_length(btrim(label)) not between 1 and 100 or request_id is null then raise exception using errcode='22023',message='INVALID_SCENARIO';end if;
 label=btrim(label); command=jsonb_build_object('propertyId',property_id,'version',expected_version,'bookVersion',expected_book_version,'label',label,'stressIndex',stress_index);
 audit_id='hu60:scenario-stress:'||actor::text||':'||request_id::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(audit_id,0));
 select a.payload into receipt from public.audit_events a where a.id=audit_id and a.user_id=actor;
 if found then
  if receipt->'command' is distinct from command then raise exception using errcode='40001',message='REQUEST_CONFLICT';end if;
  return (receipt->'result')||jsonb_build_object('replayed',true);
 end if;
 -- Null is a receipt lookup before calculation, not a write.
 if snapshot is null then return jsonb_build_object('pending',true);end if;
 if jsonb_typeof(snapshot)<>'object' or jsonb_typeof(snapshot->'result') is distinct from 'object' or jsonb_typeof(snapshot->'property') is distinct from 'object' or snapshot->'property'->>'id' is distinct from property_id or jsonb_typeof(snapshot->'engine') is distinct from 'string' then raise exception using errcode='22023',message='INVALID_SNAPSHOT';end if;
 select * into p from public.properties x where x.id=property_id and x.user_id=actor for update;
 if not found then raise exception using errcode='42501',message='PROPERTY_UNAVAILABLE';end if;
 if exists(select 1 from public.property_deletions d where d.id=p.id) then raise exception using errcode='40001',message='PROPERTY_DELETED';end if;
 if jsonb_typeof(snapshot->'sourceStress') is distinct from 'object' or snapshot->'sourceStress' is distinct from (p.payload->'investment'->'stress'->stress_index) then raise exception using errcode='22023',message='STRESS_SOURCE_CHANGED';end if;
 if p.updated_at is distinct from expected_version then raise exception using errcode='40001',message='VERSION_CONFLICT';end if;
 select b.updated_at into book_at from public.accounting_books b where b.user_id=actor for share;
 if book_at is distinct from expected_book_version then raise exception using errcode='40001',message='BOOK_CONFLICT';end if;
 if (select count(*) from public.analysis_scenarios s where s.property_id=p.id and s.user_id=actor)>=50 then raise exception using errcode='40001',message='SCENARIO_LIMIT';end if;
 new_id=gen_random_uuid()::text;
 insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) values(new_id,p.id,actor,label,snapshot,at);
 result=jsonb_build_object('id',new_id,'replayed',false);
 insert into public.audit_events(id,user_id,property_id,module,payload,created_at) values(audit_id,actor,p.id,'scenario:stress',jsonb_build_object('actor',actor,'at',at,'reason',label,'requestId',request_id,'command',command,'result',result,'engine',snapshot->'engine'),at);
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.stress_computed_scenario (
  actor                 uuid,
  property_id           text,
  expected_version      timestamp with time zone,
  expected_book_version timestamp with time zone,
  label                 text,
  request_id            uuid,
  stress_index          integer,
  snapshot              jsonb                    DEFAULT NULL::jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select access_private.stress_scenario(actor,property_id,expected_version,expected_book_version,label,request_id,stress_index,snapshot)$function$;

REVOKE ALL
  ON FUNCTION "public"."stress_computed_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb)
  FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "access_private"."stress_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."stress_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."stress_computed_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."stress_computed_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."stress_computed_scenario"(uuid, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid, integer, jsonb) TO "service_role";

