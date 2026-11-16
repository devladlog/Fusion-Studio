# AI & Dataverse Integration

## Overview

**Fusion Studio** integrates with Azure OpenAI for intelligent app generation and Dataverse for direct data modeling. These services enable a powerful low-code to pro-code workflow.

## AI Generation Architecture

```mermaid
flowchart TB
    subgraph Inputs["Input Sources"]
        DOC[📄 Document<br/>MD, TXT, PDF, DOCX]
        IMG[🖼️ Mockup<br/>PNG, JPG, WEBP]
        TXT[💬 Instructions<br/>Natural Language]
    end
    
    subgraph Pipeline["Input Pipeline"]
        PIPE[InputPipeline]
        PARSE[Document Parser]
        B64[Base64 Encoder]
    end
    
    subgraph AI["AI Service"]
        CHAT[Chat Completion]
        PROMPT[System Prompts]
        VALID[Zod Validation]
    end
    
    subgraph Azure["Azure OpenAI"]
        GPT[GPT-4 / GPT-4o]
    end
    
    subgraph Outputs["Generated Artifacts"]
        CANVAS[Canvas App<br/>Screens + Controls]
        FLOW[Power Automate Flow<br/>Triggers + Actions]
        SCHEMA[Dataverse Schema<br/>Tables + Columns]
    end
    
    DOC --> PARSE --> PIPE
    IMG --> B64 --> PIPE
    TXT --> PIPE
    
    PIPE --> PROMPT --> CHAT
    CHAT --> GPT
    GPT --> CHAT
    CHAT --> VALID
    
    VALID --> CANVAS
    VALID --> FLOW
    VALID --> SCHEMA
```

## Azure OpenAI Configuration

```mermaid
sequenceDiagram
    participant U as User
    participant CMD as Command
    participant AI as AiService
    participant SS as SecretStorage
    participant CFG as VS Code Settings
    participant AOAI as Azure OpenAI
    
    Note over U,CFG: Initial Setup
    U->>CFG: Set endpoint URL
    U->>CFG: Set deployment name
    U->>CMD: powerapps.setApiKey
    CMD->>AI: storeApiKey(key)
    AI->>SS: store('azureOpenAi.apiKey', key)
    
    Note over U,AOAI: API Call
    U->>CMD: Generate from Instructions
    CMD->>AI: generateCanvasApp(request)
    AI->>SS: get('azureOpenAi.apiKey')
    SS-->>AI: API Key
    AI->>CFG: get endpoint, deployment
    AI->>AOAI: POST /chat/completions
    AOAI-->>AI: JSON Response
    AI-->>CMD: GeneratedArtifact
```

## Generation Request Types

```mermaid
classDiagram
    class GenerationRequest {
        +kind: "document" | "mockup" | "instructions"
        +payload: string
        +targetArtifact: ArtifactType
        +options?: Record~string, unknown~
    }
    
    class GeneratedArtifact {
        +kind: ArtifactType
        +name: string
        +files: GeneratedFile[]
        +summary: string
    }
    
    class GeneratedFile {
        +relativePath: string
        +content: string
    }
    
    class CanvasControl {
        +controlName: string
        +controlType: string
        +properties: Record~string, string~
        +children?: CanvasControl[]
    }
    
    class FlowDefinition {
        +name: string
        +trigger: FlowStep
        +actions: FlowStep[]
    }
    
    class FlowStep {
        +type: string
        +name: string
        +inputs: Record~string, unknown~
        +runAfter?: string[]
    }
    
    GenerationRequest --> GeneratedArtifact
    GeneratedArtifact --> GeneratedFile
    GeneratedArtifact --> CanvasControl
    GeneratedArtifact --> FlowDefinition
    FlowDefinition --> FlowStep
```

## System Prompts

### Canvas App Generation

```mermaid
flowchart LR
    subgraph Prompt["System Prompt"]
        ROLE[You are a Power Apps architect]
        FORMAT[Output JSON only]
        SCHEMA[appName, screens, controls]
    end
    
    subgraph User["User Content"]
        REQ[Requirements text<br/>or Document content]
    end
    
    subgraph Response["Expected Response"]
        JSON[Valid JSON<br/>Validated by Zod]
    end
    
    Prompt --> GPT[GPT-4]
    User --> GPT
    GPT --> JSON
```

### Flow Generation

