/**
 * File Watcher Service
 * Watches for changes in unpacked canvas app source files
 * and triggers auto-sync operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { PacService } from '../pac/pacService';
import { DependencyGraph } from '../powerfx/dependencyGraph';
import { lintFormula, LintResult } from '../powerfx/linter';

/**
 * Source file types in unpacked canvas apps
 */
export enum SourceFileType {
    Screen = 'screen',
    Control = 'control',
    Component = 'component',
    DataSource = 'datasource',
    Resource = 'resource',
    Theme = 'theme',
    AppInfo = 'appinfo',
    Unknown = 'unknown'
}

/**
 * File change event
 */
export interface FileChangeEvent {
    type: 'created' | 'changed' | 'deleted';
    uri: vscode.Uri;
    fileType: SourceFileType;
    timestamp: Date;
}

/**
 * File Watcher Service
 */
export class FileWatcherService {
    private watcher: vscode.FileSystemWatcher | undefined;
    private sourcePath: string | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;
    private pendingChanges: FileChangeEvent[] = [];
    
    private _onFileChanged = new vscode.EventEmitter<FileChangeEvent>();
    public readonly onFileChanged = this._onFileChanged.event;
    
    private _onSyncRequired = new vscode.EventEmitter<FileChangeEvent[]>();
    public readonly onSyncRequired = this._onSyncRequired.event;
    
    private diagnosticCollection: vscode.DiagnosticCollection;
    
    constructor(
        private pacService: PacService,
        private graph: DependencyGraph
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('powerfx');
    }
    
