"""Read-only SQLite snapshot audit. Never imports data or contacts production."""
from contextlib import closing
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def audit(db):
    integrity = [r[0] for r in db.execute('pragma integrity_check')]
    foreign_keys = list(db.execute('pragma foreign_key_check'))
    tables = []
    for (name,) in db.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"):
        cols = list(db.execute('pragma table_info(' + quoted(name) + ')'))
        count = db.execute('select count(*) from ' + quoted(name)).fetchone()[0]
        invalid = {}
        for col in cols:
            if col[1] not in ('payload', 'original_payload', 'object_keys'):
                continue
            # Historical snapshots stay byte-for-byte unchanged; only validate here.
            errors = 0
            for (value,) in db.execute('select ' + quoted(col[1]) + ' from ' + quoted(name)):
                try:
                    json.loads(value)
                except (ValueError, TypeError):
                    errors += 1
            if errors:
                invalid[col[1]] = errors
        tables.append({'name': name, 'rows': count, 'columns': [c[1] for c in cols], 'invalid_json': invalid})
    return {'integrity_ok': integrity == ['ok'], 'foreign_key_errors': len(foreign_keys),
            'tables': tables, 'data_valid': integrity == ['ok'] and not foreign_keys and not any(t['invalid_json'] for t in tables)}


def validate_pages(pages, expected_tables):
    """Refuse clipped/partial MCP projections; this is not a DB backup validator."""
    grouped = {}
    if not expected_tables or len(expected_tables) != len(set(expected_tables)):
        raise ValueError('Expected table list must be nonempty and unique')
    for page in pages:
        name = page['table_name']
        if name not in expected_tables:
            raise ValueError('Unexpected table')
        p = page.get('model_projection', {})
        if not p or p.get('truncated') or any(p.get(k, 0) for k in ('truncated_values','omitted_columns','omitted_rows')):
            raise ValueError('Truncated or unverifiable source page: ' + name)
        grouped.setdefault(name, []).append(page)
    if set(grouped) != set(expected_tables):
        raise ValueError('Missing expected tables')
    for name, chunks in grouped.items():
        offset = 0
        for i, page in enumerate(chunks):
            if page['offset'] != offset:
                raise ValueError('Page gap or duplicate: ' + name)
            nxt = page['model_projection']['next_offset']
            if page['has_more'] != (nxt is not None) or (nxt is not None and nxt <= offset):
                raise ValueError('Invalid continuation: ' + name)
            if nxt is None and i != len(chunks)-1:
                raise ValueError('Unexpected extra page: ' + name)
            offset = nxt
        if offset is not None:
            raise ValueError('Incomplete table: ' + name)
    return True


def snapshot(source, destination, environment):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if source == destination or destination.exists():
        raise ValueError('Destination must be a new file distinct from source')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.touch(mode=0o600, exist_ok=False)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as origin, closing(sqlite3.connect(destination)) as target:
        origin.backup(target)
    with closing(sqlite3.connect(destination.as_uri() + '?mode=ro', uri=True)) as restored:
        result = audit(restored)
    return {'created_at': datetime.now(timezone.utc).isoformat(), 'environment': environment,
            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
            'bytes': destination.stat().st_size, 'database': result,
            'storage_verified': False, 'production_ready': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--environment', choices=['local-rehearsal','production-export'], required=True)
    args = parser.parse_args()
    result = snapshot(args.source, args.destination, args.environment)
    manifest = Path(args.destination + '.manifest.json')
    with manifest.open('x') as f:
        manifest.chmod(0o600)
        json.dump(result, f, indent=2)
    print(json.dumps({'data_valid': result['database']['data_valid'], 'tables': len(result['database']['tables']), 'storage_verified': False}))
    raise SystemExit(0 if result['database']['data_valid'] else 2)
