---
name: humanize
description: Strip AI tells from blog prose and align it to the H·AI·K·U voice. Use after drafting or substantially editing any file under website/content/blog/. Layered pass — voice rules win on conflict, then a generic AI-tell sweep, then a final "what makes this obviously AI?" self-audit.
---

# Humanize: H·AI·K·U voice + AI-tell removal

This skill runs a **layered editing pass** on blog prose. It is scoped to `website/content/blog/**/*.{md,mdx}`. Do not invoke it on UI copy, READMEs, doc pages, or paper revisions — those have a different register.

## Order of operations

The passes run in this order. Earlier passes win when they conflict with later ones.

1. **Load the voice rules.** Read `.claude/rules/content-voice.md` and `.claude/rules/citations.md` before touching prose. These define the register and override anything below.
2. **Voice-first edit.** Bring the draft into compliance with `content-voice.md`: contractions, no hedging, hook in the first two sentences, prose over bullet lists, every claim grounded per the No-Empty-Authority rule, citations linked or paths named per `citations.md`.
3. **AI-tell sweep.** Apply the pattern list in this file — but only where it doesn't fight the voice rules. The conflicts are listed explicitly below; respect them.
4. **Self-audit.** Run the final "what makes this obviously AI?" pass. Answer briefly. Then revise.

## Where voice beats the generic humanizer

The standard AI-tell rules are useful but blunt. The voice is specific, and these overrides apply:

- **Em-dashes are allowed** — particularly in long-form prose where rhythm matters. Don't blanket-replace them with commas. Ban only the *AI-cadence* em-dash that introduces a marketing flourish ("a seamless experience — designed for you").
- **The rule of three is allowed when earned.** The voice actively uses three-beat constructions. Strip them only when they're hollow ("efficient, scalable, and powerful"), not when each beat carries weight.
- **First-person plural OR singular, not generic.** Either "we" (project perspective) or "I" (Jason's specific anecdote). Pick one per post and stay in it. The generic humanizer's "use I when it fits" loses to the explicit register pick.
- **Cap "X isn't Y. It's Z." at two uses per article**, per `content-voice.md`. The humanizer's "negative parallelism" rule aligns here, but the cap is stricter.
- **Coined phrases stay.** When the draft names a pattern ("the continuity contract", "the workshop has two editors"), don't flatten it back to plain language. Coining is a feature, not a tell.
- **Contractions are required**, not optional.
- **No hypothetical numbers, even framed as such.** Replace with a real, named, verifiable thing — a commit SHA, a file path, a test case, a CI run — or cut the claim.
- **No emojis. Straight quotes. Sentence-case headings.**

When in doubt, voice wins.

## AI-tell pattern list

Apply these only where they don't conflict with the rules above.

### Content patterns

- **Inflation of significance.** Strip "stands as a testament to", "marks a pivotal moment", "underscores", "reflects broader shifts", "evolving landscape", "key turning point". Replace with the specific fact that earned the importance — or cut.
- **Notability theater.** "His work has been featured in major publications" is empty. Replace with a named outlet, year, and what was actually said.
- **`-ing` participle filler.** "Creating a calming experience and reinforcing simplicity" — fake depth. Either name what actually happens or drop the participle.
- **Promotional vocabulary.** "Vibrant", "rich", "breathtaking", "renowned", "nestled", "showcasing", "powerful", "seamless", "intuitive", "unlock potential", "robust", "comprehensive", "holistic", "synergy". These are marketing tics. Replace with the concrete behavior.
- **Vague attributions.** "Experts argue", "some critics", "industry observers". Either link the source per `citations.md` or cut the claim.
- **Generic "challenges and future prospects" sections.** If a section is filler, cut it. The voice guide bans formulaic timelines and consultant-shaped outlook paragraphs.

### Language and grammar patterns

- **Overused AI vocabulary.** "Additionally", "crucial", "plays a key role", "delve into", "in today's fast-paced", "unlock", "navigate the complexities", "harness the power of", "leverage". Cut or replace with plain words.
- **Copula avoidance.** "Serves as", "functions as", "represents". Use "is" when "is" is what you mean.
- **Elegant variation.** Repeated reference to the same thing using different words ("the validator… the gate… the check…") reads as AI. Pick one term and stick with it.
- **False ranges.** "From small startups to large enterprises", "everything from X to Y". State who actually uses it.
- **Filler phrases.** "In order to" → "to". "Has the ability to" → "can". "Due to the fact that" → "because".

### Style patterns

- **Boldface inside paragraphs** to highlight a list of nouns. Don't do it. Bold is for true emphasis.
- **Inline-header lists** ("Speed: faster load times. Security: better encryption.") are AI shape. Convert to prose if the items belong together.
- **Title Case In Headings.** Use sentence case.
- **Curly quotes.** Use straight quotes.
- **Emojis.** Remove unless explicitly requested.

### Communication patterns

- **Chatbot artifacts.** "Here's a breakdown of...", "Let me know if you want more detail!", "I hope this helps." Cut.
- **Knowledge-cutoff hedges.** "While details are limited, the feature appears to have been introduced recently." Find the actual commit or cut.
- **Sycophantic openers.** "Great point", "this is an insightful observation". Cut.

### Filler and hedging

- **Excessive hedging.** "Might potentially", "may sometimes", "could possibly". Pick one or none.
- **Generic conclusions.** "Overall, the outlook is positive and the future looks promising." Replace with a specific forward action, a callback to the opening scene, a question, or a challenge — per the voice guide's "Vary the closing move" rule.

## Soul check

Pattern removal is half the job. The post also needs a pulse. Per `content-voice.md`:

- Have an opinion. React to facts, don't just report them.
- Vary rhythm. Short punchy sentence. Then one that takes its time and earns the breath.
- Acknowledge complexity where it exists. "It works, but the seams show."
- Be specific about feelings and reactions. Not "this is concerning" but the concrete thing that makes it concerning.
- Coin the phrase the reader will repeat in their next meeting.

If the prose reads like a Wikipedia summary or a press release, it failed the soul check even if every AI tell is gone.

## The final self-audit

After the layered passes, perform this final step explicitly. Don't skip it.

1. Read the revised draft.
2. Ask: **"What makes this obviously AI generated?"** Answer in three to five short bullets, naming specific phrases or sentences. Be honest — the goal is to find what's left, not to defend the draft.
3. Revise those specific tells.
4. Re-read once more. If the draft would now plausibly come from a human writing about a project they shipped, it's done. If not, repeat step 2.

## Output

When invoked on a draft, produce:

1. The revised markdown (full file or the diff, depending on scope).
2. The self-audit answer — the bullets from "what makes this obviously AI generated?" before the final revision.
3. A short note on any deliberate voice choices that *look* like AI tells but aren't (a kept em-dash, a kept three-beat construction). This protects the choice from being undone on the next pass.

## Scope

This skill is paired with `.claude/rules/blog-humanize.md`, a path-scoped rule that loads only when working on `website/content/blog/**`. The rule tells the assistant to invoke this skill before reporting the task complete. Do not invoke this skill on other paths.
