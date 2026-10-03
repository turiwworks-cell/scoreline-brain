--!strict
-- Scoreline Part 20. Default transparent artboard: 390 x 340.
-- Only GOAAAL / RED CARD and goal flare/glint. Host owns all scene movement.
-- VM: kind String, color1/color2 Color, play Trigger, phase Number.
type Curve = { x1: number, y1: number, x2: number, y2: number }
type Timing = { dur: number, c: Curve }
type Glyph = { adv: number, path: Path }
type Moments = {
    fonts: { B: { [string]: Glyph } }, unit: Path,
    grads: { [string]: Gradient }, px: { [string]: Paint },
    ga: number, t: number, running: boolean, shown: boolean,
    kind: string, stops: { { number } }, glow: number,
    vm: ViewModel?, playProperty: PropertyTrigger?, onPlay: (() -> ())?,
    phaseProperty: Property<number>?, context: Context?,
}
local W = 390
local GLYPHS: { B: { [string]: { any } } } = { B = {} }
GLYPHS.B["A"] = { 674, "M 8 0 L 288 -697 L 385 -697 L 665 0 L 524 0 L 338 -506 L 149 0 Z M 192 -136 L 232 -252 L 442 -252 L 484 -136 Z" }
GLYPHS.B["C"] = { 709, "M 373 16 Q 274 16 198 -30 Q 123 -76 81 -158 Q 39 -240 39 -349 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 484 -713 564 -657 Q 645 -602 680 -505 L 558 -460 Q 536 -521 488 -555 Q 441 -589 373 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -424 169 -349 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 373 -108 Q 441 -108 488 -142 Q 536 -176 558 -237 L 680 -193 Q 645 -96 564 -40 Q 484 16 373 16 Z" }
GLYPHS.B["D"] = { 674, "M 67 0 L 67 -697 L 270 -697 Q 444 -697 539 -605 Q 634 -513 634 -343 Q 634 -177 540 -88 Q 446 0 269 0 Z M 196 -119 L 256 -119 Q 335 -119 390 -139 Q 445 -159 474 -209 Q 504 -259 504 -348 Q 504 -434 475 -485 Q 447 -535 394 -557 Q 342 -578 268 -578 L 196 -578 Z" }
GLYPHS.B["E"] = { 578, "M 67 0 L 67 -697 L 531 -697 L 531 -581 L 196 -581 L 196 -415 L 509 -415 L 509 -300 L 196 -300 L 196 -116 L 531 -116 L 531 0 Z" }
GLYPHS.B["G"] = { 735, "M 365 16 Q 269 16 196 -30 Q 123 -76 81 -158 Q 39 -240 39 -349 Q 39 -458 81 -540 Q 123 -621 198 -667 Q 274 -713 373 -713 Q 484 -713 564 -657 Q 645 -602 680 -505 L 558 -460 Q 536 -521 488 -555 Q 441 -589 373 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -424 169 -349 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 373 -108 Q 405 -108 439 -117 Q 473 -126 501 -148 Q 530 -171 548 -211 Q 565 -251 565 -313 L 565 -353 L 594 -263 L 394 -263 L 394 -379 L 680 -379 L 680 0 L 566 0 L 548 -113 L 570 -96 Q 552 -59 521 -34 Q 490 -9 451 3 Q 411 16 365 16 Z" }
GLYPHS.B["L"] = { 504, "M 67 0 L 67 -697 L 196 -697 L 196 -116 L 493 -116 L 493 0 Z" }
GLYPHS.B["O"] = { 747, "M 373 16 Q 274 16 198 -30 Q 123 -75 81 -157 Q 39 -239 39 -348 Q 39 -458 81 -540 Q 123 -622 198 -667 Q 274 -713 373 -713 Q 473 -713 548 -667 Q 624 -622 666 -540 Q 708 -458 708 -348 Q 708 -239 665 -157 Q 623 -75 547 -30 Q 472 16 373 16 Z M 372 -108 Q 436 -108 482 -138 Q 527 -167 552 -221 Q 577 -275 577 -348 Q 577 -422 552 -476 Q 527 -530 481 -559 Q 436 -589 372 -589 Q 311 -589 264 -560 Q 218 -531 193 -477 Q 169 -423 169 -348 Q 169 -274 193 -220 Q 218 -166 264 -137 Q 311 -108 372 -108 Z" }
GLYPHS.B["R"] = { 612, "M 67 0 L 67 -697 L 297 -697 Q 382 -697 434 -672 Q 486 -648 511 -602 Q 535 -557 535 -495 Q 535 -399 480 -347 Q 426 -294 325 -288 Q 302 -287 278 -287 Q 254 -287 237 -287 L 196 -287 L 196 0 Z M 446 0 L 271 -302 L 403 -318 L 595 0 Z M 196 -403 L 284 -403 Q 317 -403 345 -410 Q 372 -418 389 -437 Q 406 -457 406 -493 Q 406 -530 389 -549 Q 372 -568 345 -575 Q 317 -581 284 -581 L 196 -581 Z" }
GLYPHS.B[" "] = { 260, "" }

