import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import arCommon from "./locales/ar/common.json";
import enOnboarding from "./locales/en/onboarding.json";
import arOnboarding from "./locales/ar/onboarding.json";
import enCreateDeal from "./locales/en/createDeal.json";
import arCreateDeal from "./locales/ar/createDeal.json";

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;
export const RTL_LANGUAGES = ["ar"];

export function isRtl(lng: string | undefined): boolean {
  return RTL_LANGUAGES.includes((lng || "en").split("-")[0]);
}

export function applyDocumentDirection(lng: string | undefined): void {
  const lang = (lng || "en").split("-")[0];
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, onboarding: enOnboarding, createDeal: enCreateDeal },
      ar: { common: arCommon, onboarding: arOnboarding, createDeal: arCreateDeal },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ar"],
    ns: ["common", "onboarding", "createDeal"],
    defaultNS: "common",
    detection: {
      // Query string (?lng=ar) wins for deep links; otherwise localStorage; otherwise
      // the English fallback. No navigator detection, so the default stays English
      // unless the user explicitly picks Arabic.
      order: ["querystring", "localStorage"],
      caches: ["localStorage"],
      lookupQuerystring: "lng",
      lookupLocalStorage: "qld_lang",
    },
    interpolation: { escapeValue: false },
  });

applyDocumentDirection(i18n.language);
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
