#!/usr/bin/env python3
"""Standard-library structural checks; NOT a substitute for runtime e2e tests."""
from pathlib import Path
import json, re, sys
root=Path(__file__).resolve().parents[1]
errors=[]
required=['AGENTS.md','SKILLS.md','DESIGN.md','WORKFLOWS.md','SECURITY.md','docs/MASTER_EXECUTION_PROMPT_V2.md']
for rel in required:
    if not (root/rel).is_file(): errors.append(f'missing required: {rel}')
for b in ['retropick','founder']:
    for fn in ['AGENTS.md','VOICE.md','DESIGN.md','POSITIONING.md','profile.json','tokens.json','claims-ledger.yaml']:
        if not (root/'brands'/b/fn).is_file(): errors.append(f'missing brand file: {b}/{fn}')
    for fn in ['profile.json','tokens.json']:
        p=root/'brands'/b/fn
        if p.exists():
            try:
                data=json.loads(p.read_text())
                if (data.get('tenant',data.get('id')))!=b: errors.append(f'tenant mismatch in {p}')
            except Exception as exc: errors.append(f'invalid JSON {p}: {exc}')
for p in sorted((root/'.agents/skills').glob('*/SKILL.md')):
    text=p.read_text()
    if not text.startswith('---\n') or not re.search(r'^name: '+re.escape(p.parent.name)+r'$',text,re.M) or not re.search(r'^description:\s+.+$',text,re.M):
        errors.append(f'invalid skill metadata: {p}')
for p in sorted((root/'workflows/definitions').glob('*.yaml')):
    text=p.read_text()
    for f in ('id: ','trigger: ','owner: ','tenant: ','stages:','approval_gate: ','retry_policy: ','terminal_states:'):
        if f not in text: errors.append(f'missing {f!r} in {p}')
if len(list((root/'.agents/skills').glob('*/SKILL.md')))<20: errors.append('fewer than 20 local skills')
if len(list((root/'workflows/definitions').glob('*.yaml')))<12: errors.append('fewer than 12 workflows')
print(f"Scaffold check: {len(list(root.rglob('*')))} paths; {len(list((root/'.agents/skills').glob('*/SKILL.md')))} skills; {len(list((root/'workflows/definitions').glob('*.yaml')))} workflows")
if errors:
    print('\n'.join('ERROR: '+x for x in errors),file=sys.stderr)
    sys.exit(1)
print('PASS: structural starter scaffold. Runtime integration NOT TESTED.')
