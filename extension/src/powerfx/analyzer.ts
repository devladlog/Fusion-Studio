/**
 * PowerFx Analyzer
 * Analyzes AST to extract dependencies, data sources, and control references
 */

import {
    ASTNode,
    ExpressionNode,
    ProgramNode,
    CallExpressionNode,
    IdentifierNode,
    MemberExpressionNode,
    BinaryExpressionNode,
    ChainExpressionNode,
    RecordExpressionNode,
    TableExpressionNode,
    IfExpressionNode,
    UnaryExpressionNode,
    PropertyNode,
    parse
} from './parser';

/**
 * Types of dependencies in PowerFx
 */
export enum DependencyType {
    Control = 'CONTROL',
    DataSource = 'DATASOURCE',
    Collection = 'COLLECTION',
    Variable = 'VARIABLE',
    GlobalVariable = 'GLOBAL_VARIABLE',
    ContextVariable = 'CONTEXT_VARIABLE',
    Screen = 'SCREEN',
    Function = 'FUNCTION',
    Component = 'COMPONENT'
}

/**
 * A dependency reference found in a formula
 */
export interface Dependency {
    type: DependencyType;
    name: string;
    path: string[];  // Full path for nested references like Screen1.Label1.Text
    line: number;
    column: number;
    isWrite: boolean;  // true for Set, UpdateContext, Collect, Patch, etc.
}

/**
 * Function call analysis
 */
export interface FunctionCall {
    name: string;
    arguments: number;
    line: number;
    column: number;
    isBehavior: boolean;  // Functions that modify state
    isNavigation: boolean;
}

/**
 * Analysis result for a formula
 */
export interface FormulaAnalysis {
    dependencies: Dependency[];
    functionCalls: FunctionCall[];
    complexity: number;  // McCabe-like complexity metric
    hasImperativeCode: boolean;
    errors: string[];
}

// Functions that modify state (behavior functions)
const BEHAVIOR_FUNCTIONS = new Set([
    'set', 'updatecontext', 'collect', 'clearcollect', 'remove', 'removeif',
    'patch', 'update', 'updateif', 'clear', 'reset', 'back', 'exit',
    'launch', 'navigate', 'notify', 'refresh', 'requesthide', 'select',
    'setfocus', 'setproperty', 'trace', 'viewform', 'editform', 'newform',
    'submitform', 'resetform'
]);

// Functions that perform navigation
const NAVIGATION_FUNCTIONS = new Set(['navigate', 'back', 'exit', 'launch']);

// Known data sources patterns
const DATASOURCE_PATTERNS = [
    /^'.*'$/,  // Single-quoted names like 'My Table'
    /Accounts|Contacts|Leads|Opportunities/i  // Common Dataverse tables
];

/**
 * PowerFx Formula Analyzer
 */
export class PowerFxAnalyzer {
    private dependencies: Dependency[] = [];
    private functionCalls: FunctionCall[] = [];
    private complexity: number = 1;
    private errors: string[] = [];
    
    /**
     * Analyze a PowerFx formula string
     */
    analyze(formula: string): FormulaAnalysis {
        this.reset();
        
        const parseResult = parse(formula);
        
        if (parseResult.errors.length > 0) {
            this.errors = parseResult.errors.map(e => `Line ${e.line}: ${e.message}`);
            return this.getResult();
        }
        
        if (parseResult.ast) {
            this.visit(parseResult.ast.body);
        }
        
        return this.getResult();
    }
    
    /**
     * Analyze an already-parsed AST
     */
    analyzeAST(ast: ProgramNode): FormulaAnalysis {
        this.reset();
        this.visit(ast.body);
        return this.getResult();
    }
    
    private reset(): void {
        this.dependencies = [];
        this.functionCalls = [];
        this.complexity = 1;
        this.errors = [];
    }
    
    private getResult(): FormulaAnalysis {
        return {
            dependencies: this.dependencies,
            functionCalls: this.functionCalls,
            complexity: this.complexity,
            hasImperativeCode: this.functionCalls.some(f => f.isBehavior),
            errors: this.errors
        };
    }
    
    private visit(node: ExpressionNode, context: VisitContext = {}): void {
        switch (node.type) {
            case 'Literal':
                // No dependencies in literals
                break;
                
            case 'Identifier':
                this.visitIdentifier(node, context);
                break;
                
            case 'BinaryExpression':
                this.visitBinaryExpression(node, context);
                break;
                
            case 'UnaryExpression':
                this.visitUnaryExpression(node);
                break;
                
            case 'CallExpression':
                this.visitCallExpression(node, context);
                break;
                
            case 'MemberExpression':
                this.visitMemberExpression(node, context);
                break;
                
            case 'RecordExpression':
                this.visitRecordExpression(node, context);
                break;
                
            case 'TableExpression':
                this.visitTableExpression(node, context);
                break;
                
            case 'IfExpression':
                this.visitIfExpression(node, context);
                break;
                
            case 'ChainExpression':
                this.visitChainExpression(node, context);
                break;
        }
    }
    
