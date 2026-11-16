import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StateManager } from '../state/stateManager';

/**
 * Dashboard Panel - Main GUI for Fusion Studio
 * Provides a user-friendly interface to access all features
 */
export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    public static readonly viewType = 'fusionStudio.dashboard';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _stateManager: StateManager;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        stateManager: StateManager
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._stateManager = stateManager;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => this._handleMessage(message),
            null,
            this._disposables
        );

        // Update status when state changes
        this._stateManager.onEnvironmentChanged((env) => {
            this._sendStatusUpdate();
        });

        this._stateManager.onStudioStateChanged((state) => {
            this._sendStatusUpdate();
        });
    }

    /**
     * Create or show the dashboard panel
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        stateManager: StateManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'Fusion Studio',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'resources')
                ]
            }
        );

        // Set icon
        panel.iconPath = {
            light: vscode.Uri.joinPath(extensionUri, 'resources', 'powerapps.svg'),
            dark: vscode.Uri.joinPath(extensionUri, 'resources', 'powerapps.svg')
        };

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, stateManager);
    }

    /**
     * Handle messages from the webview
     */
    private async _handleMessage(message: any) {
        switch (message.type) {
            case 'run-command':
                if (message.command) {
                    try {
                        await vscode.commands.executeCommand(message.command);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to execute command: ${message.command}`);
                    }
                }
                break;

            case 'get-status':
                this._sendStatusUpdate();
                break;

            case 'open-settings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'powerapps');
                break;
        }
    }

    /**
     * Send status update to webview
     */
    private _sendStatusUpdate() {
        const environment = this._stateManager.getCurrentEnvironment() || 'Not connected';
        const studioState = this._stateManager.getStudioState();
        const isStudioReady = this._stateManager.isStudioReady();

        this._panel.webview.postMessage({
            type: 'update-status',
            environment: environment,
            studio: isStudioReady ? 'Connected' : 'Ready',
            git: 'Initialized'
        });
    }

    /**
     * Update the webview content
     */
    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Fusion Studio';
        this._panel.webview.html = this._getHtmlContent(webview);
    }

    /**
     * Get HTML content for the webview
     */
    private _getHtmlContent(webview: vscode.Webview): string {
        // Read the dashboard HTML template
        const htmlPath = path.join(this._extensionUri.fsPath, 'resources', 'dashboard.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Generate nonce for CSP
        const nonce = this._getNonce();

        // Replace nonce placeholder
        html = html.replace(/\{\{nonce\}\}/g, nonce);

        // Show the installed extension version in the footer
        html = html.replace(/\{\{version\}\}/g, this._getVersionLabel());

        // Update CSP to allow our nonce
        html = html.replace(
            /<meta http-equiv="Content-Security-Policy"[^>]*>/,
            `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">`
        );

        return html;
    }

    /**
     * Version label for the footer ("v0.4.3"), read from the shipped package.json
     * so it always matches the installed build. Empty if it cannot be read.
     */
    private _getVersionLabel(): string {
        try {
            const pkgPath = path.join(this._extensionUri.fsPath, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            return typeof pkg.version === 'string' ? `v${pkg.version}` : '';
        } catch {
            return '';
        }
    }

    /**
     * Generate a nonce for CSP
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Dispose the panel
     */
    public dispose() {
        DashboardPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
