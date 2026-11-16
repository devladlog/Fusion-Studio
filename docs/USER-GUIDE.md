# Fusion Studio - Complete User Guide

> **Your comprehensive guide to mastering Fusion Studio - Power Apps development with engineering superpowers**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [AI Copilot Chat](#ai-copilot-chat)
4. [Dataverse Designer](#dataverse-designer)
5. [Flow Designer](#flow-designer)
6. [PowerFx Analysis](#powerfx-analysis)
7. [Git Integration](#git-integration)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

```mermaid
flowchart LR
    subgraph Required["Required"]
        VS[VS Code 1.85+]
        NODE[Node.js 18+]
        PAC[PAC CLI]
    end
    
    subgraph Optional["Optional"]
        GIT[Git]
        AOAI[Azure OpenAI]
    end
    
    Required --> Install[Install Extension]
    Optional -.-> Install
    Install --> Ready[Ready to Use]
```

| Requirement | Version | Purpose |
|-------------|---------|---------|
| VS Code | 1.85+ | Extension host |
| Node.js | 18+ | Build tools |
| PAC CLI | Latest | Power Platform commands |
| Git | Any | Version control |
| Azure OpenAI | GPT-4/4o | AI generation features |

### Installation Steps

```mermaid
sequenceDiagram
    participant U as User
    participant VS as VS Code
    participant EXT as Extension
    participant PAC as PAC CLI
    participant AOAI as Azure OpenAI
    
    Note over U,AOAI: Step 1: Install Extension
    U->>VS: Open Extensions (Ctrl+Shift+X)
    U->>VS: Search "Power Apps Fusion Studio"
    U->>VS: Click Install
    VS->>EXT: Install & Activate
    
    Note over U,AOAI: Step 2: Authenticate PAC
    U->>PAC: pac auth create
    PAC-->>U: Browser opens for login
    U->>PAC: Complete authentication
    
    Note over U,AOAI: Step 3: Configure AI (Optional)
    U->>VS: Open Settings (Ctrl+,)
    U->>VS: Set fusionStudio.azureOpenAi.endpoint
    U->>VS: Set fusionStudio.azureOpenAi.deploymentName
    U->>EXT: Cmd: Set Azure OpenAI API Key
    EXT-->>U: API Key stored securely
    
    Note over U,AOAI: Ready!
    EXT->>U: Dashboard opens automatically
```

### First Launch

When you first open a workspace with Fusion Studio installed, the **Dashboard** opens automatically, giving you an overview of all features.

```
1. Press F1 or Ctrl+Shift+P
2. Type "Fusion Studio: Open Dashboard"
3. Press Enter
```

---

## Dashboard Overview

The Dashboard is your central hub for all Fusion Studio features.

```mermaid
flowchart TB
    subgraph Dashboard["Fusion Studio Dashboard"]
        direction TB
        
        subgraph Header["Header"]
            LOGO[Logo & Title]
            STATUS[Connection Status]
        end
        
        subgraph Status["Status Bar"]
            ENV[Environment: Connected]
            STUDIO[Studio: Ready]
            GIT[Git: main branch]
        end
        
        subgraph Quick["Quick Actions"]
            Q1[Open Studio]
            Q2[AI Chat]
            Q3[New App]
            Q4[Design Table]
        end
        
        subgraph Features["Feature Cards"]
            F1[PowerFx Analysis<br/>Parse, Lint, Dependencies]
            F2[AI Generation<br/>Docs, Mockups, Instructions]
            F3[Dataverse<br/>Tables, Columns, Schemas]
            F4[Git Workflow<br/>Commit, Branch, Sync]
            F5[Flow Designer<br/>Generate Power Automate]
            F6[Observability<br/>Logs, Diagnostics]
        end
        
        subgraph Steps["Getting Started"]
            S1[1. Connect Environment]
            S2[2. Open/Create App]
            S3[3. Analyze Code]
            S4[4. Commit Changes]
        end
    end
    
    Header --> Status --> Quick --> Features --> Steps
```

### Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| 🟢 | Connected | Environment is connected |
| 🟡 | Pending | Connecting or loading |
| 🔴 | Disconnected | Not authenticated |
| ⚡ | Active | Operation in progress |

### Quick Actions

| Button | Action | Shortcut |
|--------|--------|----------|
| Open Studio | Launch Power Apps Studio | `Ctrl+Shift+S` |
| AI Chat | Open Copilot sidebar | `Ctrl+Shift+C` |
| New App | Create Canvas App | `Ctrl+Shift+N` |
| Design Table | Open Dataverse Designer | - |

---

## AI Copilot Chat

The AI Copilot is your intelligent assistant for Power Platform development.

```mermaid
flowchart LR
    subgraph Input["Your Question"]
        Q[How do I filter<br/>a gallery by user?]
    end
    
    subgraph AI["AI Processing"]
        direction TB
        CTX[Context Gathering]
        PROMPT[System Prompt]
        GPT[Azure OpenAI]
    end
    
    subgraph Output["AI Response"]
        CODE[PowerFx Code]
        EXPLAIN[Explanation]
        TIPS[Best Practices]
    end
    
    Q --> CTX --> PROMPT --> GPT --> Output
```

### How to Use

1. **Open AI Chat**
   - Click "AI Chat" in Dashboard, or
   - Press `Ctrl+Shift+C`, or
   - Command Palette: "Open Copilot Sidebar"

2. **Ask Questions**
   - Type your question in the input box
   - Press `Enter` to send
   - Use `Shift+Enter` for new lines

3. **Quick Suggestions**
   Click suggestion chips for common tasks:
   - Filter gallery by current user
   - Dataverse schema design
   - Approval flow creation

### Example Conversations

```mermaid
sequenceDiagram
    participant U as You
    participant AI as Fusion AI
    
    U->>AI: How do I filter a gallery by current user?
    AI->>U: Use this PowerFx formula:
    Note over AI,U: Filter(Employees, Owner = User().Email)
    AI->>U: This filters the Employees table...
    
    U->>AI: What if I want to include team members?
    AI->>U: Expand the filter:
    Note over AI,U: Filter(Employees,<br/>Owner = User().Email ||<br/>Team in User().Teams)
```

### Supported Topics

| Category | Example Questions |
|----------|-------------------|
| **PowerFx** | "How do filters work?", "Explain Patch function" |
| **Dataverse** | "Design a schema for...", "How to create relationships?" |
| **Flows** | "Create approval workflow", "Trigger on new record" |
| **Canvas Apps** | "Add navigation", "Responsive design tips" |
| **Best Practices** | "Error handling patterns", "Performance tips" |

---

## Dataverse Designer

Design production-ready Dataverse table schemas visually.

```mermaid
flowchart TB
    subgraph Designer["Dataverse Designer"]
        subgraph Definition["Table Definition"]
            DN[Display Name]
            SN[Schema Name]
            DESC[Description]
            PC[Primary Column]
        end
        
        subgraph Columns["Columns"]
            C1[Column 1: String]
            C2[Column 2: Integer]
            C3[Column 3: DateTime]
            C4[+ Add Column]
        end
        
        subgraph Actions["Actions"]
            CREATE[Create Table]
            VALIDATE[Validate Schema]
        end
    end
    
    Definition --> Columns --> Actions
    
    subgraph Dataverse["Dataverse"]
        TABLE[New Table Created]
    end
    
    Actions --> Dataverse
```

### Creating a Table

1. **Open Dataverse Designer**
   - From Dashboard: Click "Design Tables"
   - Command Palette: "Open Dataverse Designer"

2. **Define Table**
   ```
   Display Name: Project Task
   Schema Name: cr_projecttask
   Description: Stores project tasks and assignments
   Primary Column: name
   ```

3. **Add Columns**
   
   | Column | Type | Required |
   |--------|------|----------|
   | Task Name | String | Yes |
   | Due Date | DateTime | Yes |
   | Priority | PickList | No |
   | Assigned To | Lookup | No |
   | Completed | Boolean | No |

4. **Create Table**
   - Click "Create Table"
   - Wait for confirmation toast
   - Table is created in Dataverse!

### Column Types

```mermaid
flowchart LR
    subgraph Text["Text Types"]
        STR[String<br/>Single line]
        MEMO[Memo<br/>Multi-line]
    end
    
    subgraph Numbers["Number Types"]
        INT[Integer<br/>Whole numbers]
        DEC[Decimal<br/>Precise decimals]
        MONEY[Money<br/>Currency values]
    end
    
    subgraph Other["Other Types"]
        BOOL[Boolean<br/>Yes/No]
        DATE[DateTime<br/>Date and time]
        LOOK[Lookup<br/>Related table]
        PICK[PickList<br/>Choice values]
    end
```

### Color Coding

Each column type has a color indicator for quick identification:

| Type | Color |
|------|-------|
| String | 🔵 Cyan |
| Memo | 🔵 Teal |
| Integer | 🟠 Orange |
| Decimal | 🟠 Light Orange |
| Money | 🟢 Green |
| Boolean | 🟣 Purple |
| DateTime | 🔵 Light Blue |
| Lookup | 🩷 Pink |
| PickList | 🟡 Yellow |

---

## Flow Designer

Generate Power Automate flows from natural language descriptions.

```mermaid
flowchart TB
    subgraph Input["Your Description"]
        PROMPT[When a new lead is created,<br/>send approval to manager,<br/>then update status]
    end
    
    subgraph AI["AI Generation"]
        PARSE[Parse Intent]
        BUILD[Build Definition]
        VALIDATE[Validate JSON]
    end
    
    subgraph Output["Generated Flow"]
        direction TB
        T[⚡ Trigger: New Lead Created]
        A1[Action 1: Send Approval]
        A2[Action 2: Update Status]
        T --> A1 --> A2
    end
    
    Input --> AI --> Output
```

### Using Flow Designer

1. **Open Flow Designer**
   - Dashboard: Click on Flow Designer card
   - Command Palette: "Open Flow Designer"

2. **Write Description**
   ```
   Example: When a form is submitted, create a 
   Dataverse record, send confirmation email to 
   the submitter, and notify the admin in Teams.
   ```

3. **Generate Flow**
   - Click "Generate Flow"
   - Wait for AI processing
   - Review the generated flow

4. **Review Output**
   - **Summary**: Plain-language description
   - **Stats**: Trigger count, actions, connectors
   - **Execution Map**: Visual step-by-step flow
   - **Definition**: Raw JSON (copy to Power Automate)

### Example Prompts

| Use Case | Prompt |
|----------|--------|
| **Approval** | "When a purchase request exceeds $1000, send approval to finance manager" |
| **Notification** | "Daily at 8 AM, post overdue tasks to Teams channel" |
| **Integration** | "When email received from VIP list, create Dataverse record and notify sales" |
| **Data Sync** | "When SharePoint item modified, update corresponding Dataverse record" |

### Execution Map

The execution map shows your flow visually:

```mermaid
flowchart TB
    subgraph Flow["Generated Flow"]
        T["⚡ Trigger<br/>When item created"]
        A1["1. Get Item Details<br/>SharePoint"]
        A2["2. Create Record<br/>Dataverse"]
        A3["3. Send Message<br/>Teams"]
        
        T --> A1 --> A2 --> A3
    end
```

---

## PowerFx Analysis

Analyze your Canvas App formulas with the built-in PowerFx engine.

```mermaid
flowchart LR
    subgraph Input["PowerFx Formula"]
        CODE["Filter(Products,<br/>Price > 100)"]
    end
    
    subgraph Pipeline["Analysis Pipeline"]
        TOK[Tokenizer<br/>Lexical Analysis]
        PAR[Parser<br/>AST Generation]
        ANA[Analyzer<br/>Dependencies]
        LNT[Linter<br/>12 Rules]
    end
    
    subgraph Output["Results"]
        DEP[Dependency Graph]
        WARN[Warnings]
        ERR[Errors]
        TIPS[Suggestions]
    end
    
    Input --> TOK --> PAR --> ANA --> LNT --> Output
```

### Running Analysis

1. **Analyze Current Formula**
   - Select PowerFx code in editor
   - Command: "Analyze PowerFx"
   - View results in Problems panel

2. **Analyze Entire App**
   - Command: "Analyze Canvas App"
   - Reviews all screens and controls
   - Generates full dependency graph

### Lint Rules

The linter checks for 12 common issues:

| Rule | Description | Severity |
|------|-------------|----------|
| `no-hardcoded-colors` | Avoid hex colors, use themes | Warning |
| `no-deep-nesting` | Max 3 levels of nesting | Warning |
| `no-magic-numbers` | Extract to variables | Info |
| `no-unused-variables` | Remove dead code | Warning |
| `prefer-delegation` | Use delegable functions | Error |
| `no-empty-screens` | Screens need content | Warning |
| `consistent-naming` | Follow naming convention | Info |
| `no-inline-styles` | Use shared styles | Warning |
| `validate-data-sources` | Check connections | Error |
| `limit-control-count` | Max 500 per screen | Warning |
| `error-handling` | Add error boundaries | Warning |
| `accessibility` | WCAG compliance | Warning |

### Dependency Graph

Export your app's dependency graph in multiple formats:

```mermaid
flowchart TB
    subgraph App["Canvas App"]
        S1[Screen: Home]
        S2[Screen: Details]
        G1[Gallery: Products]
        F1[Form: ProductEdit]
        DS[DataSource: Products]
    end
    
    S1 --> G1
    G1 --> DS
    G1 -->|OnSelect| S2
    S2 --> F1
    F1 --> DS
```

**Export Formats:**
- **Mermaid** - For documentation
- **DOT** - For Graphviz
- **D2** - For D2 diagrams
- **JSON** - For processing

---

## Git Integration

Professional Git workflow built into Fusion Studio.

```mermaid
gitGraph
    commit id: "Initial commit"
    branch feature/new-screen
    commit id: "Add Home screen"
    commit id: "Add navigation"
    checkout main
    branch feature/data-model
    commit id: "Add Products table"
    checkout main
    merge feature/new-screen
    merge feature/data-model
    commit id: "Release v1.0"
```

### Git Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| Initialize Repo | Create new Git repository | - |
| Commit Changes | Save with Power Apps message | `Ctrl+Shift+G` |
| Create Branch | New feature branch | - |
| Push | Upload to remote | - |
| Pull | Download changes | - |
| Sync | Push + Pull | - |

### Power Apps Commit Messages

Fusion Studio generates meaningful commit messages:

```
[PowerApps] Screen: Added "Home" screen

- New screen with gallery control
- Added navigation to Details
- Connected to Products data source
```

### Workflow

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant FS as Fusion Studio
    participant GIT as Git
    participant REMOTE as GitHub/Azure DevOps
    
    DEV->>FS: Make changes to app
    FS->>FS: Auto-detect changes
    DEV->>FS: Commit Changes command
    FS->>FS: Generate commit message
    FS->>GIT: git commit -m "..."
    DEV->>FS: Push command
    FS->>GIT: git push
    GIT->>REMOTE: Upload changes
    REMOTE-->>DEV: Changes visible online
```

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+Shift+S` | Open Power Apps Studio |
| `Ctrl+Shift+C` | Open AI Copilot |
| `Ctrl+Shift+G` | Git: Commit |
| `Ctrl+Shift+D` | Open Dashboard |

### In AI Chat

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Esc` | Clear input |

### In Editors

| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` | IntelliSense |
| `F12` | Go to Definition |
| `Shift+F12` | Find References |
| `F2` | Rename Symbol |

---

## Troubleshooting

### Common Issues

```mermaid
flowchart TD
    subgraph Issues["Common Issues"]
        I1[Extension not activating]
        I2[PAC authentication failed]
        I3[AI features not working]
        I4[Dataverse connection error]
    end
    
    subgraph Solutions["Solutions"]
        S1[Reload VS Code window]
        S2[Run 'pac auth create']
        S3[Check API key and settings]
        S4[Verify environment URL]
    end
    
    I1 --> S1
    I2 --> S2
    I3 --> S3
    I4 --> S4
```

### Extension Not Activating

1. Check VS Code version (requires 1.85+)
2. Reload window: `Ctrl+Shift+P` > "Reload Window"
3. Check Output panel for errors
4. Reinstall extension

### PAC Authentication Failed

```powershell
# Clear existing auth
pac auth clear

# Create new authentication
pac auth create --environment https://your-env.crm.dynamics.com

# Verify
pac auth list
```

### AI Features Not Working

1. **Check Settings:**
   ```json
   {
     "fusionStudio.azureOpenAi.endpoint": "https://your-resource.openai.azure.com",
     "fusionStudio.azureOpenAi.deploymentName": "gpt-4"
   }
   ```

2. **Set API Key:**
   - Command: "Set Azure OpenAI API Key"
   - Enter your key when prompted

3. **Verify Connection:**
   - Try a simple chat message
   - Check Output panel for errors

### Dataverse Connection Error

1. Verify environment URL is correct
2. Check PAC authentication is active
3. Ensure user has appropriate Dataverse permissions
4. Try: Command "Reset Dataverse Client"

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `PAC_AUTH_001` | Not authenticated | Run `pac auth create` |
| `PAC_AUTH_002` | Token expired | Re-authenticate |
| `DV_CONN_001` | Connection refused | Check firewall/VPN |
| `DV_PERM_001` | Permission denied | Check Dataverse roles |
| `AI_KEY_001` | Invalid API key | Re-enter API key |
| `AI_QUOTA_001` | Rate limited | Wait and retry |

---

## Getting Help

### Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: `/docs` folder in repository
- **Logs**: View > Output > Fusion Studio

### Debug Mode

Enable verbose logging:

```json
// settings.json
{
  "fusionStudio.debug": true
}
```

### Contact

- Repository: [github.com/devladlog/Fusion-Studio](https://github.com/devladlog/Fusion-Studio)
- Issues: Use GitHub Issues for bug reports

---

## Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║                    FUSION STUDIO                             ║
║              Quick Reference Card                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  SHORTCUTS                                                   ║
║  ─────────────────────────────────────────────────────────   ║
║  Ctrl+Shift+P     Command Palette                            ║
║  Ctrl+Shift+D     Open Dashboard                             ║
║  Ctrl+Shift+S     Open Power Apps Studio                     ║
║  Ctrl+Shift+C     Open AI Copilot                            ║
║                                                              ║
║  KEY COMMANDS                                                ║
║  ─────────────────────────────────────────────────────────   ║
║  > Fusion Studio: Open Dashboard                             ║
║  > Open Copilot Sidebar                                      ║
║  > Open Dataverse Designer                                   ║
║  > Open Flow Designer                                        ║
║  > Analyze PowerFx                                           ║
║  > Set Azure OpenAI API Key                                  ║
║                                                              ║
║  STATUS BAR                                                  ║
║  ─────────────────────────────────────────────────────────   ║
║  🟢 Connected    🟡 Pending    🔴 Disconnected               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

*Fusion Studio v0.4.2 - Power Apps Engineering Superpowers*
