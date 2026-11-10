import { Link } from "react-router";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Tree of Tongues" },
    { name: "description", content: "An interactive atlas of the world's languages. Work in progress." },
  ];
}

const workbenches = [
  { to: "/design", label: "Design system", note: "Tokens, type and scripts" },
  { to: "/spike/tree", label: "Tree spike", note: "Every Glottolog languoid, zoomable" },
  { to: "/spike/map", label: "Map spike", note: "Language points and countries" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl">Tree of Tongues</h1>
      <p className="mt-4">An atlas of the world's languages. Phase 0: foundations.</p>
      <nav aria-label="Workbenches" className="mt-8">
        <ul className="space-y-3">
          {workbenches.map((w) => (
            <li key={w.to}>
              <Link to={w.to}>{w.label}</Link>
              <span className="ms-2 opacity-80">{w.note}</span>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
