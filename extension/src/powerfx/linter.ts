/**
 * PowerFx Linter
 * Static analysis rules for PowerFx formulas
 */

import { parse, ProgramNode, ExpressionNode, CallExpressionNode, IdentifierNode } from './parser';
import { analyzeFormula, FormulaAnalysis, FunctionCall } from './analyzer';
import * as vscode from 'vscode';

/**
 * Lint rule severity
 */
export enum Severity {
    Error = 'error',
    Warning = 'warning',
    Info = 'info',
    Hint = 'hint'
}

/**
 * A lint diagnostic
 */
export interface LintDiagnostic {
    rule: string;
    message: string;
    severity: Severity;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    fix?: LintFix;
}

/**
 * A suggested fix for a lint issue
 */
export interface LintFix {
    description: string;
    replacement: string;
    start: number;
    end: number;
}

/**
 * Lint result for a formula
 */
export interface LintResult {
    diagnostics: LintDiagnostic[];
    analysis: FormulaAnalysis;
}

/**
 * Linter configuration
 */
export interface LinterConfig {
    rules: Record<string, RuleConfig>;
}

export interface RuleConfig {
    enabled: boolean;
    severity?: Severity;
    options?: Record<string, unknown>;
}

/**
 * Default linter configuration
 */
const DEFAULT_CONFIG: LinterConfig = {
    rules: {
        'no-hardcoded-environment': { enabled: true, severity: Severity.Warning },
        'max-formula-complexity': { enabled: true, severity: Severity.Warning, options: { maxComplexity: 10 } },
        'no-deprecated-functions': { enabled: true, severity: Severity.Warning },
        'prefer-coalesce': { enabled: true, severity: Severity.Info },
        'no-empty-if': { enabled: true, severity: Severity.Warning },
        'max-chain-length': { enabled: true, severity: Severity.Warning, options: { maxLength: 5 } },
        'no-unused-variables': { enabled: true, severity: Severity.Info },
        'consistent-naming': { enabled: true, severity: Severity.Info },
        'no-nested-if': { enabled: true, severity: Severity.Warning, options: { maxDepth: 3 } },
        'prefer-switch': { enabled: true, severity: Severity.Info, options: { minConditions: 3 } },
        'datasource-in-onstart': { enabled: true, severity: Severity.Info },
        'avoid-forall-side-effects': { enabled: true, severity: Severity.Warning }
    }
};

// Deprecated functions in PowerFx
const DEPRECATED_FUNCTIONS: Record<string, string> = {
    'context': 'Use UpdateContext instead',
    'loaddata': 'Use SaveData with Collect pattern instead',
    'savedata': 'Consider using Dataverse or cloud storage'
};

/**
 * PowerFx Linter
 */
export class PowerFxLinter {
    private config: LinterConfig;
    
