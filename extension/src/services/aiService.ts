// -------------------------------------------------------
// AI / LLM Generation Service
// Uses Azure OpenAI to convert inputs into Power Platform artifacts.
// -------------------------------------------------------
import axios from 'axios';
import * as vscode from 'vscode';
import { z } from 'zod';
import {
  GenerationRequest,
  GeneratedArtifact,
  GeneratedFile,
  CanvasControl,
  FlowDefinition,
  DataverseSchemaResult,
} from '../types';
import { logger } from './logger';
import { withRetry } from './retry';
import { validateBase64Size } from './validation';

// ------- Configuration constants -------
const AI_TEMPERATURE = 0.2;
const AI_MAX_TOKENS = 4096;
const AI_API_VERSION = '2024-12-01-preview';

interface AiConfig {
  endpoint: string;
  deploymentName: string;
  apiKey: string;
}

// ------- Zod schemas for AI response validation -------

const CanvasControlSchema: z.ZodType<CanvasControl> = z.lazy(() =>
  z.object({
    controlName: z.string(),
    controlType: z.string(),
    properties: z.record(z.string(), z.string()).default({}),
    children: z.array(CanvasControlSchema).optional(),
  })
);

const CanvasAppResponseSchema = z.object({
  appName: z.string().default('GeneratedApp'),
  screens: z
    .array(
      z.object({
        screenName: z.string(),
        controls: z.array(CanvasControlSchema).default([]),
      })
    )
    .default([]),
  summary: z.string().default('Canvas app generated successfully.'),
});

const FlowStepSchema = z.object({
  type: z.string(),
  name: z.string(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  runAfter: z.array(z.string()).optional(),
});

const FlowResponseSchema = z.object({
  flowName: z.string().default('GeneratedFlow'),
  trigger: FlowStepSchema.default({ type: 'Manual', name: 'manual', inputs: {} }),
  actions: z.array(FlowStepSchema).default([]),
  summary: z.string().default('Flow generated successfully.'),
});

const DataverseSchemaResponseSchema = z.object({
  tables: z
    .array(
      z.object({
        logicalName: z.string(),
        displayName: z.string(),
        schemaName: z.string(),
        isCustom: z.boolean().default(true),
        columns: z
          .array(
            z.object({
              logicalName: z.string(),
              displayName: z.string(),
              type: z.string(),
              isRequired: z.boolean().optional(),
              maxLength: z.number().optional(),
            })
          )
          .default([]),
      })
    )
    .default([]),
  relationships: z
    .array(
      z.object({
        name: z.string(),
        fromTable: z.string(),
        fromColumn: z.string(),
        toTable: z.string(),
        toColumn: z.string(),
        type: z.enum(['OneToMany', 'ManyToOne', 'ManyToMany']),
      })
    )
    .default([]),
});

// ------- Helper: detect transient errors -------
function isTransientError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  return false;
}

export class AiService {
  private secretStorage: vscode.SecretStorage | undefined;

  /** Call once during activation to enable SecretStorage for API key */
  setSecretStorage(storage: vscode.SecretStorage): void {
    this.secretStorage = storage;
  }

  private async getConfig(): Promise<AiConfig> {
    const cfg = vscode.workspace.getConfiguration('powerapps.azureOpenAi');
    let apiKey = '';

    // Prefer SecretStorage, fall back to settings
    if (this.secretStorage) {
      apiKey = (await this.secretStorage.get('azureOpenAi.apiKey')) ?? '';
    }
    if (!apiKey) {
      apiKey = cfg.get<string>('apiKey') ?? '';
    }

    return {
      endpoint: cfg.get<string>('endpoint') ?? '',
      deploymentName: cfg.get<string>('deploymentName') ?? '',
      apiKey,
    };
  }

