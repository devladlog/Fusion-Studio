// -------------------------------------------------------
// Power Platform Studio - Shared Types
// -------------------------------------------------------

/** Power Platform environment reference */
export interface PpEnvironment {
  id: string;
  displayName: string;
  url: string;
  type: string; // Sandbox | Production | Developer | Trial
  region: string;
}

/** Solution metadata */
export interface PpSolution {
  solutionId: string;
  uniqueName: string;
  displayName: string;
  version: string;
  isManaged: boolean;
  publisherId: string;
}

/** Canvas or Model-driven app metadata */
export interface PpApp {
  id: string;
  displayName: string;
  type: 'canvas' | 'model-driven';
  description?: string;
  modifiedOn?: string;
  solutionId?: string;
}

/** Power Automate flow metadata */
export interface PpFlow {
  id: string;
  displayName: string;
  state: 'Started' | 'Stopped' | 'Suspended';
  triggerType?: string;
  modifiedOn?: string;
}

/** Dataverse table (entity) metadata */
export interface PpTable {
  logicalName: string;
  displayName: string;
  schemaName: string;
  isCustom: boolean;
  columns: PpColumn[];
}

/** Dataverse column (attribute) metadata */
export interface PpColumn {
  logicalName: string;
  displayName: string;
  type: DataverseColumnType;
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  maxLength?: number;
  options?: { label: string; value: number }[];
}

export type DataverseColumnType =
  | 'String'
  | 'Memo'
  | 'Integer'
  | 'Decimal'
  | 'Money'
  | 'Boolean'
  | 'DateTime'
  | 'Lookup'
  | 'PickList'
  | 'UniqueIdentifier'
  | 'Image';

// -------------------------------------------------------
// AI / Generation types
// -------------------------------------------------------

export interface GenerationRequest {
  kind: 'document' | 'mockup' | 'instructions';
  payload: string; // text content, base64 image, or instruction text
  targetArtifact: 'canvas-app' | 'model-driven-app' | 'flow' | 'dataverse-table';
  options?: Record<string, unknown>;
}

export interface GeneratedArtifact {
  kind: GenerationRequest['targetArtifact'];
  name: string;
  files: GeneratedFile[];
  summary: string;
}

export interface GeneratedFile {
  relativePath: string;
  content: string;
}

/** Canvas app control tree node (simplified Power Apps YAML) */
export interface CanvasControl {
  controlName: string;
  controlType: string;
  properties: Record<string, string>;
  children?: CanvasControl[];
}

/** Flow definition (simplified) */
export interface FlowDefinition {
  name: string;
  trigger: FlowStep;
  actions: FlowStep[];
}

export interface FlowStep {
  type: string;
  name: string;
  inputs: Record<string, unknown>;
  runAfter?: string[];
}

/** Dataverse schema generation result */
export interface DataverseSchemaResult {
  tables: PpTable[];
  relationships: DataverseRelationship[];
}

export interface DataverseRelationship {
  name: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'OneToMany' | 'ManyToOne' | 'ManyToMany';
}
