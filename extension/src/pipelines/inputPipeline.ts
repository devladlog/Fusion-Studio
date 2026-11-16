// -------------------------------------------------------
// Input Processing Pipelines
// Handles document, mockup, and instruction inputs and
// routes them to the AI layer for artifact generation.
// -------------------------------------------------------
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AiService } from '../services/aiService';
import { DataverseService } from '../services/dataverseService';
import { GeneratedArtifact, DataverseSchemaResult, GenerationRequest } from '../types';
import { logger } from '../services/logger';
import { validateFileSize, validateBase64Size } from '../services/validation';

export class InputPipeline {
  constructor(
    private readonly ai: AiService,
    private readonly dataverse: DataverseService
  ) {}

  // ---------------------- Document Pipeline ----------------------

  /**
   * Generate artifacts from a document file (PDF / Word / Markdown / plain text).
   * PDF text is extracted with pdf-parse and Word (.docx) text with mammoth;
   * both are bundled into dist/extension.js by esbuild.js.
   */
  async fromDocument(documentUri: vscode.Uri): Promise<void> {
    const ext = path.extname(documentUri.fsPath).toLowerCase();
    const stat = fs.statSync(documentUri.fsPath);
    validateFileSize(stat.size, documentUri.fsPath);
    let text: string;

    if (ext === '.md' || ext === '.txt') {
      text = fs.readFileSync(documentUri.fsPath, 'utf-8');
    } else if (ext === '.pdf') {
      try {
        // Load lib/pdf-parse.js, not the package entry: pdf-parse's index.js runs a debug
        // self-test (reading ./test/data/05-versions-space.pdf) when module.parent is
        // undefined, which is the case inside the esbuild bundle.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
        const buffer = fs.readFileSync(documentUri.fsPath);
        const data = await pdfParse(buffer);
        text = data.text;
        logger.info(`Parsed PDF: ${data.numpages} pages, ${text.length} chars`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('PDF parsing failed', err);
        const input = await this.promptForText(
          `PDF parsing failed (${message}). Paste or summarize the document contents:`
        );
        if (!input) { return; }
        text = input;
      }
    } else if (ext === '.docx') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: documentUri.fsPath });
        text = result.value;
        logger.info(`Parsed DOCX: ${text.length} chars`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('DOCX parsing failed', err);
        const input = await this.promptForText(
          `Word parsing failed (${message}). Paste or summarize the document contents:`
        );
        if (!input) { return; }
        text = input;
      }
    } else {
      const input = await this.promptForText(
        'Unsupported file format. Paste or summarize the document contents:'
      );
      if (!input) { return; }
      text = input;
    }

    // Ask what to generate
    const target = await vscode.window.showQuickPick(
      ['Canvas App', 'Model-Driven App', 'Power Automate Flow', 'Dataverse Tables'],
      { title: 'What should be generated from this document?' }
    );
    if (!target) {
      return;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Generating from document...' },
      async () => {
        const targetArtifact = this.mapTarget(target);

        if (targetArtifact === 'dataverse-table') {
          await this.generateAndApplySchema(text);
        } else {
          const request: GenerationRequest = {
            kind: 'document',
            payload: text,
            targetArtifact,
          };
          const artifact = targetArtifact === 'flow'
            ? await this.ai.generateFlow(request)
            : await this.ai.generateCanvasApp(request);
          await this.saveArtifact(artifact);
        }
      }
    );
  }

  // ---------------------- Mockup Pipeline ----------------------

  async fromMockup(imageUri: vscode.Uri): Promise<void> {
    const stat = fs.statSync(imageUri.fsPath);
    validateFileSize(stat.size, imageUri.fsPath);
    const imageBuffer = fs.readFileSync(imageUri.fsPath);
    const base64 = imageBuffer.toString('base64');
    validateBase64Size(base64);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Interpreting mockup...' },
      async () => {
        const artifact = await this.ai.interpretMockup(base64);
        await this.saveArtifact(artifact);
      }
    );
  }

  // ---------------------- Instructions Pipeline ----------------------

  async fromInstructions(): Promise<void> {
    const instructions = await this.promptForText(
      'Describe what you want to create (app, flow, tables, etc.):'
    );
    if (!instructions) {
      return;
    }

    const target = await vscode.window.showQuickPick(
      ['Canvas App', 'Model-Driven App', 'Power Automate Flow', 'Dataverse Tables'],
      { title: 'What type of artifact?' }
    );
    if (!target) {
      return;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Generating from instructions...' },
      async () => {
        const targetArtifact = this.mapTarget(target);

        if (targetArtifact === 'dataverse-table') {
          await this.generateAndApplySchema(instructions);
        } else {
          const request: GenerationRequest = {
            kind: 'instructions',
            payload: instructions,
            targetArtifact,
          };
          const artifact = targetArtifact === 'flow'
            ? await this.ai.generateFlow(request)
            : await this.ai.generateCanvasApp(request);
          await this.saveArtifact(artifact);
        }
      }
    );
  }

  // ---------------------- Helpers ----------------------

  private mapTarget(
    label: string
  ): GenerationRequest['targetArtifact'] {
    switch (label) {
      case 'Power Automate Flow':
        return 'flow';
      case 'Dataverse Tables':
        return 'dataverse-table';
      case 'Model-Driven App':
        return 'model-driven-app';
      default:
        return 'canvas-app';
    }
  }

  private async promptForText(prompt: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
      prompt,
      ignoreFocusOut: true,
    });
  }

  /** Save generated files to a workspace folder */
  private async saveArtifact(artifact: GeneratedArtifact): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const baseDir = workspaceFolders?.[0]?.uri.fsPath;
    if (!baseDir) {
      // Open a save dialog if no workspace
      const folder = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        openLabel: 'Select output folder',
      });
      if (!folder?.[0]) {
        return;
      }
      await this.writeFiles(folder[0].fsPath, artifact);
      return;
    }

    const outDir = path.join(baseDir, 'generated', artifact.name);
    await this.writeFiles(outDir, artifact);
  }

  private async writeFiles(
    outDir: string,
    artifact: GeneratedArtifact
  ): Promise<void> {
    for (const file of artifact.files) {
      const filePath = path.join(outDir, file.relativePath);
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }

    vscode.window.showInformationMessage(
      `${artifact.kind} "${artifact.name}" generated with ${artifact.files.length} file(s). ${artifact.summary}`
    );

    // Open the first file
    if (artifact.files.length > 0) {
      const firstFile = path.join(outDir, artifact.files[0].relativePath);
      const doc = await vscode.workspace.openTextDocument(firstFile);
      await vscode.window.showTextDocument(doc);
    }
  }

  /** Generate Dataverse schema from text and optionally apply it */
  private async generateAndApplySchema(text: string): Promise<void> {
    const schema: DataverseSchemaResult = await this.ai.generateDataverseSchema({
      kind: 'instructions',
      payload: text,
      targetArtifact: 'dataverse-table',
    });

    // Show summary
    const tableNames = schema.tables.map((t) => t.displayName).join(', ');
    const relCount = schema.relationships.length;
    const apply = await vscode.window.showInformationMessage(
      `Generated ${schema.tables.length} table(s): ${tableNames} with ${relCount} relationship(s). Apply to Dataverse?`,
      'Apply Now',
      'Save JSON Only'
    );

    if (apply === 'Apply Now') {
      for (const table of schema.tables) {
        try {
          await this.dataverse.createTable(
            table.displayName,
            table.schemaName,
            '',
            'name'
          );
          for (const col of table.columns) {
            await this.dataverse.addColumn(table.logicalName, col);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to create table "${table.displayName}": ${message}`);
        }
      }
      for (const rel of schema.relationships) {
        try {
          await this.dataverse.createRelationship(rel);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showWarningMessage(`Failed to create relationship "${rel.name}": ${message}`);
        }
      }
      vscode.window.showInformationMessage('Dataverse schema applied successfully.');
    } else if (apply === 'Save JSON Only') {
      const artifact: GeneratedArtifact = {
        kind: 'dataverse-table',
        name: 'DataverseSchema',
        files: [
          {
            relativePath: 'schema.json',
            content: JSON.stringify(schema, null, 2),
          },
        ],
        summary: `${schema.tables.length} tables, ${relCount} relationships`,
      };
      await this.saveArtifact(artifact);
    }
  }
}
