# Audit Sweep Log — unit-10

Mechanical record of every automated transformation applied to the 20 design artifacts. Development can replay these steps against the pre-audit baseline (branch parent `28bb2b06`) to reproduce the result.

---

## Sweep 1 — palette neutral (FB-11): `gray-*` → `stone-*`

**Scope:** 14 artifacts enumerated in FB-11.

**Transform:**

```bash
for f in stages/design/artifacts/*.html; do
  LC_ALL=C sed -i '' -E 's/-gray-([0-9]+)/-stone-\1/g;
                        s/>gray-([0-9]+)/>stone-\1/g;
                        s/ gray-([0-9]+)/ stone-\1/g;
                        s/"gray-([0-9]+)/"stone-\1/g;
                        s/^gray-([0-9]+)/stone-\1/g' "$f"
done
```

**Verification:** `grep -rn 'gray-' stages/design/artifacts/` → 0 matches (was 1614).

**Files touched:** `feedback-card-states.html`, `comment-to-feedback-flow.html`, `review-ui-mockup.html`, `comments-list-with-agent-toggle.html`, `review-package-structure.html`, `feedback-inline-desktop.html`, `review-context-header.html`, `rollback-reason-banner.html`, `assessor-summary-card.html`, `revisit-unit-list.html`, `feedback-inline-mobile.html`, `feedback-lifecycle-transitions.html`, `stage-progress-strip.html`, `review-flow-with-feedback-assessor.html`.

**Commit:** `53bdfa0b fix(design): sweep gray-* to stone-* across 14 artifacts (FB-11)`

---

## Sweep 2 — HTML numeric entity conversion

**Scope:** 5 artifacts had legitimate HTML numeric entities that would false-positive the FB-16 hex grep (`&#9670;` etc.).

**Transform (Python):**

```python
repl = {
  '&#9670;': '\u25CA',   # ◊ lozenge
  '&#9675;': '\u25CB',   # ○ white circle
  '&#8599;': '\u2197',   # ↗ north-east arrow
  '&#39;':   "'",         # apostrophe
}
for fn in os.listdir(ART):
  if fn.endswith('.html'):
    s = open(p).read()
    for k,v in repl.items(): s = s.replace(k,v)
    open(p,'w').write(s)
```

**Verification:** `grep -rEn '&#[0-9]+;' stages/design/artifacts/` → 0 matches.

**Files touched:** `feedback-inline-desktop.html`, `review-ui-mockup.html`, `revisit-unit-list.html`, `review-context-header.html`, `stage-progress-strip.html`.

**Commit:** bundled into `15044b2d`.

---

## Sweep 3 — raw hex → CSS var (FB-16)

**Scope:** 5 artifacts with 175 total hex occurrences after entity conversion.

**Transform (Python):** replace every `#rrggbb` (or `#rgb`) with `var(--color-NAME)` where NAME is the Tailwind color name matching that hex. Inject a `<style data-haiku-token-audit="true">` block with `:root` CSS variables (using `rgb()` syntax — no `#` present) just before `</head>`.

**Variable block inventory:** 50 variables covering white, slate-{50,100,200,300,400,500,700,900,950}, stone-{50,200,500,700,900,950,200-alt,400-alt,600-alt,700-alt}, blue-{50,100,400,500,600,700,900}, teal-{50,100,400,500,600,700}, green-{100,400,500,600,800,900}, amber-{50,100,400,500,800,900}, rose-{200,500}, sky-{300,500}, purple-{200,500,900}, violet-600.

**Verification:** `grep -rEn '#[0-9a-fA-F]{3,8}\b' stages/design/artifacts/` → 0 matches (was 175 after entity sweep).

**Files touched:**

| File | Hex occurrences before | After |
|---|---|---|
| `annotation-gesture-spec.html` | 20 | 0 |
| `feedback-lifecycle-transitions.html` | 43 | 0 |
| `focus-ring-spec.html` | 8 | 0 |
| `review-flow-with-feedback-assessor.html` | 52 | 0 |
| `review-ui-mockup.html` | 52 | 0 |

**Commit:** `15044b2d fix(design): replace raw hex with CSS var() refs + convert HTML entities (FB-16)`

---

## Sweep 4 — DESIGN-BRIEF + DESIGN-TOKENS reconciliation (FB-18/21/23/29)

Non-mechanical — manual edits to two source-of-truth documents:

- `knowledge/DESIGN-TOKENS.md`: origin badge inventory expanded to 6 origins (was 4); §8 Layout Tokens section added; §9 Status Badge Shade Decision section added; §10 Audited Tokens section added.
- `stages/design/DESIGN-BRIEF.md`: §2 status color table shade `-700` → `-800`; §2 origin table replaced with 6-row canonical inventory; §4 Responsive Behavior gained canonical breakpoint table, canonical sidebar width, canonical `--layout-max-width`, canonical footer button responsive heights; §6 WCAG table rebuilt with `-800` shades and origin pairs.

