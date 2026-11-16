# Fusion Studio - Architecture Documentation

## Overview

**Fusion Studio** is a comprehensive VS Code extension that brings the full Power Apps development experience into VS Code, enhanced with engineering capabilities not available in the web-based Studio.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Fusion["Fusion Studio"]
        subgraph Extension["Extension Host"]
            EXT[extension.ts]
            SM[StateManager]
            
            subgraph Services["Core Services"]
                PAC[PacService]
                AI[AiService]
                DV[DataverseService]
                GIT[GitService]
                FW[FileWatcher]
                LOG[Logger]
            end
            
            subgraph Analysis["PowerFx Analysis"]
                TOK[Tokenizer]
                PAR[Parser]
                ANA[Analyzer]
                LNT[Linter]
                DEP[DependencyGraph]
            end
            
            subgraph Views["Tree Views"]
                ENV[EnvironmentTree]
                APP[AppsTree]
                OBS[ObservabilityTree]
                DEPT[DependencyTree]
            end
            
            subgraph Panels["WebView Panels"]
                STU[StudioWebView]
                CHAT[ChatPanel]
                DVD[DataverseDesigner]
                FLD[FlowDesigner]
            end
        end
        
        SB[StatusBar]
    end
    
    subgraph External["External Services"]
        PACS[PAC CLI]
        AOAI[Azure OpenAI]
        DVR[Dataverse REST API]
        PAS[Power Apps Studio Web]
    end
    
    EXT --> Services
    EXT --> Analysis
    EXT --> Views
    EXT --> Panels
    
    PAC --> PACS
    AI --> AOAI
    DV --> DVR
    STU --> PAS
    
    SM --> EXT
    SB --> EXT
```

## Component Responsibilities

### Extension Entry Point (`extension.ts`)

The main activation point that:
- Initializes all services
- Registers commands (30+)
- Sets up tree view providers
- Configures webview panels
- Manages extension lifecycle

### Services Layer

```mermaid
classDiagram
    class PacService {
        +listOrganizations() PpEnvironment[]
        +selectOrganization(url) void
        +unpackCanvasApp(msapp, output) boolean
        +packCanvasApp(source, msapp) boolean
        +authStatus() boolean
    }
    
    class AiService {
        -secretStorage SecretStorage
        +setSecretStorage(storage) void
        +generateCanvasApp(request) GeneratedArtifact
        +generateFlow(request) GeneratedArtifact
        +analyzeCanvasApp(content) string
        +interpretMockup(base64) GeneratedArtifact
        +chatAssistant(text) string
        +storeApiKey(key) void
    }
    
    class DataverseService {
        -client AxiosInstance
        +listTables() PpTable[]
        +getTableColumns(name) PpColumn[]
        +createTable(name, schema) void
        +addColumn(table, column) void
        +resetClient() void
    }
    
    class GitService {
        +initRepository(path) void
        +commit(message) void
        +commitPowerAppsChanges(app, type) void
        +createBranch(name) void
        +push() void
        +pull() void
        +getCurrentBranch() string
    }
    
    class FileWatcherService {
        -watcher FileSystemWatcher
        -diagnostics DiagnosticCollection
        +startWatching(path) void
        +stopWatching() void
        +isWatching() boolean
        +onSyncRequired EventEmitter
    }
    
    class Logger {
        +info(msg) void
        +warn(msg) void
        +error(msg, err) void
        +debug(msg) void
        +show() void
        +dispose() void
    }
    
    PacService ..> Logger
    AiService ..> Logger
    DataverseService ..> Logger
    GitService ..> Logger
