import * as vscode from 'vscode';
import { StudioWebViewProvider } from './studioWebView';
import { PacService, Organization } from './pac/pacService';
import { StateManager } from './state/stateManager';
import { createDependencyGraph, DependencyGraph } from './powerfx/dependencyGraph';
import { createLinter, lintFormula } from './powerfx/linter';
import { 
    EnvironmentTreeProvider, 
    AppsTreeProvider, 
    ObservabilityTreeProvider,
    DependencyTreeProvider 
} from './views/treeProviders';
import { FileWatcherService } from './services/fileWatcher';
import { GitService, createGitService } from './services/gitService';
import { StatusBarManager } from './services/statusBar';
import { AiService } from './services/aiService';
import { DataverseService } from './services/dataverseService';
import { logger } from './services/logger';
import { ChatPanelProvider } from './panels/chatPanel';
import { DataverseDesignerPanel } from './panels/dataverseDesigner';
import { FlowDesignerPanel } from './panels/flowDesigner';
import { DashboardPanel } from './panels/dashboard';
import { InputPipeline } from './pipelines/inputPipeline';

// Global service instances
let studioProvider: StudioWebViewProvider;
let pacService: PacService;
let stateManager: StateManager;
let dependencyGraph: DependencyGraph;
let fileWatcher: FileWatcherService;
let gitService: GitService;
let statusBar: StatusBarManager;
let aiService: AiService;
let dataverseService: DataverseService;
let inputPipeline: InputPipeline;

