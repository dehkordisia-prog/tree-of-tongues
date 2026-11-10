import { useEffect } from "react";
import { useLocation } from "react-router";

import { localeFromSearch } from "./direction";
import { setLocale } from "./locale";

/**
 * Applies ?lang=fa|tr|en after hydration. A URL without ?lang keeps the current locale for
 * the session, so in-app links need not repeat it. Use ?lang=en to go back.
 */
export function LocaleSync() {
  const { search } = useLocation();
  useEffect(() => {
    const requested = localeFromSearch(search);
    if (requested) void setLocale(requested);
  }, [search]);
  return null;
}