  /** Store API key into SecretStorage (called from command) */
  async storeApiKey(key: string): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('SecretStorage not available.');
    }
    await this.secretStorage.store('azureOpenAi.apiKey', key);
    logger.info('Azure OpenAI API key stored in SecretStorage.');
  }

  /** Send a chat-completion request to Azure OpenAI */
  private async chat(
    systemPrompt: string,
    userContent: string | { type: string; [k: string]: unknown }[]
  ): Promise<string> {
    const { endpoint, deploymentName, apiKey } = await this.getConfig();
    if (!endpoint || !deploymentName || !apiKey) {
      throw new Error(
        'Azure OpenAI is not configured. Fill in powerapps.azureOpenAi.* settings.'
      );
    }
    const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${AI_API_VERSION}`;

    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    logger.debug(`AI chat request to deployment "${deploymentName}"`);

    const res = await withRetry(
      () =>
        axios.post(
          url,
          { messages, temperature: AI_TEMPERATURE, max_tokens: AI_MAX_TOKENS },
          { headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 120_000 }
        ),
      'Azure OpenAI chat',
      { retryableError: isTransientError }
    );

    return res.data.choices?.[0]?.message?.content ?? '';
  }

  // ------- High-level generation methods -------

  /** Generate a Canvas App control tree from instructions or document text */
  async generateCanvasApp(request: GenerationRequest): Promise<GeneratedArtifact> {
    const systemPrompt = `You are a Power Apps Canvas App architect.
Given user requirements, output a JSON object with:
- "appName": string
- "screens": array of screen objects, each containing:
  - "screenName": string
  - "controls": array of CanvasControl objects with controlName, controlType, properties, children
- "summary": short human-readable summary of what was generated
Output ONLY valid JSON, nothing else.`;

    const userMessage = this.buildUserMessage(request);
    const raw = await this.chat(systemPrompt, userMessage);
    const parsed = CanvasAppResponseSchema.parse(this.parseJson(raw));

    const files: GeneratedFile[] = [];
    for (const screen of parsed.screens) {
      files.push({
        relativePath: `Src/${screen.screenName}.fx.yaml`,
        content: this.controlTreeToYaml(screen.controls, 0),
      });
    }

    return {
      kind: 'canvas-app',
      name: parsed.appName,
      files,
      summary: parsed.summary,
    };
  }

  /** Generate a Flow definition from instructions */
  async generateFlow(request: GenerationRequest): Promise<GeneratedArtifact> {
    const systemPrompt = `You are a Power Automate architect.
Given user requirements, output a JSON object with:
- "flowName": string
- "trigger": { "type": string, "name": string, "inputs": object }
- "actions": array of { "type": string, "name": string, "inputs": object, "runAfter": string[] }
- "summary": short summary
Output ONLY valid JSON.`;

    const userMessage = this.buildUserMessage(request);
    const raw = await this.chat(systemPrompt, userMessage);
    const parsed = FlowResponseSchema.parse(this.parseJson(raw));

    const flowDef: FlowDefinition = {
      name: parsed.flowName,
      trigger: parsed.trigger,
      actions: parsed.actions,
    };

    const files: GeneratedFile[] = [
      {
        relativePath: `${flowDef.name}/definition.json`,
        content: JSON.stringify(flowDef, null, 2),
      },
    ];

    return {
      kind: 'flow',
      name: flowDef.name,
      files,
      summary: parsed.summary,
    };
  }

  /** Generate a Dataverse schema from instructions or document text */
  async generateDataverseSchema(
    request: GenerationRequest
  ): Promise<DataverseSchemaResult> {
    const systemPrompt = `You are a Dataverse schema architect.
Given user requirements, output a JSON object with:
- "tables": array of { "logicalName", "displayName", "schemaName", "isCustom": true, "columns": [ { "logicalName", "displayName", "type" (String|Integer|Decimal|Boolean|DateTime|Lookup|PickList|Money|Memo), "isRequired", "maxLength" } ] }
- "relationships": array of { "name", "fromTable", "fromColumn", "toTable", "toColumn", "type" (OneToMany|ManyToOne|ManyToMany) }
Output ONLY valid JSON.`;

    const userMessage = this.buildUserMessage(request);
    const raw = await this.chat(systemPrompt, userMessage);
    const parsed = DataverseSchemaResponseSchema.parse(this.parseJson(raw));

    return {
      tables: parsed.tables as DataverseSchemaResult['tables'],
      relationships: parsed.relationships,
    };
  }

  /** Analyze a canvas app YAML source and return suggestions */
  async analyzeCanvasApp(yamlContent: string): Promise<string> {
    const systemPrompt = `You are a Power Apps performance and quality analyst.
Given a Canvas App YAML source, provide a bullet-list of improvement suggestions covering:
- Performance (delegation, collection sizes)
- UX (accessibility, responsive layout)
- Maintainability (naming conventions, component reuse)
Be specific and actionable.`;
    return this.chat(systemPrompt, yamlContent);
  }

  /** General Power Platform chat assistant */
  async chatAssistant(userMessage: string): Promise<string> {
    const systemPrompt = `You are a Power Platform expert assistant inside VS Code.
Help the user with PowerFX formulas, Power Automate expressions, Dataverse schema design, and general Power Platform guidance.
Be concise and use code blocks where appropriate.`;
    return this.chat(systemPrompt, userMessage);
  }

  // ------- Mockup interpretation (vision) -------

  async interpretMockup(base64Image: string): Promise<GeneratedArtifact> {
    validateBase64Size(base64Image);
    const systemPrompt = `You are a UI layout detection specialist for Power Apps.
Given an image of a UI mockup, identify all visible controls and their layout.
Output a JSON object with:
- "appName": string
- "screens": array of screen objects with "screenName" and "controls" (array of { controlName, controlType, properties, children })
- "summary": description of what was detected
Output ONLY valid JSON.`;

    const userContent = [
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${base64Image}` },
      },
      { type: 'text', text: 'Analyze this mockup and convert it to Power Apps controls.' },
    ];

    const raw = await this.chat(systemPrompt, userContent);
    const parsed = CanvasAppResponseSchema.parse(this.parseJson(raw));

    const files: GeneratedFile[] = [];
    for (const screen of parsed.screens) {
      files.push({
        relativePath: `Src/${screen.screenName}.fx.yaml`,
        content: this.controlTreeToYaml(screen.controls, 0),
      });
    }

    return {
      kind: 'canvas-app',
      name: parsed.appName,
      files,
      summary: parsed.summary,
    };
  }

  // ------- Internal helpers -------

  private buildUserMessage(
    request: GenerationRequest
  ): string | { type: string; [k: string]: unknown }[] {
    if (request.kind === 'mockup') {
      return [
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${request.payload}` },
        },
        { type: 'text', text: 'Convert this UI mockup to Power Apps controls.' },
      ];
    }
    return request.payload;
  }

  private parseJson(raw: string): unknown {
    // Strip markdown fencing if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`AI returned invalid JSON:\n${raw.substring(0, 500)}`);
    }
  }

  private controlTreeToYaml(controls: CanvasControl[], indent: number): string {
    const pad = '  '.repeat(indent);
    let out = '';
    for (const ctrl of controls) {
      out += `${pad}- ${ctrl.controlName} As ${ctrl.controlType}:\n`;
      for (const [key, val] of Object.entries(ctrl.properties ?? {})) {
        out += `${pad}    ${key}: ${val}\n`;
      }
      if (ctrl.children?.length) {
        out += `${pad}    Children:\n`;
        out += this.controlTreeToYaml(ctrl.children, indent + 3);
      }
    }
    return out;
  }
}