local function hex(h: number, a: number?): Color
    local r = bit32.band(bit32.rshift(h, 16), 255)
    local g = bit32.band(bit32.rshift(h, 8), 255)
    local b = bit32.band(h, 255)
    return Color.rgba(r, g, b, math.floor(255 * math.clamp(a or 1, 0, 1) + 0.5))
end
local function C(x1: number, y1: number, x2: number, y2: number): Curve
    return { x1 = x1, y1 = y1, x2 = x2, y2 = y2 }
end
-- no curve overshoots: movement settles, it never bounces or wobbles
local GLIDE = C(0.16, 1, 0.3, 1)
local INOUT = C(0.42, 0, 0.58, 1)

local function bez(c: Curve, x: number): number
    if x <= 0 then return 0 end
    if x >= 1 then return 1 end
    local lo, hi, t = 0, 1, x
    for _ = 1, 16 do
        t = (lo + hi) * 0.5
        local u = 1 - t
        local cx = 3 * c.x1 * t * u * u + 3 * c.x2 * t * t * u + t * t * t
        if cx < x then lo = t else hi = t end
    end
    local u = 1 - t
    return 3 * c.y1 * t * u * u + 3 * c.y2 * t * t * u + t * t * t
end
local function prog(t: number, delay: number, dur: number): number
    if dur <= 0 then return if t >= delay then 1 else 0 end
    return math.clamp((t - delay) / dur, 0, 1)
end
local function ease(c: Curve, t: number, delay: number, dur: number): number
    return bez(c, prog(t, delay, dur))
end
local function lerp(a: number, b: number, p: number): number
    return a + (b - a) * p
end
local function mix(a: number, b: number, p: number): number
    local function ch(x: number, s: number): number return bit32.band(bit32.rshift(x, s), 255) end
    local r = math.floor(lerp(ch(a, 16), ch(b, 16), p) + 0.5)
    local g = math.floor(lerp(ch(a, 8), ch(b, 8), p) + 0.5)
    local bl = math.floor(lerp(ch(a, 0), ch(b, 0), p) + 0.5)
    return r * 65536 + g * 256 + bl
end
local function luma(x: number): number
    local function lin(c: number): number
        c /= 255
        return if c <= 0.04045 then c / 12.92 else ((c + 0.055) / 1.055) ^ 2.4
    end
    return 0.2126 * lin(bit32.band(bit32.rshift(x, 16), 255)) + 0.7152 * lin(bit32.band(bit32.rshift(x, 8), 255)) + 0.0722 * lin(bit32.band(x, 255))
end
-- lighten a team colour until black text on it passes WCAG AA comfortably
local function pastel(x: number): number
    local p = 0.22
    local c = mix(x, 0xF7F2EA, p)
    while luma(c) < 0.36 and p < 0.95 do
        p += 0.06
        c = mix(x, 0xF7F2EA, p)
    end
    return c
end
local function parseCmds(s: string): { number }
    local out: { number } = {}
    local ops: { [string]: number } = { M = 1, L = 2, C = 3, Z = 4, Q = 5 }
    for w in string.gmatch(s, "%S+") do
        local op = ops[w]
        if op then table.insert(out, -op) else table.insert(out, tonumber(w) or 0) end
    end
    return out
