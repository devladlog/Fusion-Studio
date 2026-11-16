/**
 * TreeView Providers for Power Apps Explorer
 * Displays environments, apps, and controls in the VS Code sidebar
 */

import * as vscode from 'vscode';
import { PacService, Organization } from '../pac/pacService';
import { DependencyGraph, GraphNode, NodeType } from '../powerfx/dependencyGraph';
import { StateManager } from '../state/stateManager';

/**
 * Base tree item class
 */
export class PowerAppsTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: TreeItemType,
        public readonly data?: unknown
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;
        this.setIcon();
    }
    
    private setIcon(): void {
        switch (this.itemType) {
            case 'environment':
                this.iconPath = new vscode.ThemeIcon('globe');
                break;
            case 'app':
                this.iconPath = new vscode.ThemeIcon('window');
                break;
            case 'screen':
                this.iconPath = new vscode.ThemeIcon('layout');
                break;
            case 'control':
                this.iconPath = new vscode.ThemeIcon('symbol-field');
                break;
            case 'datasource':
                this.iconPath = new vscode.ThemeIcon('database');
                break;
            case 'collection':
                this.iconPath = new vscode.ThemeIcon('folder-library');
                break;
            case 'variable':
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
                break;
            case 'component':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'formula':
                this.iconPath = new vscode.ThemeIcon('symbol-function');
                break;
            case 'property':
                this.iconPath = new vscode.ThemeIcon('symbol-property');
                break;
        }
    }
}

export type TreeItemType = 
    | 'environment' 
    | 'app' 
    | 'screen' 
    | 'control' 
    | 'datasource' 
    | 'collection' 
    | 'variable' 
    | 'component'
    | 'formula'
    | 'property';

/**
 * Environment TreeView Provider
 * Shows available Power Platform environments
 */
export class EnvironmentTreeProvider implements vscode.TreeDataProvider<PowerAppsTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PowerAppsTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private environments: Organization[] = [];
    private currentEnvironment?: string;
    
    constructor(
        private pacService: PacService,
        private stateManager: StateManager
    ) {
        // Listen for environment changes
        stateManager.onEnvironmentChanged(() => {
            this.currentEnvironment = stateManager.getCurrentEnvironment();
            this.refresh();
        });
    }
    
    async refresh(): Promise<void> {
        this.environments = await this.pacService.listOrganizations();
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeItem(element: PowerAppsTreeItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: PowerAppsTreeItem): Promise<PowerAppsTreeItem[]> {
        if (!element) {
            // Root level - show environments
            if (this.environments.length === 0) {
                await this.refresh();
            }
            
            return this.environments.map(env => {
                const item = new PowerAppsTreeItem(
                    env.friendlyName,
                    vscode.TreeItemCollapsibleState.None,
                    'environment',
                    env
                );
                
                item.description = env.type;
                item.tooltip = `${env.url}\nType: ${env.type}\nID: ${env.environmentId}`;
                
                if (env.environmentId === this.currentEnvironment || env.active) {
                    item.description = `${env.type} (active)`;
                    item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                }
                
                item.command = {
                    command: 'powerapps.selectEnvironmentFromTree',
                    title: 'Select Environment',
                    arguments: [env]
                };
                
                return item;
            });
        }
        
        return [];
    }
}

/**
 * Canvas Apps TreeView Provider
 * Shows controls and screens from unpacked app source
 */
export class AppsTreeProvider implements vscode.TreeDataProvider<PowerAppsTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PowerAppsTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private graph?: DependencyGraph;
    
    constructor(private stateManager: StateManager) {}
    
    setDependencyGraph(graph: DependencyGraph): void {
        this.graph = graph;
        graph.onGraphChanged(() => this.refresh());
        this.refresh();
    }
    
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeItem(element: PowerAppsTreeItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: PowerAppsTreeItem): PowerAppsTreeItem[] {
        if (!this.graph) {
            return [new PowerAppsTreeItem(
                'No app loaded',
                vscode.TreeItemCollapsibleState.None,
                'app'
            )];
        }
        
        const nodes = this.graph.getAllNodes();
        
        if (!element) {
            // Root level - show screens
            const screens = nodes.filter(n => n.type === NodeType.Screen);
            
            if (screens.length === 0) {
                return [new PowerAppsTreeItem(
                    'Load an app to see structure',
                    vscode.TreeItemCollapsibleState.None,
                    'app'
                )];
            }
            
            return screens.map(screen => {
                const item = new PowerAppsTreeItem(
                    screen.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'screen',
                    screen
                );
                
                const controlCount = nodes.filter(n => n.screen === screen.name).length;
                item.description = `${controlCount} controls`;
                
                return item;
            });
        }
        
        // Child items
        const parentNode = element.data as GraphNode;
        
        if (element.itemType === 'screen') {
            // Show controls in this screen
            const controls = nodes.filter(n => 
                n.screen === parentNode.name && 
                n.type === NodeType.Control
            );
            
            return controls.map(control => {
                const item = new PowerAppsTreeItem(
                    control.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'control',
                    control
                );
                
                item.description = control.metadata.controlType;
                
                return item;
            });
        }
        
        if (element.itemType === 'control') {
            // Show properties with formulas
            const properties: PowerAppsTreeItem[] = [];
            
            for (const [propName, propInfo] of parentNode.properties) {
                if (propInfo.formula && propInfo.formula.trim().length > 0) {
                    const item = new PowerAppsTreeItem(
                        propName,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        propInfo
                    );
                    
                    // Truncate long formulas
                    const formula = propInfo.formula.length > 50 
                        ? propInfo.formula.substring(0, 47) + '...'
                        : propInfo.formula;
                    item.description = formula;
                    item.tooltip = propInfo.formula;
                    
                    properties.push(item);
                }
            }
            
            return properties;
        }
        
        return [];
    }
}

