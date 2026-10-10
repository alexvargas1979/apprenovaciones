import { sqliteTable,text,index,integer,primaryKey,uniqueIndex } from 'drizzle-orm/sqlite-core';
export const properties=sqliteTable('properties',{id:text('id').primaryKey(),userId:text('user_id').notNull(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('idx_properties_user_id').on(t.userId)]);
export const propertyDocuments=sqliteTable('property_documents',{
  id:text('id').primaryKey(),groupId:text('group_id').notNull(),propertyId:text('property_id').notNull().references(()=>properties.id),userId:text('user_id').notNull(),
  version:integer('version').notNull(),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),sha256:text('sha256').notNull(),
  title:text('title').notNull(),category:text('category').notNull(),linkType:text('link_type').notNull(),linkRef:text('link_ref').notNull(),note:text('note').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('idx_property_documents_owner_property').on(t.userId,t.propertyId),uniqueIndex('idx_property_documents_group_version').on(t.groupId,t.version),uniqueIndex('idx_property_documents_object').on(t.objectKey)]);
export const analysisScenarios=sqliteTable('analysis_scenarios',{id:text('id').primaryKey(),propertyId:text('property_id').notNull().references(()=>properties.id),userId:text('user_id').notNull(),label:text('label').notNull(),sourceId:text('source_id'),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_analysis_scenarios_owner_property').on(t.userId,t.propertyId)]);
export const analysisBaselines=sqliteTable('analysis_baselines',{propertyId:text('property_id').primaryKey().references(()=>properties.id),userId:text('user_id').notNull(),scenarioId:text('scenario_id').notNull().references(()=>analysisScenarios.id),createdAt:text('created_at').notNull()});

// Additive HU-01 schema: legacy properties and credentials remain untouched.
export const propertyBaselines=sqliteTable('property_baselines',{
  propertyId:text('property_id').primaryKey().references(()=>properties.id),
  userId:text('user_id').notNull(),
  originalPayload:text('original_payload').notNull(),
  originalUpdatedAt:text('original_updated_at').notNull(),
  capturedAt:text('captured_at').notNull(),
});
export const investmentProjects=sqliteTable('investment_projects',{
  propertyId:text('property_id').primaryKey().references(()=>properties.id),
  userId:text('user_id').notNull(),
  schemaVersion:integer('schema_version').notNull(),
  origin:text('origin').notNull(),
  createdAt:text('created_at').notNull(),
},t=>[index('idx_investment_projects_user_id').on(t.userId)]);
export const openingBalances=sqliteTable('opening_balances',{
  propertyId:text('property_id').notNull().references(()=>propertyBaselines.propertyId),
  lineId:text('line_id').notNull(),
  amount:text('amount').notNull(),
  source:text('source').notNull(),
},t=>[primaryKey({columns:[t.propertyId,t.lineId]})]);

// One versioned private journal per owner; allocations across properties commit atomically.
export const accountingBooks=sqliteTable('accounting_books',{userId:text('user_id').primaryKey(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()});

export const auditEvents=sqliteTable('audit_events',{id:text('id').primaryKey(),userId:text('user_id').notNull(),propertyId:text('property_id').notNull(),module:text('module').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_audit_owner_property_date').on(t.userId,t.propertyId,t.createdAt)]);
export const workbookImports=sqliteTable('workbook_imports',{id:text('id').primaryKey(),userId:text('user_id').notNull(),propertyId:text('property_id').notNull().references(()=>properties.id),hash:text('hash').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[uniqueIndex('idx_import_owner_hash').on(t.userId,t.hash)]);

export const teamMembers=sqliteTable('team_members',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),memberId:text('member_id'),tokenHash:text('token_hash').notNull(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('idx_team_owner').on(t.ownerId),index('idx_team_member').on(t.memberId),uniqueIndex('idx_team_token').on(t.tokenHash)]);
export const teamContributions=sqliteTable('team_contributions',{id:text('id').primaryKey(),grantId:text('grant_id').notNull().references(()=>teamMembers.id),ownerId:text('owner_id').notNull(),propertyId:text('property_id').notNull().references(()=>properties.id),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_team_contributions_owner').on(t.ownerId)]);

// HU-43: invoice records/lines/allocations and recoverable drafts outside the journal JSON.
export const expenseInvoices=sqliteTable('expense_invoices',{userId:text('user_id').notNull(),id:text('id').notNull(),position:integer('position').notNull(),requestId:text('request_id'),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.id]}),uniqueIndex('idx_expense_request').on(t.userId,t.requestId)]);
export const expenseLines=sqliteTable('expense_lines',{userId:text('user_id').notNull(),id:text('id').notNull(),invoiceId:text('invoice_id').notNull(),propertyId:text('property_id').notNull(),position:integer('position').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.id]}),index('idx_expense_lines_invoice').on(t.userId,t.invoiceId),index('idx_expense_lines_property').on(t.userId,t.propertyId)]);
export const expenseAllocations=sqliteTable('expense_allocations',{userId:text('user_id').notNull(),lineId:text('line_id').notNull(),position:integer('position').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.lineId,t.position]})]);
export const expenseClassificationHistory=sqliteTable('expense_classification_history',{userId:text('user_id').notNull(),id:text('id').notNull(),position:integer('position').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const expenseLegacyBackup=sqliteTable('expense_legacy_backup',{userId:text('user_id').primaryKey(),payload:text('payload').notNull(),version:text('version').notNull(),createdAt:text('created_at').notNull()});
export const expenseDrafts=sqliteTable('expense_drafts',{userId:text('user_id').notNull(),id:text('id').notNull(),propertyId:text('property_id').notNull(),status:text('status').notNull(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()},t=>[primaryKey({columns:[t.userId,t.id]}),index('idx_expense_drafts_property').on(t.userId,t.propertyId,t.updatedAt)]);
export const expenseReports=sqliteTable('expense_reports',{userId:text('user_id').notNull(),id:text('id').notNull(),propertyId:text('property_id').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.id]}),index('idx_expense_reports_property').on(t.userId,t.propertyId,t.createdAt)]);

export const propertyDeletions=sqliteTable('property_deletions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),name:text('name').notNull(),version:text('version').notNull(),deletedAt:text('deleted_at').notNull(),objectKeys:text('object_keys').notNull()},t=>[index('idx_property_deletions_user').on(t.userId)]);
