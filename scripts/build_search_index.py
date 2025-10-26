#!/usr/bin/env python3
import json
from pathlib import Path

examples_dir = Path(__file__).parent.parent / 'examples'
out_file = Path(__file__).parent.parent / 'search-index.json'
index = []
for p in examples_dir.glob('*.json'):
    try:
        data = json.loads(p.read_text())
    except Exception as e:
        print(f"Skipping {p}: {e}")
        continue
    title = data.get('title','')
    slug = data.get('slug','')
    url = slug + '.html' if slug else ''
    intro = data.get('intro', [])
    excerpt = intro[0] if intro else (data.get('body',[""])[0] if data.get('body') else '')
    # keywords: from title tokens + tags if present
    keywords = []
    if title:
        keywords += [t.strip().lower() for t in title.replace("-", " ").split()]
    # include slug parts
    if slug:
        keywords += slug.split('-')
    index.append({
        'title': title,
        'url': url,
        'keywords': list(dict.fromkeys(keywords)),
        'excerpt': excerpt
    })

out_file.write_text(json.dumps(index, indent=2), encoding='utf-8')
print(f"Wrote {out_file}")
