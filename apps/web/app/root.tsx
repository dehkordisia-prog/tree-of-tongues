import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import { I18nextProvider } from "react-i18next";

import "@/design/fonts.css";
import { THEME_INIT_SCRIPT } from "@/design/theme";
import { htmlAttributes } from "@/i18n/direction";
import { i18n } from "@/i18n";
import { LocaleSync } from "@/i18n/LocaleSync";
import { useLocale } from "@/i18n/locale";

import type { Route } from "./+types/root";
import "./app.css";

// Only what the first paint needs: the Latin UI face and the Latin display face (about 130 KB).
// Script faces (Persian, Devanagari, Han, IPA) load on demand through unicode-range.
// Preloaded fonts need crossOrigin even when same-origin.
const preloadFont = (href: string) => ({
  rel: "preload",
  href,
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous" as const,
});
export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  preloadFont("/fonts/tongues-sans/tongues-sans-latin-wght-normal.woff2"),
  preloadFont("/fonts/tongues-serif/tongues-serif-latin-wght-normal.woff2"),
];

// Default title, so error and not-found pages still have one (WCAG 2.4.2).
export function meta() {
  return [{ title: "Tree of Tongues" }];
}

// Fonts are self-hosted (no third-party requests, CLAUDE.md rule 11).
// lang and dir follow the active locale. Prerendered HTML is always English; the locale store
// serves "en" during hydration and switches right after (see src/i18n/locale.ts).
export function Layout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = htmlAttributes(useLocale());
  return (
    // suppressHydrationWarning covers one level only: it lets a pre-hydration inline script
    // (for example the theme script) set attributes on <html> without a mismatch warning.
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Applies a saved manual theme before first paint, so it never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>
          {children}
          <LocaleSync />
        </I18nextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : "Error";
    details = error.status === 404 ? "This page does not exist." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1>{message}</h1>
      <p>{details}</p>
      <p>
        <a href="/">Back to the start</a>
      </p>
      {stack && (
        <pre className="overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