// Tree providers
let environmentTreeProvider: EnvironmentTreeProvider;
let appsTreeProvider: AppsTreeProvider;
let observabilityTreeProvider: ObservabilityTreeProvider;
let dependencyTreeProvider: DependencyTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    logger.info('Fusion Studio extension is now active');

    // Initialize core services
    pacService = new PacService();
    stateManager = new StateManager(context);
    dependencyGraph = createDependencyGraph();
    gitService = createGitService();
    fileWatcher = new FileWatcherService(pacService, dependencyGraph);
    
    // Initialize AI and Dataverse services
    aiService = new AiService();
    aiService.setSecretStorage(context.secrets);
    dataverseService = new DataverseService();
    inputPipeline = new InputPipeline(aiService, dataverseService);
    
    // Initialize WebView provider
    studioProvider = new StudioWebViewProvider(context.extensionUri, pacService, stateManager);

    // Initialize tree view providers
    environmentTreeProvider = new EnvironmentTreeProvider(pacService, stateManager);
    appsTreeProvider = new AppsTreeProvider(stateManager);
    observabilityTreeProvider = new ObservabilityTreeProvider(stateManager);
    dependencyTreeProvider = new DependencyTreeProvider();
    
    // Connect providers to dependency graph
    appsTreeProvider.setDependencyGraph(dependencyGraph);
    dependencyTreeProvider.setDependencyGraph(dependencyGraph);
    
    // Initialize status bar
    statusBar = new StatusBarManager(stateManager, gitService, fileWatcher);

    // Register tree views
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('powerapps.environments', environmentTreeProvider),
        vscode.window.registerTreeDataProvider('powerapps.apps', appsTreeProvider),
        vscode.window.registerTreeDataProvider('powerapps.observability', observabilityTreeProvider),
        vscode.window.registerTreeDataProvider('powerapps.dependencies', dependencyTreeProvider)
    );
    
    // Register Chat Panel (AI Copilot sidebar)
    const chatProvider = new ChatPanelProvider(context.extensionUri, aiService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('powerapps.chatPanel', chatProvider)
    );

    // Register WebView Provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('powerapps.studioView', studioProvider)
    );

    // ========== DASHBOARD COMMAND ==========
    
    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.openDashboard', () => {
            DashboardPanel.createOrShow(context.extensionUri, stateManager);
        })
    );

    // ========== STUDIO COMMANDS ==========
    
    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.openStudio', () => {
            StudioWebViewProvider.createOrShow(context.extensionUri, pacService, stateManager);
        })
    );

    // ========== PAC CLI COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.unpackApp', async () => {
            const msappFile = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'Canvas App': ['msapp'] },
                title: 'Select Canvas App (.msapp)'
            });

            if (msappFile?.[0]) {
                const outputFolder = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    title: 'Select output folder for unpacked source'
                });

                if (outputFolder?.[0]) {
                    const success = await pacService.unpackCanvasApp(
                        msappFile[0].fsPath,
                        outputFolder[0].fsPath
                    );
                    
                    if (success) {
                        // Start watching the unpacked folder
                        fileWatcher.startWatching(outputFolder[0].fsPath);
                        stateManager.setCanvasAppSourcePath(outputFolder[0].fsPath);
                        
                        // Build dependency graph
                        await dependencyGraph.buildFromSource(outputFolder[0].fsPath);
                    }
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.packApp', async () => {
            const sourceFolder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select unpacked source folder'
            });

            if (sourceFolder?.[0]) {
                const outputFile = await vscode.window.showSaveDialog({
                    filters: { 'Canvas App': ['msapp'] },
                    title: 'Save Canvas App as'
                });

                if (outputFile) {
                    await pacService.packCanvasApp(
                        sourceFolder[0].fsPath,
                        outputFile.fsPath
                    );
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.selectEnvironment', async () => {
            const environments = await pacService.listOrganizations();
            if (environments.length === 0) {
                vscode.window.showWarningMessage('No environments found. Please authenticate first.');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                environments.map(env => ({
                    label: env.friendlyName,
                    description: env.url,
                    detail: `${env.type} - ${env.environmentId}`,
                    env
                })),
                { placeHolder: 'Select Power Platform Environment' }
            );

            if (selected) {
                stateManager.setCurrentEnvironment(selected.env.environmentId);
                await pacService.selectOrganization(selected.env.url);
                vscode.window.showInformationMessage(`Selected environment: ${selected.label}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.selectEnvironmentFromTree', async (env: Organization) => {
            stateManager.setCurrentEnvironment(env.environmentId);
            await pacService.selectOrganization(env.url);
            vscode.window.showInformationMessage(`Selected environment: ${env.friendlyName}`);
            environmentTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.authStatus', async () => {
            const authList = await pacService.listAuthProfiles();
            if (authList.length === 0) {
                const action = await vscode.window.showWarningMessage(
                    'No authentication profiles found.',
                    'Authenticate'
                );
                if (action === 'Authenticate') {
                    await pacService.createAuthProfile();
                    environmentTreeProvider.refresh();
                }
            } else {
                const items = authList.map(p => ({
                    label: p.name,
                    description: p.kind,
                    detail: `${p.user} (${p.cloud})`,
                    picked: p.active
                }));
                
                await vscode.window.showQuickPick(items, {
                    placeHolder: 'Authentication Profiles',
                    canPickMany: false
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.refreshEnvironments', () => {
            environmentTreeProvider.refresh();
        })
    );

    // ========== POWERFX COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.lintFormula', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const formula = selection.isEmpty 
                ? editor.document.getText() 
                : editor.document.getText(selection);

            const result = lintFormula(formula);
            
            if (result.diagnostics.length === 0) {
                vscode.window.showInformationMessage('No issues found!');
            } else {
                const linter = createLinter();
                const diagnostics = linter.toVSCodeDiagnostics(result, editor.document);
                
                const collection = vscode.languages.createDiagnosticCollection('powerfx-lint');
                collection.set(editor.document.uri, diagnostics);
                
                vscode.window.showWarningMessage(
                    `Found ${result.diagnostics.length} issue(s)`
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.analyzeFormula', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const formula = editor.document.getText(editor.selection);
            if (!formula) {
                vscode.window.showWarningMessage('Please select a formula to analyze');
                return;
            }

            const result = lintFormula(formula);
            
            const panel = vscode.window.createWebviewPanel(
                'formulaAnalysis',
                'Formula Analysis',
                vscode.ViewColumn.Beside,
                {}
            );
            
            panel.webview.html = getAnalysisHtml(formula, result.analysis);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.exportDependencyGraph', async () => {
            const format = await vscode.window.showQuickPick(
                [
                    { label: 'Mermaid', value: 'mermaid', description: 'Markdown-compatible diagram' },
                    { label: 'DOT (Graphviz)', value: 'dot', description: 'Graphviz format' },
                    { label: 'D2', value: 'd2', description: 'D2 diagram format' },
                    { label: 'JSON', value: 'json', description: 'Raw JSON data' }
                ],
                { placeHolder: 'Select export format' }
            );

            if (format) {
                const content = dependencyGraph.export(format.value as 'mermaid' | 'dot' | 'd2' | 'json');
                
                const doc = await vscode.workspace.openTextDocument({
                    content,
                    language: format.value === 'json' ? 'json' : 'markdown'
                });
                
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    // ========== GIT COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitInit', async () => {
            const isRepo = await gitService.isRepository();
            if (isRepo) {
                vscode.window.showInformationMessage('Git repository already initialized');
                return;
            }
            
            await gitService.init();
            statusBar.updateAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitCommit', async () => {
            const status = await gitService.getStatus();
            if (status.length === 0) {
                vscode.window.showInformationMessage('No changes to commit');
                return;
            }

            const message = await vscode.window.showInputBox({
                prompt: 'Commit message',
                placeHolder: 'Enter commit message'
            });

            if (message) {
                await gitService.stageAll();
                await gitService.commit(message);
                statusBar.updateAll();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitCommitPowerApps', async () => {
            const appName = await vscode.window.showInputBox({
                prompt: 'App name',
                placeHolder: 'Enter the Canvas App name'
            });

            if (!appName) {return;}

            const changeType = await vscode.window.showQuickPick(
                ['Feature', 'Bugfix', 'Refactor', 'Update', 'Initial'],
                { placeHolder: 'Select change type' }
            );

            if (changeType) {
                await gitService.commitPowerAppsChanges(appName, changeType);
                statusBar.updateAll();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitCreateBranch', async () => {
            const branchName = await vscode.window.showInputBox({
                prompt: 'Branch name',
                placeHolder: 'e.g., add-login-screen'
            });

            if (branchName) {
                await gitService.createBranch(branchName);
                statusBar.updateAll();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitPush', async () => {
            await gitService.push();
            statusBar.updateAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.gitPull', async () => {
            await gitService.pull();
            statusBar.updateAll();
        })
    );

    // ========== FILE WATCHER COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.toggleWatcher', async () => {
            if (fileWatcher.isWatching()) {
                fileWatcher.stopWatching();
                vscode.window.showInformationMessage('File watcher stopped');
            } else {
                const folder = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    title: 'Select Canvas App source folder to watch'
                });

                if (folder?.[0]) {
                    fileWatcher.startWatching(folder[0].fsPath);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.watchCurrentFolder', () => {
            const sourcePath = stateManager.getCanvasAppSourcePath();
            if (sourcePath) {
                fileWatcher.startWatching(sourcePath);
            } else {
                vscode.window.showWarningMessage('No Canvas App source folder configured');
            }
        })
    );

    // ========== REFRESH COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.refreshApps', () => {
            appsTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.refreshObservability', () => {
            observabilityTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.refreshDependencies', () => {
            dependencyTreeProvider.refresh();
        })
    );

    // ========== UTILITY COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.showGraphStats', () => {
            const stats = dependencyGraph.getStats();
            
            vscode.window.showInformationMessage(
                `Graph: ${stats.totalNodes} nodes, ${stats.totalEdges} edges, ` +
                `${stats.screens} screens, ${stats.dataSources} data sources`
            );
            
            if (stats.circularDependencies.length > 0) {
                vscode.window.showWarningMessage(
                    `Found ${stats.circularDependencies.length} circular dependencies!`
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.clearState', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Clear all cached state?',
                'Yes', 'No'
            );
            
            if (confirm === 'Yes') {
                await stateManager.clearState();
                dependencyGraph.clear();
                vscode.window.showInformationMessage('State cleared');
            }
        })
    );

    // ========== AI GENERATION COMMANDS ==========

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.generateFromDocument', async () => {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                filters: { 'Documents': ['md', 'txt', 'pdf', 'docx'] },
                openLabel: 'Select Document'
            });
            if (files?.[0]) {
                await inputPipeline.fromDocument(files[0]);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.generateFromMockup', async () => {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                filters: { 'Images': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] },
                openLabel: 'Select Mockup Image'
            });
            if (files?.[0]) {
                await inputPipeline.fromMockup(files[0]);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.generateFromInstructions', async () => {
            await inputPipeline.fromInstructions();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.analyzeCanvasApp', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a Canvas App YAML file first.');
                return;
            }
            const content = editor.document.getText();
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Analyzing Canvas App with AI...' },
                async () => {
                    const analysis = await aiService.analyzeCanvasApp(content);
                    const doc = await vscode.workspace.openTextDocument({ content: analysis, language: 'markdown' });
                    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.openChatPanel', () => {
            vscode.commands.executeCommand('powerapps.chatPanel.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.openDataverseDesigner', () => {
            DataverseDesignerPanel.show(context.extensionUri, dataverseService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.openFlowDesigner', () => {
            FlowDesignerPanel.show(context.extensionUri, aiService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('powerapps.setApiKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI API Key',
                password: true,
                ignoreFocusOut: true
            });
            if (key) {
                await aiService.storeApiKey(key);
                vscode.window.showInformationMessage('API key stored securely.');
            }
        })
    );

    // ========== SUBSCRIPTIONS ==========

    // File watcher events
    context.subscriptions.push(
        fileWatcher.onSyncRequired(changes => {
            const screenChanges = changes.filter(c => c.fileType === 'screen');
            if (screenChanges.length > 0) {
                appsTreeProvider.refresh();
            }
        })
    );

    // Cleanup on deactivation
    context.subscriptions.push({
        dispose: () => {
            fileWatcher.dispose();
            dependencyGraph.dispose();
            statusBar.dispose();
            stateManager.dispose();
        }
    });

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome');
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Welcome to Fusion Studio! Your Power Apps engineering toolkit is ready.',
            'Open Dashboard',
            'Open Studio'
        ).then(selection => {
            if (selection === 'Open Dashboard') {
                vscode.commands.executeCommand('powerapps.openDashboard');
            } else if (selection === 'Open Studio') {
                vscode.commands.executeCommand('powerapps.openStudio');
            }
        });
        context.globalState.update('hasShownWelcome', true);
        
        // Auto-open dashboard on first activation
        DashboardPanel.createOrShow(context.extensionUri, stateManager);
    }

    // Initialize async tasks
    initializeAsync();
}

async function initializeAsync(): Promise<void> {
    // Check for existing source folder
    const sourcePath = stateManager?.getCanvasAppSourcePath();
    if (sourcePath) {
        try {
            await dependencyGraph.buildFromSource(sourcePath);
        } catch {
            // Folder might not exist anymore
        }
    }
    
    // Update status bar with Git info
    await statusBar?.updateAll();
    
    // Refresh environment list
    await environmentTreeProvider?.refresh();
}

function getAnalysisHtml(formula: string, analysis: { 
    complexity: number; 
    dependencies?: Array<{ name: string; type: string; isWrite: boolean }>; 
    functionCalls?: Array<{ name: string; arguments: number; isBehavior: boolean }>;
    hasImperativeCode: boolean;
}): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        h2 { color: var(--vscode-foreground); }
        .section { margin: 20px 0; }
        .formula { background: var(--vscode-editor-background); padding: 10px; border-radius: 4px; white-space: pre-wrap; }
        .metric { display: inline-block; margin: 5px 10px; padding: 5px 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--vscode-widget-border); }
        .warning { color: var(--vscode-editorWarning-foreground); }
    </style>
</head>
<body>
    <h2>Formula Analysis</h2>
    
    <div class="section">
        <h3>Formula</h3>
        <pre class="formula">${escapeHtml(formula)}</pre>
    </div>
    
    <div class="section">
        <h3>Metrics</h3>
        <div class="metric">Complexity: ${analysis.complexity}</div>
        <div class="metric">Dependencies: ${analysis.dependencies?.length ?? 0}</div>
        <div class="metric">Function Calls: ${analysis.functionCalls?.length ?? 0}</div>
        ${analysis.hasImperativeCode ? '<div class="metric warning">Contains Side Effects</div>' : ''}
    </div>
    
    <div class="section">
        <h3>Dependencies</h3>
        <table>
            <tr><th>Name</th><th>Type</th><th>Read/Write</th></tr>
            ${(analysis.dependencies ?? []).map(d => 
                `<tr><td>${d.name}</td><td>${d.type}</td><td>${d.isWrite ? 'Write' : 'Read'}</td></tr>`
            ).join('')}
        </table>
    </div>
    
    <div class="section">
        <h3>Function Calls</h3>
        <table>
            <tr><th>Function</th><th>Args</th><th>Type</th></tr>
            ${(analysis.functionCalls ?? []).map(f => 
                `<tr><td>${f.name}</td><td>${f.arguments}</td><td>${f.isBehavior ? 'Behavior' : 'Expression'}</td></tr>`
            ).join('')}
        </table>
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function deactivate() {
    console.log('Fusion Studio extension deactivated');
}