    private visitIdentifier(node: IdentifierNode, context: VisitContext): void {
        if (node.isThisRecord || node.isParent || node.isSelf) {
            // Context references - not external dependencies
            return;
        }
        
        // Determine dependency type
        const depType = this.inferDependencyType(node.name);
        
        this.addDependency({
            type: depType,
            name: node.name,
            path: [node.name],
            line: node.line,
            column: node.column,
            isWrite: context.isWriteContext ?? false
        });
    }
    
    private visitBinaryExpression(node: BinaryExpressionNode, context: VisitContext): void {
        this.visit(node.left, context);
        this.visit(node.right, context);
        
        // Logical operators add to complexity
        if (node.operator.toLowerCase() === 'and' || node.operator.toLowerCase() === 'or') {
            this.complexity++;
        }
    }
    
    private visitUnaryExpression(node: UnaryExpressionNode): void {
        this.visit(node.argument);
    }
    
    private visitCallExpression(node: CallExpressionNode, context: VisitContext): void {
        const funcName = node.callee.name.toLowerCase();
        const isBehavior = BEHAVIOR_FUNCTIONS.has(funcName);
        const isNavigation = NAVIGATION_FUNCTIONS.has(funcName);
        
        this.functionCalls.push({
            name: node.callee.name,
            arguments: node.arguments.length,
            line: node.line,
            column: node.column,
            isBehavior,
            isNavigation
        });
        
        // Handle special functions that write data
        if (funcName === 'set' && node.arguments.length >= 1) {
            // First argument is the variable being set
            this.visitAsGlobalVariable(node.arguments[0], true);
            // Remaining arguments are read context
            for (let i = 1; i < node.arguments.length; i++) {
                this.visit(node.arguments[i], { ...context, isWriteContext: false });
            }
        } else if (funcName === 'updatecontext' && node.arguments.length >= 1) {
            // Argument is a record with context variables
            this.visitAsContextVariables(node.arguments[0], true);
        } else if ((funcName === 'collect' || funcName === 'clearcollect') && node.arguments.length >= 1) {
            // First argument is the collection
            this.visitAsCollection(node.arguments[0], true);
            for (let i = 1; i < node.arguments.length; i++) {
                this.visit(node.arguments[i], { ...context, isWriteContext: false });
            }
        } else if (funcName === 'navigate' && node.arguments.length >= 1) {
            // First argument is the screen
            this.visitAsScreen(node.arguments[0]);
            for (let i = 1; i < node.arguments.length; i++) {
                this.visit(node.arguments[i], { ...context, isWriteContext: false });
            }
        } else if ((funcName === 'patch' || funcName === 'remove' || funcName === 'update') && node.arguments.length >= 1) {
            // First argument is the data source
            this.visitAsDataSource(node.arguments[0], true);
            for (let i = 1; i < node.arguments.length; i++) {
                this.visit(node.arguments[i], { ...context, isWriteContext: false });
            }
        } else if ((funcName === 'filter' || funcName === 'lookup' || funcName === 'search') && node.arguments.length >= 1) {
            // First argument is the data source (read)
            this.visitAsDataSource(node.arguments[0], false);
            for (let i = 1; i < node.arguments.length; i++) {
                this.visit(node.arguments[i], { ...context, isWriteContext: false });
            }
        } else if (funcName === 'if' || funcName === 'switch') {
            // Conditional increases complexity
            this.complexity++;
            for (const arg of node.arguments) {
                this.visit(arg, context);
            }
        } else if (funcName === 'forall') {
            // Loop increases complexity
            this.complexity += 2;
            for (const arg of node.arguments) {
                this.visit(arg, context);
            }
        } else {
            // Regular function call
            for (const arg of node.arguments) {
                this.visit(arg, context);
            }
        }
    }
    
    private visitMemberExpression(node: MemberExpressionNode, context: VisitContext): void {
        const path = this.extractMemberPath(node);
        
        if (path.length > 0) {
            const rootName = path[0];
            const depType = this.inferDependencyType(rootName);
            
            this.addDependency({
                type: depType,
                name: rootName,
                path,
                line: node.line,
                column: node.column,
                isWrite: context.isWriteContext ?? false
            });
        }
    }
    