```mermaid
flowchart LR
    subgraph Prompt["System Prompt"]
        ROLE[You are a Power Automate architect]
        FORMAT[Output JSON only]
        SCHEMA[flowName, trigger, actions]
    end
    
    subgraph User["User Content"]
        REQ[Flow description]
    end
    
    subgraph Response["Expected Response"]
        JSON[Flow Definition JSON]
    end
    
    Prompt --> GPT[GPT-4]
    User --> GPT
    GPT --> JSON
```

## Response Validation with Zod

```mermaid
flowchart TB
    subgraph Input
        RAW[Raw AI Response]
    end
    
    subgraph Parsing
        JSON[JSON.parse]
        STRIP[Strip markdown fences]
    end
    
    subgraph Validation
        ZOD[Zod Schema]
        CANVAS_S[CanvasAppResponseSchema]
        FLOW_S[FlowResponseSchema]
        DV_S[DataverseSchemaResponseSchema]
    end
    
    subgraph Output
        VALID[Validated Object]
        ERROR[Validation Error]
    end
    
    RAW --> STRIP --> JSON
    JSON --> ZOD
    ZOD --> CANVAS_S
    ZOD --> FLOW_S
    ZOD --> DV_S
    
    CANVAS_S --> VALID
    FLOW_S --> VALID
    DV_S --> VALID
    
    ZOD -.-> ERROR
```

## Dataverse Integration

```mermaid
flowchart TB
    subgraph Extension
        DV[DataverseService]
        CLIENT[Axios Client]
    end
    
    subgraph Auth["Authentication"]
        TOKEN[Access Token]
        CMD[getAccessToken Command]
    end
    
    subgraph API["Dataverse REST API v9.2"]
        ENTITY[/EntityDefinitions]
        ATTR[/Attributes]
        REL[/Relationships]
    end
    
    subgraph Operations
        LIST[List Tables]
        CREATE[Create Table]
        COLS[Add Columns]
        READ[Get Schema]
    end
    
    DV --> CMD --> TOKEN
    TOKEN --> CLIENT --> API
    
    LIST --> ENTITY
    CREATE --> ENTITY
    COLS --> ATTR
    READ --> ENTITY
```

## Dataverse Designer Panel

```mermaid
sequenceDiagram
    participant U as User
    participant WV as WebView
    participant DP as DataverseDesigner
    participant DV as DataverseService
    participant API as Dataverse API
    
    U->>DP: Open Designer
    DP->>WV: Render HTML Form
    
    U->>WV: Fill Table Details
    U->>WV: Add Columns
    U->>WV: Click Create
    
    WV->>DP: postMessage(createTable)
    DP->>DV: createTable(name, schema)
    DV->>API: POST /EntityDefinitions
    API-->>DV: 201 Created
    
    loop For Each Column
        DP->>DV: addColumn(table, column)
        DV->>API: POST /Attributes
        API-->>DV: 201 Created
    end
    
    DV-->>DP: Success
    DP->>WV: postMessage(success)
    WV-->>U: Show Confirmation
```

## Dataverse Types

```mermaid
classDiagram
    class PpTable {
        +logicalName: string
        +displayName: string
        +schemaName: string
        +isCustom: boolean
        +columns: PpColumn[]
    }
    
    class PpColumn {
        +logicalName: string
        +displayName: string
        +type: DataverseColumnType
        +isPrimaryKey?: boolean
        +isRequired?: boolean
        +maxLength?: number
        +options?: PickListOption[]
    }
    
    class DataverseRelationship {
        +name: string
        +fromTable: string
        +fromColumn: string
        +toTable: string
        +toColumn: string
        +type: RelationshipType
    }
    
    class PickListOption {
        +label: string
        +value: number
    }
    
    PpTable --> PpColumn
    PpColumn --> PickListOption
```

## Column Type Mapping

```mermaid
flowchart LR
    subgraph PowerFx["PowerFx Types"]
        TEXT[Text]
        NUM[Number]
        BOOL[Yes/No]
        DATE[Date]
        LOOK[Lookup]
        CHOICE[Choice]
    end
    
    subgraph Dataverse["Dataverse Types"]
        STR[String / Memo]
        INT[Integer / Decimal / Money]
        BIT[Boolean]
        DT[DateTime]
        LK[Lookup]
        PL[PickList]
    end
    
    TEXT --> STR
    NUM --> INT
    BOOL --> BIT
    DATE --> DT
    LOOK --> LK
    CHOICE --> PL
```