/**
 * Observability TreeView Provider
 * Shows current Studio state and debugging info
 */
export class ObservabilityTreeProvider implements vscode.TreeDataProvider<PowerAppsTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PowerAppsTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    constructor(private stateManager: StateManager) {
        // Refresh when studio state changes
        stateManager.onStudioStateChanged(() => this.refresh());
    }
    
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeItem(element: PowerAppsTreeItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: PowerAppsTreeItem): PowerAppsTreeItem[] {
        if (element) {
            return [];
        }
        
        const items: PowerAppsTreeItem[] = [];
        const state = this.stateManager.getStudioState();
        
        // Studio connection status
        const connected = this.stateManager.isStudioReady();
        const statusItem = new PowerAppsTreeItem(
            connected ? 'Studio Connected' : 'Studio Disconnected',
            vscode.TreeItemCollapsibleState.None,
            'app'
        );
        statusItem.iconPath = new vscode.ThemeIcon(
            connected ? 'check' : 'close',
            new vscode.ThemeColor(connected ? 'charts.green' : 'charts.red')
        );
        items.push(statusItem);
        
        if (state) {
            // Active screen
            if (state.activeScreen) {
                const screenItem = new PowerAppsTreeItem(
                    `Screen: ${state.activeScreen}`,
                    vscode.TreeItemCollapsibleState.None,
                    'screen'
                );
                items.push(screenItem);
            }
            
            // Selected control
            if (state.selectedControl) {
                const controlItem = new PowerAppsTreeItem(
                    `Selected: ${state.selectedControl}`,
                    vscode.TreeItemCollapsibleState.None,
                    'control'
                );
                items.push(controlItem);
            }
            
            // Last formula
            if (state.lastFormula) {
                const formulaItem = new PowerAppsTreeItem(
                    'Last Formula',
                    vscode.TreeItemCollapsibleState.None,
                    'formula'
                );
                formulaItem.description = state.lastFormula.substring(0, 50);
                formulaItem.tooltip = state.lastFormula;
                items.push(formulaItem);
            }
            
            // Timestamp
            const timeItem = new PowerAppsTreeItem(
                `Updated: ${new Date(state.timestamp).toLocaleTimeString()}`,
                vscode.TreeItemCollapsibleState.None,
                'property'
            );
            timeItem.iconPath = new vscode.ThemeIcon('clock');
            items.push(timeItem);
        }
        
        // Current environment
        const env = this.stateManager.getCurrentEnvironment();
        if (env) {
            const envItem = new PowerAppsTreeItem(
                `Environment: ${env}`,
                vscode.TreeItemCollapsibleState.None,
                'environment'
            );
            items.push(envItem);
        }
        
        return items;
    }
}

/**
 * Dependency Graph TreeView Provider
 * Shows data sources, collections, and variables
 */
export class DependencyTreeProvider implements vscode.TreeDataProvider<PowerAppsTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PowerAppsTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private graph?: DependencyGraph;
    
    setDependencyGraph(graph: DependencyGraph): void {
        this.graph = graph;
        graph.onGraphChanged(() => this.refresh());
        this.refresh();
    }
    
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
    
    getTreeItem(element: PowerAppsTreeItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(element?: PowerAppsTreeItem): PowerAppsTreeItem[] {
        if (!this.graph) {
            return [];
        }
        
        const nodes = this.graph.getAllNodes();
        
        if (!element) {
            // Root level - show categories
            const categories: PowerAppsTreeItem[] = [];
            
            const dataSources = nodes.filter(n => n.type === NodeType.DataSource);
            if (dataSources.length > 0) {
                const item = new PowerAppsTreeItem(
                    'Data Sources',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'datasource',
                    { nodes: dataSources, nodeType: NodeType.DataSource }
                );
                item.description = `${dataSources.length}`;
                categories.push(item);
            }
            
            const collections = nodes.filter(n => n.type === NodeType.Collection);
            if (collections.length > 0) {
                const item = new PowerAppsTreeItem(
                    'Collections',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'collection',
                    { nodes: collections, nodeType: NodeType.Collection }
                );
                item.description = `${collections.length}`;
                categories.push(item);
            }
            
            const variables = nodes.filter(n => n.type === NodeType.Variable);
            if (variables.length > 0) {
                const item = new PowerAppsTreeItem(
                    'Variables',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'variable',
                    { nodes: variables, nodeType: NodeType.Variable }
                );
                item.description = `${variables.length}`;
                categories.push(item);
            }
            
            const components = nodes.filter(n => n.type === NodeType.Component);
            if (components.length > 0) {
                const item = new PowerAppsTreeItem(
                    'Components',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'component',
                    { nodes: components, nodeType: NodeType.Component }
                );
                item.description = `${components.length}`;
                categories.push(item);
            }
            
            return categories;
        }
        
        // Show items in category
        const data = element.data as { nodes: GraphNode[] };
        return data.nodes.map(node => {
            const edges = this.graph!.getIncomingEdges(node.id);
            const item = new PowerAppsTreeItem(
                node.name,
                vscode.TreeItemCollapsibleState.None,
                element.itemType,
                node
            );
            item.description = `${edges.length} references`;
            item.tooltip = `Used by: ${edges.map(e => e.from).join(', ')}`;
            
            return item;
        });
    }
}
