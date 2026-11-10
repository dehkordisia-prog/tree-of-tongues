import { useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LOCALES, LOCALE_ENDONYMS } from "@/i18n/direction";
import { useLocale } from "@/i18n/locale";

import { ensureCjkFonts } from "./cjk-fonts";

// Script specimens for the /design "Scripts" section.
//
// Rules for the samples:
// - Real text, never images. Every sample carries explicit lang and dir, never inherited: an LTR
//   sample inside an RTL page would otherwise move its final full stop to the start.
// - Samples are neutral: pangrams, numerals and language names. Each card says where its text comes from.
// - Anything that is a linguistic claim (a gloss, an IPA transcription) sits behind a TODO(verify)
//   so linguist-reviewer checks it before it ships beyond this workbench.

const ZWNJ = "‌";

type Line = {
  text: string;
  lang: string;
  /** Required: a sample must never inherit direction from the page (it flips trailing punctuation). */
  dir: "rtl" | "ltr";
  className?: string;
  style?: CSSProperties;
  /** English caption under the line. Treat as a claim: verify before reuse. */
  note?: string;
};

type Card = {
  id: string;
  labelKey:
    | "specimen.latin"
    | "specimen.turkish"
    | "specimen.persianNaskh"
    | "specimen.persianNastaliq"
    | "specimen.devanagari"
    | "specimen.han"
    | "specimen.ipa";
  face: string;
  source: string;
  lines: Line[];
  footnote?: string;
};

const display: CSSProperties = { fontFamily: "var(--font-display)" };
const ui: CSSProperties = { fontFamily: "var(--font-ui)" };

// Persian lines are shared by the Naskh and Nastaliq cards so the two styles compare like for like.
// TODO(verify): glosses below (linguist-reviewer, owner reads Persian).
const persianLines = (className: string): Line[] => [
  {
    text: "زبان فارسی",
    lang: "fa",
    dir: "rtl",
    className,
    note: "Persian language. fārsi is the romanized endonym.",
  },
  {
    text: `می${ZWNJ}شود`,
    lang: "fa",
    dir: "rtl",
    className,
    note: "ZWNJ compound (U+200C between the two parts). The parts stay separate words with a small gap.",
  },
  {
    text: "میشود",
    lang: "fa",
    dir: "rtl",
    className,
    note: "Same word without the ZWNJ (not standard spelling). Shown only to compare the join.",
  },
  { text: "۰۱۲۳۴۵۶۷۸۹", lang: "fa", dir: "rtl", className, note: "Persian digits 0 to 9, U+06F0 to U+06F9." },
  {
    text: "پارسی، چای، ژاله، گل",
    lang: "fa",
    dir: "rtl",
    className,
    note: "Words with the Persian-specific letters pe, che, zhe and gaf: Pārsi, tea, a given name (dew), flower.",
  },
  {
    text: "«آب»، «نان»؛ «چای»؟",
    lang: "fa",
    dir: "rtl",
    className,
    note: "Persian punctuation (guillemets, comma, semicolon, question mark) around water, bread, tea.",
  },
];

