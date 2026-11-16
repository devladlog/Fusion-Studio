// -------------------------------------------------------
// Centralized Logger (OutputChannel-based)
// -------------------------------------------------------
import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function ensureChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Power Platform Studio');
  }
  return channel;
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(msg: string): void {
    ensureChannel().appendLine(`[INFO  ${timestamp()}] ${msg}`);
  },
  warn(msg: string): void {
    ensureChannel().appendLine(`[WARN  ${timestamp()}] ${msg}`);
  },
  error(msg: string, err?: unknown): void {
    const suffix = err instanceof Error ? `: ${err.message}` : '';
    ensureChannel().appendLine(`[ERROR ${timestamp()}] ${msg}${suffix}`);
  },
  debug(msg: string): void {
    ensureChannel().appendLine(`[DEBUG ${timestamp()}] ${msg}`);
  },
  show(): void {
    ensureChannel().show(true);
  },
  dispose(): void {
    channel?.dispose();
    channel = undefined;
  },
};
