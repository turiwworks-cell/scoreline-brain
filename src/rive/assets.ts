declare const __RIVE_ASSETS__: { liveIcon: boolean; moments: boolean };

// Determined at build time. Part 20 adds these files; absent assets never make a 404 request.
const available = typeof __RIVE_ASSETS__ === 'undefined' ? { liveIcon: false, moments: false } : __RIVE_ASSETS__;
const base = import.meta.env.BASE_URL;
export const liveIconSource = available.liveIcon ? `${base}rive/live-icon.riv` : null;
export const momentsSource = available.moments ? `${base}rive/moments.riv` : null;
