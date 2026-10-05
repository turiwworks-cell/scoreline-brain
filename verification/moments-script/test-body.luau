
local function fixture(kind: string): (any, any, any)
    local listeners: { () -> () } = {}
    local vm: any = {
        kind = { value = kind }, c1 = { value = hex(0x0055A4) },
        c2 = { value = hex(0xEF4135) }, phase = { value = 0 },
    }
    local trigger: any = {}
    trigger.addListener = function(_s: any, fn: () -> ()) table.insert(listeners, fn) end
    trigger.removeListener = function(_s: any, fn: () -> ())
        for i, f in listeners do if f == fn then table.remove(listeners, i); break end end
    end
    trigger.fire = function(_s: any) for _, f in listeners do f() end end
    vm.getString = function(_s: any, _key: string): any return vm.kind end
    vm.getColor = function(_s: any, key: string): any return if key == "color1" then vm.c1 else vm.c2 end
    vm.getNumber = function(_s: any, _key: string): any return vm.phase end
    vm.getTrigger = function(_s: any, _key: string): any return trigger end
    local ctx: any = {
        viewModel = function(_s: any): any return vm end,
        markNeedsUpdate = function(_s: any) end,
    }
    local n: any = {
        fonts = { B = {} }, grads = {}, px = {}, ga = 1, t = 0,
        running = false, shown = false, kind = "goal", stops = {}, glow = 0,
    }
    assert(init(n, ctx))
    return n, vm, { trigger = trigger, listeners = listeners, context = ctx }
end
local function count(t: any): number
    local n = 0
    for _ in t do n += 1 end
    return n
end
local function renderer(): any
    return {
        save = function(_s: any) end, restore = function(_s: any) end,
        transform = function(_s: any, _m: Mat2D) end,
        clipPath = function(_s: any, _p: Path) end,
        drawPath = function(_s: any, _p: Path, _paint: Paint) end,
    }
end
return function(): Tests
 return function(test: Tester)
    test.group("moments", function()
        test.case("starts at trigger, lands goal, finishes, then sleeps", function(expect)
            local n, vm, f = fixture("goal")
            expect(advance(n, 10)).is(false)
            expect(n.shown).is(false)
            f.trigger:fire()
            expect(vm.phase.value).is(0)
            expect(n.t).is(0)
            advance(n, 0.853)
            expect(vm.phase.value).is(0)
            advance(n, 0.0011)
            expect(vm.phase.value).is(1)
            advance(n, 2)
            expect(vm.phase.value).is(2)
            expect(advance(n, 1)).is(false)
            expect(n.t).lessThan(1.7)
        end)
        test.case("red includes the space slot and no host hit delay", function(expect)
            local n, vm, f = fixture("red")
            f.trigger:fire()
            advance(n, 1.119)
            expect(vm.phase.value).is(0)
            advance(n, 0.0011)
            expect(vm.phase.value).is(1)
            advance(n, 0.016)
            expect(vm.phase.value).is(2)
            expect(n.running).is(false)
        end)
        test.case("large step cannot drop landing notification", function(expect)
            local n, vm, f = fixture("goal")
            f.trigger:fire()
            advance(n, 100)
            expect(vm.phase.value).is(1)
            advance(n, 0)
            expect(vm.phase.value).is(2)
        end)
        test.case("retrigger midway resets clock and samples new kind and colours", function(expect)
            local n, vm, f = fixture("goal")
            f.trigger:fire(); advance(n, 0.9)
            vm.kind.value = "red"; vm.c1.value = hex(0xFFD700)
            expect(n.kind).is("goal")
            f.trigger:fire()
            expect(n.kind).is("red")
            expect(n.t).is(0)
            expect(vm.phase.value).is(0)
            advance(n, -1)
            expect(n.t).is(0)
            expect(#f.listeners).is(1)
        end)
        test.case("20 alternating coloured plays retain fixed paths and bounded frame caches", function(expect)
            local n, vm, f = fixture("goal")
            local path = n.fonts.B.A.path
            local r = renderer()
            for cycle = 1, 20 do
                vm.kind.value = if cycle % 2 == 0 then "red" else "goal"
                vm.c1.value = hex(cycle * 7777)
                f.trigger:fire()
                for _ = 1, 110 do
                    advance(n, 1 / 60)
                    draw(n, r)
                    expect(count(n.grads)).lessThanOrEqual(16)
                    expect(count(n.px)).lessThanOrEqual(24)
                end
                expect(vm.phase.value).is(2)
                expect(n.running).is(false)
                expect(n.fonts.B.A.path).is(path)
                expect(count(n.fonts.B)).is(9)
                expect(#f.listeners).is(1)
            end
        end)
        test.case("re-init removes old callback instead of doubling listeners", function(expect)
            local n, _vm, f = fixture("goal")
            init(n, f.context)
            expect(#f.listeners).is(1)
            f.trigger:fire()
            expect(n.running).is(true)
        end)
    end)
 end
end

