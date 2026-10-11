SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION access_private.duplicate_scenario (
  property_id           text,
  source_id             text,
  expected_version      timestamp with time zone,
  expected_book_version timestamp with time zone,
  label                 text,
  request_id            uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  SET "TimeZone" TO 'UTC'
  AS $function$
declare actor uuid=auth.uid(); p public.properties; source public.analysis_scenarios; book_at timestamptz; command jsonb; receipt jsonb; result jsonb; audit_id text; new_id text; at timestamptz=clock_timestamp();
begin
 if actor is null then raise exception using errcode='42501',message='AUTH';end if;
 if property_id is null or char_length(property_id) not between 1 and 80 or source_id is null or char_length(source_id) not between 1 and 80 or expected_version is null or not isfinite(expected_version) or (expected_book_version is not null and not isfinite(expected_book_version)) or label is null or char_length(btrim(label)) not between 1 and 100 or request_id is null then raise exception using errcode='22023',message='INVALID_SCENARIO';end if;
 label=btrim(label);
 command=jsonb_build_object('propertyId',property_id,'sourceId',source_id,'version',expected_version,'bookVersion',expected_book_version,'label',label);
 audit_id='hu60:scenario:'||actor::text||':'||request_id::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(audit_id,0));
 select a.payload into receipt from public.audit_events a where a.id=audit_id and a.user_id=actor;
 if found then
  if receipt->'command' is distinct from command then raise exception using errcode='40001',message='REQUEST_CONFLICT';end if;
  return (receipt->'result')||jsonb_build_object('replayed',true);
 end if;
 select * into p from public.properties x where x.id=property_id and x.user_id=actor for update;
 if not found then raise exception using errcode='42501',message='PROPERTY_UNAVAILABLE';end if;
 if exists(select 1 from public.property_deletions d where d.id=p.id) then raise exception using errcode='40001',message='PROPERTY_DELETED';end if;
 if p.updated_at is distinct from expected_version then raise exception using errcode='40001',message='VERSION_CONFLICT';end if;
 select b.updated_at into book_at from public.accounting_books b where b.user_id=actor for share;
 if book_at is distinct from expected_book_version then raise exception using errcode='40001',message='BOOK_CONFLICT';end if;
 select * into source from public.analysis_scenarios s where s.id=duplicate_scenario.source_id and s.property_id=p.id and s.user_id=actor;
 if not found then raise exception using errcode='42501',message='SOURCE_UNAVAILABLE';end if;
 if (select count(*) from public.analysis_scenarios s where s.property_id=p.id and s.user_id=actor)>=50 then raise exception using errcode='40001',message='SCENARIO_LIMIT';end if;
 new_id=gen_random_uuid()::text;
 insert into public.analysis_scenarios(id,property_id,user_id,label,source_id,payload,created_at) values(new_id,p.id,actor,label,source.id,source.payload,at);
 result=jsonb_build_object('id',new_id,'sourceId',source.id,'replayed',false);
 insert into public.audit_events(id,user_id,property_id,module,payload,created_at) values(audit_id,actor,p.id,'scenario:duplicate',jsonb_build_object('actor',actor,'at',at,'reason',label,'requestId',request_id,'command',command,'result',result,'changes',jsonb_build_array(jsonb_build_object('field','scenario','before',null,'after',jsonb_build_object('id',new_id,'sourceId',source.id)))),at);
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.duplicate_owned_scenario (
  property_id           text,
  source_id             text,
  expected_version      timestamp with time zone,
  expected_book_version timestamp with time zone,
  label                 text,
  request_id            uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select access_private.duplicate_scenario(property_id,source_id,expected_version,expected_book_version,label,request_id)$function$;

REVOKE ALL ON FUNCTION "public"."duplicate_owned_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) FROM PUBLIC, "anon", "service_role";

REVOKE ALL ON FUNCTION "access_private"."duplicate_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."duplicate_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."duplicate_owned_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."duplicate_owned_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."duplicate_owned_scenario"(text, text, timestamp WITH time zone, timestamp WITH time zone, text, uuid) TO "postgres";