    constructor(config?: Partial<LinterConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            rules: { ...DEFAULT_CONFIG.rules, ...config?.rules }
        };
    }
    
    /**
     * Lint a PowerFx formula
     */
    lint(formula: string, context?: LintContext): LintResult {
        const parseResult = parse(formula);
        const analysis = analyzeFormula(formula);
        
        const diagnostics: LintDiagnostic[] = [];
        
        // Add parse errors
        for (const error of parseResult.errors) {
            diagnostics.push({
                rule: 'parse-error',
                message: error.message,
                severity: Severity.Error,
                line: error.line,
                column: error.column
            });
        }
        
        // Skip rule checks if parsing failed
        if (!parseResult.ast) {
            return { diagnostics, analysis };
        }
        
        // Run enabled rules
        diagnostics.push(...this.runRules(formula, parseResult.ast, analysis, context));
        
        return { diagnostics, analysis };
    }
    
    private runRules(
        formula: string,
        ast: ProgramNode,
        analysis: FormulaAnalysis,
        context?: LintContext
    ): LintDiagnostic[] {
        const diagnostics: LintDiagnostic[] = [];
        
        // Rule: max-formula-complexity
        if (this.isEnabled('max-formula-complexity')) {
            const maxComplexity = this.getOption('max-formula-complexity', 'maxComplexity', 10);
            if (analysis.complexity > maxComplexity) {
                diagnostics.push({
                    rule: 'max-formula-complexity',
                    message: `Formula complexity (${analysis.complexity}) exceeds maximum (${maxComplexity}). Consider breaking into smaller formulas.`,
                    severity: this.getSeverity('max-formula-complexity'),
                    line: 1,
                    column: 1
                });
            }
        }
        
        // Rule: no-deprecated-functions
        if (this.isEnabled('no-deprecated-functions')) {
            for (const call of analysis.functionCalls) {
                const funcLower = call.name.toLowerCase();
                if (funcLower in DEPRECATED_FUNCTIONS) {
                    diagnostics.push({
                        rule: 'no-deprecated-functions',
                        message: `'${call.name}' is deprecated. ${DEPRECATED_FUNCTIONS[funcLower]}`,
                        severity: this.getSeverity('no-deprecated-functions'),
                        line: call.line,
                        column: call.column
                    });
                }
            }
        }
        
        // Rule: no-hardcoded-environment
        if (this.isEnabled('no-hardcoded-environment')) {
            const envPatterns = [
                /https:\/\/[^.]+\.crm\d*\.dynamics\.com/gi,
                /https:\/\/[^.]+\.powerapps\.com/gi,
                /org[a-f0-9]{8}\.crm\d*\.dynamics\.com/gi
            ];
            
            for (const pattern of envPatterns) {
                let match;
                while ((match = pattern.exec(formula)) !== null) {
                    const position = this.getLineAndColumn(formula, match.index);
                    diagnostics.push({
                        rule: 'no-hardcoded-environment',
                        message: 'Hardcoded environment URL detected. Use Environment variables or parameters instead.',
                        severity: this.getSeverity('no-hardcoded-environment'),
                        line: position.line,
                        column: position.column
                    });
                }
            }
        }
        
        // Rule: avoid-forall-side-effects
        if (this.isEnabled('avoid-forall-side-effects')) {
            this.checkForAllSideEffects(ast.body, analysis, diagnostics);
        }
        
        // Rule: prefer-switch
        if (this.isEnabled('prefer-switch')) {
            const minConditions = this.getOption('prefer-switch', 'minConditions', 3);
            const nestedIfs = this.countNestedIfs(ast.body);
            if (nestedIfs >= minConditions) {
                diagnostics.push({
                    rule: 'prefer-switch',
                    message: `Consider using Switch() instead of ${nestedIfs} nested If() conditions.`,
                    severity: this.getSeverity('prefer-switch'),
                    line: 1,
                    column: 1
                });
            }
        }
        
        // Rule: consistent-naming
        if (this.isEnabled('consistent-naming')) {
            this.checkConsistentNaming(analysis, diagnostics);
        }
        
        // Rule: datasource-in-onstart
        if (this.isEnabled('datasource-in-onstart') && context?.propertyName === 'OnSelect') {
            const dataReads = analysis.dependencies.filter(d => 
                d.type.toString().includes('DATASOURCE') && !d.isWrite
            );
            if (dataReads.length > 0) {
                diagnostics.push({
                    rule: 'datasource-in-onstart',
                    message: 'Consider caching data source reads in OnStart or OnVisible instead of OnSelect.',
                    severity: this.getSeverity('datasource-in-onstart'),
                    line: 1,
                    column: 1
                });
            }
        }
        
        return diagnostics;
    }
    
    private checkForAllSideEffects(
        node: ExpressionNode,
        analysis: FormulaAnalysis,
        diagnostics: LintDiagnostic[]
    ): void {
        // Find ForAll calls that contain behavior functions
        const forAllCalls = analysis.functionCalls.filter(
            f => f.name.toLowerCase() === 'forall'
        );
        
        const behaviorCalls = analysis.functionCalls.filter(f => f.isBehavior);
        
        // Simple heuristic: if we have ForAll and behavior functions together
        if (forAllCalls.length > 0 && behaviorCalls.length > 0) {
            for (const forAll of forAllCalls) {
                diagnostics.push({
                    rule: 'avoid-forall-side-effects',
                    message: 'ForAll with side effects (Patch, Collect, etc.) can cause performance issues. Consider using batch operations.',
                    severity: this.getSeverity('avoid-forall-side-effects'),
                    line: forAll.line,
                    column: forAll.column
                });
            }
        }
    }
    
    private countNestedIfs(node: ExpressionNode, depth: number = 0): number {
        if (node.type === 'CallExpression') {
            const call = node as CallExpressionNode;
            if (call.callee.name.toLowerCase() === 'if') {
                let maxChildDepth = depth + 1;
                for (const arg of call.arguments) {
                    maxChildDepth = Math.max(maxChildDepth, this.countNestedIfs(arg, depth + 1));
                }
                return maxChildDepth;
            }
        }
        return depth;
    }
    
    private checkConsistentNaming(analysis: FormulaAnalysis, diagnostics: LintDiagnostic[]): void {
        // Check for mixed naming conventions
        const names = analysis.dependencies.map(d => d.name);
        
        const camelCase = names.filter(n => /^[a-z][a-zA-Z0-9]*$/.test(n));
        const pascalCase = names.filter(n => /^[A-Z][a-zA-Z0-9]*$/.test(n));
        const snakeCase = names.filter(n => /^[a-z][a-z0-9_]*$/.test(n));
        
        // If significant mix, suggest consistency
        if (camelCase.length > 2 && pascalCase.length > 2) {
            diagnostics.push({
                rule: 'consistent-naming',
                message: 'Mixed naming conventions detected (camelCase and PascalCase). Consider using a consistent style.',
                severity: this.getSeverity('consistent-naming'),
                line: 1,
                column: 1
            });
        }
    }
    
    private getLineAndColumn(text: string, index: number): { line: number; column: number } {
        const lines = text.substring(0, index).split('\n');
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1
        };
    }
    
    private isEnabled(rule: string): boolean {
        return this.config.rules[rule]?.enabled ?? false;
    }
    
    private getSeverity(rule: string): Severity {
        return this.config.rules[rule]?.severity ?? Severity.Warning;
    }
    
    private getOption<T>(rule: string, option: string, defaultValue: T): T {
        return (this.config.rules[rule]?.options?.[option] as T) ?? defaultValue;
    }
    
    /**
     * Convert lint diagnostics to VS Code diagnostics
     */
    toVSCodeDiagnostics(result: LintResult, document: vscode.TextDocument): vscode.Diagnostic[] {
        return result.diagnostics.map(d => {
            const range = new vscode.Range(
                d.line - 1,
                d.column - 1,
                d.endLine ? d.endLine - 1 : d.line - 1,
                d.endColumn ? d.endColumn - 1 : d.column
            );
            
            const severity = this.mapSeverity(d.severity);
            const diagnostic = new vscode.Diagnostic(range, d.message, severity);
            diagnostic.source = 'PowerFx Linter';
            diagnostic.code = d.rule;
            
            return diagnostic;
        });
    }
    
    private mapSeverity(severity: Severity): vscode.DiagnosticSeverity {
        switch (severity) {
            case Severity.Error: return vscode.DiagnosticSeverity.Error;
            case Severity.Warning: return vscode.DiagnosticSeverity.Warning;
            case Severity.Info: return vscode.DiagnosticSeverity.Information;
            case Severity.Hint: return vscode.DiagnosticSeverity.Hint;
        }
    }
}

/**
 * Context for linting (property name, control type, etc.)
 */
interface LintContext {
    propertyName?: string;
    controlType?: string;
    screenName?: string;
    isComponent?: boolean;
}

/**
 * Create a linter instance with default configuration
 */
export function createLinter(config?: Partial<LinterConfig>): PowerFxLinter {
    return new PowerFxLinter(config);
}

/**
 * Quick lint function
 */
export function lintFormula(formula: string, context?: LintContext): LintResult {
    const linter = new PowerFxLinter();
    return linter.lint(formula, context);
}
