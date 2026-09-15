import { useCallback, useEffect, useRef } from "react";

const focusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true",
  );
}

export function useModalFocus<T extends HTMLElement>(open: boolean) {
  const dialogRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const explicitOpenerRef = useRef<HTMLElement | null>(null);
  const rememberOpener = useCallback((element: HTMLElement) => {
    explicitOpenerRef.current = element;
    previousFocusRef.current = element;
  }, []);

  useEffect(() => {
    if (open) return;
    const rememberTarget = (event: Event) => {
      if (event.target instanceof HTMLElement && !dialogRef.current?.contains(event.target))
        previousFocusRef.current = event.target;
    };
    if (document.activeElement instanceof HTMLElement)
      previousFocusRef.current = document.activeElement;
    document.addEventListener("focusin", rememberTarget);
    document.addEventListener("pointerdown", rememberTarget, true);
    return () => {
      document.removeEventListener("focusin", rememberTarget);
      document.removeEventListener("pointerdown", rememberTarget, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;

    const focusable = focusableElements(dialog);
    if (!dialog.contains(document.activeElement)) (focusable[0] || dialog).focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const modalDialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      );
      if (modalDialogs.at(-1) !== dialog) return;
      const available = focusableElements(dialog);
      if (available.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = available[0];
      const last = available.at(-1) || first;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", trapFocus);
    const previousFocus = explicitOpenerRef.current || previousFocusRef.current;
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      explicitOpenerRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return { dialogRef, rememberOpener };
}
