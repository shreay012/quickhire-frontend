'use client';

/**
 * ExtensionAttrsCleaner — strip attributes injected by browser extensions
 * (Bitdefender Anti-Tracker etc.) AFTER React has hydrated.
 *
 * Why client-side useEffect (not an inline <script> in <head>):
 *   Some Bitdefender modules actively REWRITE inline <script> tags in the
 *   SSR HTML, replacing their content with a chrome-extension://… reference.
 *   That triggers a SSR/client hydration mismatch. By keeping this logic
 *   out of the server-rendered HTML entirely, there's nothing to mismatch.
 *
 * What it strips:
 *   • bis_skin_checked        (Bitdefender Anti-Tracker)
 *   • bis_register            (related Bitdefender flag)
 *   • bis_size                (some Bitdefender variants)
 *
 * Safe in production: if no extension is present the MutationObserver
 * simply never fires. ~30 lines of overhead, mounted once at root.
 */

import { useEffect } from 'react';

const ATTRS = ['bis_skin_checked', 'bis_register', 'bis_size'];

export default function ExtensionAttrsCleaner() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const strip = (el) => {
      if (!el || !el.removeAttribute) return;
      for (const a of ATTRS) el.removeAttribute(a);
    };

    // Initial sweep — anything the extension stamped on between SSR and now.
    try {
      const sel = ATTRS.map((a) => `[${a}]`).join(', ');
      document.querySelectorAll(sel).forEach(strip);
    } catch { /* selector may be invalid in obscure browsers; harmless */ }

    // Live observer — catch future injections without blocking layout.
    let obs;
    try {
      obs = new MutationObserver((muts) => {
        for (const mut of muts) {
          if (mut.type === 'attributes' && ATTRS.includes(mut.attributeName)) {
            strip(mut.target);
          } else if (mut.type === 'childList') {
            for (const node of mut.addedNodes) {
              if (node && node.nodeType === 1) strip(node);
            }
          }
        }
      });
      obs.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ATTRS,
      });
    } catch { /* MutationObserver unsupported in very old browsers */ }

    return () => { try { obs?.disconnect(); } catch { /* noop */ } };
  }, []);

  return null;
}
