// Translated text with the right lang and dir. A key without a translation yet falls back to English
// and keeps lang="en" dir="ltr" inside a Persian page (useTx).

import type { ParseKeys, TOptions } from "i18next";
import type { ElementType, HTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

import { useTx } from "@/i18n/useTx";

type Props = { k: ParseKeys; o?: TOptions; as?: ElementType } & HTMLAttributes<HTMLElement> & {
    htmlFor?: string;
  };

export function T({ k, o, as: Tag = "span", ...rest }: Props) {
  const tx = useTx();
  const r = tx(k, o);
  return (
    <Tag lang={r.lang} dir={r.dir} {...rest}>
      {r.text}
    </Tag>
  );
}

/** Plain strings for attributes (aria-label, title). */
export function useT() {
  const { t } = useTranslation();
  return (k: ParseKeys, o?: TOptions): string => String(t(k as never, o as never));
}

export function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const p =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(p);
}

/** Small inline icons. Pointing icons mirror in RTL (class tt-mirror). */
export function Icon({
  name,
  className = "",
}: {
  name:
    | "search"
    | "tree"
    | "map"
    | "settings"
    | "chevron"
    | "close"
    | "link"
    | "collapse"
    | "plus"
    | "minus"
    | "home"
    | "info";
  className?: string;
}) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className,
  };
  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
      );
    case "tree":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="10" r="3.2" />
          <circle cx="15.5" cy="14" r="2.5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common} className={`tt-mirror ${className}`}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common} className={`tt-mirror ${className}`}>
          <path d="M14 5l7 7-7 7M4 4v16" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
        </svg>
      );
    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7.5v.5" />
        </svg>
      );
  }
}
