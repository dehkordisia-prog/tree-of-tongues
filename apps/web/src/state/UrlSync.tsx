// Location -> store (docs/specs/app-shell.md section 3.2). Also applies the locale rule (2.6) and
// rewrites non-canonical URLs with replace. Replaces the session-sticky src/i18n/LocaleSync.tsx.

import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";

import { getLocale, setLocale } from "@/i18n/locale";

import { shellStore, type HydrateCause } from "./shell";
import { parseShellUrl, toShellHref } from "./url";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function UrlSync() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const first = useRef(true);

  useIsoLayoutEffect(() => {
    shellStore.getState().bind((href, { replace }) => {
      void navigate(href, { replace, preventScrollReset: true });
    });
  }, [navigate]);

  useIsoLayoutEffect(() => {
    const parsed = parseShellUrl(location.pathname, location.search, { dev: import.meta.env.DEV });
    const cause: HydrateCause = first.current
      ? "load"
      : navType === "POP"
        ? "pop"
        : navType === "PUSH"
          ? "push"
          : "replace";
    first.current = false;
    const store = shellStore.getState();
    const state = { ...parsed.state };

    // Workbench pages (/design, /spike/*) are outside the shell: they only honor an explicit ?lang.
    if (!parsed.isShell) {
      const lang = new URLSearchParams(location.search).get("lang");
      if (lang && state.locale !== getLocale()) void setLocale(state.locale);
      return;
    }

    // Locale (2.6): honored on load and when the reader picks one. Back and forward keep the
    // current interface language: a restored entry with another lang is rewritten.
    if (cause === "pop" && state.locale !== store.locale) state.locale = store.locale;

    store.hydrateFromUrl(state, cause, parsed.flags);
    if (state.locale !== getLocale()) void setLocale(state.locale);

    const canonical = toShellHref(state, parsed.flags);
    if (canonical !== location.pathname + location.search) {
      void navigate(canonical + location.hash, { replace: true, preventScrollReset: true });
    }
  }, [location.pathname, location.search]);

  return null;
}
