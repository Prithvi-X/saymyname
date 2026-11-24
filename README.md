# SayMyName Antigravity Project Instructions Kit v1.0

This is a starter kit for the SayMyName repository. It contains Antigravity workspace rules, reusable Agent Skills, a specification index and working templates. It does not contain application source code and it has not been installed into your repository automatically.

## Install safely

1. Open the existing SayMyName repository and check `git status`.
2. Back up or commit existing work.
3. Read `AGENTS.md` and all `.agents/rules/*.md` and `.agents/skills/*/SKILL.md` files in this kit.
4. Merge the root `AGENTS.md` into any existing project instructions. Do not overwrite existing instructions blindly.
5. Merge `.agents/` into the repository `.agents/` directory. Preserve any existing rules or skills with the same name.
6. Copy `docs/` templates into the corresponding repository folders, adapting to established conventions.
7. Place approved Documents 01-09 under `docs/product/` using the exact file names in `SPECIFICATION_INDEX.md`.
8. Open Antigravity at the repository root and verify that project rules and Skills are discovered in Customizations / Skills & Rules.
9. Start a new session and invoke the read-only repository audit skill. Review the result before making code changes.

## Supported Antigravity conventions

- Root `AGENTS.md` is an always-active workspace instruction file and uses no YAML frontmatter.
- Rule files under `.agents/rules/` require YAML frontmatter with a valid `trigger`.
- Rule files are kept directly inside `.agents/rules/` for default discovery. Do not put rules in nested subfolders unless explicitly registered according to current Antigravity documentation.
- Skills live in `.agents/skills/<skill-name>/SKILL.md` and require a clear name/description frontmatter.
- Legacy Antigravity Workflows are deprecated; use Skills for repeatable procedures.

## Safety baseline

Use Antigravity's plan/review workflow for non-trivial work. Keep Terminal Sandbox enabled where available, keep non-workspace access disabled unless approved, and do not use unrestricted or dangerous skip-permission modes. Human owners approve sensitive decisions and production actions.

## Source documents

See `docs/product/SPECIFICATION_INDEX.md`. The specification documents remain the product source of truth; this kit is the agent operating layer.
