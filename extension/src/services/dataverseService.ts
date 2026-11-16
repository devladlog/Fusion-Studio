// -------------------------------------------------------
// Dataverse REST API Service
// -------------------------------------------------------
import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import {
  PpTable,
  PpColumn,
  DataverseColumnType,
  DataverseRelationship,
} from '../types';
import { logger } from './logger';
import { validateUrl, validateSchemaName } from './validation';
import { withRetry } from './retry';

const DATAVERSE_API_VERSION = 'v9.2';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class DataverseService {
  private client: AxiosInstance | undefined;
  private tokenExpiresAt = 0;

  private getBaseUrl(): string {
    return (
      vscode.workspace
        .getConfiguration('powerapps')
        .get<string>('dataverseUrl') ?? ''
    );
  }

  private async ensureClient(): Promise<AxiosInstance> {
    const now = Date.now();
    if (this.client && now < this.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return this.client;
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'Dataverse URL not configured. Set powerapps.dataverseUrl.'
      );
    }
    validateUrl(baseUrl, 'Dataverse URL');

    logger.info('Refreshing Dataverse access token...');
    const tokenRaw = await vscode.commands.executeCommand<string>(
      'powerapps.internal.getAccessToken'
    );
    const token = tokenRaw ?? '';
    if (!token) {
      throw new Error('Failed to obtain Dataverse access token. Please authenticate first.');
    }

    // Assume token valid for 1 hour (typical Azure AD)
    this.tokenExpiresAt = now + 60 * 60 * 1000;

    this.client = axios.create({
      baseURL: `${baseUrl.replace(/\/+$/, '')}/api/data/${DATAVERSE_API_VERSION}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Intercept 401 to force re-auth on next call
    this.client.interceptors.response.use(undefined, (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logger.warn('Received 401 from Dataverse, invalidating token.');
        this.resetClient();
      }
      return Promise.reject(err);
    });

    return this.client;
  }

  /** Invalidate cached client (e.g. after re-auth) */
  resetClient(): void {
    this.client = undefined;
    this.tokenExpiresAt = 0;
  }

  // ------- Tables (Entities) -------

  async listTables(customOnly: boolean = true): Promise<PpTable[]> {
    const http = await this.ensureClient();
    const filter = customOnly
      ? "$filter=IsCustomEntity eq true"
      : '';
    const res = await withRetry(
      () => http.get(
        `/EntityDefinitions?$select=LogicalName,DisplayName,SchemaName,IsCustomEntity&${filter}`
      ),
      'Dataverse listTables'
    );
    const entities: Record<string, unknown>[] = res.data?.value ?? [];
    return entities.map((e) => ({
      logicalName: String(e['LogicalName'] ?? ''),
      displayName:
        String((e['DisplayName'] as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
          ?? e['SchemaName']
          ?? e['LogicalName']
          ?? ''),
      schemaName: String(e['SchemaName'] ?? ''),
      isCustom: Boolean(e['IsCustomEntity']),
      columns: [],
    }));
  }

  async getTableColumns(logicalName: string): Promise<PpColumn[]> {
    const http = await this.ensureClient();
    const res = await withRetry(
      () => http.get(
        `/EntityDefinitions(LogicalName='${encodeURIComponent(logicalName)}')/Attributes?$select=LogicalName,DisplayName,AttributeType,IsPrimaryId,RequiredLevel,MaxLength`
      ),
      'Dataverse getTableColumns'
    );
    const attrs: Record<string, unknown>[] = res.data?.value ?? [];
    return attrs.map((a) => ({
      logicalName: String(a['LogicalName'] ?? ''),
      displayName:
        String((a['DisplayName'] as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
          ?? a['LogicalName']
          ?? ''),
      type: this.mapColumnType(String(a['AttributeType'] ?? 'String')),
      isPrimaryKey: Boolean(a['IsPrimaryId']),
      isRequired: (a['RequiredLevel'] as { Value?: string } | undefined)?.Value === 'ApplicationRequired',
      maxLength: typeof a['MaxLength'] === 'number' ? a['MaxLength'] : undefined,
    }));
  }

  async createTable(
    displayName: string,
    schemaName: string,
    description: string,
    primaryColumnName: string
  ): Promise<void> {
    validateSchemaName(schemaName, 'table schema name');
    const http = await this.ensureClient();
    await http.post('/EntityDefinitions', {
      SchemaName: schemaName,
      DisplayName: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: displayName, LanguageCode: 1033 }],
      },
      Description: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: description, LanguageCode: 1033 }],
      },
      HasActivities: false,
      HasNotes: false,
      PrimaryNameAttribute: primaryColumnName.toLowerCase(),
    });
  }

  async addColumn(
    tableLogicalName: string,
    column: PpColumn
  ): Promise<void> {
    const http = await this.ensureClient();
    const body: Record<string, unknown> = {
      '@odata.type': `Microsoft.Dynamics.CRM.${this.odataColumnType(column.type)}AttributeMetadata`,
      SchemaName: column.logicalName,
      DisplayName: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: column.displayName, LanguageCode: 1033 }],
      },
      RequiredLevel: {
        Value: column.isRequired ? 'ApplicationRequired' : 'None',
      },
    };

    if (column.type === 'String' || column.type === 'Memo') {
      body['MaxLength'] = column.maxLength ?? 256;
    }

    await http.post(
      `/EntityDefinitions(LogicalName='${encodeURIComponent(tableLogicalName)}')/Attributes`,
      body
    );
  }

  async createRelationship(rel: DataverseRelationship): Promise<void> {
    validateSchemaName(rel.name, 'relationship name');
    if (rel.fromTable === rel.toTable && rel.fromColumn === rel.toColumn) {
      throw new Error(`Self-referencing relationship "${rel.name}" on same column is not allowed.`);
    }
    const http = await this.ensureClient();
    await http.post('/RelationshipDefinitions', {
      '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
      SchemaName: rel.name,
      ReferencedEntity: rel.toTable,
      ReferencedAttribute: rel.toColumn,
      ReferencingEntity: rel.fromTable,
      ReferencingAttribute: rel.fromColumn,
    });
  }

  // ------- Helpers -------

  private mapColumnType(apiType: string): DataverseColumnType {
    const map: Record<string, DataverseColumnType> = {
      String: 'String',
      Memo: 'Memo',
      Integer: 'Integer',
      Decimal: 'Decimal',
      Money: 'Money',
      Boolean: 'Boolean',
      DateTime: 'DateTime',
      Lookup: 'Lookup',
      Picklist: 'PickList',
      Uniqueidentifier: 'UniqueIdentifier',
      Image: 'Image',
    };
    return map[apiType] ?? 'String';
  }

  private odataColumnType(type: DataverseColumnType): string {
    const map: Record<DataverseColumnType, string> = {
      String: 'String',
      Memo: 'Memo',
      Integer: 'Integer',
      Decimal: 'Decimal',
      Money: 'Money',
      Boolean: 'Boolean',
      DateTime: 'DateTime',
      Lookup: 'Lookup',
      PickList: 'Picklist',
      UniqueIdentifier: 'Uniqueidentifier',
      Image: 'Image',
    };
    return map[type] ?? 'String';
  }
}
