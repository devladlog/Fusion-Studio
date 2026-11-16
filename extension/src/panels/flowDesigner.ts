// -------------------------------------------------------
// Flow Designer - Webview Panel
// -------------------------------------------------------
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AiService } from '../services/aiService';
import { getNonce, getCspMeta } from './webviewUtils';

export class FlowDesignerPanel {
  public static readonly viewType = 'powerPlatformStudio.flowDesigner';
  private static instance: FlowDesignerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly ai: AiService
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: { command: string; instructions?: string }) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static show(extensionUri: vscode.Uri, ai: AiService): FlowDesignerPanel {
    if (FlowDesignerPanel.instance) {
      FlowDesignerPanel.instance.panel.reveal();
      return FlowDesignerPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      FlowDesignerPanel.viewType,
      'Flow Designer',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    FlowDesignerPanel.instance = new FlowDesignerPanel(panel, extensionUri, ai);
    return FlowDesignerPanel.instance;
  }

  private dispose(): void {
    FlowDesignerPanel.instance = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private async handleMessage(msg: { command: string; instructions?: string }): Promise<void> {
    switch (msg.command) {
      case 'generate': {
        try {
          this.panel.webview.postMessage({ command: 'status', text: 'Generating flow...' });
          const result = await this.ai.generateFlow({
            kind: 'instructions',
            payload: msg.instructions ?? '',
            targetArtifact: 'flow',
          });
          const defFile = result.files[0];
          this.panel.webview.postMessage({
            command: 'result',
            definition: defFile?.content ?? '{}',
            summary: result.summary,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.panel.webview.postMessage({ command: 'error', text: message });
        }
        break;
      }
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const templatePath = path.join(this.extensionUri.fsPath, 'resources', 'flowDesigner.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace(/\{\{CSP\}\}/g, getCspMeta(webview, nonce));
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }
}
