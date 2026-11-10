# Self-hosted fonts

All fonts are SIL Open Font License 1.1. Each folder holds its own OFL.txt with the copyright line.
No font is requested from a third party at runtime. The @font-face rules live in
apps/web/src/design/fonts.css. The Han rules live in noto-sans-sc/noto-sans-sc.css and load on
demand through ensureCjkFonts().

| Folder | Font | Version and source | Copyright |
| --- | --- | --- | --- |
| tongues-serif | Tongues Serif: web subset of Adobe Source Serif 4, variable weight 200 to 900, opsz fixed at 36, roman | Built by scripts/build_fonts.py from source-serif-4.005_Desktop.zip, file VAR/SourceSerif4Variable-Roman.ttf, release 4.005R, github.com/adobe-fonts/source-serif | Copyright 2014 - 2023 Adobe, Reserved Font Name 'Source' |
| tongues-sans | Tongues Sans: web subset of Adobe Source Sans 3, variable weight 200 to 900, roman and italic | Built by scripts/build_fonts.py from VF-source-sans-3.052R.zip, files VF/SourceSans3VF-Upright.ttf and VF/SourceSans3VF-Italic.ttf, release 3.052R, github.com/adobe-fonts/source-sans | OFL.txt says 2010-2022 Adobe (LICENSE.md at tag 3.052R); the font's own name ID 0 says 2023; upstream main now says 2010-2024. Reserved Font Name 'Source' |
| charis-sil | Charis 7.000, Regular (SIL renamed the family from "Charis SIL" to "Charis" in version 7; our CSS keeps the alias "Charis SIL") | github.com/silnrsi/font-charis release v7.000 (2025-06-02), official web/Charis-Regular.woff2, unmodified | Copyright 1997-2025 SIL Global, Reserved Font Names "Charis" and "SIL" |
| noto-naskh-arabic | Noto Naskh Arabic, variable wght, Arabic subset | @fontsource-variable/noto-naskh-arabic 5.3.0; upstream github.com/notofonts/arabic | Copyright 2022 The Noto Project Authors |
| noto-nastaliq-urdu | Noto Nastaliq Urdu, variable wght, Arabic subset | @fontsource-variable/noto-nastaliq-urdu 5.3.0; upstream github.com/notofonts/nastaliq | Copyright 2022 The Noto Project Authors |
| noto-sans-devanagari | Noto Sans Devanagari, variable wght, Devanagari subset | @fontsource-variable/noto-sans-devanagari 5.3.0; upstream github.com/notofonts/devanagari | Copyright 2022 The Noto Project Authors |
| noto-sans-sc | Noto Sans SC, variable wght, 101 unicode-range slices | @fontsource-variable/noto-sans-sc 5.3.1; upstream github.com/notofonts/noto-cjk | Copyright 2014-2021 Adobe, Reserved Font Name "Source" |

## How the files were obtained
- **Tongues Sans and Tongues Serif** are built from Adobe's official releases by
  `uv run python scripts/build_fonts.py`. Inputs (zip URL, sha256, member files, licence text) and the
  sha256 of every output are pinned in scripts/fonts-build.lock.json. The zips are cached in
  data/raw/fonts-src/ (gitignored). `--check` rebuilds and confirms the committed files are
  byte-identical. The script also writes src/design/fonts.tongues.css.
- **Why renamed:** Adobe's licence reserves the name "Source". A web subset is a Modified Version
  (OFL FAQ 2.6 to 2.8), so it may not keep that name. Name IDs 1, 3, 4, 6, 25, the variable-font
  instance names and the STAT names no longer say "Source". Copyright (ID 0), trademark (ID 7) and licence
  (IDs 13, 14) are unchanged. The modification note is in name ID 10 and in each folder's FONTLOG.txt.
- **Noto Naskh, Nastaliq, Devanagari and Noto Sans SC** come from Fontsource (`npm pack` into a scratch folder,
  woff2 copied unchanged). Their OFL.txt lines match name ID 0 in the font files. The Noto Sans SC OFL.txt
  comes from github.com/google/fonts. Rights-auditor owns the question of whether Google's pre-made slices
  of Noto Sans SC (Reserved Font Name 'Source', Adobe) are acceptable.
- **Charis** comes straight from the SIL release, unmodified.

## Notes
- Charis is the unmodified official WOFF2 (312 KB) because subsetting would force a rename.
  Phase 1 option: a renamed IPA subset of about 60 KB, built the same way as Tongues Sans.
- Only Charis Regular ships. Bold and italic IPA are synthesized by the browser.
- Tongues Serif keeps no optical-size axis. Opsz is fixed at 36, a heading size. Keeping the axis
  would add about 110 KB to the Latin slice.
