SET local check_function_bodies = off;

CREATE SCHEMA "migration_private";

CREATE TABLE "migration_private"."identity_inventory" (
  "source_id"        text    NOT NULL,
  "legacy_user_id"   text    NOT NULL,
  "roles"            text[]  NOT NULL,
  "references_count" integer NOT NULL,
  CONSTRAINT "identity_inventory_legacy_user_id_check" CHECK (((length(legacy_user_id) >= 1) AND (length(legacy_user_id) <= 300))),
  CONSTRAINT "identity_inventory_pkey" PRIMARY KEY (source_id, legacy_user_id),
  CONSTRAINT "identity_inventory_references_count_check" CHECK ((references_count > 0)),
  CONSTRAINT "identity_inventory_roles_check" CHECK (((cardinality(roles) > 0) AND (roles <@ ARRAY['owner'::text, 'member'::text, 'historical_actor'::text])))
);

ALTER TABLE "migration_private"."identity_inventory"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "migration_private"."identity_link_events" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "source_id"      text                     NOT NULL,
  "legacy_user_id" text                     NOT NULL,
  "auth_user_id"   uuid                     NOT NULL,
  "event"          text                     NOT NULL,
  "administrator"  text                     NOT NULL,
  "at"             timestamp with time zone NOT NULL DEFAULT now(),
  "review_sha256"  text                     NOT NULL,
  "reason"         text,
  CONSTRAINT "identity_link_events_event_check" CHECK ((event = ANY (ARRAY['verified'::text, 'revoked'::text]))),
  CONSTRAINT "identity_link_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "migration_private"."identity_link_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "migration_private"."identity_links" (
  "source_id"         text                     NOT NULL,
  "legacy_user_id"    text                     NOT NULL,
  "auth_user_id"      uuid                     NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'verified'::text,
  "legacy_proof_ref"  text                     NOT NULL,
  "target_proof_ref"  text                     NOT NULL,
  "review_sha256"     text                     NOT NULL,
  "reviewed_by"       text                     NOT NULL,
  "reviewed_at"       timestamp with time zone NOT NULL,
  "proof_expires_at"  timestamp with time zone NOT NULL,
  "linked_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at"        timestamp with time zone,
  "revoked_by"        text,
  "revocation_reason" text,
  CONSTRAINT "identity_links_check1"
    CHECK ((((status = 'verified'::text) AND (revoked_at IS NULL) AND (revoked_by IS NULL) AND (revocation_reason IS NULL)) OR ((status = 'revoked'::text) AND (revoked_at IS
    NOT NULL) AND (length(TRIM(BOTH FROM revoked_by)) > 0) AND (length(TRIM(BOTH FROM revocation_reason)) > 0)))),
  CONSTRAINT "identity_links_check" CHECK (((proof_expires_at > reviewed_at) AND (proof_expires_at <= (reviewed_at + '24:00:00'::interval)))),
  CONSTRAINT "identity_links_legacy_proof_ref_check" CHECK (((length(TRIM(BOTH FROM legacy_proof_ref)) >= 1) AND (length(TRIM(BOTH FROM legacy_proof_ref)) <= 500))),
  CONSTRAINT "identity_links_pkey" PRIMARY KEY (source_id, legacy_user_id),
  CONSTRAINT "identity_links_review_sha256_check" CHECK ((review_sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "identity_links_reviewed_by_check" CHECK (((length(TRIM(BOTH FROM reviewed_by)) >= 1) AND (length(TRIM(BOTH FROM reviewed_by)) <= 200))),
  CONSTRAINT "identity_links_source_id_auth_user_id_key" UNIQUE (source_id, auth_user_id),
  CONSTRAINT "identity_links_status_check" CHECK ((status = ANY (ARRAY['verified'::text, 'revoked'::text]))),
  CONSTRAINT "identity_links_target_proof_ref_check" CHECK (((length(TRIM(BOTH FROM target_proof_ref)) >= 1) AND (length(TRIM(BOTH FROM target_proof_ref)) <= 500))),
  CONSTRAINT "revocation_complete" CHECK (((status <> 'revoked'::text) OR ((revoked_by IS NOT NULL) AND (revocation_reason IS NOT NULL))))
);

ALTER TABLE "migration_private"."identity_links"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "migration_private"."identity_sources" (
  "source_id"       text                     NOT NULL,
  "snapshot_sha256" text                     NOT NULL,
  "registered_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "registered_by"   text                     NOT NULL,
  CONSTRAINT "identity_sources_pkey" PRIMARY KEY (source_id),
  CONSTRAINT "identity_sources_registered_by_check" CHECK (((length(TRIM(BOTH FROM registered_by)) >= 1) AND (length(TRIM(BOTH FROM registered_by)) <= 200))),
  CONSTRAINT "identity_sources_snapshot_sha256_check" CHECK ((snapshot_sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "identity_sources_source_id_check" CHECK (((length(source_id) >= 1) AND (length(source_id) <= 200)))
);

ALTER TABLE "migration_private"."identity_sources"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION migration_private.audit_identity_link()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 insert into migration_private.identity_link_events(source_id,legacy_user_id,auth_user_id,event,administrator,review_sha256,reason)
 values(NEW.source_id,NEW.legacy_user_id,NEW.auth_user_id,NEW.status,case when TG_OP='INSERT' then NEW.reviewed_by else NEW.revoked_by end,NEW.review_sha256,NEW.revocation_reason);
 return NEW;
end $function$;

CREATE OR REPLACE FUNCTION migration_private.guard_identity_link()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if TG_OP='DELETE' then raise exception using errcode='23514',message='Revoke the link; never delete its history'; end if;
 if TG_OP='INSERT' then
  if NEW.status<>'verified' or NEW.reviewed_at>now() or NEW.proof_expires_at<=now() then
   raise exception using errcode='23514',message='A current administrative verification is required';
  end if;
  if not exists(select 1 from auth.users where id=NEW.auth_user_id and email_confirmed_at is not null and deleted_at is null and is_anonymous is not true and (banned_until is null or banned_until<=now())) then
   raise exception using errcode='23514',message='Target account must be confirmed and available';
  end if;
  NEW.linked_at=now();
 elsif TG_OP='UPDATE' then
  if OLD.status<>'verified' or NEW.status<>'revoked' or
   (to_jsonb(NEW)-array['status','revoked_at','revoked_by','revocation_reason']) is distinct from
   (to_jsonb(OLD)-array['status','revoked_at','revoked_by','revocation_reason']) then
   raise exception using errcode='23514',message='Identity cannot be reassigned or reactivated';
  end if;
  NEW.revoked_at=now();
 end if;
 return NEW;
end $function$;

CREATE OR REPLACE FUNCTION migration_private.reject_history_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin raise exception using errcode='23514',message='Migration evidence is append-only'; end $function$;

ALTER TABLE "migration_private"."identity_links"
  ADD CONSTRAINT "identity_links_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);

ALTER TABLE "migration_private"."identity_link_events"
  ADD CONSTRAINT "identity_link_events_source_id_legacy_user_id_fkey" FOREIGN KEY (source_id, legacy_user_id) REFERENCES migration_private.identity_links(source_id, legacy_user_id);

ALTER TABLE "migration_private"."identity_links"
  ADD CONSTRAINT "identity_links_source_id_legacy_user_id_fkey" FOREIGN KEY (source_id, legacy_user_id) REFERENCES migration_private.identity_inventory(source_id, legacy_user_id);

ALTER TABLE "migration_private"."identity_inventory"
  ADD CONSTRAINT "identity_inventory_source_id_fkey" FOREIGN KEY (source_id) REFERENCES migration_private.identity_sources(source_id);

CREATE INDEX identity_link_events_source_idx ON migration_private.identity_link_events USING btree (source_id, legacy_user_id, at);

CREATE INDEX identity_links_auth_idx ON migration_private.identity_links USING btree (auth_user_id);

CREATE TRIGGER immutable_inventory
  BEFORE DELETE OR UPDATE ON migration_private.identity_inventory
  FOR EACH ROW
  EXECUTE FUNCTION migration_private.reject_history_change();

CREATE TRIGGER immutable_link_events
  BEFORE DELETE OR UPDATE ON migration_private.identity_link_events
  FOR EACH ROW
  EXECUTE FUNCTION migration_private.reject_history_change();

CREATE TRIGGER audit_link
  AFTER INSERT OR UPDATE ON migration_private.identity_links
  FOR EACH ROW
  EXECUTE FUNCTION migration_private.audit_identity_link();

CREATE TRIGGER guard_link
  BEFORE INSERT OR DELETE OR UPDATE ON migration_private.identity_links
  FOR EACH ROW
  EXECUTE FUNCTION migration_private.guard_identity_link();

CREATE TRIGGER immutable_source
  BEFORE DELETE OR UPDATE ON migration_private.identity_sources
  FOR EACH ROW
  EXECUTE FUNCTION migration_private.reject_history_change();

REVOKE ALL ON FUNCTION "migration_private"."audit_identity_link"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "migration_private"."guard_identity_link"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "migration_private"."reject_history_change"() FROM PUBLIC;