// TODO(verify): every note in the IPA card (linguist-reviewer). The symbol-test line is a font
// coverage test, not a transcription of any language.
const cards: Card[] = [
  {
    id: "latin",
    labelKey: "specimen.latin",
    face: "Tongues Serif (display), Tongues Sans (UI)",
    source: "Traditional English pangram, public domain. Romanization row is a project-authored letter test.",
    lines: [
      {
        text: "The quick brown fox jumps over the lazy dog.",
        lang: "en",
        dir: "ltr",
        style: display,
        className: "text-2xl",
      },
      {
        text: "The quick brown fox jumps over the lazy dog.",
        lang: "en",
        dir: "ltr",
        style: ui,
        className: "text-xl",
      },
      {
        text: "ā ē ī ō ū  ṣ ḥ ṭ ḍ ẓ  š ž č ǧ ḫ  ʿ ʾ",
        lang: "und-Latn",
        dir: "ltr",
        style: ui,
        className: "text-xl",
        note: "Letters used in scholarly romanization: macrons, dots below, carons, ayn and hamza marks.",
      },
      // The romanized endonym comes from docs/CONTENT_STYLE.md.
      {
        text: "fārsi",
        lang: "fa-Latn",
        dir: "ltr",
        style: ui,
        className: "text-xl",
        note: "Romanized endonym (CONTENT_STYLE.md).",
      },
    ],
  },
  {
    id: "turkish",
    labelKey: "specimen.turkish",
    face: "Tongues Serif, Tongues Sans (Latin Extended)",
    source: "Well-known Turkish pangram; verify wording before reuse.",
    lines: [
      // TODO(verify): the pangram and its gloss.
      {
        text: "Pijamalı hasta yağız şoföre çabucak güvendi.",
        lang: "tr",
        dir: "ltr",
        style: display,
        className: "text-2xl",
        note: "Uses all 29 letters of the Turkish alphabet. Gloss: the sick man in pyjamas quickly trusted the dark-haired driver.",
      },
      { text: "ı İ  ş Ş  ğ Ğ  ç Ç  ö Ö  ü Ü", lang: "tr", dir: "ltr", style: ui, className: "text-xl" },
    ],
  },
  {
    id: "persian-naskh",
    labelKey: "specimen.persianNaskh",
    face: "Noto Naskh Arabic",
    source: "Project-authored sample. Persian language name and digits; glosses await review.",
    lines: persianLines("script-naskh text-2xl"),
  },
  {
    id: "persian-nastaliq",
    labelKey: "specimen.persianNastaliq",
    face: "Noto Nastaliq Urdu (designed for Urdu)",
    source: "Same text as the Naskh card.",
    lines: persianLines("script-nastaliq text-2xl"),
    footnote:
      "Noto Nastaliq Urdu has no Persian language tuning. Its digits follow Urdu shapes, so ۴ ۶ ۷ may differ from Persian printing. The owner should check them.",
  },
  {
    id: "devanagari",
    labelKey: "specimen.devanagari",
    face: "Noto Sans Devanagari",
    source: "Project-authored sample: language names and numerals.",
    lines: [
      // TODO(verify): glosses and romanizations.
      {
        text: "हिन्दी",
        lang: "hi",
        dir: "ltr",
        className: "script-devanagari text-3xl",
        note: "Hindi (hindī).",
      },
      {
        text: "संस्कृत",
        lang: "sa",
        dir: "ltr",
        className: "script-devanagari text-3xl",
        note: "Sanskrit (saṃskṛta).",
      },
      {
        text: "०१२३४५६७८९",
        lang: "hi",
        dir: "ltr",
        className: "script-devanagari text-2xl",
        note: "Devanagari digits 0 to 9.",
      },
      {
        text: "क्ष  त्र  ज्ञ  श्र",
        lang: "hi",
        dir: "ltr",
        className: "script-devanagari text-2xl",
        note: "Conjunct clusters.",
      },
    ],
  },
  {
    id: "han",
    labelKey: "specimen.han",
    face: "Noto Sans SC (loaded in slices on demand)",
    source: "Project-authored sample: language names and numerals, Simplified forms.",
    lines: [
      // TODO(verify): glosses and pinyin.
      {
        text: "汉语",
        lang: "zh-Hans",
        dir: "ltr",
        className: "script-cjk text-3xl",
        note: "Chinese language (Hànyǔ).",
      },
      {
        text: "中文",
        lang: "zh-Hans",
        dir: "ltr",
        className: "script-cjk text-3xl",
        note: "Chinese (Zhōngwén).",
      },
      {
        text: "一二三四五六七八九十",
        lang: "zh-Hans",
        dir: "ltr",
        className: "script-cjk text-2xl",
        note: "Numerals one to ten.",
      },
    ],
    footnote: "Traditional, Japanese and Korean regional forms need their own faces and are not loaded yet.",
  },
  {
    id: "ipa",
    labelKey: "specimen.ipa",
    face: "Charis SIL",
    source:
      "Persian entry from docs/CONTENT_STYLE.md. Other lines are project-authored textbook examples and a symbol test.",
    lines: [
      // TODO(verify): /ɒːb/ for آب (CONTENT_STYLE.md example).
      {
        text: "/ɒːb/",
        lang: "fa-fonipa",
        dir: "ltr",
        className: "text-2xl",
        note: "Persian آب (āb), broad. Meaning: water.",
      },
      // TODO(verify): broad and narrow forms of English "pin".
      {
        text: "/pɪn/  [pʰɪn]",
        lang: "en-fonipa",
        dir: "ltr",
        className: "text-2xl",
        note: "English pin: broad in slashes, narrow in brackets (aspirated p).",
      },
      // TODO(verify): Mandarin tone letters for the four tones of ma.
      {
        text: "ma˥  ma˧˥  ma˨˩˦  ma˥˩",
        lang: "cmn-fonipa",
        dir: "ltr",
        className: "text-2xl",
        note: "Mandarin ma with Chao tone letters for tones 1 to 4.",
      },
      {
        text: "t͡ʃ d͡ʒ n̥ ã ẽ ɔ̃ kʼ tʰ ɡʷ ə̯ ɪ̈ ɚ ʔ ʕ ħ ɬ ǃ ǀ",
        lang: "und-fonipa",
        dir: "ltr",
        className: "text-2xl",
        note: "Symbol test: tie bar, voiceless ring, nasal tilde, ejective, labialization, non-syllabic, clicks. Not a transcription of any language.",
      },
    ],
  },
];

