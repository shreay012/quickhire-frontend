import { useRef, useCallback } from 'react';
import {
  createGuestSession,
  getGuestSession,
  updateGuestSession,
  claimGuestSession,
} from '../services/guestSessionApi';

const LS_KEY = '_guest_session_id';

/**
 * Manages a server-side guest booking session so that:
 * - refresh on any step restores exactly where the user was
 * - on login, the session is claimed → a real job is created server-side
 *
 * Usage:
 *   const { init, load, save, claim } = useGuestSession();
 *
 *   // On stepper mount (guest only): load or create
 *   const sessionData = await load() ?? (await init(), null);
 *
 *   // After each step's Continue:
 *   await save({ step: 1, serviceId, techIds, techNames });
 *
 *   // After successful OTP verification:
 *   const { jobId } = await claim() ?? {};
 */
export function useGuestSession() {
  const idRef = useRef(
    typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null,
  );

  // Create a fresh session on the server, store the ID locally
  const init = useCallback(async () => {
    if (idRef.current) return idRef.current;
    try {
      const res = await createGuestSession();
      const id = res.data?.data?.id;
      if (id) {
        idRef.current = id;
        if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  }, []);

  // Load existing session from server (returns null if not found / expired)
  const load = useCallback(async () => {
    const id = idRef.current;
    if (!id) return null;
    try {
      const res = await getGuestSession(id);
      return res.data?.data ?? null;
    } catch (err) {
      if ([404, 410].includes(err?.response?.status)) {
        if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
        idRef.current = null;
      }
      return null;
    }
  }, []);

  // Persist current step state (fire-and-forget — never blocks the UI)
  const save = useCallback(
    async (data) => {
      let id = idRef.current;
      if (!id) id = await init();
      if (!id) return;
      try {
        await updateGuestSession(id, data);
      } catch {
        // silent — session save is best-effort
      }
    },
    [init],
  );

  // Claim the session after login — server creates a job and returns its ID
  const claim = useCallback(async () => {
    const id = idRef.current;
    if (!id) return null;
    try {
      const res = await claimGuestSession(id);
      if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
      idRef.current = null;
      return res.data?.data ?? null; // { jobId } or { alreadyClaimed: true }
    } catch {
      return null;
    }
  }, []);

  const getSessionId = useCallback(() => idRef.current, []);

  return { init, load, save, claim, getSessionId };
}
