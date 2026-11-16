// -------------------------------------------------------
// Copilot Chat Side-Panel
// -------------------------------------------------------
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AiService } from '../services/aiService';
import { getNonce, getCspMeta } from './webviewUtils';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'powerPlatformStudio.chatPanel';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly ai: AiService
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    void context;
    void token;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (msg: { command: string; text?: string }) => {
      if (msg.command === 'chat' && msg.text) {
        try {
          webviewView.webview.postMessage({ command: 'thinking' });
          const reply = await this.ai.chatAssistant(msg.text);
          webviewView.webview.postMessage({ command: 'reply', text: reply });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          webviewView.webview.postMessage({
            command: 'reply',
            text: `Error: ${message}`,
          });
        }
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const templatePath = path.join(this.extensionUri.fsPath, 'resources', 'chatPanel.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace(/\{\{CSP\}\}/g, getCspMeta(webview, nonce));
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }
}
