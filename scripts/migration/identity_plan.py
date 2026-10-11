"""HU-57 offline identity inventory and coverage. Never links accounts or imports rows."""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import uuid

TABLES = set('properties property_documents analysis_scenarios analysis_baselines property_baselines investment_projects opening_balances accounting_books audit_events workbook_imports team_members team_contributions expense_invoices expense_lines expense_allocations expense_classification_history expense_legacy_backup expense_drafts expense_reports property_deletions'.split())
RETIRED = {'settings', 'attom_receipts'}
PRIVATE_ROOT = Path(__file__).resolve().parents[2] / 'migration-private'

def strict_json(value):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Duplicate JSON key; resolve before converting')
            result[key] = value
        return result
    return json.loads(value, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))

def inventory(snapshot, manifest, source_id):
    raw = Path(snapshot).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != manifest.get('sha256') or manifest.get('database', {}).get('data_valid') is not True:
        raise ValueError('Snapshot hash or audit validation does not match')
    if not source_id or len(source_id) > 200:
        raise ValueError('A source identifier is required')
    identities, grants = {}, []
    def add(value, role, reference):
        if not isinstance(value, str) or not value.strip() or len(value) > 300:
            raise ValueError('Missing or invalid legacy identity')
        item = identities.setdefault(value, {'roles': set(), 'references': Counter()})
        item['roles'].add(role)
        item['references'][reference] += 1
    def actors(value, reference):
        if isinstance(value, dict):
            for key, nested in value.items():
                if key == 'actor' and nested not in (None, ''):
                    add(nested, 'historical_actor', reference+'.actor')
                else:
                    actors(nested, reference)
        elif isinstance(value, list):
            for nested in value:
                actors(nested, reference)
    db = sqlite3.connect(':memory:')
    try:
        # Read the exact bytes that were hashed; do not race a live/WAL source.
        db.deserialize(raw)
        db.row_factory = sqlite3.Row
        if db.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Invalid SQLite snapshot')
        actual = {row[0] for row in db.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")}
        expected = {t['name'] for t in manifest['database']['tables']}
        if actual != expected or actual-TABLES-RETIRED:
            raise ValueError('Unexpected or missing source tables; review inventory')
        if not {'properties', 'team_members'} <= actual:
            raise ValueError('Missing ownership/team tables')
        for table in sorted(actual & TABLES):
            for row in db.execute('select * from "'+table+'"'):
                names = row.keys()
                for col in ('user_id', 'owner_id'):
                    if col in names:
                        add(row[col], 'owner', table+'.'+col)
                if 'member_id' in names and row['member_id'] is not None:
                    add(row['member_id'], 'member', table+'.member_id')
                for col in ('payload', 'original_payload'):
                    if col in names:
                        payload = strict_json(row[col])
                        actors(payload, table+'.'+col)
                if table == 'team_members':
                    p = strict_json(row['payload'])
                    state = p.get('status')
                    if state not in ('Activo', 'Revocado', 'Invitación', 'Por aprobar'):
                        raise ValueError('Unrecognized team status')
                    if state == 'Activo' and not row['member_id']:
                        raise ValueError('Active collaborator has no verified legacy identity')
                    grants.append({'legacy_grant_id': row['id'], 'owner_id': row['owner_id'], 'member_id': row['member_id'], 'status': state})
    finally:
        db.close()
    return {'source_id': source_id, 'snapshot_sha256': digest,
            'identities': [{'legacy_user_id': k, 'roles': sorted(v['roles']), 'references': dict(v['references'])} for k,v in sorted(identities.items())],
            'grants': grants, 'retired_tables_excluded': sorted(actual & RETIRED),
            'original_actors_preserved': True, 'production_ready': False}

def reconcile(source, exported_links):
    """Accept only an administrator export; this report never confers authorization."""
    mapped, targets, blocked = {}, set(), []
    known = {i['legacy_user_id'] for i in source['identities']}
    for link in exported_links:
        old = link['legacy_user_id']
        if old not in known or link['source_id'] != source['source_id'] or link['snapshot_sha256'] != source['snapshot_sha256']:
            raise ValueError('Link belongs to a different source or unknown identity')
        target = str(uuid.UUID(link['auth_user_id']))
        if old in mapped or target in targets:
            raise ValueError('Duplicate or merged identity mapping')
        if link['status'] not in ('verified', 'revoked'):
            raise ValueError('Unknown verification status')
        mapped[old] = target if link['status'] == 'verified' else None
        targets.add(target)
    for old in sorted(known):
        if not mapped.get(old):
            blocked.append({'legacy_user_id': old, 'reason': 'missing_or_revoked_link'})
    actions=[]
    for grant in source['grants']:
        state=grant['status']
        action='keep_revoked' if state=='Revocado' else 'reissue_with_owner_approval_and_expiry' if state in ('Invitación','Por aprobar') else 'retain_only_after_HU58_permission_validation'
        actions.append({'legacy_grant_id': grant['legacy_grant_id'], 'status': state, 'action': action, 'grants_access': False})
    return {'source_id': source['source_id'], 'snapshot_sha256': source['snapshot_sha256'],
            'required_identities': len(known), 'verified_identities': len(known)-len(blocked),
            'identity_coverage_complete': not blocked, 'blocking_exceptions': blocked,
            'mapping': {k:v for k,v in mapped.items() if v}, 'team_actions': actions,
            'preserve_original_actor_ids': True, 'production_ready': False}

def save_private(path, value):
    path=Path(path)
    if not path.resolve().is_relative_to(PRIVATE_ROOT.resolve()):
        raise ValueError('Identity reports must remain inside an ignored migration-private directory')
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(value,handle,indent=2,ensure_ascii=False)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--source-id',required=True)
    parser.add_argument('--links',help='Private administrator export of links joined with source snapshot hash')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    source=inventory(args.snapshot,strict_json(Path(args.manifest).read_text()),args.source_id)
    result={'inventory': source, 'coverage': reconcile(source,strict_json(Path(args.links).read_text()) if args.links else [])}
    save_private(args.output,result)
    print(json.dumps({'identities':len(source['identities']),'unresolved':len(result['coverage']['blocking_exceptions']),'production_ready':False}))
