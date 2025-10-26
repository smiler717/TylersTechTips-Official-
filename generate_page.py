#!/usr/bin/env python3
"""
Simple static page generator for Tyler's Tech Tips.
Usage: python3 generate_page.py path/to/page_data.json
page_data.json schema:
{
  "slug": "how-to-install-ssd",
  "title": "How to Install an SSD",
  "date": "October 24, 2025",
  "author": "Tyler",
  "image": "images/ssd.jpg",
  "image_alt": "Installing an SSD",
  "intro": ["Intro paragraph 1", "Intro paragraph 2"],
  "steps": [
    {"title": "Step title", "text": "Step details"},
    ...
  ],
  "body": ["More paragraphs"]
}
This script will render the template.html file and write slug + '.html' in the same folder.
"""
import sys
import json
from pathlib import Path
import subprocess

def render_steps(steps):
    if not steps:
        return ""
    parts = ["<ol class=\"steps\">"]
    for s in steps:
        title = s.get('title','')
        text = s.get('text','')
        parts.append(f"<li class=\"step\">\n    <h3>{title}</h3>\n    <p>{text}</p>\n</li>")
    parts.append("</ol>")
    return "\n".join(parts)


def paragraphs_html(paragraphs):
    if not paragraphs:
        return ""
    return "\n".join([f"<p>{p}</p>" for p in paragraphs])


def main():
    if len(sys.argv) < 2:
        print("Usage: generate_page.py path/to/page_data.json")
        sys.exit(2)
    data_path = Path(sys.argv[1])
    if not data_path.exists():
        print(f"Data file not found: {data_path}")
        sys.exit(1)
    data = json.loads(data_path.read_text())
    slug = data.get('slug')
    if not slug:
        print('slug is required in data')
        sys.exit(1)
    template_path = Path(__file__).parent / 'template.html'
    if not template_path.exists():
        print(f'template.html not found at {template_path}')
        sys.exit(1)
    tpl = template_path.read_text()

    intro_html = paragraphs_html(data.get('intro', []))
    body_html = paragraphs_html(data.get('body', []))
    steps_html = render_steps(data.get('steps', []))

    # Simple token replacements
    out = tpl
    # Normalize image path: prefer local Images/ or images/ if present
    def normalize_image_path(img_path):
        if not img_path:
            return ''
        try:
            base = Path(__file__).parent
            
            # Use default theme colors for each type of page
            image_map = {
                'Images/network-monitoring.jpg': 'https://placehold.co/800x400/4a90e2/white?text=Network+Monitoring',
                'Images/intune-mgmt.jpg': 'https://placehold.co/800x400/00a4ef/white?text=Intune+Management',
                'Images/windows-server.jpg': 'https://placehold.co/800x400/107c10/white?text=Windows+Server',
                'Images/network-monitoring-dash.jpg': 'https://placehold.co/800x400/4a90e2/white?text=Network+Monitoring',
                'Images/intune-mdm-console.jpg': 'https://placehold.co/800x400/00a4ef/white?text=Intune+Management',
                'Images/windows-server-dashboard.jpg': 'https://placehold.co/800x400/107c10/white?text=Windows+Server'
            }
            
            if img_path in image_map:
                return image_map[img_path]
                
            # For any other images, return a generic placeholder
            return 'https://placehold.co/800x400/cccccc/333333?text=Image+Placeholder'
        except Exception as e:
            print(f"Error handling image path {img_path}: {e}")
            return 'https://placehold.co/800x400/cccccc/333333?text=Image+Placeholder'

    replacements = {
        '{{title}}': data.get('title','Untitled'),
        '{{date}}': data.get('date',''),
        '{{author}}': data.get('author',''),
            '{{image}}': str(normalize_image_path(data.get('image','') or '')),
        '{{image_alt}}': data.get('image_alt',''),
        '{{intro_html}}': intro_html,
        '{{body_html}}': body_html,
        '{{steps_html}}': steps_html,
    }

    for k,v in replacements.items():
        out = out.replace(k, v)

    # Remove any leftover simple conditional tags like {% if image %}...{% endif %}
    # For simplicity, drop them by removing lines with those markers
    out = out.replace('{% if image %}', '')
    out = out.replace('{% endif %}', '')

    out_path = Path(__file__).parent / (slug + '.html')
    out_path.write_text(out, encoding='utf-8')
    print(f'Wrote {out_path}')

    # After generating a page, rebuild the search index so the site search stays up-to-date
    try:
        script = Path(__file__).parent / 'scripts' / 'build_search_index.py'
        if script.exists():
            subprocess.run(['python3', str(script)], check=True)
            print('Rebuilt search-index.json')
    except Exception as e:
        print('Warning: failed to rebuild search index:', e)

if __name__ == '__main__':
    main()