end
-- writes commands into a path, shifted by (dx, dy) and scaled by k.
-- Quadratic curves are converted to cubics (only moveTo, lineTo, cubicTo are used).
local function emit(p: Path, c: { number }, dx: number, dy: number, k: number)
    local i, n = 1, #c
    local cx, cy = 0, 0
    while i <= n do
        local op = -c[i]
        if op == 1 then
            cx, cy = c[i + 1], c[i + 2]
            p:moveTo(Vector.xy(cx * k + dx, cy * k + dy))
            i += 3
        elseif op == 2 then
            cx, cy = c[i + 1], c[i + 2]
            p:lineTo(Vector.xy(cx * k + dx, cy * k + dy))
            i += 3
        elseif op == 3 then
            p:cubicTo(Vector.xy(c[i + 1] * k + dx, c[i + 2] * k + dy), Vector.xy(c[i + 3] * k + dx, c[i + 4] * k + dy), Vector.xy(c[i + 5] * k + dx, c[i + 6] * k + dy))
            cx, cy = c[i + 5], c[i + 6]
            i += 7
        elseif op == 5 then
            local qx, qy, ex, ey = c[i + 1], c[i + 2], c[i + 3], c[i + 4]
            local c1x, c1y = cx + (qx - cx) * 2 / 3, cy + (qy - cy) * 2 / 3
            local c2x, c2y = ex + (qx - ex) * 2 / 3, ey + (qy - ey) * 2 / 3
            p:cubicTo(Vector.xy(c1x * k + dx, c1y * k + dy), Vector.xy(c2x * k + dx, c2y * k + dy), Vector.xy(ex * k + dx, ey * k + dy))
            cx, cy = ex, ey
            i += 5
        elseif op == 4 then
            p:close()
            i += 1
        else
            i += 1
        end
    end
end

local function parsePath(s: string): Path
    local p = Path.new()
    emit(p, parseCmds(s), 0, 0, 1)
    return p
end

local GOAL: Timing = { dur = 0.7, c = GLIDE }
local function tmOf(_self: Moments, _key: string): Timing return GOAL end
-- Fixed words only; reproduce textPath's trailing -20 and the caller's
-- second tracking subtraction exactly, without a text/path cache.
local function textPath(self: Moments, _font: string, word: string, _track: number): { adv: number }
    local adv = 0
    for i = 1, #word do adv += self.fonts.B[string.sub(word, i, i)].adv - 20 end
    return { adv = adv }
end
local function clipRect(self: Moments, r: Renderer, x: number, y: number, w: number, h: number)
    r:save()
    r:transform(Mat2D.withTranslation(x, y) * Mat2D.withScale(w, h))
    r:clipPath(self.unit)
    r:restore()
end
local function lookPaint(self: Moments, c: Color, _stroke: number?, feather: number): Paint
    local cc = if self.ga >= 0.999 then c else Color.opacity(c, Color.opacity(c) * math.clamp(self.ga, 0, 1))
    local key = "soft|" .. tostring(cc) .. "|" .. tostring(feather)
    local p = self.px[key]
    if p == nil then
        p = Paint.with({ style = "fill", color = cc, feather = feather })
        self.px[key] = p
    end
    return p
end
local function gradLook(self: Moments, key: string, gr: Gradient): Paint
    local p = self.px[key]
    if p == nil then
        p = Paint.with({ style = "fill", gradient = gr })
        self.px[key] = p
    end
    return p
end
local function stopsPaint(self: Moments, key: string, stops: { { number } }, horizontal: boolean): Paint
    local a = math.clamp(math.floor(self.ga * 20 + 0.5), 0, 20)
    local k = key .. (if horizontal then "h" else "v") .. tostring(a)
    local gr = self.grads[k]
    if gr == nil then
        local gs: { GradientStop } = {}
        for _, s in stops do
            table.insert(gs, { position = s[1], color = hex(s[2], (s[3] or 1) * a / 20) })
        end
        gr = Gradient.linear(Vector.xy(0, 0), if horizontal then Vector.xy(1, 0) else Vector.xy(0, 1), gs)
        self.grads[k] = gr
    end
    return gradLook(self, k, gr)