    private visitRecordExpression(node: RecordExpressionNode, context: VisitContext): void {
        for (const prop of node.properties) {
            this.visit(prop.value, context);
        }
    }
    
    private visitTableExpression(node: TableExpressionNode, context: VisitContext): void {
        for (const element of node.elements) {
            this.visit(element, context);
        }
    }
    
    private visitIfExpression(node: IfExpressionNode, context: VisitContext): void {
        this.complexity++;
        this.visit(node.condition, context);
        this.visit(node.consequent, context);
        if (node.alternate) {
            this.visit(node.alternate, context);
        }
    }
    
    private visitChainExpression(node: ChainExpressionNode, context: VisitContext): void {
        for (const expr of node.expressions) {
            this.visit(expr, context);
        }
    }
    
    // Special visit methods for specific patterns
    
    private visitAsGlobalVariable(node: ExpressionNode, isWrite: boolean): void {
        if (node.type === 'Identifier') {
            this.addDependency({
                type: DependencyType.GlobalVariable,
                name: node.name,
                path: [node.name],
                line: node.line,
                column: node.column,
                isWrite
            });
        }
    }
    
    private visitAsContextVariables(node: ExpressionNode, isWrite: boolean): void {
        if (node.type === 'RecordExpression') {
            for (const prop of node.properties) {
                this.addDependency({
                    type: DependencyType.ContextVariable,
                    name: prop.key.name,
                    path: [prop.key.name],
                    line: prop.line,
                    column: prop.column,
                    isWrite
                });
                // Visit the value in read context
                this.visit(prop.value, { isWriteContext: false });
            }
        }
    }
    
    private visitAsCollection(node: ExpressionNode, isWrite: boolean): void {
        if (node.type === 'Identifier') {
            this.addDependency({
                type: DependencyType.Collection,
                name: node.name,
                path: [node.name],
                line: node.line,
                column: node.column,
                isWrite
            });
        }
    }
    
    private visitAsScreen(node: ExpressionNode): void {
        if (node.type === 'Identifier') {
            this.addDependency({
                type: DependencyType.Screen,
                name: node.name,
                path: [node.name],
                line: node.line,
                column: node.column,
                isWrite: false
            });
        }
    }
    
    private visitAsDataSource(node: ExpressionNode, isWrite: boolean): void {
        if (node.type === 'Identifier') {
            this.addDependency({
                type: DependencyType.DataSource,
                name: node.name,
                path: [node.name],
                line: node.line,
                column: node.column,
                isWrite
            });
        }
    }
    
    // Helper methods
    
    private extractMemberPath(node: MemberExpressionNode): string[] {
        const path: string[] = [];
        
        let current: ExpressionNode = node;
        while (current.type === 'MemberExpression') {
            const memberNode = current as MemberExpressionNode;
            if (memberNode.property.type === 'Identifier') {
                path.unshift(memberNode.property.name);
            }
            current = memberNode.object;
        }
        
        if (current.type === 'Identifier') {
            path.unshift((current as IdentifierNode).name);
        }
        
        return path;
    }
    
    private inferDependencyType(name: string): DependencyType {
        // Check for data source patterns
        for (const pattern of DATASOURCE_PATTERNS) {
            if (pattern.test(name)) {
                return DependencyType.DataSource;
            }
        }
        
        // Common naming conventions
        if (name.startsWith('var') || name.startsWith('gbl')) {
            return DependencyType.GlobalVariable;
        }
        if (name.startsWith('loc')) {
            return DependencyType.ContextVariable;
        }
        if (name.startsWith('col')) {
            return DependencyType.Collection;
        }
        if (name.endsWith('Screen') || name.startsWith('scr')) {
            return DependencyType.Screen;
        }
        
        // Default to control reference
        return DependencyType.Control;
    }
    
    private addDependency(dep: Dependency): void {
        // Avoid duplicates (same name and path)
        const existing = this.dependencies.find(d => 
            d.name === dep.name && 
            d.path.join('.') === dep.path.join('.')
        );
        
        if (!existing) {
            this.dependencies.push(dep);
        } else if (dep.isWrite && !existing.isWrite) {
            // Update to write if we found a write context
            existing.isWrite = true;
        }
    }
}

interface VisitContext {
    isWriteContext?: boolean;
}

/**
 * Convenience function to analyze a formula
 */
export function analyzeFormula(formula: string): FormulaAnalysis {
    const analyzer = new PowerFxAnalyzer();
    return analyzer.analyze(formula);
}
