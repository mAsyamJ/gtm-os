#!/usr/bin/env python3
"""Trusted deterministic validator: model output can select reviewed claims only."""
import json
import sys
from pathlib import Path

def main():
    root=Path(sys.argv[1]).resolve()
    source=root/'brief.json'; candidate=root/'candidate.json'
    if source.is_symlink() or candidate.is_symlink() or candidate.stat().st_size>100000:
        raise ValueError('Unsafe editorial input')
    brief=json.loads(source.read_text()); value=json.loads(candidate.read_text())
    if set(value)!= {'posts','threads'} or len(value['posts'])!=5 or len(value['threads'])!=2:
        raise ValueError('Editorial selection shape')
    for item in value['posts']+value['threads']:
        if set(item)!={'claimIndices'} or not 1<=len(item['claimIndices'])<=6:
            raise ValueError('Claims required')
        for index in item['claimIndices']:
            if type(index) is not int or not 0<=index<len(brief['claims']):
                raise ValueError('Unsupported claim')
    print('PASS: reviewed claim selection; editorial quality remains human-reviewed')

if __name__=='__main__':
    main()
