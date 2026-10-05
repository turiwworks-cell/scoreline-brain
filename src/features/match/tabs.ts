// The match screen's tabs, in order (TABS, luau:1814): the URL names them, the slide direction
// between two of them follows this order.
export const DETAIL_TABS = ['facts', 'stats', 'lineup', 'table'] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
