# Contributing

- Use English for documentation, prompts, pull requests, and comments. Commit messages must be English and ASCII-only.
- Start feature branches from the latest `main`. Never commit directly to `main`; open pull requests.
- Use lowercase `snake_case` folders and uppercase hyphenated Markdown filenames (`README.md`).
- Preserve exact prompts, skill versions, artwork, checklists, audits, and revision history in `test/`.

Run `npm install` after checkout to install the local pre-commit ESLint hook.
Run `npm run lint` before pushing. GitHub Actions checks JavaScript/TypeScript
on every push and pull request; generated vendor files and pinned submodules are excluded.