end
local function softLight(self: Moments, r: Renderer, x: number, y: number, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number)
    if alpha * self.ga <= 0.003 or w <= 0 or h <= 0 then return end
    local a = math.clamp(math.floor(self.ga * alpha * 80 + 0.5), 0, 80)
    local gk = "sl" .. tostring(color) .. "|" .. tostring(a)
    local gr = self.grads[gk]
    if gr == nil then
        local gs: { GradientStop } = {}
        for i = 0, 24 do
            local t = i / 24
            local v = (1 - t * t) ^ 3
            table.insert(gs, { position = t * 0.5, color = hex(mix(color, 0xFFFFFF, 0.35 * (1 - t) ^ 2), v * a / 80) })
        end
        gr = Gradient.radial(Vector.xy(0.5, 0.5), 0.5, gs)
        self.grads[gk] = gr
    end
    r:save()
    clipRect(self, r, x, y, w, h)
    r:transform(Mat2D.withTranslation(cx - rx, cy - ry) * Mat2D.withScale(rx * 2, ry * 2))
    r:drawPath(self.unit, gradLook(self, gk, gr))
    r:restore()
end

    local function goalLetters(T: Timing): (number, number)
        return T.dur * 0.1, T.dur * 0.72
    end
    local LAND = C(0.12, 1, 0.3, 1)
    local GLINT_W = 440
    local GLINT = { { 0, 0xFFFFFF, 0 }, { 0.3, 0xFFFFFF, 0.3 }, { 0.5, 0xFFFFFF, 0.75 }, { 0.7, 0xFFFFFF, 0.3 }, { 1, 0xFFFFFF, 0 } }
    local function shoutWord(self: Moments, r: Renderer, word: string, cx: number, base: number, size: number, t0: number, t: number, stops: { { number } }, key: string, base0: number, glow: number)
        local T = tmOf(self, "goal")
        local gap, land = goalLetters(T)
        local tp = textPath(self, "B", word, -0.02)
        size = math.min(size, (W - 64) * 1000 / (tp.adv - 20 * (#word - 1)))
        local k = size / 1000
        local wordW = (tp.adv - 20 * (#word - 1)) * k
        local midY = base - size * 0.35
        local landed = t0 + (#word - 1) * gap + land * 0.55
        -- the flare: light swells behind the word as it lands, then rests
        local fl = prog(t, landed - 0.1, 0.25) * (1 - 0.55 * ease(INOUT, t, landed + 0.15, 0.9))
        if fl > 0.01 then
            self.ga = base0
            softLight(self, r, 0, midY - 170, W, 340, cx, midY, 230 * (0.8 + 0.2 * fl), 130 * (0.8 + 0.2 * fl), glow, 0.55 * fl)
        end
        -- the word settles from a touch larger
        local ws = lerp(1.08, 1, bez(LAND, prog(t, t0, land + (#word - 1) * gap + T.dur)))
        r:save()
        r:transform(Mat2D.withTranslation(cx, midY) * Mat2D.withScale(ws, ws) * Mat2D.withTranslation(-cx, -midY))
        local gx = cx - wordW / 2
        local gp = prog(t, landed + 0.05, T.dur * 0.9)
        local adv = 0
        for i = 1, #word do
            local chr = string.sub(word, i, i)
            local g = self.fonts.B[chr]
            if g then
                local pL = bez(LAND, prog(t, t0 + (i - 1) * gap, land))
                if pL > 0.001 then
                    local sl = lerp(1.85, 1, pL)
                    local lx = gx + adv * k
                    local cxL = lx + g.adv * k / 2
                    local alpha = math.clamp(pL * 2.4, 0, 1)
                    local focus = math.clamp((pL - 0.3) / 0.6, 0, 1)
                    r:save()
                    r:transform(Mat2D.withTranslation(cxL, midY) * Mat2D.withScale(sl, sl) * Mat2D.withTranslation(-cxL, -midY))
                    r:transform(Mat2D.withTranslation(lx, base) * Mat2D.withScale(k, k))
                    if focus < 0.999 then
                        -- still arriving: soft, in the team's light (feather in font units)
                        self.ga = base0 * alpha * (1 - focus)
                        local fe = math.max(10, math.floor((1 - focus) * 14 / (k * sl) / 10 + 0.5) * 10)
                        r:drawPath(g.path, lookPaint(self, hex(glow), nil, fe))
                    end
                    if focus > 0.001 then
                        self.ga = base0 * alpha * focus
                        r:save()
                        r:clipPath(g.path)
                        r:save()
                        r:transform(Mat2D.withTranslation(-adv, -760) * Mat2D.withScale(tp.adv, 790))
                        r:drawPath(self.unit, stopsPaint(self, key, stops, true))
                        r:restore()
                        if gp > 0 and gp < 1 then
                            -- the glint, a slanted band of light crossing the whole word
                            self.ga = base0 * focus * math.sin(gp * math.pi)
                            local bx = lerp(-520, tp.adv + 520, gp) - adv
                            r:transform(Mat2D.withTranslation(bx, -380) * Mat2D.withRotation(0.32) * Mat2D.withTranslation(-GLINT_W / 2, -700) * Mat2D.withScale(GLINT_W, 1400))
                            r:drawPath(self.unit, stopsPaint(self, "glint", GLINT, true))
                        end
                        r:restore()
                    end
                    r:restore()
                end
                adv += g.adv - 20
            end
        end
        r:restore()
        self.ga = base0
    end

    -- a word of big letters, each slamming in; fill: stops across the whole word
    local function slamWord(self: Moments, r: Renderer, word: string, cx: number, base: number, size: number, t0: number, t: number, stops: { { number } }, key: string, base0: number)
        local T = tmOf(self, "goal")
        local tp = textPath(self, "B", word, -0.02)
        -- never wider than the screen
        size = math.min(size, (W - 44) * 1000 / (tp.adv - 20 * (#word - 1)))
        local k = size / 1000
        local wordW = (tp.adv - 20 * (#word - 1)) * k
        local gx = cx - wordW / 2
        local adv = 0
        for i = 1, #word do
            local chr = string.sub(word, i, i)
            local g = self.fonts.B[chr]
            if g then
                local pL = bez(T.c, prog(t, t0 + (i - 1) * 0.06, T.dur))
                if pL > 0.001 then
                    local sl = lerp(1.4, 1, pL)
                    local lx = gx + adv * k
                    local cxL = lx + g.adv * k / 2
                    self.ga = base0 * math.clamp(pL * 1.8, 0, 1)
                    r:save()
                    r:transform(Mat2D.withTranslation(cxL, base - size * 0.35) * Mat2D.withScale(sl, sl) * Mat2D.withTranslation(-cxL, -(base - size * 0.35)))
                    r:transform(Mat2D.withTranslation(lx, base) * Mat2D.withScale(k, k))
                    r:clipPath(g.path)
                    r:transform(Mat2D.withTranslation(-adv, -760) * Mat2D.withScale(tp.adv, 790))
                    r:drawPath(self.unit, stopsPaint(self, key, stops, true))
                    r:restore()
                end
                adv += g.adv - 20
            end
        end
        self.ga = base0
    end

    -- the player rising behind the floor, his name, the line under it and the commentary
-- phase 1 is the end of the LAST letter, not the early flare bloom.
-- GOAAAL: 5*0.07+0.504 = 0.854; RED CARD includes the space slot:
-- 7*0.06+0.7 = 1.12. No host delay (0.1 / 0.42) is reapplied.
local function landing(kind: string): number
    return if kind == "red" then 7 * 0.06 + GOAL.dur else 5 * GOAL.dur * 0.1 + GOAL.dur * 0.72
end
local function ending(kind: string): number
    if kind == "red" then return landing(kind) end
    local land = GOAL.dur * 0.72
    local bloom = 5 * GOAL.dur * 0.1 + land * 0.55
    return math.max(land + 5 * GOAL.dur * 0.1 + GOAL.dur, bloom + 0.15 + 0.9, bloom + 0.05 + GOAL.dur * 0.9)
end
local function phase(self: Moments, n: number)
    local p = self.phaseProperty
    if p and p.value ~= n then p.value = n end
end
local function start(self: Moments)
    local vm = self.vm
    if vm == nil then return end
    local kind = vm:getString("kind")
    local c1, c2 = vm:getColor("color1"), vm:getColor("color2")
    if kind == nil or c1 == nil or c2 == nil then return end
    self.kind = if kind.value == "red" then "red" else "goal"
    local a, b = bit32.band(c1.value :: any, 0xFFFFFF), bit32.band(c2.value :: any, 0xFFFFFF)
    self.glow = pastel(a)
    self.stops = if self.kind == "red"
        then { { 0, 0xFF6A5E }, { 0.5, 0xFF2D2D }, { 1, 0xC2101A } }
        else { { 0, pastel(a) }, { 0.55, pastel(mix(b, 0xF7F2EA, 0.25)) }, { 1, pastel(a) } }
    self.t, self.running, self.shown = 0, true, true
    phase(self, 0)
    if self.context then self.context:markNeedsUpdate() end
end
local function init(self: Moments, context: Context): boolean
    -- Re-init removes the previous callback; replay never installs listeners.
    if self.playProperty and self.onPlay then self.playProperty:removeListener(self.onPlay) end
    self.context, self.vm = context, context:viewModel()
    self.fonts = { B = {} }
    for ch, g in GLYPHS.B do self.fonts.B[ch] = { adv = g[1] :: number, path = parsePath(g[2] :: string) } end
    self.unit = Path.new()
    self.unit:moveTo(Vector.xy(0, 0)); self.unit:lineTo(Vector.xy(1, 0))
    self.unit:lineTo(Vector.xy(1, 1)); self.unit:lineTo(Vector.xy(0, 1)); self.unit:close()
    self.grads, self.px = {}, {}
    self.t, self.running, self.shown, self.ga = 0, false, false, 1
    local vm = self.vm
    if vm == nil then return false end
    self.phaseProperty, self.playProperty = vm:getNumber("phase"), vm:getTrigger("play")
    if self.phaseProperty == nil or self.playProperty == nil or vm:getString("kind") == nil or vm:getColor("color1") == nil or vm:getColor("color2") == nil then return false end
    local onPlay = function() start(self) end
    self.onPlay = onPlay
    self.playProperty:addListener(onPlay)
    phase(self, 0)
    return true
end
local function advance(self: Moments, seconds: number): boolean
    if not self.running then return false end
    self.t = math.min(self.t + math.max(seconds, 0), ending(self.kind))
    -- One phase per advance preserves 1 then 2 even across a large time step.
    local p = self.phaseProperty
    if p and p.value == 0 and self.t >= landing(self.kind) then phase(self, 1)
    elseif self.t >= ending(self.kind) then phase(self, 2); self.running = false end
    return self.running
end
local function draw(self: Moments, r: Renderer)
    if not self.shown then return end
    -- Frame-local immutable paints. Only this frame is retained: no cache
    -- grows with time, alpha/feather, team colours or replay count.
    self.grads, self.px = {}, {}
    self.ga = 1
    -- Midpoint (195,170); baseline = midpoint + 0.35*size.
    if self.kind == "red" then
        local tp = textPath(self, "B", "RED CARD", -0.02)
        local size = math.min(70, (W - 44) * 1000 / (tp.adv - 20 * 7))
        slamWord(self, r, "RED CARD", 195, 170 + size * 0.35, size, 0, self.t, self.stops, "redword", 1)
    else
        local tp = textPath(self, "B", "GOAAAL", -0.02)
        local size = math.min(104, (W - 64) * 1000 / (tp.adv - 20 * 5))
        shoutWord(self, r, "GOAAAL", 195, 170 + size * 0.35, size, 0, self.t, self.stops, "goal", 1, self.glow)
    end
end
return function(): Node<Moments>
    return {
        init = init, advance = advance, draw = draw,
        fonts = { B = {} }, unit = late(), grads = {}, px = {},
        ga = 1, t = 0, running = false, shown = false, kind = "goal",
        stops = {}, glow = 0, vm = nil, phaseProperty = nil,
        playProperty = nil, onPlay = nil, context = nil,
    }
end

