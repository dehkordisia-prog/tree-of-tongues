import "i18next";

import type en from "./en.json";

// Typed keys: t("nav.backToStart") autocompletes and a typo fails typecheck.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
