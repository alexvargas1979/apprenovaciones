CREATE TABLE "public"."accounting_books" (
  "user_id"    uuid                     NOT NULL,
  "payload"    jsonb                    NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "accounting_books_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "accounting_books_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."accounting_books"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."accounting_books" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."analysis_baselines" (
  "property_id" text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "scenario_id" text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "analysis_baselines_pkey" PRIMARY KEY (property_id)
);

ALTER TABLE "public"."analysis_baselines"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."analysis_baselines" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."analysis_scenarios" (
  "id"          text                     NOT NULL,
  "property_id" text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "label"       text                     NOT NULL,
  "source_id"   text,
  "payload"     jsonb                    NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "analysis_scenarios_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "analysis_scenarios_pkey" PRIMARY KEY (id),
  CONSTRAINT "analysis_scenarios_user_id_id_key" UNIQUE (user_id, id),
  CONSTRAINT "analysis_scenarios_user_id_property_id_id_key" UNIQUE (user_id, property_id, id)
);

ALTER TABLE "public"."analysis_scenarios"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."analysis_scenarios" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."audit_events" (
  "id"          text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "property_id" text                     NOT NULL,
  "module"      text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "audit_events_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."audit_events" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_allocations" (
  "user_id"  uuid    NOT NULL,
  "line_id"  text    NOT NULL,
  "position" integer NOT NULL,
  "payload"  jsonb   NOT NULL,
  CONSTRAINT "expense_allocations_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_allocations_pkey" PRIMARY KEY (user_id, line_id, "position"),
  CONSTRAINT "expense_allocations_position_check" CHECK (("position" >= 0))
);

ALTER TABLE "public"."expense_allocations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_allocations" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_classification_history" (
  "user_id"  uuid    NOT NULL,
  "id"       text    NOT NULL,
  "position" integer NOT NULL,
  "payload"  jsonb   NOT NULL,
  CONSTRAINT "expense_classification_history_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_classification_history_pkey" PRIMARY KEY (user_id, id),
  CONSTRAINT "expense_classification_history_position_check" CHECK (("position" >= 0))
);

ALTER TABLE "public"."expense_classification_history"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_classification_history" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_drafts" (
  "user_id"     uuid                     NOT NULL,
  "id"          text                     NOT NULL,
  "property_id" text                     NOT NULL,
  "status"      text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "updated_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "expense_drafts_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_drafts_pkey" PRIMARY KEY (user_id, id),
  CONSTRAINT "expense_drafts_status_check" CHECK ((status = ANY (ARRAY['Pendiente de clasificar'::text, 'Borrador'::text, 'En revisión'::text, 'Rechazado'::text])))
);

ALTER TABLE "public"."expense_drafts"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_drafts" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_invoices" (
  "user_id"    uuid    NOT NULL,
  "id"         text    NOT NULL,
  "position"   integer NOT NULL,
  "request_id" text,
  "payload"    jsonb   NOT NULL,
  CONSTRAINT "expense_invoices_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_invoices_pkey" PRIMARY KEY (user_id, id),
  CONSTRAINT "expense_invoices_position_check" CHECK (("position" >= 0)),
  CONSTRAINT "expense_invoices_user_id_request_id_key" UNIQUE (user_id, request_id)
);

ALTER TABLE "public"."expense_invoices"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_invoices" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_legacy_backup" (
  "user_id"    uuid                     NOT NULL,
  "payload"    text                     NOT NULL,
  "version"    text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "expense_legacy_backup_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."expense_legacy_backup"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_legacy_backup" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_lines" (
  "user_id"     uuid    NOT NULL,
  "id"          text    NOT NULL,
  "invoice_id"  text    NOT NULL,
  "property_id" text    NOT NULL,
  "position"    integer NOT NULL,
  "payload"     jsonb   NOT NULL,
  CONSTRAINT "expense_lines_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_lines_pkey" PRIMARY KEY (user_id, id),
  CONSTRAINT "expense_lines_position_check" CHECK (("position" >= 0))
);

ALTER TABLE "public"."expense_lines"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_lines" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."expense_reports" (
  "user_id"     uuid                     NOT NULL,
  "id"          text                     NOT NULL,
  "property_id" text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "expense_reports_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "expense_reports_pkey" PRIMARY KEY (user_id, id)
);

