SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION access_private.rename_property (
  property_id      text,
  expected_version timestamp with time zone,
  new_name         text,
  reason           text,
  request_id       uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  SET "TimeZone" TO 'UTC'
  AS $function$
declare actor uuid=auth.uid(); p public.properties; receipt jsonb; command jsonb; result jsonb; audit_id text; at timestamptz; next_payload jsonb;
begin
 if actor is null then raise exception using errcode='42501',message='AUTH';end if;
 if property_id is null or char_length(property_id) not between 1 and 80 or expected_version is null or not isfinite(expected_version) or request_id is null or new_name is null or char_length(btrim(new_name)) not between 1 and 180 or reason is null or char_length(btrim(reason)) not between 1 and 1000 then raise exception using errcode='22023',message='INVALID_RENAME';end if;
 new_name=btrim(new_name);reason=btrim(reason);
 command=jsonb_build_object('propertyId',property_id,'expectedVersion',expected_version,'name',new_name,'reason',reason);
 audit_id='hu60:name:'||actor::text||':'||request_id::text;
 -- Same request serializes even when callers race against different properties.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(audit_id,0));
 select payload into receipt from public.audit_events a where a.id=audit_id and a.user_id=actor;
 if found then
  if receipt->'command' is distinct from command then raise exception using errcode='40001',message='REQUEST_CONFLICT';end if;
  return (receipt->'result')||jsonb_build_object('replayed',true);
 end if;
 select * into p from public.properties x where x.id=property_id and x.user_id=actor for update;
 if not found then raise exception using errcode='42501',message='PROPERTY_UNAVAILABLE';end if;
 if exists(select 1 from public.property_deletions d where d.id=property_id) then raise exception using errcode='40001',message='PROPERTY_DELETED';end if;
 if p.updated_at is distinct from expected_version then raise exception using errcode='40001',message='VERSION_CONFLICT';end if;
 if p.payload->>'name' is not distinct from new_name then raise exception using errcode='22023',message='NAME_UNCHANGED';end if;
 if p.payload ? 'dataHistory' and jsonb_typeof(p.payload->'dataHistory') <> 'array' then raise exception using errcode='22023',message='INVALID_HISTORY';end if;
 at=greatest(clock_timestamp(),p.updated_at+interval '1 millisecond');
 -- Preserve the complete legacy row before its first edit, as in HU-01.
 if not exists(select 1 from public.investment_projects i where i.property_id=p.id and i.user_id=actor) then
  insert into public.property_baselines(property_id,user_id,original_payload,original_updated_at,captured_at)
   values(p.id,actor,p.payload::text,p.updated_at::text,at) on conflict on constraint property_baselines_pkey do nothing;
  insert into public.opening_balances(user_id,property_id,line_id,amount,source)
   select actor,p.id,j.key,(j.value->>'actual')::numeric,'legacy_manual_total'
   from public.property_baselines b cross join lateral jsonb_each(coalesce((b.original_payload::jsonb)->'lines','{}')) j
   where b.property_id=p.id and b.user_id=actor and jsonb_typeof(j.value->'actual')='number'
   on conflict on constraint opening_balances_pkey do nothing;
  insert into public.investment_projects(property_id,user_id,schema_version,origin,created_at) values(p.id,actor,1,'legacy',at);
 end if;
 next_payload=jsonb_set(p.payload,'{name}',to_jsonb(new_name));
 next_payload=jsonb_set(next_payload,'{dataHistory}',coalesce(p.payload->'dataHistory','[]')||jsonb_build_array(jsonb_build_object('at',at,'actor',actor,'source','Manual','field','name','before',p.payload->'name','after',new_name)));
 update public.properties x set payload=next_payload,updated_at=at where x.id=p.id and x.user_id=actor;
 result=jsonb_build_object('id',p.id,'name',new_name,'updatedAt',at,'replayed',false);
 insert into public.audit_events(id,user_id,property_id,module,payload,created_at)
 values(audit_id,actor,p.id,'property:name',jsonb_build_object('actor',actor,'at',at,'reason',reason,'requestId',request_id,'command',command,'result',result,'changes',jsonb_build_array(jsonb_build_object('field','name','before',p.payload->'name','after',new_name))),at);
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.rename_owned_property (
  property_id      text,
  expected_version timestamp with time zone,
  new_name         text,
  reason           text,
  request_id       uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select access_private.rename_property(property_id,expected_version,new_name,reason,request_id)$function$;

REVOKE ALL ON FUNCTION "public"."rename_owned_property"(text, timestamp WITH time zone, text, text, uuid) FROM PUBLIC, "anon", "service_role";

REVOKE ALL ON FUNCTION "access_private"."rename_property"(text, timestamp WITH time zone, text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "access_private"."rename_property"(text, timestamp WITH time zone, text, text, uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rename_owned_property"(text, timestamp WITH time zone, text, text, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."rename_owned_property"(text, timestamp WITH time zone, text, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rename_owned_property"(text, timestamp WITH time zone, text, text, uuid) TO "postgres";

