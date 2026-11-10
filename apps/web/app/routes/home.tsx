import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useTx } from "@/i18n/useTx";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Tree of Tongues" },
    { name: "description", content: "An interactive atlas of the world's languages. Work in progress." },
  ];
}

const workbenches = [
  { to: "/design", key: "design" },
  { to: "/spike/tree", key: "tree" },
  { to: "/spike/map", key: "map" },
] as const;

export default function Home() {
  const { t } = useTranslation();
  const tx = useTx();
  return (
    <main className="mx-auto max-w-3xl px-gutter py-12">
      <h1 className="text-hero">{t("app.title")}</h1>
      <p className="mt-4 text-lead text-ink-muted">{t("app.tagline")}</p>
      <nav aria-label={t("nav.workbenches")} className="mt-10">
        <ul className="grid gap-3">
          {workbenches.map((w) => (
            <li key={w.to} className="flex flex-col rounded-lg border border-line bg-surface px-4 py-2 shadow-raised">
              <WorkbenchItem
                to={w.to}
                label={tx(`workbench.${w.key}.label`)}
                note={tx(`workbench.${w.key}.note`)}
              />
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

type Tx = ReturnType<ReturnType<typeof useTx>>;

// A missing translation falls back to English; lang and dir keep that English text correct
// inside an RTL page.
function WorkbenchItem({ to, label, note }: { to: string; label: Tx; note: Tx }) {
  return (
    <>
      <Link to={to} lang={label.lang} dir={label.dir} className="inline-flex min-h-target items-center self-start font-display text-title-sm">
        {label.text}
      </Link>
      <span className="pb-2 text-small text-ink-muted" lang={note.lang} dir={note.dir}>
        {note.text}
      </span>
    </>
  );
}
