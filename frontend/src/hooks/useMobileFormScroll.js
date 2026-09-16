import { useEffect } from "react";

/**
 * On mobile, the soft keyboard covers bottom form actions (Sign in, etc.).
 * Scroll the focused field / nearby submit button into view, and pad the
 * scroll container using visualViewport keyboard inset.
 */
export function useMobileFormScroll(containerRef) {
  useEffect(() => {
    const root = containerRef?.current;
    if (!root) return;

    const syncKeyboardPad = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--kb-inset", "0px");
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb-inset", `${Math.round(inset)}px`);
    };

    const bringActionsIntoView = (target) => {
      syncKeyboardPad();
      const form = target.closest("form, .auth-form, .auth-provider-stack, .lumen-panel");
      const action =
        form?.querySelector(".join-btn, .lumen-cta, button[type='submit']") || target;

      // Prefer keeping the CTA in the visible area above the keyboard.
      action.scrollIntoView({ block: "nearest", behavior: "smooth", inline: "nearest" });
      // Nudge a bit further so the button isn't flush against the keyboard edge.
      window.setTimeout(() => {
        const vv = window.visualViewport;
        if (!vv || !root) return;
        const actionRect = action.getBoundingClientRect();
        const safeBottom = vv.height - 24;
        if (actionRect.bottom > safeBottom) {
          root.scrollBy({
            top: actionRect.bottom - safeBottom + 16,
            behavior: "smooth",
          });
        }
      }, 80);
    };

    const onFocusIn = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, textarea, select")) return;

      // Wait for keyboard animation, then keep field + following actions visible.
      window.setTimeout(() => bringActionsIntoView(target), 280);
      window.setTimeout(() => bringActionsIntoView(target), 550);
    };

    syncKeyboardPad();
    root.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", syncKeyboardPad);
    window.visualViewport?.addEventListener("scroll", syncKeyboardPad);
    window.addEventListener("resize", syncKeyboardPad);

    return () => {
      root.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", syncKeyboardPad);
      window.visualViewport?.removeEventListener("scroll", syncKeyboardPad);
      window.removeEventListener("resize", syncKeyboardPad);
    };
  }, [containerRef]);
}
