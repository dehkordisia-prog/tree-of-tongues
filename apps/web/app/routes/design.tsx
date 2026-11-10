import { Link } from "react-router";

export function meta() {
  return [{ title: "Design system · Tree of Tongues" }];
}

// Placeholder. ux-designer and script-typographer replace this in Phase 0, step 2.
export default function Design() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl">Design system</h1>
      <p className="mt-4">Tokens and type are on the way.</p>
      <p className="mt-4">
        <Link to="/">Back to the start</Link>
      </p>
    </main>
  );
}