const casingSample = "istanbul ışık ılık";
const casingLowerSample = "DİYARBAKIR IŞIK";

function CasingDemo({ H }: { H: "h3" | "h4" }) {
  const { t } = useTranslation();
  // The same sample, three ways. toLocaleUpperCase("tr") maps i to İ and ı to I.
  const rows = [
    {
      label: t("specimen.casingDefault"),
      upper: casingSample.toUpperCase(),
      lower: casingLowerSample.toLowerCase(),
    },
    {
      label: t("specimen.casingTurkish"),
      upper: casingSample.toLocaleUpperCase("tr"),
      lower: casingLowerSample.toLocaleLowerCase("tr"),
    },
  ];
  return (
    <article
      aria-labelledby="specimen-casing"
      className="rounded-lg border border-current/25 p-4 md:col-span-2"
    >
      <H id="specimen-casing" className="text-lg font-semibold">
        {t("specimen.turkishCasing")}
      </H>
      <p lang="tr" className="mt-2 text-xl" style={ui}>
        {casingSample}
      </p>
      <table className="mt-3 w-full text-start text-lg">
        <thead>
          <tr>
            <th scope="col" className="pe-4 text-start text-sm font-semibold"></th>
            <th scope="col" className="pe-4 text-start text-sm font-semibold">
              {t("specimen.casingUpper")}
            </th>
            <th scope="col" className="text-start text-sm font-semibold">
              {t("specimen.casingLower")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="pe-4 py-1 text-start text-sm font-normal">
                {row.label}
              </th>
              <td lang="tr" className="pe-4 py-1">
                {row.upper}
              </td>
              <td lang="tr" className="py-1">
                {row.lower}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="pe-4 py-1 text-start text-sm font-normal">
              {t("specimen.casingCss")}
            </th>
            <td className="pe-4 py-1">
              <span lang="tr" style={{ textTransform: "uppercase" }}>
                {casingSample}
              </span>
              <span className="ms-2 text-sm">(tr)</span>
              <br />
              <span lang="en" style={{ textTransform: "uppercase" }}>
                {casingSample}
              </span>
              <span className="ms-2 text-sm">(en)</span>
            </td>
            <td className="py-1">
              <span lang="tr" style={{ textTransform: "lowercase" }}>
                {casingLowerSample}
              </span>
              <span className="ms-2 text-sm">(tr)</span>
              <br />
              <span lang="en" style={{ textTransform: "lowercase" }}>
                {casingLowerSample}
              </span>
              <span className="ms-2 text-sm">(en)</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-sm">{t("specimen.projectSample")} Rule: toLocaleUpperCase(&quot;tr&quot;).</p>
    </article>
  );
}

/** Links that switch the interface language through ?lang=. The URL is the source of truth. */
function LocaleLinks() {
  const { t } = useTranslation();
  const active = useLocale();
  return (
    <nav aria-label={t("nav.interfaceLanguage")}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              to={{ search: `?lang=${locale}` }}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === active ? "true" : undefined}
              className={locale === active ? "font-semibold" : undefined}
            >
              {LOCALE_ENDONYMS[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ScriptSpecimen({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const { t } = useTranslation();
  const H = headingLevel === 3 ? "h3" : "h4";

  // Han is on demand: add its @font-face stylesheet only when this component is on the page.
  useEffect(() => {
    ensureCjkFonts();
  }, []);

  return (
    <div className="space-y-6">
      <LocaleLinks />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.id}
            aria-labelledby={`specimen-${card.id}`}
            className="rounded-lg border border-current/25 p-4"
          >
            <H id={`specimen-${card.id}`} className="text-lg font-semibold">
              {t(card.labelKey)}
            </H>
            {card.lines.map((line, index) => (
              <div key={index} className="mt-3">
                <p data-sample lang={line.lang} dir={line.dir} className={line.className} style={line.style}>
                  {line.text}
                </p>
                {line.note && (
                  <p lang="en" dir="ltr" className="mt-1 text-sm">
                    {line.note}
                  </p>
                )}
              </div>
            ))}
            <p lang="en" dir="ltr" className="mt-4 text-sm">
              <strong className="font-semibold">{t("specimen.face")}:</strong> {card.face}
              <br />
              <strong className="font-semibold">{t("specimen.source")}:</strong> {card.source}
            </p>
            {card.footnote && (
              <p lang="en" dir="ltr" className="mt-2 text-sm">
                {card.footnote}
              </p>
            )}
          </article>
        ))}
        <CasingDemo H={H} />
      </div>
    </div>
  );
}
