import { Link } from "react-router";

export function meta() {
  return [{ title: "Map spike · Tree of Tongues" }];
}

// Placeholder. cartographer replaces this in Phase 0, step 4.
export default function MapSpike() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl">Map spike</h1>
      <p className="mt-4">The map is not built yet.</p>
      <p className="mt-4">
        <Link to="/">Back to the start</Link>
      </p>
    </main>
  );
}
