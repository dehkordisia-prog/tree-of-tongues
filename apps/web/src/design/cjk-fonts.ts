// Han text is on demand. The 101 Noto Sans SC slices are declared in a separate stylesheet
// (about 96 KB of @font-face rules) that loads only when something asks for it.
// Each slice font file still downloads only when one of its characters is on the page.

const HREF = "/fonts/noto-sans-sc/noto-sans-sc.css";

/** Add the Han @font-face stylesheet to the document once. Client only; a no-op during prerender. */
export function ensureCjkFonts(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-cjk-fonts]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HREF;
  link.dataset.cjkFonts = "";
  document.head.append(link);
}
