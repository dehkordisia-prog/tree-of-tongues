# Quick prototype prompt

Paste this into any Claude chat, with reference/infographic.png attached, to feel the interaction in about ten minutes before the real build. It is a sketch, not the product.

---

Build a single self-contained HTML page called "Tree of Tongues: prototype". Inline CSS and JavaScript; you may load d3 v7, topojson-client and world-atlas (countries-110m) from jsdelivr.

Data: about 30 languages from the attached chart across six families (Indo-European, Sino-Tibetan, Afro-Asiatic, Turkic, Austronesian, Niger-Congo). For each: English name, endonym in native script with romanization, family path, approximate L1 and total speakers labeled "approximate, prototype data", 3 to 5 main countries (ISO codes), script, a greeting with romanization, and one surprising fact. Give Persian, Turkish and English extra depth: three historical stages each, with dates.

Interactions:
1. A zoomable circle-packing tree (family, branch, language). Clicking zooms with a smooth camera (d3.interpolateZoom), dims siblings and updates a breadcrumb; Esc zooms out.
2. A side panel for the selected node: names, speakers, countries, stages, and a "Go deeper" row of three related languages.
3. A world map (d3-geo, Natural Earth projection): selecting a language highlights its countries; clicking a country lists its languages.
4. A "Hear it" button that uses the browser's speechSynthesis with the language's BCP-47 code when a matching voice exists, labeled "Synthetic: your browser's voice"; hide it when no voice exists.
5. A year slider from 1500 to 2025 that changes the Persian, Turkish and English bubble sizes from three or four rough keyframes, labeled "illustrative".

Style: dark "observatory" theme, luminous family colors, serif headings, keyboard accessible, reduced motion respected. Write "Persian", never "Farsi". No em dashes anywhere in the text.