ALTER TABLE "public"."expense_reports"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."expense_reports" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."investment_projects" (
  "property_id"    text                     NOT NULL,
  "user_id"        uuid                     NOT NULL,
  "schema_version" integer                  NOT NULL,
  "origin"         text                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL,
  CONSTRAINT "investment_projects_pkey" PRIMARY KEY (property_id),
  CONSTRAINT "investment_projects_schema_version_check" CHECK ((schema_version > 0))
);

ALTER TABLE "public"."investment_projects"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."investment_projects" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."opening_balances" (
  "user_id"     uuid    NOT NULL,
  "property_id" text    NOT NULL,
  "line_id"     text    NOT NULL,
  "amount"      numeric NOT NULL,
  "source"      text    NOT NULL,
  CONSTRAINT "opening_balances_amount_check" CHECK (((amount >= (0)::numeric) AND (amount <= (1000000000)::numeric) AND (scale(amount) <= 2))),
  CONSTRAINT "opening_balances_pkey" PRIMARY KEY (property_id, line_id)
);

ALTER TABLE "public"."opening_balances"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."opening_balances" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."properties" (
  "id"         text                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "payload"    jsonb                    NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "properties_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "properties_pkey" PRIMARY KEY (id),
  CONSTRAINT "properties_user_id_id_key" UNIQUE (user_id, id)
);

ALTER TABLE "public"."properties"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."properties" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."property_baselines" (
  "property_id"         text                     NOT NULL,
  "user_id"             uuid                     NOT NULL,
  "original_payload"    text                     NOT NULL,
  "original_updated_at" text                     NOT NULL,
  "captured_at"         timestamp with time zone NOT NULL,
  CONSTRAINT "property_baselines_pkey" PRIMARY KEY (property_id),
  CONSTRAINT "property_baselines_user_id_property_id_key" UNIQUE (user_id, property_id)
);

ALTER TABLE "public"."property_baselines"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."property_baselines" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."property_deletions" (
  "id"          text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "version"     text                     NOT NULL,
  "deleted_at"  timestamp with time zone NOT NULL,
  "object_keys" jsonb                    NOT NULL,
  CONSTRAINT "property_deletions_object_keys_check" CHECK ((jsonb_typeof(object_keys) = 'array'::text)),
  CONSTRAINT "property_deletions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."property_deletions"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."property_deletions" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."property_documents" (
  "id"          text                     NOT NULL,
  "group_id"    text                     NOT NULL,
  "property_id" text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "version"     integer                  NOT NULL,
  "object_key"  text                     NOT NULL,
  "filename"    text                     NOT NULL,
  "mime"        text                     NOT NULL,
  "size"        bigint                   NOT NULL,
  "sha256"      text                     NOT NULL,
  "title"       text                     NOT NULL,
  "category"    text                     NOT NULL,
  "link_type"   text                     NOT NULL,
  "link_ref"    text                     NOT NULL,
  "note"        text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "property_documents_object_key_key" UNIQUE (object_key),
  CONSTRAINT "property_documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_documents_sha256_check" CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "property_documents_size_check" CHECK (((size >= 0) AND (size <= 10485760))),
  CONSTRAINT "property_documents_user_id_group_id_version_key" UNIQUE (user_id, group_id, VERSION),
  CONSTRAINT "property_documents_version_check" CHECK ((version > 0))
);