## Error Handling & Retry

```mermaid
flowchart TB
    subgraph Request
        REQ[API Request]
    end
    
    subgraph Retry["Retry Logic"]
        TRY[Execute Request]
        CHECK{Success?}
        TRANS{Transient Error?}
        DELAY[Exponential Backoff]
        COUNT{Max Retries?}
    end
    
    subgraph Errors["Error Types"]
        E429[429 Rate Limited]
        E502[502 Bad Gateway]
        E503[503 Service Unavailable]
        E504[504 Gateway Timeout]
        EPERM[4xx Permanent Error]
    end
    
    subgraph Result
        SUCCESS[Return Result]
        FAIL[Throw Error]
    end
    
    REQ --> TRY --> CHECK
    CHECK -->|Yes| SUCCESS
    CHECK -->|No| TRANS
    
    TRANS -->|Yes| COUNT
    TRANS -->|No| FAIL
    
    COUNT -->|No| DELAY --> TRY
    COUNT -->|Yes| FAIL
    
    E429 --> TRANS
    E502 --> TRANS
    E503 --> TRANS
    E504 --> TRANS
    EPERM --> TRANS
```

## Security Best Practices

```mermaid
flowchart TB
    subgraph Secrets["Secret Management"]
        KEY[API Key]
        SS[SecretStorage]
        OS[OS Keychain]
    end
    
    subgraph Transport["Transport Security"]
        TLS[HTTPS Only]
        HEADER[Authorization Header]
    end
    
    subgraph Validation["Input Validation"]
        URL[URL Validation]
        SIZE[File Size Limits]
        SCHEMA[Schema Validation]
    end
    
    subgraph Tokens["Token Management"]
        REFRESH[Auto-Refresh]
        EXPIRE[Expiry Check]
        BUFFER[5-min Buffer]
    end
    
    KEY --> SS --> OS
    
    TLS --> HEADER
    
    URL --> SIZE --> SCHEMA
    
    REFRESH --> EXPIRE --> BUFFER
```

## Chat Panel (AI Copilot)

```mermaid
sequenceDiagram
    participant U as User
    participant WV as ChatPanel WebView
    participant CP as ChatPanelProvider
    participant AI as AiService
    participant AOAI as Azure OpenAI
    
    U->>WV: Type question
    U->>WV: Click Send
    WV->>CP: postMessage({command: 'chat', text})
    CP->>WV: postMessage({command: 'thinking'})
    
    CP->>AI: chatAssistant(text)
    AI->>AOAI: POST /chat/completions
    AOAI-->>AI: Assistant response
    AI-->>CP: Reply text
    
    CP->>WV: postMessage({command: 'reply', text})
    WV-->>U: Display response
```

## Configuration Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `powerapps.azureOpenAi.endpoint` | string | "" | Azure OpenAI endpoint URL |
| `powerapps.azureOpenAi.deploymentName` | string | "" | Model deployment name |
| `powerapps.azureOpenAi.apiKey` | string | "" | API key (prefer SecretStorage) |
| `powerapps.dataverseUrl` | string | "" | Dataverse environment URL |

## Usage Examples

### Generate Canvas App from Instructions

```typescript
// Command: powerapps.generateFromInstructions
const instructions = "Create a simple contact form with name, email, and message fields";
await inputPipeline.fromInstructions();

// Result: Generated files saved to workspace
// - src/Screens/ContactScreen.yaml
// - src/Controls/NameInput.yaml
// - src/Controls/EmailInput.yaml
// - src/Controls/MessageInput.yaml
// - src/Controls/SubmitButton.yaml
```

### Generate from Mockup

```typescript
// Command: powerapps.generateFromMockup
const mockupPath = '/path/to/wireframe.png';
await inputPipeline.fromMockup(vscode.Uri.file(mockupPath));

// AI interprets the image and generates matching controls
```

### Create Dataverse Table

```typescript
// Using DataverseDesignerPanel
DataverseDesignerPanel.show(extensionUri, dataverseService);

// Or programmatically:
await dataverseService.createTable(
  'Contacts',
  'new_contacts',
  'Contact information',
  'new_name'
);

await dataverseService.addColumn('new_contacts', {
  logicalName: 'new_email',
  displayName: 'Email Address',
  type: 'String',
  isRequired: true,
  maxLength: 100
});
```