```

### PowerFx Analysis Pipeline

```mermaid
flowchart LR
    subgraph Input
        FORMULA[PowerFx Formula]
    end
    
    subgraph Tokenizer
        LEX[Lexical Analysis]
        TOKENS[Token Stream]
    end
    
    subgraph Parser
        PARSE[Recursive Descent]
        AST[Abstract Syntax Tree]
    end
    
    subgraph Analyzer
        VISIT[AST Visitor]
        DEPS[Dependencies]
        TYPES[Type Info]
    end
    
    subgraph Outputs
        LINT[Lint Results]
        GRAPH[Dependency Graph]
        METRICS[Complexity Metrics]
    end
    
    FORMULA --> LEX --> TOKENS --> PARSE --> AST --> VISIT
    VISIT --> DEPS --> LINT
    VISIT --> DEPS --> GRAPH
    VISIT --> TYPES --> METRICS
```

## Data Flow

### App Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CMD as Command
    participant PIPE as InputPipeline
    participant AI as AiService
    participant AOAI as Azure OpenAI
    participant FS as FileSystem
    
    U->>CMD: Generate from Document
    CMD->>PIPE: fromDocument(uri)
    PIPE->>PIPE: Read & Parse Document
    PIPE->>AI: generateCanvasApp(request)
    AI->>AOAI: Chat Completion
    AOAI-->>AI: JSON Response
    AI->>AI: Validate with Zod
    AI-->>PIPE: GeneratedArtifact
    PIPE->>FS: Write Files
    PIPE-->>U: Show Summary
```

### Canvas App Sync Flow

```mermaid
sequenceDiagram
    participant STU as Studio WebView
    participant EXT as Extension
    participant PAC as PacService
    participant CLI as PAC CLI
    participant FW as FileWatcher
    participant LINT as Linter
    
    STU->>EXT: App Saved Event
    EXT->>PAC: unpackCanvasApp()
    PAC->>CLI: pac canvas unpack
    CLI-->>PAC: Success
    PAC-->>EXT: Files Updated
    EXT->>FW: Start Watching
    FW->>LINT: On File Change
    LINT-->>FW: Diagnostics
    FW-->>EXT: Sync Required Event
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> Inactive
    
    Inactive --> Authenticated: pac auth create
    Authenticated --> EnvironmentSelected: pac org select
    EnvironmentSelected --> AppLoaded: Unpack Canvas App
    AppLoaded --> Watching: Start File Watcher
    Watching --> Synced: Files Match Studio
    Synced --> Modified: File Changed
    Modified --> Synced: Auto-Lint Complete
    
    Watching --> AppLoaded: Stop Watcher
    AppLoaded --> EnvironmentSelected: Close App
    EnvironmentSelected --> Authenticated: Clear Environment
    Authenticated --> Inactive: Sign Out
```

## Module Dependencies

```mermaid
graph TD
    EXT[extension.ts] --> STU[studioWebView]
    EXT --> PAC[pac/pacService]
    EXT --> SM[state/stateManager]
    EXT --> PFX[powerfx/*]
    EXT --> SVC[services/*]
    EXT --> VW[views/*]
    EXT --> PAN[panels/*]
    EXT --> PIPE[pipelines/*]
    
    PFX --> TOK[tokenizer]
    PFX --> PAR[parser]
    PFX --> ANA[analyzer]
    PFX --> LNT[linter]
    PFX --> DEP[dependencyGraph]
    
    SVC --> AI[aiService]
    SVC --> DV[dataverseService]
    SVC --> GIT[gitService]
    SVC --> FW[fileWatcher]
    SVC --> LOG[logger]
    SVC --> VAL[validation]
    SVC --> RTY[retry]
    SVC --> STAT[statusBar]
    
    PAN --> CHAT[chatPanel]
    PAN --> DVD[dataverseDesigner]
    PAN --> FLD[flowDesigner]
    
    PIPE --> AI
    PIPE --> DV
    
    VW --> ENV[treeProviders]
    
    FW --> LNT
    FW --> DEP
```

## Security Considerations

### Content Security Policy (WebView)

```mermaid
flowchart LR
    subgraph WebView
        HTML[HTML Content]
        JS[JavaScript]
        CSS[Styles]
    end
    
    subgraph CSP["Content Security Policy"]
        NONCE[Nonce Validation]
        SRC[Source Restrictions]
        FRAME[Frame Ancestors]
    end
    
    subgraph External
        STUDIO[Power Apps Studio]
    end
    
    HTML --> CSP
    JS --> NONCE
    CSS --> SRC
    STUDIO --> FRAME
```

