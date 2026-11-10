import { useEffect } from "react";
import { redirect, useNavigate } from "react-router";

import { loadEntity } from "@/data/entity";
import { i18n } from "@/i18n";
import { FamilyInspector } from "@/shell/inspector/FamilyInspector";
import { Skeleton } from "@/shell/inspector/parts";
import { MissingInspector } from "@/shell/inspector/States";

import { serverDeps } from "../server/entityDeps.server";
import type { Route } from "./+types/family";
import { entityTitle, lensOf } from "./entity.shared";

export { shouldRevalidate } from "./entity.shared";

// Build time: prerendered pages read data/build from disk (react-router.config.ts lists them).
export async function loader({ params }: Route.LoaderArgs) {
  return loadEntity("family", params.glottocode, "", "tree", serverDeps());
}

// Browser: client navigations and the SPA fallback for every other Glottocode.
export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const { clientDeps } = await import("@/data/clientDeps");
  const data = await loadEntity("family", params.glottocode, url.search, lensOf(url), await clientDeps());
  if (data.status === "redirect") throw redirect(data.to);
  return data;
}

export function HydrateFallback() {
  return <Skeleton />;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const level = loaderData?.status === "ok" ? loaderData.bundle.languoid.level : "family";
  const title = entityTitle(
    loaderData,
    i18n.t(`levelLower.${level === "dialect" ? "dialect" : level === "family" ? "family" : "language"}`),
    i18n.t("meta.notFound"),
  );
  const name =
    loaderData && loaderData.status !== "redirect" ? (loaderData.label ?? loaderData.glottocode) : "";
  return [{ title }, { name: "description", content: i18n.t("meta.description", { name, level }) }];
}

export default function FamilyRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const redirectTo = loaderData.status === "redirect" ? loaderData.to : null;
  // Prerendered or dev-server data can carry a level mismatch: correct it with replace (spec 2.1).
  useEffect(() => {
    if (redirectTo) void navigate(redirectTo + window.location.search, { replace: true });
  }, [redirectTo, navigate]);
  if (loaderData.status === "redirect") return <Skeleton />;
  if (loaderData.status === "ok") return <FamilyInspector data={loaderData} />;
  return <MissingInspector data={loaderData} />;
}
