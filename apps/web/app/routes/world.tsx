import { loadWorld } from "@/data/entity";
import { loadScopeIndex } from "@/data/scopeIndex";
import { i18n } from "@/i18n";
import { WorldInspector } from "@/shell/inspector/States";

import { serverIndex } from "../server/entityDeps.server";
import type { Route } from "./+types/world";
import { lensOf, shouldRevalidate as entityRevalidate } from "./entity.shared";

export const shouldRevalidate = entityRevalidate;

export async function loader() {
  return loadWorld(serverIndex(), "tree");
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return loadWorld(await loadScopeIndex(), lensOf(new URL(request.url)));
}

export function meta() {
  return [{ title: "Tree of Tongues" }, { name: "description", content: i18n.t("meta.worldDescription") }];
}

export default function WorldRoute({ loaderData }: Route.ComponentProps) {
  return <WorldInspector deeper={loaderData.deeper} />;
}
