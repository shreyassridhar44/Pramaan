# Contributing

## Workflow

1. Read `claude-code/CLAUDE.md` and `claude-code/HANDOFF.md`.
2. Work on the next step in `claude-code/STEPS.md`, or on an agreed fix.
3. Keep changes focused. One milestone or fix per commit.
4. Run the checks for the parts you changed (see `TESTING.md`).
5. Update documentation that your change affects, and `CHANGELOG.md`.

## Commit messages

Conventional Commits, imperative mood:

```
feat(api): add release eligibility engine
fix(web): keep focus in the provenance grid after a bank response
docs: record decision on map boundary data
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.

Commits use the contributor's own Git identity. Do not add AI tools as authors or co-authors.

## Code style

- TypeScript: strict, ESLint and Prettier; no raw colours outside `tokens.css`.
- Python: ruff and mypy; type hints everywhere; business rules only in `app/domain`.
- Copy: plain professional English, sentence case, no emoji, no em dashes.

## Reviews

Every change to rules (`app/domain/rules`) needs a test that cites the APH clause it implements.
