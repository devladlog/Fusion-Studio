// -------------------------------------------------------
// Webview utilities (CSP, nonce generation)
// -------------------------------------------------------
import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function getCspMeta(webview: vscode.Webview, nonce: string): string {
  const cspSource = webview.cspSource;
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${cspSource} data:; font-src ${cspSource};" />`;
}