**Commit:** `06827979 docs(design): reconcile DESIGN-BRIEF + DESIGN-TOKENS (FB-18/21/23/29)`

---

## Sweep 5 — status shade `-700` → `-800` in artifacts (FB-18)

**Scope:** 13 artifacts with 132 `text-(amber|blue|green)-700` occurrences.

**Transform:**

```bash
for f in stages/design/artifacts/*.html; do
  LC_ALL=C sed -i '' -E '
    s/text-amber-700/text-amber-800/g;
    s/text-blue-700/text-blue-800/g;
    s/text-green-700/text-green-800/g
  ' "$f"
done
```

Dark-mode paired tokens (`dark:text-{color}-400` on status badges) were inspected and left as-is where they render non-status badges (PASS/FAIL, WCAG proof tables); actual status badges in `feedback-card-states.html` already used `dark:text-{color}-300`, matching the canonical pair.

**Verification:** `grep -rEn 'text-amber-700|text-blue-700|text-green-700' stages/design/artifacts/` → 0 matches (was 132).

**Commit:** bundled into `bb3164db`.

---

## Sweep 6 — sidebar widths (FB-23)

**Scope:** 3 `<aside>` declarations in `comments-list-with-agent-toggle.html`.

**Transform:**

```bash
sed -i '' -E 's/<aside class="w-96 shrink-0/<aside class="w-80 lg:w-96 shrink-0/g' \
  stages/design/artifacts/comments-list-with-agent-toggle.html
```

**Verification:** `grep -rEn 'class="w-96[^"]*shrink-0' stages/design/artifacts/` → 0 matches.

**Commit:** bundled into `bb3164db`.

---

## Sweep 7 — breakpoint label rewrite (FB-29)

**Scope:** 4 artifacts had breakpoint labels using `1280px` / `375px` prose.

**Manual edits (per-file):**

- `feedback-card-states.html §7` — "Mobile (375px)" → "Mobile (< 768px)"; "Tablet (768px) & Desktop (1280px)" → "Tablet (768-1023px, `md:`) & Desktop (≥ 1024px, `lg:`)".
- `comments-list-with-agent-toggle.html` — "Mobile (375px)" → "Mobile (< 768px)"; "Tablet (768px)" → "Tablet (768-1023px, `md:`)"; "Desktop (1280px+)" → "Desktop (≥ 1024px, `lg:`)".
- `rollback-reason-banner.html` — "mobile 375px" / "tablet 768px" / "desktop 1280px" → "mobile (< 768px)" / "tablet (768-1023px, `md:`)" / "desktop (≥ 1024px, `lg:`)".
- `assessor-summary-card.html` — "mobile (375px)" / "tablet (768px)" / "desktop (1280px)" → canonical labels with `md:` / `lg:` prefix hints.
- `revisit-modal-spec.html` — responsive table rebuilt: "mobile 375px" / "tablet 768px" / "desktop 1280px+" → "< 768px" / "768-1023px, `md:`" / "≥ 1024px, `lg:`".

**Verification:** `grep -rEn 'Desktop \(1280|desktop 1280' stages/design/artifacts/` → 0 matches.

**Commit:** bundled into `bb3164db`.

Legitimate remaining `375px` references (kept): device-width simulations in `stage-progress-strip.html`, `annotation-popover-states.html`, `revisit-modal-spec.html`, `feedback-inline-mobile.html` — these are mobile mockup container widths, not breakpoint declarations.

---

## Replay: how to re-run the full sweep

```bash
cd <intent-dir>
ART=stages/design/artifacts

# Sweep 1: gray → stone
for f in "$ART"/*.html; do
  LC_ALL=C sed -i '' -E 's/-gray-([0-9]+)/-stone-\1/g; s/>gray-([0-9]+)/>stone-\1/g; s/ gray-([0-9]+)/ stone-\1/g; s/"gray-([0-9]+)/"stone-\1/g; s/^gray-([0-9]+)/stone-\1/g' "$f"
done

# Sweep 2+3: entities + hex → CSS var
python3 scripts/hex-to-token.py "$ART"  # see unit-10 commit 15044b2d

# Sweep 5: status -700 → -800
for f in "$ART"/*.html; do
  LC_ALL=C sed -i '' -E 's/text-amber-700/text-amber-800/g; s/text-blue-700/text-blue-800/g; s/text-green-700/text-green-800/g' "$f"
done

# Sweep 6: sidebar widths
sed -i '' -E 's/<aside class="w-96 shrink-0/<aside class="w-80 lg:w-96 shrink-0/g' "$ART/comments-list-with-agent-toggle.html"

# Sweeps 4, 7: manual; see DESIGN-BRIEF + DESIGN-TOKENS diffs in commits 06827979, bb3164db.
```
