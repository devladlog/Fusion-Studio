# Changelog

All notable changes to **Fusion Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Real-time collaboration features
- Power Platform solution management
- Model-driven app support
- Plugin development tools

---

## [0.4.3] - 2026-11-16 - Packaging Fix

> **Fix release**: the Marketplace build of 0.4.2 could not start. 0.4.3 ships its runtime dependencies inside the extension.

### Fixed
- **Activation from the Marketplace build**: 0.4.2 failed on startup with `Cannot find module 'axios'`. Its package left out `node_modules` (apart from the unused `uuid`), so `axios` and `zod`, which load when the extension starts, and `mammoth`, used for Word import, were missing.
- **PDF import**: `pdf-parse` is now a declared dependency and is bundled. Before, it was not listed in `dependencies`, so PDF parsing always fell back to the "paste or summarize the document contents" prompt.
- **Publish workflow**: the Marketplace token is passed through the `VSCE_PAT` environment variable instead of on the command line. The workflow now type-checks, bundles and packages the `.vsix` before publishing it, so the GitHub Release gets the `.vsix` as an asset (before, `vsce publish` left no `.vsix` behind to attach).

### Security
- Updated bundled dependencies within their semver ranges to resolve known high-severity advisories in `axios`, `form-data`, `zod` and `@xmldom/xmldom` (via `mammoth`). `npm audit --omit=dev` now reports 0 vulnerabilities.

### Changed
- The extension is bundled with esbuild into a single minified file, `dist/extension.js`, which is the new entry point. The `.vsix` no longer contains `node_modules`, `out/` or source maps: it went from 131 files (1.8 MB) to 16 files (about 0.6 MB).
- `vsce package` works without `--no-dependencies`; `vscode:prepublish` runs the type-check and the production bundle.
- Removed the unused `uuid` dependency.
- Repository, issue and homepage links in the extension manifest point to the public [devladlog/Fusion-Studio](https://github.com/devladlog/Fusion-Studio) repository, and the README images load from it.

### Developer
- New npm scripts: `bundle`, `bundle:prod`, `typecheck`, `watch:tsc`. `compile` (tsc) still emits `out/` for the tests; `npm test` builds both first.
- F5 in VS Code runs esbuild and tsc in watch mode.

---

## [0.4.2] - 2026-06 - Marketplace Rename

> Versions 0.4.0 and 0.4.1 have no separate record in the source history: the version went from 0.3.2 to 0.4.2 in one step. The changes below cover everything in that step.

### Changed
- Renamed the extension package from `fusion-studio` to `powerapps-fusion-studio` and the display name from "Fusion Studio" to "Power Apps Fusion Studio" (Marketplace ID `VladimiroLuis.powerapps-fusion-studio`).
- Rewrote the Marketplace README.
- Replaced the banner image.

---

## [0.3.0] - 2026-04-16 - AI Integration Release

> **Major Release**: Complete AI-powered development experience with Azure OpenAI integration, visual designers, and comprehensive documentation.

### Added

#### AI Generation
- **Document-to-App**: Generate Canvas Apps from markdown, text, PDF, and DOCX files
- **Mockup-to-App**: Convert UI wireframes and designs into Power Apps screens
- **Instructions-to-App**: Natural language app generation with GPT-4
- **AI Analysis**: Get intelligent insights and recommendations for existing apps
- **Secure Storage**: API keys stored securely via VS Code SecretStorage

#### Visual Designers
- **Dataverse Designer**: Create and manage Dataverse tables with intuitive visual interface
  - Support for all standard column types
  - JSON preview and export
  - Real-time validation
- **Flow Designer**: Design Power Automate flows visually
  - Drag-and-drop flow builder
  - Trigger and action configuration
  - AI-powered flow generation
- **AI Copilot Chat**: Sidebar chat panel for development assistance
  - PowerFx formula help
  - Best practices guidance
  - Debugging support

#### Dashboard
- Modern command center with quick actions
- Recent activity tracking
- Statistics overview
- One-click access to all tools

#### Documentation
- Comprehensive User Guide with Mermaid diagrams
- Complete Features reference
- Troubleshooting guide with error codes
- Quick Start guide (5-minute setup)
- Professional VS Code Marketplace README
- Screenshot guide and placeholder assets

### Changed
- Redesigned all panel UIs to match modern Dashboard design
- Updated package.json with enhanced marketplace metadata
- Improved error handling and user feedback
- Enhanced configuration options

### Technical
- Centralized logging service with OutputChannel
- Retry utility with exponential backoff
- Input validation helpers
- Improved TypeScript types

---

## [0.2.0] - 2025-12-01 - Engineering Release

> **Engineering Focus**: Professional-grade PowerFx analysis and Git-first workflows.

### Added

#### PowerFx Analysis Engine
- **Tokenizer**: Lexical analysis for PowerFx formulas
- **Parser**: Abstract Syntax Tree generation
- **Analyzer**: Dependency and variable extraction
- **Linter**: 12 best-practice rules
  - `no-hardcoded-colors`
  - `no-nested-if`
  - `no-magic-numbers`
  - `prefer-switch`
  - `no-empty-handler`
  - And 7 more...

#### Dependency Visualization
- **Export Formats**: Mermaid, DOT, D2, JSON
- **Graph Statistics**: Node count, edge count, cycle detection
- **Interactive Preview**: View dependencies in VS Code

#### Git Integration
- Power Apps-specific commit messages
- Feature branch creation
- Push/Pull operations
- .gitignore template for YAML source files

#### Tree Views
- **Environments**: List and switch Power Platform environments
- **Canvas Apps**: Browse app structure and screens
- **Dependencies**: View data sources, variables, collections
- **Observability**: Monitor Studio state in real-time

#### DevOps
- GitHub Actions workflow (`powerapps-ci.yml`)
- Azure DevOps pipeline (`powerapps-pipeline.yml`)
- Automated build and test

### Changed
- Enhanced status bar with environment indicator
- Improved error diagnostics
- Better file watcher performance

---

## [0.1.0] - 2025-09-15 - MVP Release

> **Initial Release**: Core Power Apps Studio integration.

### Added

#### Core Features
- **Embedded Studio**: Power Apps Studio in VS Code WebView
- **PAC CLI Integration**: Authentication, organization, canvas commands
- **Environment Selection**: Switch between Power Platform environments
- **Unpack/Pack**: Extract and create .msapp files

#### UI Components
- Activity bar icon and view container
- Status bar with sync status
- Basic tree views

### Technical
- TypeScript strict mode
- Content Security Policy for WebView
- Non-intrusive iframe embedding
- Extensible architecture

---

## Links

- [GitHub Repository](https://github.com/devladlog/Fusion-Studio)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=VladimiroLuis.powerapps-fusion-studio)
- [Documentation](https://github.com/devladlog/Fusion-Studio/tree/main/docs)
- [Report Issues](https://github.com/devladlog/Fusion-Studio/issues)
