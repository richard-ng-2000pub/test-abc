#!/usr/bin/env python3
"""Build data/index.json for MURDGRID GitHub Pages. Stdlib only.

Run from the repository root:
    python tools/build_index.py
Or:
    python tools/build_index.py --data data

GitHub Pages cannot scan a folder for files at runtime. The manifest is required.
"""
import argparse
import json
import re
from pathlib import Path


def number_in_id(value):
    match = re.search(r'(\d+)$', value)
    return int(match.group(1)) if match else 99999


def main():
    parser = argparse.ArgumentParser(description='Create MURDGRID case manifest from existing JSON files.')
    parser.add_argument('--data', default='data', help='Data folder containing your extracted package')
    parser.add_argument('--check', action='store_true', help='Validate case files only; do not overwrite index.json')
    args = parser.parse_args()
    root = Path(args.data)
    if not root.exists():
        parser.error(f'Data directory not found: {root}')
    entries = []
    failures = []
    seen = set()
    asset_references = set()
    for path in root.rglob('*.json'):
        if path.name == 'index.json' or 'certificates' in path.relative_to(root).parts or 'assets' in path.relative_to(root).parts:
            continue
        try:
            obj = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError) as e:
            failures.append(f'{path}: invalid JSON: {e}')
            continue
        if not (isinstance(obj, dict) and {'case_id','grid','actors','frames'} <= obj.keys()):
            continue  # unrelated JSON: do not mistake it for a case
        case_id = str(obj['case_id'])
        where = str(path)
        if case_id in seen:
            failures.append(f'{where}: duplicate case_id {case_id}')
            continue
        seen.add(case_id)
        grid = obj['grid']
        try:
            rows,cols = int(grid['rows']),int(grid['columns'])
            if len(grid['room_ids']) != rows or any(len(r) != cols for r in grid['room_ids']):
                raise ValueError('room_ids dimensions do not match grid dimensions')
            actors = obj['actors']
            frames = obj['frames']
            steps = int(obj['timing']['steps'])
            if len(frames) != steps + 1:
                raise ValueError(f'expected {steps+1} frames; got {len(frames)}')
            if [int(fr['step']) for fr in frames] != list(range(steps+1)):
                raise ValueError('frames must be ordered consecutively from 0 through steps')
            ids = [str(a['id']) for a in actors]
            if len(ids) != len(set(ids)):
                raise ValueError('duplicate actor letters')
            for a in actors:
                if len(a['path']) != steps+1:
                    raise ValueError(f"actor {a['id']} does not have steps+1 path entries")
                if a['path'][0] != a['start'] or a['path'][-1] != a['end']:
                    raise ValueError(f"actor {a['id']} path endpoints do not match BEFORE/AFTER")
                if any(a['path'][i] != frames[i]['positions'].get(a['id']) for i in range(steps+1)):
                    raise ValueError(f"actor {a['id']} path and synchronized frames disagree")
                if a.get('portrait'):
                    asset_references.add(a['portrait'])
            for o in obj.get('objects',[]):
                if len(o.get('cells',[])) != (2 if o.get('kind')=='X2' else 1):
                    raise ValueError(f"object {o.get('id')} has wrong number of occupied cells")
                if o.get('image'):
                    asset_references.add(o['image'])
            entries.append({
                'id':case_id,'title':obj.get('title',case_id),'level':obj.get('level',0),
                'level_name':obj.get('level_name',''),'file':path.relative_to(root).as_posix(),
                'steps':steps,'actors':len(actors),'rooms':len(obj.get('rooms',[]))
            })
        except (KeyError,TypeError,ValueError) as exc:
            failures.append(f'{where}: {exc}')
    entries.sort(key=lambda o:(-1 if o['id']=='KG-EX' else number_in_id(o['id']),o['id']))
    for problem in failures:
        print('ERROR:',problem)
    print(f'Found {len(entries)} valid case file(s) (including example if present).')
    print('Levels:',', '.join(f'L{n}={sum(x["level"] == n for x in entries)}' for n in range(6)))
    existing=sum((root / ref).is_file() for ref in asset_references)
    print(f'Assets: {existing}/{len(asset_references)} referenced images currently found; missing images use visual placeholders.')
    if failures:
        raise SystemExit(f'{len(failures)} errors: fix the files above before deployment.')
    if not entries:
        raise SystemExit('No MURDGRID case JSON files found.')
    if not args.check:
        target = root/'index.json'
        target.write_text(json.dumps({'schema_version':'murdgrid-site-index-1','book':'MURDGRID Volume 1','cases':entries},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print(f'Updated {target}. Commit/upload this index so the website can discover all cases.')


if __name__=='__main__':
    main()
