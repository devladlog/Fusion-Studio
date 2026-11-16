import * as vscode from 'vscode';
import { PacService } from './pac/pacService';
import { StateManager } from './state/stateManager';

/**
 * Provider for the Fusion Studio WebView
 * Embeds make.powerapps.com in a VS Code WebView panel
 */
export class StudioWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'powerapps.studioView';
    private static currentPanel: vscode.WebviewPanel | undefined;

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _pacService: PacService,
        private readonly _stateManager: StateManager
    ) {}

    /**
     * Creates a new WebView panel or reveals existing one
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        pacService: PacService,
        stateManager: StateManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel exists, reveal it
        if (StudioWebViewProvider.currentPanel) {
            StudioWebViewProvider.currentPanel.reveal(column);
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'powerAppsStudio',
            'Fusion Studio',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview', 'build'),
                    vscode.Uri.joinPath(extensionUri, 'resources')
                ]
            }
        );

        StudioWebViewProvider.currentPanel = panel;

        // Set HTML content
        panel.webview.html = StudioWebViewProvider.getWebviewContent(
            panel.webview,
            extensionUri,
            stateManager.getCurrentEnvironment()
        );

        // Handle messages from WebView
        panel.webview.onDidReceiveMessage(
            async message => {
                await StudioWebViewProvider.handleMessage(message, panel, pacService, stateManager);
            },
            undefined,
            []
        );

        // Handle panel disposal
        panel.onDidDispose(
            () => {
                StudioWebViewProvider.currentPanel = undefined;
            },
            null,
            []
        );
    }

    /**
     * Implementation for WebviewViewProvider interface
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'webview', 'build'),
                vscode.Uri.joinPath(this._extensionUri, 'resources')
            ]
        };

        webviewView.webview.html = StudioWebViewProvider.getWebviewContent(
            webviewView.webview,
            this._extensionUri,
            this._stateManager.getCurrentEnvironment()
        );

        // Handle messages
        webviewView.webview.onDidReceiveMessage(async message => {
            await StudioWebViewProvider.handleMessage(
                message,
                webviewView,
                this._pacService,
                this._stateManager
            );
        });
    }

    /**
     * Handles messages from the WebView
     */
    private static async handleMessage(
        message: WebViewMessage,
        target: vscode.WebviewPanel | vscode.WebviewView,
        pacService: PacService,
        stateManager: StateManager
    ) {
        switch (message.type) {
            case 'studio-ready':
                console.log('Fusion Studio WebView ready');
                stateManager.setStudioReady(true);
                break;

            case 'studio-state-changed':
                // Read-only observability: capture state without modifying
                stateManager.updateStudioState({
                    activeScreen: message.data?.activeScreen,
                    selectedControl: message.data?.selectedControl,
                    lastFormula: message.data?.lastFormula,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'app-saved': {
                // Trigger auto-unpack if enabled
                const config = vscode.workspace.getConfiguration('powerapps');
                if (config.get('autoUnpackOnSave') && message.data?.appId) {
                    vscode.window.showInformationMessage(
                        'App saved. Triggering source sync...'
                    );
                    // TODO: Implement auto-unpack workflow
                }
                break;
            }

            case 'error':
                vscode.window.showErrorMessage(
                    `Fusion Studio Error: ${message.data?.message}`
                );
                break;

            case 'request-env-list': {
                const environments = await pacService.listOrganizations();
                target.webview.postMessage({
                    type: 'env-list',
                    data: environments
                });
                break;
            }

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    /**
     * Generates the HTML content for the WebView
     */
    private static getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        currentEnvironment?: string
    ): string {
        // Determine the Power Apps URL
        const baseUrl = 'https://make.powerapps.com';
        const studioUrl = currentEnvironment
            ? `${baseUrl}/environments/${currentEnvironment}/home`
            : baseUrl;

        // Security: Generate nonce for inline scripts
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        frame-src https://make.powerapps.com https://*.powerapps.com https://login.microsoftonline.com https://*.dynamics.com;
        style-src 'unsafe-inline';
        script-src 'nonce-${nonce}';
    ">
    <title>Fusion Studio</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #1e1e1e;
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .toolbar {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            background: #252526;
            border-bottom: 1px solid #3c3c3c;
            gap: 12px;
        }
        .toolbar-title {
            color: #cccccc;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            font-weight: 500;
        }
        .toolbar-status {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4caf50;
        }
        .status-indicator.disconnected {
            background: #f44336;
        }
        .status-text {
            color: #858585;
            font-family: 'Segoe UI', sans-serif;
            font-size: 12px;
        }
        .studio-frame {
            flex: 1;
            width: 100%;
            border: none;
        }
        .loading-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #cccccc;
            font-family: 'Segoe UI', sans-serif;
            text-align: center;
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #3c3c3c;
            border-top-color: #0078d4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <span class="toolbar-title">Fusion Studio</span>
            <div class="toolbar-status">
                <div class="status-indicator" id="statusIndicator"></div>
                <span class="status-text" id="statusText">Connecting...</span>
            </div>
        </div>
        <div class="loading-overlay" id="loadingOverlay">
            <div class="loading-spinner"></div>
            <div>Loading Fusion Studio...</div>
        </div>
        <iframe 
            id="studioFrame"
            class="studio-frame"
            src="${studioUrl}"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            allow="clipboard-write"
            style="display: none;"
        ></iframe>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            const frame = document.getElementById('studioFrame');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');

            // Handle iframe load
            frame.addEventListener('load', () => {
                loadingOverlay.style.display = 'none';
                frame.style.display = 'block';
                statusIndicator.classList.remove('disconnected');
                statusText.textContent = 'Connected';
                
                // Notify extension that Studio is ready
                vscode.postMessage({ type: 'studio-ready' });
            });

            // Handle iframe errors
            frame.addEventListener('error', () => {
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Connection failed';
                vscode.postMessage({ 
                    type: 'error', 
                    data: { message: 'Failed to load Fusion Studio' }
                });
            });

            // Listen for messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'env-list':
                        console.log('Received environment list:', message.data);
                        break;
                    case 'navigate':
                        if (message.data?.url) {
                            frame.src = message.data.url;
                        }
                        break;
                }
            });

            // Periodic state polling (read-only observability)
            // NOTE: This is non-intrusive - we only observe, never modify
            setInterval(() => {
                try {
                    // We can only observe cross-origin iframe state through postMessage
                    // The Studio side would need to cooperate with our observer
                    // For MVP, we just track that the frame is loaded
                    vscode.postMessage({
                        type: 'studio-state-changed',
                        data: {
                            timestamp: new Date().toISOString(),
                            frameLoaded: frame.style.display !== 'none'
                        }
                    });
                } catch (e) {
                    // Cross-origin restrictions - expected behavior
                }
            }, 5000);
        })();
    </script>
</body>
</html>`;
    }
}

/**
 * Message types from WebView to Extension
 */
interface WebViewMessage {
    type: 'studio-ready' | 'studio-state-changed' | 'app-saved' | 'error' | 'request-env-list';
    data?: {
        activeScreen?: string;
        selectedControl?: string;
        lastFormula?: string;
        message?: string;
        appId?: string;
        [key: string]: unknown;
    };
}

/**
 * Generate a nonce for Content Security Policy
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
