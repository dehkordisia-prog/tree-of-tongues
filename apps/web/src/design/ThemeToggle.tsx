import { useEffect, useId, useSyncExternalStore } from "react";

import { applyThemePref, readThemePref, setThemePref, subscribeThemePref, type ThemePref } from "./theme";
import { currentTheme, onThemeChange, type ThemeName } from "./tokens";

const options: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "night", label: "Night" },
  { value: "parchment", label: "Parchment" },
];

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeThemePref, readThemePref, () => "system");
}

/** The theme in effect right now (manual choice or OS preference). Prerender assumes night. */
export function useResolvedTheme(): ThemeName {
  return useSyncExternalStore(
    (cb) => onThemeChange(cb),
    () => currentTheme(),
    () => "night",
  );
}

/** Three-way theme switch: a native radio group, so arrow keys work and screen readers announce it. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const pref = useThemePref();
  const name = useId();

  // Without the inline head script, apply a stored choice after hydration (one frame of the other theme).
  useEffect(() => {
    applyThemePref(readThemePref());
  }, []);

  return (
    <fieldset className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <legend className="sr-only">Theme</legend>
      <span aria-hidden="true" className="text-small text-ink-muted me-1">
        Theme
      </span>
      <div className="inline-flex rounded-pill border border-line-strong bg-surface p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative inline-flex min-h-target min-w-target cursor-pointer items-center justify-center rounded-pill px-3 text-small text-ink-muted transition-colors duration-(--tt-dur-ui-fast) ease-standard has-checked:bg-raised has-checked:text-ink has-checked:shadow-raised has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus hover:text-ink"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={pref === o.value}
              onChange={() => setThemePref(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
