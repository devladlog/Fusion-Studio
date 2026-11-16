# PowerFx Analysis Engine

## Overview

The PowerFx Analysis Engine provides comprehensive static analysis of PowerFx formulas used in Canvas Apps. It consists of four main components working together in a pipeline.

## Analysis Pipeline

```mermaid
flowchart TB
    subgraph Input["Input"]
        FORMULA["PowerFx Formula<br/>e.g., If(IsBlank(TextInput1.Text), Navigate(Screen2), Collect(MyCollection, {Name: TextInput1.Text}))"]
    end
    
    subgraph Tokenizer["1. Tokenizer (Lexical Analysis)"]
        LEX[PowerFxTokenizer]
        TOKENS["Token[]<br/>IF, LPAREN, IDENTIFIER, ..."]
    end
    
    subgraph Parser["2. Parser (Syntax Analysis)"]
        PARSE[PowerFxParser]
        AST["AST<br/>IfExpression<br/>├─ condition: FunctionCall<br/>├─ thenBranch: FunctionCall<br/>└─ elseBranch: FunctionCall"]
    end
    
    subgraph Analyzer["3. Analyzer (Semantic Analysis)"]
        VISIT[FormulaAnalyzer]
        DEPS["Dependencies<br/>• TextInput1 (Control)<br/>• Screen2 (Screen)<br/>• MyCollection (Collection)"]
    end
    
    subgraph Linter["4. Linter (Quality Analysis)"]
        RULES[12 Lint Rules]
        DIAG["Diagnostics<br/>⚠ Complexity: 4<br/>ℹ Uses navigation"]
    end
    
    subgraph Graph["5. Dependency Graph"]
        NODES[Graph Nodes]
        EDGES[Graph Edges]
        EXPORT["Export Formats<br/>Mermaid | DOT | D2 | JSON"]
    end
    
    FORMULA --> LEX --> TOKENS --> PARSE --> AST --> VISIT --> DEPS --> RULES --> DIAG
    DEPS --> NODES --> EXPORT
```

## Token Types

The tokenizer recognizes 40+ token types:

```mermaid
mindmap
  root((Token Types))
    Literals
      Number
      String
      Boolean
    Operators
      Arithmetic
        Plus
        Minus
        Star
        Slash
        Caret
      Comparison
        Equal
        NotEqual
        LessThan
        GreaterThan
        LessOrEqual
        GreaterOrEqual
      Logical
        And
        Or
        Not
    Punctuation
      LeftParen
      RightParen
      LeftBrace
      RightBrace
      LeftBracket
      RightBracket
      Comma
      Semicolon
      Colon
      Dot
      At
    Keywords
      If
      Then
      Else
      True
      False
      In
      Self
      Parent
      ThisItem
    Special
      Identifier
      Comment
      Whitespace
      EOF
```

## AST Node Types

```mermaid
classDiagram
    class ASTNode {
        <<interface>>
        +type: string
        +start: number
        +end: number
        +line: number
        +column: number
    }
    
    class ExpressionNode {
        <<interface>>
    }
    
    class BinaryExpression {
        +type: "BinaryExpression"
        +operator: string
        +left: ExpressionNode
        +right: ExpressionNode
    }
    
    class UnaryExpression {
        +type: "UnaryExpression"
        +operator: string
        +argument: ExpressionNode
    }
    
    class FunctionCall {
        +type: "FunctionCall"
        +name: string
        +arguments: ExpressionNode[]
    }
    
    class MemberExpression {
        +type: "MemberExpression"
        +object: ExpressionNode
        +property: IdentifierNode
        +computed: boolean
    }
    
    class IdentifierNode {
        +type: "Identifier"
        +name: string
    }
    
    class LiteralNode {
        +type: "Literal"
        +value: string|number|boolean
        +raw: string
    }
    
    class RecordExpression {
        +type: "RecordExpression"
        +properties: PropertyNode[]
    }
    
    class TableExpression {
        +type: "TableExpression"
        +rows: RecordExpression[]
    }
    
    class IfExpression {
        +type: "IfExpression"
        +condition: ExpressionNode
        +thenBranch: ExpressionNode
        +elseBranch: ExpressionNode?
    }

    ASTNode <|-- ExpressionNode
    ExpressionNode <|-- BinaryExpression
    ExpressionNode <|-- UnaryExpression
    ExpressionNode <|-- FunctionCall
    ExpressionNode <|-- MemberExpression
    ExpressionNode <|-- IdentifierNode
    ExpressionNode <|-- LiteralNode
    ExpressionNode <|-- RecordExpression
    ExpressionNode <|-- TableExpression
    ExpressionNode <|-- IfExpression
```

