"""
Builds the Live button's still (index.html <svg id="live-sprite">) and the digit metrics
(src/rive/liveStill.ts) from the editor's static SVG of the Live-on art and the font embedded in
public/rive/live-icon.riv. Run it again when either changes:

  pip install fonttools
  python3 scripts/live-still.py path/to/live-on.svg

The still is the art as the editor exported it, less the calendar's digit, and with the dot's halo
feathered as Rive draws it (the export has it as a flat circle). The digits are the font's own
outlines at the text run's style (DM Sans, opsz 14, weight 600, 32 units), centred in the calendar
as Rive centres them, so any count can be drawn and match the art.
"""
import io, re, sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

ROOT = __file__.rsplit('/scripts/', 1)[0]
svg = open(sys.argv[1]).read()
paths = re.findall(r'<path transform="matrix\(([^)]*)\)"([^>]*?)d="([^"]*)"\s*/>', svg)
defs = re.search(r'<defs>(.*?)</defs>', svg, re.S).group(1)

def num(m):
    v = float(m.group(0))
    return ('%.2f' % v).rstrip('0').rstrip('.').replace('-0', '-0') if v != 0 else '0'
def short(s):
    return re.sub(r'-?\d+\.?\d*(?:e-?\d+)?', num, s)

# the digit is the last white path at the calendar; the halo is the translucent circle
digit = paths[-1]
body = []
for m, attrs, d in paths[:-1]:
    if 'fill-opacity' in attrs and '#83dc7b' in attrs:
        # Rive's feather: full to r 20, half at the circle's r 26, gone by r 33 (measured)
        t = [float(v) for v in m.split()]
        cx, cy = (float(v) for v in re.match(r'M(-?[\d.]+) (-?[\d.]+)', d).groups())
        body.append('<circle cx="%.2f" cy="%.2f" r="%.2f" fill="url(#lh)"/>' % (t[4] + t[0] * cx, t[5] + t[0] * -0.25, t[0] * 33))
        continue
    body.append('<path transform="matrix(%s)"%s d="%s"/>' % (short(m), attrs.rstrip(), short(d)))
halo = [(20, 1), (22, .91), (23, .84), (24, .73), (25, .625), (26, .5), (27, .36), (28, .25), (29, .16), (30, .09), (31, .05), (33, 0)]
grad = '<radialGradient id="lh">%s</radialGradient>' % ''.join(
    '<stop offset="%s" stop-color="#83dc7b" stop-opacity="%s"/>' % (short(str(round(r / 33, 4))), short(str(round(a * .3098, 4)))) for r, a in halo)
defs = re.sub(r'\s+', ' ', short(defs)).replace('> <', '><').strip()

# the font, and the digit's place: fit the font's "0" to the exported one
b = open(ROOT + '/public/rive/live-icon.riv', 'rb').read()
font = TTFont(io.BytesIO(b[b.find(b'GDEF') - 12:]))
font = instantiateVariableFont(font, {'opsz': 14, 'wght': 600})
gs = font.getGlyphSet(); cmap = font.getBestCmap()
m = [float(v) for v in digit[0].split()]
k = m[0] * 32 / 1000  # export scale × font size / units per em
rec = RecordingPen(); parse_path(digit[2], rec)
bp = BoundsPen(None); rec.replay(bp); sx0, sy0, sx1, sy1 = bp.bounds
gb = BoundsPen(gs); gs[cmap[ord('0')]].draw(gb); gx0, gy0, gx1, gy1 = gb.bounds
ox = m[4] + m[0] * sx0 - gx0 * k          # pen origin x of the exported "0"
base = m[5] + m[0] * sy1 + gy0 * k        # baseline y
# the runtime spaces the digits 1.9 apart, the line centred where the export's 0 is (measured from
# Rive's own drawing of 0, 1, 5, 7, 12, 88 and 99, in the export's scale)
SPACING = 1.9
adv = {d: gs[cmap[ord(d)]].width * k for d in '0123456789'}
centre = ox + adv['0'] / 2
glyphs = []
for d in '0123456789':
    pen = SVGPathPen(gs)
    gs[cmap[ord(d)]].draw(TransformPen(pen, (k, 0, 0, -k, 0, 0)))
    glyphs.append('<path id="ld%s" fill="#fff" d="%s"/>' % (d, short(pen.getCommands())))

sprite = ('<svg id="live-sprite" width="0" height="0" style="position:absolute" aria-hidden="true">'
          '<defs>%s%s<g id="live-still">%s</g>%s</defs></svg>') % (defs, grad, ''.join(body), ''.join(glyphs))
html = open(ROOT + '/index.html').read()
html, n = re.subn(r'<svg id="live-sprite".*?</svg>', lambda _: sprite, html, flags=re.S)
assert n == 1, 'index.html needs one <svg id="live-sprite"> to replace'
# the first frame's still shows the count before any data: 0
zero = '<use href="#live-still"/><use href="#ld0" x="%.2f" y="%.2f"/>' % (centre - adv['0'] / 2, base)
html, n = re.subn(r'(<svg class="sf-still sf-live-on"[^>]*>).*?(</svg>)', lambda g: g.group(1) + zero + g.group(2), html, flags=re.S)
assert n == 1, 'index.html needs the first frame\'s <svg class="sf-still">'
open(ROOT + '/index.html', 'w').write(html)

ts = open(ROOT + '/src/rive/liveStill.ts').read()
data = 'export const LIVE_DIGITS = %s;' % json.dumps(
    {'centre': round(centre, 2), 'baseline': round(base, 2), 'spacing': SPACING, 'advance': [round(adv[d], 2) for d in '0123456789']})
ts, n = re.subn(r'export const LIVE_DIGITS = .*?;', lambda _: data, ts)
assert n == 1
open(ROOT + '/src/rive/liveStill.ts', 'w').write(ts)
# the export is the artboard scaled by its own factor (434 / 433, the 1.002 in every transform):
# the view box takes the canvas's 443 × 152, centred artboard (x from −5), into the export's scale
f = m[0]
viewbox = '%s 0 %s %s' % tuple(short('%.3f' % v) for v in (-5 * f, 443 * f, 152 * f))
html = open(ROOT + '/index.html').read()
html, n = re.subn(r'(<svg class="sf-still sf-live-on" viewBox=")[^"]*(")', lambda g: g.group(1) + viewbox + g.group(2), html)
assert n == 1
open(ROOT + '/index.html', 'w').write(html)
ts = open(ROOT + '/src/rive/liveStill.ts').read()
ts, n = re.subn(r"export const LIVE_STILL_VIEWBOX = '[^']*';", "export const LIVE_STILL_VIEWBOX = '%s';" % viewbox, ts)
assert n == 1
open(ROOT + '/src/rive/liveStill.ts', 'w').write(ts)
print('sprite', len(sprite), 'bytes;', data, 'viewBox', viewbox)

# Restore the second state after regenerating the shared sprite.
import subprocess
from pathlib import Path
subprocess.run([sys.executable, str(Path(__file__).with_name('live-off-still.py'))], check=True)