### Secret Storage

```mermaid
flowchart TB
    USER[User] -->|Set API Key| CMD[setApiKey Command]
    CMD -->|Store Securely| SS[SecretStorage]
    SS -->|Encrypted| KEYCHAIN[OS Keychain]
    
    AI[AiService] -->|Request Key| SS
    SS -->|Retrieve| AI
    AI -->|Use in Header| AOAI[Azure OpenAI]
```

## File Structure

```
extension/
├── src/
│   ├── extension.ts           # Main entry point
│   ├── studioWebView.ts       # Power Apps Studio embedding
│   ├── types.ts               # Shared type definitions
│   │
│   ├── pac/                   # PAC CLI Integration
│   │   └── pacService.ts
│   │
│   ├── powerfx/               # PowerFx Analysis
│   │   ├── tokenizer.ts       # Lexical analysis
│   │   ├── parser.ts          # AST generation
│   │   ├── analyzer.ts        # Dependency extraction
│   │   ├── linter.ts          # Static analysis rules
│   │   ├── dependencyGraph.ts # Graph operations
│   │   └── index.ts           # Barrel export
│   │
│   ├── services/              # Core Services
│   │   ├── aiService.ts       # Azure OpenAI
│   │   ├── dataverseService.ts# Dataverse REST API
│   │   ├── gitService.ts      # Git operations
│   │   ├── fileWatcher.ts     # File monitoring
│   │   ├── statusBar.ts       # Status bar UI
│   │   ├── logger.ts          # Logging
│   │   ├── retry.ts           # Retry utility
│   │   ├── validation.ts      # Input validation
│   │   └── index.ts           # Barrel export
│   │
│   ├── panels/                # WebView Panels
│   │   ├── chatPanel.ts       # AI Copilot
│   │   ├── dataverseDesigner.ts
│   │   ├── flowDesigner.ts
│   │   ├── webviewUtils.ts    # CSP, nonce helpers
│   │   └── index.ts
│   │
│   ├── pipelines/             # Processing Pipelines
│   │   ├── inputPipeline.ts   # Document/Mockup/Instructions
│   │   └── index.ts
│   │
│   ├── views/                 # Tree View Providers
│   │   └── treeProviders.ts
│   │
│   ├── state/                 # State Management
│   │   └── stateManager.ts
│   │
│   └── test/                  # Test Suite
│       └── suite/
│
├── resources/                 # Static Assets
│   ├── chatPanel.html
│   ├── dataverseDesigner.html
│   ├── flowDesigner.html
│   ├── icon.svg
│   ├── logo.png
│   └── powerapps.png
│
├── .vscode/                   # VS Code Config
├── .github/                   # CI/CD (GitHub Actions)
├── .azure-pipelines/          # CI/CD (Azure DevOps)
└── package.json               # Extension Manifest
```

## Extension Points

### Commands

The extension registers 30+ commands in the `powerapps.*` namespace:

| Category | Commands |
|----------|----------|
| Studio | openStudio |
| PAC CLI | unpackApp, packApp, selectEnvironment, authStatus |
| PowerFx | lintFormula, analyzeFormula, exportDependencyGraph |
| Git | gitInit, gitCommit, gitCommitPowerApps, gitCreateBranch, gitPush, gitPull |
| AI | generateFromDocument, generateFromMockup, generateFromInstructions, analyzeCanvasApp |
| Panels | openChatPanel, openDataverseDesigner, openFlowDesigner |
| Utility | refreshEnvironments, refreshApps, clearState, toggleWatcher |

### Configuration

All settings are under the `powerapps.*` namespace in VS Code settings.

### Tree Views

- `powerapps.environments` - Power Platform environments
- `powerapps.apps` - Canvas app structure
- `powerapps.dependencies` - Data sources and variables
- `powerapps.observability` - Live studio state
- `powerapps.chatPanel` - AI Copilot sidebar
