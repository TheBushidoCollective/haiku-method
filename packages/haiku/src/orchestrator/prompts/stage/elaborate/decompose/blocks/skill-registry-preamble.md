## Available Skills (annotate units with `applicable_skills:`)

The following Claude Code skills (slash commands) are installed in this environment. For each unit you author, evaluate which skills meaningfully accelerate the work and pin them to the unit's frontmatter as `applicable_skills: [<slug>, ...]`. Hat subagents receive the skill list automatically so they know which commands to reach for.

Only annotate when there is clear relevance — don't bloat every unit. A unit that writes tests should annotate `test`; a unit that refactors structure should annotate `refactor`; a purely documentary unit typically needs none.