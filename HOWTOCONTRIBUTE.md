# Contributing Guidelines

Thank you for contributing to **Reaxion** 🚀
To keep the project consistent and professional, please follow these guidelines.

---

## 📌 Branching Strategy

- `main` → stable, production-ready code.
- `dev` (optional) → integration branch (merge features here before main).
- Feature branches:
  - **With Linear**: Use the branch name provided by Linear (e.g., `REA-123-implement-user-authentication`)
  - **Without Linear**: Follow conventional naming:
    - `feature/<short-description>`
    - `fix/<short-description>`
    - `chore/<short-description>`
    - `hotfix/<short-description>`

**Examples:**

```
# With Linear
AREA-123-implement-user-authentication
AREA-456-fix-api-validation-error

# Without Linear
feature/auth-login
fix/slack-bug
```

---

## 📌 Pull Requests

1. Create a branch from `main`.
2. Open a PR with a **clear title** and description.
3. Request a review from at least **one teammate**.
4. The PR must pass:
   - ✅ Review approval(s)
   - ✅ CI checks (lint, tests, build)
5. Once approved → **Squash & Merge** into `main`.

> ⚠️ We only allow **Squash & Merge** → 1 PR = 1 clean commit in `main`.

---

## 📌 PR Title Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): short description
```

Types:

- `feat` → new feature
- `fix` → bug fix
- `chore` → maintenance, CI/CD, refactor
- `docs` → documentation
- `test` → tests

**Examples:**

```
feat(auth): add JWT login
fix(api): handle Slack invalid token error
chore(ci): add mirror workflow
```

---

## 📌 Commits

- Inside feature branches, you can commit as much as you want (`WIP`, `fix typo`, etc.).
- What matters: **PR title must be clean**, since squash merge will keep only the PR title in `main`.

---

## 📌 Issues

When creating an issue:

- Use the issue templates (Bug report / Feature request).
- Add relevant labels (`bug`, `enhancement`, `infra`, etc.).
- Keep it short and clear.

---

## 📌 Code Review

- Be respectful and constructive in reviews.
- Focus on code quality, readability, and testing.
- Approve only if the code meets the standards.

---

## 📌 Branch Lifecycle

- Create a branch → work on your feature → open a PR → review → squash & merge → branch is deleted.

GitHub is configured to **auto-delete branches** after merge.