ALTER TABLE "public"."property_documents"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."property_documents" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."team_contributions" (
  "id"          text                     NOT NULL,
  "grant_id"    text                     NOT NULL,
  "owner_id"    uuid                     NOT NULL,
  "property_id" text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "team_contributions_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "team_contributions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."team_contributions"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."team_contributions" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."team_members" (
  "id"         text                     NOT NULL,
  "owner_id"   uuid                     NOT NULL,
  "member_id"  uuid,
  "token_hash" text                     NOT NULL,
  "payload"    jsonb                    NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "team_members_owner_id_id_key" UNIQUE (owner_id, id),
  CONSTRAINT "team_members_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "team_members_pkey" PRIMARY KEY (id),
  CONSTRAINT "team_members_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "public"."team_members"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."team_members" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."workbook_imports" (
  "id"          text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "property_id" text                     NOT NULL,
  "hash"        text                     NOT NULL,
  "payload"     jsonb                    NOT NULL,
  "created_at"  timestamp with time zone NOT NULL,
  CONSTRAINT "workbook_imports_payload_check" CHECK ((jsonb_typeof(payload) = 'object'::text)),
  CONSTRAINT "workbook_imports_pkey" PRIMARY KEY (id),
  CONSTRAINT "workbook_imports_user_id_hash_key" UNIQUE (user_id, hash)
);

ALTER TABLE "public"."workbook_imports"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."workbook_imports" FROM "anon", "authenticated", "service_role";

ALTER TABLE "public"."expense_allocations"
  ADD COLUMN "subtotal" numeric GENERATED ALWAYS AS (((payload ->> 'subtotal'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_allocations"
  ADD COLUMN "tax" numeric GENERATED ALWAYS AS (((payload ->> 'tax'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_invoices"
  ADD COLUMN "declared_total" numeric GENERATED ALWAYS AS (((payload ->> 'declaredTotal'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_lines"
  ADD COLUMN "subtotal" numeric GENERATED ALWAYS AS (((payload ->> 'subtotal'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_lines"
  ADD COLUMN "tax" numeric GENERATED ALWAYS AS (((payload ->> 'tax'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_lines"
  ADD COLUMN "retention" numeric GENERATED ALWAYS AS (((payload ->> 'retention'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."expense_lines"
  ADD COLUMN "included" numeric GENERATED ALWAYS AS (((payload ->> 'included'::text))::numeric) STORED NOT NULL;

ALTER TABLE "public"."accounting_books"
  ADD CONSTRAINT "accounting_books_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."analysis_baselines"
  ADD CONSTRAINT "analysis_baselines_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."analysis_scenarios"
  ADD CONSTRAINT "analysis_scenarios_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."analysis_baselines"
  ADD CONSTRAINT "analysis_baselines_user_id_property_id_scenario_id_fkey" FOREIGN KEY (user_id, property_id, scenario_id)
    REFERENCES public.analysis_scenarios(user_id, property_id, id);

ALTER TABLE "public"."audit_events"
  ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_allocations"
  ADD CONSTRAINT "expense_allocations_subtotal_check" CHECK (((subtotal >= (0)::numeric) AND (subtotal <= (1000000000)::numeric) AND (scale(subtotal) <= 2)));

ALTER TABLE "public"."expense_allocations"
  ADD CONSTRAINT "expense_allocations_tax_check" CHECK (((tax >= (0)::numeric) AND (tax <= (1000000000)::numeric) AND (scale(tax) <= 2)));

ALTER TABLE "public"."expense_allocations"
  ADD CONSTRAINT "expense_allocations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_classification_history"
  ADD CONSTRAINT "expense_classification_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_drafts"
  ADD CONSTRAINT "expense_drafts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_invoices"
  ADD CONSTRAINT "expense_invoices_declared_total_check" CHECK (((declared_total >= (0)::numeric) AND (declared_total <= (1000000000)::numeric) AND (scale(declared_total) <= 2)));

ALTER TABLE "public"."expense_invoices"
  ADD CONSTRAINT "expense_invoices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_legacy_backup"
  ADD CONSTRAINT "expense_legacy_backup_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_included_check" CHECK (((included >= (0)::numeric) AND (included <= (1000000000)::numeric) AND (scale(included) <= 2)));

ALTER TABLE "public"."expense_allocations"
  ADD CONSTRAINT "expense_allocations_user_id_line_id_fkey" FOREIGN KEY (user_id, line_id) REFERENCES public.expense_lines(user_id, id);

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_retention_check" CHECK (((retention >= (0)::numeric) AND (retention <= (1000000000)::numeric) AND (scale(retention) <= 2)));

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_subtotal_check" CHECK (((subtotal >= (0)::numeric) AND (subtotal <= (1000000000)::numeric) AND (scale(subtotal) <= 2)));

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_tax_check" CHECK (((tax >= (0)::numeric) AND (tax <= (1000000000)::numeric) AND (scale(tax) <= 2)));

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_user_id_invoice_id_fkey" FOREIGN KEY (user_id, invoice_id) REFERENCES public.expense_invoices(user_id, id);

ALTER TABLE "public"."expense_reports"
  ADD CONSTRAINT "expense_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."investment_projects"
  ADD CONSTRAINT "investment_projects_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."opening_balances"
  ADD CONSTRAINT "opening_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."properties"
  ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."analysis_baselines"
  ADD CONSTRAINT "analysis_baselines_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."analysis_scenarios"
  ADD CONSTRAINT "analysis_scenarios_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."expense_drafts"
  ADD CONSTRAINT "expense_drafts_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."expense_lines"
  ADD CONSTRAINT "expense_lines_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."expense_reports"
  ADD CONSTRAINT "expense_reports_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."investment_projects"
  ADD CONSTRAINT "investment_projects_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."property_baselines"
  ADD CONSTRAINT "property_baselines_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."property_baselines"
  ADD CONSTRAINT "property_baselines_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."opening_balances"
  ADD CONSTRAINT "opening_balances_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.property_baselines(user_id, property_id);

ALTER TABLE "public"."property_deletions"
  ADD CONSTRAINT "property_deletions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."property_documents"
  ADD CONSTRAINT "property_documents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."property_documents"
  ADD CONSTRAINT "property_documents_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."team_contributions"
  ADD CONSTRAINT "team_contributions_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE "public"."team_contributions"
  ADD CONSTRAINT "team_contributions_owner_id_property_id_fkey" FOREIGN KEY (owner_id, property_id) REFERENCES public.properties(user_id, id);

ALTER TABLE "public"."team_members"
  ADD CONSTRAINT "team_members_member_id_fkey" FOREIGN KEY (member_id) REFERENCES auth.users(id);

ALTER TABLE "public"."team_members"
  ADD CONSTRAINT "team_members_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE "public"."team_contributions"
  ADD CONSTRAINT "team_contributions_owner_id_grant_id_fkey" FOREIGN KEY (owner_id, grant_id) REFERENCES public.team_members(owner_id, id);

ALTER TABLE "public"."workbook_imports"
  ADD CONSTRAINT "workbook_imports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."workbook_imports"
  ADD CONSTRAINT "workbook_imports_user_id_property_id_fkey" FOREIGN KEY (user_id, property_id) REFERENCES public.properties(user_id, id);

CREATE INDEX hu55_accounting_books_0 ON public.accounting_books USING btree (user_id);

CREATE INDEX hu55_accounting_books_1 ON public.accounting_books USING btree (user_id, updated_at);

CREATE INDEX hu55_analysis_baselines_0 ON public.analysis_baselines USING btree (user_id);

CREATE INDEX hu55_analysis_baselines_1 ON public.analysis_baselines USING btree (user_id, property_id);

CREATE INDEX hu55_analysis_baselines_2 ON public.analysis_baselines USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_analysis_baselines_3 ON public.analysis_baselines USING btree (user_id, property_id, scenario_id);

CREATE INDEX hu55_analysis_scenarios_0 ON public.analysis_scenarios USING btree (user_id);

CREATE INDEX hu55_analysis_scenarios_1 ON public.analysis_scenarios USING btree (user_id, property_id);

CREATE INDEX hu55_analysis_scenarios_2 ON public.analysis_scenarios USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_audit_events_0 ON public.audit_events USING btree (user_id);

CREATE INDEX hu55_audit_events_1 ON public.audit_events USING btree (user_id, property_id);

CREATE INDEX hu55_audit_events_2 ON public.audit_events USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_expense_allocations_0 ON public.expense_allocations USING btree (user_id);

CREATE INDEX hu55_expense_allocations_1 ON public.expense_allocations USING btree (user_id, line_id);

CREATE INDEX hu55_expense_classification_history_0 ON public.expense_classification_history USING btree (user_id);

CREATE INDEX hu55_expense_drafts_0 ON public.expense_drafts USING btree (user_id);

CREATE INDEX hu55_expense_drafts_1 ON public.expense_drafts USING btree (user_id, property_id);

CREATE INDEX hu55_expense_drafts_2 ON public.expense_drafts USING btree (user_id, property_id, updated_at);

CREATE INDEX hu55_expense_invoices_0 ON public.expense_invoices USING btree (user_id);

CREATE INDEX hu55_expense_legacy_backup_0 ON public.expense_legacy_backup USING btree (user_id);

CREATE INDEX hu55_expense_legacy_backup_1 ON public.expense_legacy_backup USING btree (user_id, created_at);

CREATE INDEX hu55_expense_lines_0 ON public.expense_lines USING btree (user_id);

CREATE INDEX hu55_expense_lines_1 ON public.expense_lines USING btree (user_id, invoice_id);

CREATE INDEX hu55_expense_lines_2 ON public.expense_lines USING btree (user_id, property_id);

CREATE INDEX hu55_expense_reports_0 ON public.expense_reports USING btree (user_id);

CREATE INDEX hu55_expense_reports_1 ON public.expense_reports USING btree (user_id, property_id);

CREATE INDEX hu55_expense_reports_2 ON public.expense_reports USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_investment_projects_0 ON public.investment_projects USING btree (user_id);

CREATE INDEX hu55_investment_projects_1 ON public.investment_projects USING btree (user_id, property_id);

CREATE INDEX hu55_investment_projects_2 ON public.investment_projects USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_opening_balances_0 ON public.opening_balances USING btree (user_id);

CREATE INDEX hu55_opening_balances_1 ON public.opening_balances USING btree (user_id, line_id);

CREATE INDEX hu55_opening_balances_2 ON public.opening_balances USING btree (user_id, property_id);

CREATE INDEX hu55_properties_0 ON public.properties USING btree (user_id);

CREATE INDEX hu55_properties_1 ON public.properties USING btree (user_id, updated_at);

CREATE INDEX hu55_property_baselines_0 ON public.property_baselines USING btree (user_id);

CREATE INDEX hu55_property_baselines_1 ON public.property_baselines USING btree (user_id, property_id);

CREATE INDEX hu55_property_deletions_0 ON public.property_deletions USING btree (user_id);

CREATE INDEX hu55_property_deletions_1 ON public.property_deletions USING btree (user_id, deleted_at);

CREATE INDEX hu55_property_documents_0 ON public.property_documents USING btree (user_id);

CREATE INDEX hu55_property_documents_1 ON public.property_documents USING btree (user_id, property_id);

CREATE INDEX hu55_property_documents_2 ON public.property_documents USING btree (user_id, property_id, created_at);

CREATE INDEX hu55_team_contributions_0 ON public.team_contributions USING btree (owner_id);

CREATE INDEX hu55_team_contributions_1 ON public.team_contributions USING btree (owner_id, grant_id);

CREATE INDEX hu55_team_contributions_2 ON public.team_contributions USING btree (owner_id, property_id);

CREATE INDEX hu55_team_contributions_3 ON public.team_contributions USING btree (owner_id, property_id, created_at);

CREATE INDEX hu55_team_members_0 ON public.team_members USING btree (member_id);

CREATE INDEX hu55_team_members_1 ON public.team_members USING btree (owner_id);

CREATE INDEX hu55_team_members_2 ON public.team_members USING btree (owner_id, updated_at);

CREATE INDEX hu55_workbook_imports_0 ON public.workbook_imports USING btree (user_id);

CREATE INDEX hu55_workbook_imports_1 ON public.workbook_imports USING btree (user_id, property_id);

CREATE INDEX hu55_workbook_imports_2 ON public.workbook_imports USING btree (user_id, property_id, created_at);

COMMENT ON TABLE "public"."accounting_books" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 accounting_books.';

COMMENT ON TABLE "public"."analysis_baselines" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 analysis_baselines.';

COMMENT ON TABLE "public"."analysis_scenarios" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 analysis_scenarios.';

COMMENT ON TABLE "public"."audit_events" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 audit_events.';

COMMENT ON TABLE "public"."expense_allocations" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_allocations.';

COMMENT ON TABLE "public"."expense_classification_history" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_classification_history.';

COMMENT ON TABLE "public"."expense_drafts" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_drafts.';

COMMENT ON TABLE "public"."expense_invoices" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_invoices.';

COMMENT ON TABLE "public"."expense_legacy_backup" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_legacy_backup.';

COMMENT ON TABLE "public"."expense_lines" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_lines.';

COMMENT ON TABLE "public"."expense_reports" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 expense_reports.';

COMMENT ON TABLE "public"."investment_projects" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 investment_projects.';

COMMENT ON TABLE "public"."opening_balances" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 opening_balances.';

COMMENT ON TABLE "public"."properties" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 properties.';

COMMENT ON TABLE "public"."property_baselines" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 property_baselines.';

COMMENT ON TABLE "public"."property_deletions" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 property_deletions.';

COMMENT ON TABLE "public"."property_documents" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 property_documents.';

COMMENT ON TABLE "public"."team_contributions" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 team_contributions.';

COMMENT ON TABLE "public"."team_members" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 team_members.';

COMMENT ON TABLE "public"."workbook_imports" IS 'HU-55: modelo local; acceso API cerrado hasta HU-58. Origen D1 workbook_imports.';

REVOKE ALL ON TABLE "public"."accounting_books" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounting_books" TO "postgres";

REVOKE ALL ON TABLE "public"."analysis_baselines" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_baselines" TO "postgres";

REVOKE ALL ON TABLE "public"."analysis_scenarios" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analysis_scenarios" TO "postgres";

REVOKE ALL ON TABLE "public"."audit_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_allocations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_allocations" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_classification_history" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_classification_history" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_drafts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_drafts" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_invoices" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_invoices" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_legacy_backup" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_legacy_backup" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_lines" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_lines" TO "postgres";

REVOKE ALL ON TABLE "public"."expense_reports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expense_reports" TO "postgres";

REVOKE ALL ON TABLE "public"."investment_projects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."investment_projects" TO "postgres";

REVOKE ALL ON TABLE "public"."opening_balances" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opening_balances" TO "postgres";

REVOKE ALL ON TABLE "public"."properties" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."properties" TO "postgres";

REVOKE ALL ON TABLE "public"."property_baselines" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."property_baselines" TO "postgres";

REVOKE ALL ON TABLE "public"."property_deletions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."property_deletions" TO "postgres";

REVOKE ALL ON TABLE "public"."property_documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."property_documents" TO "postgres";

REVOKE ALL ON TABLE "public"."team_contributions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."team_contributions" TO "postgres";

REVOKE ALL ON TABLE "public"."team_members" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."team_members" TO "postgres";

REVOKE ALL ON TABLE "public"."workbook_imports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workbook_imports" TO "postgres";

