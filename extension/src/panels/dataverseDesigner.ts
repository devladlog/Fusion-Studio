// -------------------------------------------------------
// Dataverse Table Designer - Webview Panel
// -------------------------------------------------------
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DataverseService } from '../services/dataverseService';
import { PpColumn } from '../types';
import { getNonce, getCspMeta } from './webviewUtils';
import { validateSchemaName } from '../services/validation';

export class DataverseDesignerPanel {
  public static readonly viewType = 'powerPlatformStudio.dataverseDesigner';
  private static instance: DataverseDesignerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly dataverse: DataverseService
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static show(
    extensionUri: vscode.Uri,
    dataverse: DataverseService
  ): DataverseDesignerPanel {
    if (DataverseDesignerPanel.instance) {
      DataverseDesignerPanel.instance.panel.reveal();
      return DataverseDesignerPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      DataverseDesignerPanel.viewType,
      'Dataverse Table Designer',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    DataverseDesignerPanel.instance = new DataverseDesignerPanel(
      panel,
      extensionUri,
      dataverse
    );
    return DataverseDesignerPanel.instance;
  }

  private dispose(): void {
    DataverseDesignerPanel.instance = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private async handleMessage(msg: { command: string; displayName?: string; schemaName?: string; description?: string; primaryColumn?: string; columns?: PpColumn[] }): Promise<void> {
    switch (msg.command) {
      case 'createTable': {
        try {
          const schemaName = msg.schemaName ?? '';
          validateSchemaName(schemaName, 'schema name');
          await this.dataverse.createTable(
            msg.displayName ?? '',
            schemaName,
            msg.description ?? '',
            msg.primaryColumn ?? 'name'
          );
          for (const col of msg.columns ?? []) {
            await this.dataverse.addColumn(schemaName.toLowerCase(), col);
          }
          this.panel.webview.postMessage({ command: 'success', text: `Table "${msg.displayName}" created.` });
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
    const templatePath = path.join(this.extensionUri.fsPath, 'resources', 'dataverseDesigner.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace(/\{\{CSP\}\}/g, getCspMeta(webview, nonce));
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }
}