## Dependency Types

```mermaid
graph LR
    subgraph Controls
        C1[TextInput1]
        C2[Button1]
        C3[Gallery1]
    end
    
    subgraph DataSources
        D1[Accounts]
        D2[Contacts]
    end
    
    subgraph Variables
        V1[varCount]
        V2[varUser]
    end
    
    subgraph Collections
        COL1[colItems]
        COL2[colSelected]
    end
    
    subgraph Screens
        S1[HomeScreen]
        S2[DetailScreen]
    end
    
    FORMULA[Formula] --> C1
    FORMULA --> D1
    FORMULA --> V1
    FORMULA --> COL1
    FORMULA --> S2
```

## Linter Rules

```mermaid
flowchart LR
    subgraph Rules["12 Lint Rules"]
        direction TB
        R1[max-formula-complexity]
        R2[no-hardcoded-environment]
        R3[no-deprecated-functions]
        R4[prefer-switch]
        R5[no-nested-if]
        R6[avoid-forall-side-effects]
        R7[no-magic-numbers]
        R8[use-meaningful-names]
        R9[no-excessive-nesting]
        R10[prefer-first-filter]
        R11[no-duplicate-calculations]
        R12[warn-behavior-functions]
    end
    
    subgraph Severity
        ERR[🔴 Error]
        WARN[🟡 Warning]
        INFO[🔵 Info]
        HINT[⚪ Hint]
    end
    
    R1 --> WARN
    R2 --> ERR
    R3 --> WARN
    R4 --> INFO
    R5 --> WARN
    R6 --> ERR
    R7 --> INFO
    R8 --> HINT
    R9 --> WARN
    R10 --> INFO
    R11 --> WARN
    R12 --> INFO
```

### Rule Details

| Rule | Severity | Description |
|------|----------|-------------|
| `max-formula-complexity` | Warning | Formula exceeds complexity threshold (default: 10) |
| `no-hardcoded-environment` | Error | Environment URLs should use config, not literals |
| `no-deprecated-functions` | Warning | Using deprecated PowerFx functions |
| `prefer-switch` | Info | Multiple If/ElseIf should use Switch |
| `no-nested-if` | Warning | Deeply nested If statements (>3 levels) |
| `avoid-forall-side-effects` | Error | ForAll with Patch/Collect/Set is risky |
| `no-magic-numbers` | Info | Numeric literals should be named constants |
| `use-meaningful-names` | Hint | Variable names should be descriptive |
| `no-excessive-nesting` | Warning | Expression nesting exceeds limit |
| `prefer-first-filter` | Info | Use First(Filter(...)) instead of LookUp |
| `no-duplicate-calculations` | Warning | Same expression calculated multiple times |
| `warn-behavior-functions` | Info | Uses behavior functions (Navigate, Collect, etc.) |

## Dependency Graph

### Graph Structure