    /**
     * Start watching a source folder
     */
    startWatching(sourcePath: string): void {
        this.stopWatching();
        this.sourcePath = sourcePath;
        
        // Watch for YAML and JSON files in the source folder
        const pattern = new vscode.RelativePattern(
            sourcePath,
            '**/*.{yaml,yml,json,pa.yaml}'
        );
        
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        this.watcher.onDidCreate(uri => this.handleFileEvent('created', uri));
        this.watcher.onDidChange(uri => this.handleFileEvent('changed', uri));
        this.watcher.onDidDelete(uri => this.handleFileEvent('deleted', uri));
        
        console.log(`FileWatcher: Started watching ${sourcePath}`);
        vscode.window.showInformationMessage(`Watching for changes in ${path.basename(sourcePath)}`);
    }
    
    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
        this.pendingChanges = [];
        this.sourcePath = undefined;
    }
    
    /**
     * Handle file events with debouncing
     */
    private handleFileEvent(type: 'created' | 'changed' | 'deleted', uri: vscode.Uri): void {
        const fileType = this.detectFileType(uri.fsPath);
        
        const event: FileChangeEvent = {
            type,
            uri,
            fileType,
            timestamp: new Date()
        };
        
        this.pendingChanges.push(event);
        this._onFileChanged.fire(event);
        
        // Debounce: wait 500ms before processing changes
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this.processChanges();
        }, 500);
    }
    
    /**
     * Process accumulated changes
     */
    private async processChanges(): Promise<void> {
        if (this.pendingChanges.length === 0) {
            return;
        }
        
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        
        console.log(`FileWatcher: Processing ${changes.length} file changes`);
        
        // Lint changed files
        for (const change of changes) {
            if (change.type !== 'deleted' && this.isFormulaFile(change.fileType)) {
                await this.lintFile(change.uri);
            }
        }
        
        // Update dependency graph for structural changes
        const structuralChanges = changes.filter(c => 
            c.fileType === SourceFileType.Screen ||
            c.fileType === SourceFileType.Control ||
            c.fileType === SourceFileType.Component
        );
        
        if (structuralChanges.length > 0) {
            // Rebuild graph
            if (this.sourcePath) {
                await this.graph.buildFromSource(this.sourcePath);
            }
        }
        
        // Notify listeners
        this._onSyncRequired.fire(changes);
        
        // Show notification for significant changes
        if (changes.length > 3) {
            vscode.window.showInformationMessage(
                `${changes.length} files changed. Source updated.`
            );
        }
    }
    
    /**
     * Lint a PowerFx file and update diagnostics
     */
    private async lintFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            
            // Extract formulas from YAML content
            const formulas = this.extractFormulas(content);
            
            const diagnostics: vscode.Diagnostic[] = [];
            
            for (const formula of formulas) {
                const result = lintFormula(formula.formula, {
                    propertyName: formula.property
                });
                
                for (const diag of result.diagnostics) {
                    // Adjust line numbers based on formula position in file
                    const range = new vscode.Range(
                        formula.line + diag.line - 1,
                        diag.column - 1,
                        formula.line + (diag.endLine ?? diag.line) - 1,
                        (diag.endColumn ?? diag.column + 10) - 1
                    );
                    
                    const severity = this.mapSeverity(diag.severity);
                    const diagnostic = new vscode.Diagnostic(range, diag.message, severity);
                    diagnostic.source = 'PowerFx';
                    diagnostic.code = diag.rule;
                    
                    diagnostics.push(diagnostic);
                }
            }
            
            this.diagnosticCollection.set(uri, diagnostics);
            
        } catch (error) {
            console.error(`Failed to lint ${uri.fsPath}:`, error);
        }
    }
    
    /**
     * Extract formulas from YAML content
     */
    private extractFormulas(content: string): FormulaLocation[] {
        const formulas: FormulaLocation[] = [];
        const lines = content.split('\n');
        
        // Simple YAML formula pattern: PropertyName: =FormulaContent
        // or PropertyName: |
        //      =FormulaContent
        const formulaPattern = /^(\s*)(\w+):\s*[|>]?\s*(=.+)?$/;
        
        let currentProperty: string | undefined;
        let currentFormula: string[] = [];
        let formulaStartLine = 0;
        let inMultilineFormula = false;
        let indent = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(formulaPattern);
            
            if (match) {
                // Save previous formula if any
                if (currentProperty && currentFormula.length > 0) {
                    formulas.push({
                        property: currentProperty,
                        formula: currentFormula.join('\n').replace(/^=/, '').trim(),
                        line: formulaStartLine
                    });
                }
                
                currentProperty = match[2];
                indent = match[1].length;
                
                if (match[3]) {
                    // Inline formula
                    currentFormula = [match[3]];
                    formulaStartLine = i;
                    inMultilineFormula = false;
                } else {
                    // Start of multiline formula
                    currentFormula = [];
                    formulaStartLine = i + 1;
                    inMultilineFormula = true;
                }
            } else if (inMultilineFormula && line.match(/^\s+/) && line.trim().length > 0) {
                // Continuation of multiline formula
                const lineIndent = line.search(/\S/);
                if (lineIndent > indent) {
                    currentFormula.push(line.trim());
                } else {
                    // End of multiline
                    inMultilineFormula = false;
                }
            }
        }
        
        // Don't forget last formula
        if (currentProperty && currentFormula.length > 0) {
            formulas.push({
                property: currentProperty,
                formula: currentFormula.join('\n').replace(/^=/, '').trim(),
                line: formulaStartLine
            });
        }
        
        return formulas;
    }
    
    /**
     * Detect file type based on path
     */
    private detectFileType(filePath: string): SourceFileType {
        const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
        const fileName = path.basename(normalizedPath);
        
        if (normalizedPath.includes('/screens/') || fileName.endsWith('.screen.yaml')) {
            return SourceFileType.Screen;
        }
        if (normalizedPath.includes('/controls/')) {
            return SourceFileType.Control;
        }
        if (normalizedPath.includes('/components/') || fileName.endsWith('.component.yaml')) {
            return SourceFileType.Component;
        }
        if (normalizedPath.includes('/datasources/') || normalizedPath.includes('/connections/')) {
            return SourceFileType.DataSource;
        }
        if (normalizedPath.includes('/resources/') || normalizedPath.includes('/assets/')) {
            return SourceFileType.Resource;
        }
        if (fileName.includes('theme')) {
            return SourceFileType.Theme;
        }
        if (fileName === 'app.yaml' || fileName === 'canvasmanifest.json') {
            return SourceFileType.AppInfo;
        }
        
        return SourceFileType.Unknown;
    }
    
    /**
     * Check if file type contains formulas
     */
    private isFormulaFile(fileType: SourceFileType): boolean {
        return [
            SourceFileType.Screen,
            SourceFileType.Control,
            SourceFileType.Component
        ].includes(fileType);
    }
    
    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Hint;
        }
    }
    
    /**
     * Get current source path
     */
    getSourcePath(): string | undefined {
        return this.sourcePath;
    }
    
    /**
     * Check if watching
     */
    isWatching(): boolean {
        return this.watcher !== undefined;
    }
    
    /**
     * Dispose resources
     */
    dispose(): void {
        this.stopWatching();
        this.diagnosticCollection.dispose();
        this._onFileChanged.dispose();
        this._onSyncRequired.dispose();
    }
}

interface FormulaLocation {
    property: string;
    formula: string;
    line: number;
}
