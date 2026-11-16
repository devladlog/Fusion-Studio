# Contributing to Fusion Studio

First off, thank you for considering contributing to Fusion Studio! It's people like you that make Fusion Studio such a great tool for the Power Platform community.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **VS Code** 1.85.0 or higher
- **Git**
- **PAC CLI** (Power Platform CLI) - optional, for testing

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR-USERNAME/Fusion-Studio.git
cd Fusion-Studio
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/devladlog/Fusion-Studio.git
```

---

## Development Setup

### 1. Install Dependencies

```bash
cd extension
npm install
```

### 2. Compile the Extension

```bash
npm run compile
```

### 3. Watch for Changes (Development)

```bash
npm run watch
```

### 4. Launch Extension Development Host

Press **F5** in VS Code to launch a new VS Code window with the extension loaded.

### 5. Run Tests

```bash
npm test
```

### 6. Lint Code

```bash
npm run lint
```

---

## How to Contribute

### Types of Contributions

We welcome many types of contributions:

| Type | Description |
|------|-------------|
| **Bug Fixes** | Fix issues reported in GitHub Issues |
| **Features** | Implement new features from the roadmap |
| **Documentation** | Improve docs, add examples, fix typos |
| **Tests** | Add or improve test coverage |
| **Translations** | Help translate the extension |
| **Design** | Improve UI/UX in panels and webviews |

### Finding Issues to Work On

- Look for issues labeled `good first issue` for beginner-friendly tasks
- Check `help wanted` for issues where we need community help
- Review the project roadmap for planned features

---

## Pull Request Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use these branch prefixes:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add dataverse column validation"
git commit -m "fix: resolve chat panel scroll issue"
git commit -m "docs: update installation guide"
```

Commit types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, missing semicolons, etc.
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance tasks

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Open a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template
5. Submit for review

### PR Requirements

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Linting passes
- [ ] Documentation updated (if applicable)
- [ ] Screenshots added (for UI changes)
- [ ] CHANGELOG updated (for significant changes)

---

## Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over raw promises
- Add JSDoc comments for public APIs
- Use meaningful variable names

```typescript
// Good
const environmentList = await getEnvironments();

// Bad
const x = await getEnvs();
```

### File Organization

```
src/
  commands/        # Command implementations
  providers/       # Tree view providers
  services/        # Business logic services
  panels/          # Webview panels
  analysis/        # PowerFx analysis
  utils/           # Utility functions
  types/           # TypeScript types
  extension.ts     # Extension entry point
```

### CSS (for Panels)

- Use CSS custom properties for theming
- Follow BEM naming convention
- Support both light and dark themes

```css
/* Use variables */
.card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
}
```

---

## Reporting Bugs

### Before Submitting

1. Check the [existing issues](https://github.com/devladlog/Fusion-Studio/issues)
2. Search closed issues too - it might be fixed
3. Try the latest version
4. Open a new issue with the **Bug report** template, and remove tenant names, environment URLs, app IDs and API keys from logs and screenshots

### Bug Report Template

```markdown
## Bug Description
A clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- VS Code Version: [e.g., 1.85.0]
- Extension Version: [e.g., 0.4.2]
- OS: [e.g., Windows 11]

## Screenshots
If applicable, add screenshots.

## Additional Context
Any other relevant information.
```

---

## Suggesting Features

### Feature Request Template

```markdown
## Feature Description
A clear description of the feature.

## Problem It Solves
What problem does this solve?

## Proposed Solution
How do you think it should work?

## Alternatives Considered
Other approaches you've considered.

## Additional Context
Mockups, examples, or references.
```

---

## Questions?

If you have questions about contributing:

1. Check the [Documentation](https://github.com/devladlog/Fusion-Studio/tree/main/docs)
2. Open an [issue](https://github.com/devladlog/Fusion-Studio/issues/new/choose) and describe your question

---

## Recognition

Contributors will be recognized in:

- The project README
- Release notes mentioning their contributions
- The GitHub contributors list for this repository

Thank you for contributing to Fusion Studio! 🎉
