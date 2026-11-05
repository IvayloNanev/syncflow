"use client";
import { useEffect } from "react";

export function confirmDiscard(dirty: boolean) {
  return !dirty || window.confirm("You have unsaved text. Continuing will leave or replace this editor. Discard these edits?");
}
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if(event.defaultPrevented)return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      const target = new URL(link.getAttribute("href")!, window.location.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (!confirmDiscard(true)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
}
