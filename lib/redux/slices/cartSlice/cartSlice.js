import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'qh_cart_v1';
// Bug_86 fix: session-scoped tombstone list. When the user explicitly removes
// an item we record its id here so a remount-time re-sync (e.g. an effect
// that mirrors sessionStorage into the cart) cannot resurrect it. Cleared on
// clearCart() — including the post-checkout / logout path.
const REMOVED_KEY = 'qh_cart_removed_v1';
const TAX_RATE = 0.18;

function loadRemovedIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(REMOVED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveRemovedIds(set) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(REMOVED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota errors */
  }
}

function clearRemovedIds() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(REMOVED_KEY);
  } catch {
    /* ignore */
  }
}

function flattenI18nName(n) {
  if (n && typeof n === 'object' && !Array.isArray(n)) {
    return n.en || Object.values(n)[0] || 'Service';
  }
  return n || 'Service';
}

// Bug_85 fix: derive a stable unit price from whatever shape the caller
// happens to pass. Add-to-cart sites sometimes hand us `basePrice`, sometimes
// `pricing.hourly` + hours, sometimes `hourlyRate` + hours. If we naively
// take `price` alone we end up with 0 after navigation away and back.
// Snapshot the resolved number into `price` once, here at the slice boundary,
// so the persisted item always carries a real unit price.
function resolvePrice(incoming) {
  const direct = Number(incoming?.price);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const basePrice = Number(incoming?.basePrice);
  if (Number.isFinite(basePrice) && basePrice > 0) return basePrice;

  const hours = Number(
    incoming?.hours
      ?? incoming?.durationTime
      ?? incoming?.meta?.hours
      ?? 1,
  );

  const pricingHourly = Number(incoming?.pricing?.hourly);
  if (Number.isFinite(pricingHourly) && pricingHourly > 0) {
    return Number((pricingHourly * Math.max(1, hours)).toFixed(2));
  }

  const hourlyRate = Number(incoming?.hourlyRate ?? incoming?.meta?.hourlyRate);
  if (Number.isFinite(hourlyRate) && hourlyRate > 0) {
    return Number((hourlyRate * Math.max(1, hours)).toFixed(2));
  }

  const pricingTotal = Number(incoming?.pricing?.totalPrice ?? incoming?.pricing?.basePrice);
  if (Number.isFinite(pricingTotal) && pricingTotal > 0) return pricingTotal;

  return Number.isFinite(direct) ? direct : 0;
}

function loadInitial() {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    // Heal any cart items that were persisted before the i18n-object fix —
    // their `name` may still be { en, hi, ... } and crash on render.
    const items = parsed.items.map((i) => ({ ...i, name: flattenI18nName(i.name) }));
    return { items };
  } catch {
    return { items: [] };
  }
}

function recalculate(state) {
  const subtotal = state.items.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1),
    0,
  );
  state.subtotal = Number(subtotal.toFixed(2));
  state.tax = Number((subtotal * TAX_RATE).toFixed(2));
  state.total = Number((state.subtotal + state.tax).toFixed(2));
}

function persist(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
  } catch {
    /* ignore quota errors */
  }
}

const initialState = (() => {
  const base = { items: [], subtotal: 0, tax: 0, total: 0 };
  const persisted = loadInitial();
  base.items = persisted.items;
  recalculate(base);
  return base;
})();

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const incoming = action.payload || {};
      const id = incoming.id || incoming.serviceId;
      if (!id) return;
      // Bug_86 fix (a): if the user explicitly removed this item earlier in
      // the session, do NOT let a remount-time re-sync from job/session
      // storage silently put it back. The tombstone is session-scoped so a
      // fresh navigation/login still allows re-adding via an intentional
      // user action — the caller of addToCart that wants to bypass this
      // can dispatch undoRemove() first.
      const removed = loadRemovedIds();
      if (removed.has(id)) return;

      const existing = state.items.find((i) => (i.id || i.serviceId) === id);
      if (existing) {
        existing.quantity = Number(existing.quantity || 1) + Number(incoming.quantity || 1);
        // Bug_85 fix: if a previous add lost the price (stored 0) but this
        // new payload carries a real price, heal the persisted item.
        if (!Number(existing.price)) {
          existing.price = resolvePrice(incoming);
        }
      } else {
        state.items.push({
          id,
          serviceId: incoming.serviceId || id,
          name: flattenI18nName(incoming.name),
          image: incoming.image || null,
          duration: incoming.duration || '',
          // Bug_85 fix: snapshot the resolved unit price so it survives across
          // navigation (basePrice → hourly*hours → pricing.* fallbacks).
          price: resolvePrice(incoming),
          quantity: Number(incoming.quantity || 1),
          meta: incoming.meta || null,
        });
      }
      recalculate(state);
      persist(state);
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload || {};
      const item = state.items.find((i) => (i.id || i.serviceId) === id);
      if (item) {
        item.quantity = Math.max(1, Number(quantity || 1));
        recalculate(state);
        persist(state);
      }
    },
    removeFromCart: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter((i) => (i.id || i.serviceId) !== id);
      // Bug_86 fix (a): record the tombstone so a downstream re-sync effect
      // (job → cart mirroring) can't undo this removal during the session.
      const removed = loadRemovedIds();
      removed.add(id);
      saveRemovedIds(removed);
      recalculate(state);
      persist(state);
    },
    // Bug_86 fix: explicit escape hatch — the user is intentionally re-adding
    // a service they had previously removed. Caller dispatches this BEFORE
    // addToCart to lift the tombstone for that specific id.
    undoRemove: (state, action) => {
      const id = action.payload;
      const removed = loadRemovedIds();
      removed.delete(id);
      saveRemovedIds(removed);
      // No state mutation needed — addToCart will repopulate.
      void state;
    },
    clearCart: (state) => {
      state.items = [];
      recalculate(state);
      persist(state);
      // Bug_86 fix (b): logout / successful-checkout calls clearCart — wipe
      // tombstones so the next session starts clean.
      clearRemovedIds();
    },
    hydrateCart: (state) => {
      const persisted = loadInitial();
      // Bug_86 fix (a): if persisted storage still contains an item the user
      // removed in this session, drop it on hydrate.
      const removed = loadRemovedIds();
      state.items = persisted.items.filter(
        (i) => !removed.has(i.id || i.serviceId),
      );
      recalculate(state);
      persist(state);
    },
  },
});

export const {
  addToCart,
  updateQuantity,
  removeFromCart,
  undoRemove,
  clearCart,
  hydrateCart,
} = cartSlice.actions;

export const selectCart = (state) => state.cart;
export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) =>
  state.cart.items.reduce((n, i) => n + Number(i.quantity || 1), 0);

export default cartSlice.reducer;
