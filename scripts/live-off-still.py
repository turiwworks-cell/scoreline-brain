"""Embed the supplied OFF SVG in the same HTML sprite as the ON export.

The last path is its fixed zero. Keep that exact path for count=0; other counts
use the existing Rive-font glyphs. Prefix gradient ids to avoid ON collisions.
Run after live-still.py whenever either export changes.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = (root / 'scripts/assets/live-off.svg').read_text(encoding='utf-8')
body = re.search(r'<svg\b[^>]*>(.*?)</svg>', source, re.S).group(1)
body = body.replace('grad0', 'sl-cold-off-grad0').replace('grad1', 'sl-cold-off-grad1')
paths = list(re.finditer(r'<path\b[^>]*(?:/>|>.*?</path>)', body, re.S))
assert len(paths) == 9, 'Supplied OFF art has eight art paths and one zero'
zero = paths[-1]
art = body[:zero.start()] + body[zero.end():]
group = '<g id="live-off-export"><g id="live-off-still">' + art + '</g><g id="live-off-zero">' + zero.group() + '</g></g>'
html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')
html = re.sub(r'<g id="live-off-export">.*?</g></g>', '', html, flags=re.S)
sprite = re.search(r'<svg id="live-sprite".*?</svg>', html, re.S)
assert sprite
replacement = sprite.group().replace('</defs></svg>', group + '</defs></svg>')
html = html[:sprite.start()] + replacement + html[sprite.end():]
html_path.write_text(html, encoding='utf-8', newline='\n')
print('Embedded original OFF art:', len(group), 'bytes')