```mermaid
graph TB
    subgraph Legend
        N1[Screen]:::screen
        N2[Control]:::control
        N3[DataSource]:::datasource
        N4[Variable]:::variable
        N5[Collection]:::collection
    end
    
    subgraph App["Canvas App Dependency Graph"]
        HomeScreen:::screen --> Header:::control
        HomeScreen --> Gallery1:::control
        Gallery1 --> Accounts:::datasource
        Gallery1 --> varSelectedId:::variable
        
        DetailScreen:::screen --> Form1:::control
        Form1 --> Accounts
        Form1 --> colChanges:::collection
        
        varSelectedId -.-> DetailScreen
    end
    
    classDef screen fill:#e1bee7,stroke:#7b1fa2
    classDef control fill:#bbdefb,stroke:#1976d2
    classDef datasource fill:#c8e6c9,stroke:#388e3c
    classDef variable fill:#fff9c4,stroke:#fbc02d
    classDef collection fill:#ffccbc,stroke:#e64a19
```

### Export Formats

#### Mermaid
```
graph TD
  Screen1["Screen1"]
  Screen1 --> Button1
  Button1 --> Accounts["Accounts (DataSource)"]
```

#### DOT (Graphviz)
```dot
digraph G {
  rankdir=TB;
  Screen1 [shape=box];
  Button1 [shape=ellipse];
  Accounts [shape=cylinder];
  Screen1 -> Button1;
  Button1 -> Accounts;
}
```

#### D2
```d2
Screen1: Screen1 {
  shape: rectangle
}
Button1: Button1
Accounts: Accounts {
  shape: cylinder
}
Screen1 -> Button1
Button1 -> Accounts
```

#### JSON
```json
{
  "nodes": [
    {"id": "Screen1", "type": "screen"},
    {"id": "Button1", "type": "control"},
    {"id": "Accounts", "type": "datasource"}
  ],
  "edges": [
    {"from": "Screen1", "to": "Button1"},
    {"from": "Button1", "to": "Accounts"}
  ]
}
```

## Usage Examples

### Basic Linting

```typescript
import { lintFormula } from './powerfx/linter';

const formula = `If(IsBlank(TextInput1.Text), "Empty", TextInput1.Text)`;
const diagnostics = lintFormula(formula);

// diagnostics: [{
//   message: "Formula complexity: 2",
//   severity: "info",
//   line: 1, column: 1
// }]
```

### Building Dependency Graph

```typescript
import { createDependencyGraph } from './powerfx/dependencyGraph';

const graph = createDependencyGraph();
await graph.buildFromSource('./src/unpacked-app');

// Get statistics
const stats = graph.getStats();
// { totalNodes: 45, totalEdges: 67, screens: 5, dataSources: 3, ... }

// Export to Mermaid
const mermaid = graph.exportToMermaid();
// "graph TD\n  HomeScreen --> ..."

// Find circular dependencies
const circular = stats.circularDependencies;
// [["Control1", "Control2", "Control1"], ...]
```

### Formula Analysis

```typescript
import { analyzeFormula } from './powerfx';

const analysis = analyzeFormula(`
  Collect(MyData, 
    { Name: TextInput1.Text, 
      Date: Today() 
    }
  )
`);

// analysis: {
//   complexity: 3,
//   dependencies: [
//     { type: "collection", name: "MyData", isWrite: true },
//     { type: "control", name: "TextInput1", isWrite: false }
//   ],
//   functionCalls: [
//     { name: "Collect", isBehavior: true },
//     { name: "Today", isBehavior: false }
//   ],
//   hasImperativeCode: true
// }
```

## Performance Considerations

```mermaid
flowchart LR
    subgraph Parsing["Parsing (Fast)"]
        T[Tokenize<br/>~1ms]
        P[Parse<br/>~2ms]
    end
    
    subgraph Analysis["Analysis (Medium)"]
        A[Analyze<br/>~5ms]
        L[Lint<br/>~3ms]
    end
    
    subgraph Graph["Graph (Varies)"]
        B[Build Graph<br/>~50ms per screen]
        E[Export<br/>~10ms]
    end
    
    T --> P --> A --> L
    A --> B --> E
```

- **Tokenization**: O(n) where n = formula length
- **Parsing**: O(n) with recursive descent
- **Analysis**: O(n) single pass with visitor pattern
- **Linting**: O(n) per rule, parallelizable
- **Graph Building**: O(files) where files = unpacked app files
