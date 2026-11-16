/**
 * Dependency Graph for Canvas Apps
 * Builds and manages a graph of dependencies between controls, screens, and data sources
 */

import { Dependency, DependencyType, analyzeFormula, FormulaAnalysis } from './analyzer';
import * as vscode from 'vscode';

/**
 * A node in the dependency graph
 */
export interface GraphNode {
    id: string;
    name: string;
    type: NodeType;
    screen?: string;  // Owning screen for controls
    properties: Map<string, PropertyInfo>;
    metadata: NodeMetadata;
}

export interface PropertyInfo {
    name: string;
    formula: string;
    analysis?: FormulaAnalysis;
}

export interface NodeMetadata {
    filePath?: string;
    line?: number;
    controlType?: string;
    isComponent?: boolean;
}

export enum NodeType {
    Screen = 'SCREEN',
    Control = 'CONTROL',
    Component = 'COMPONENT',
    DataSource = 'DATASOURCE',
    Collection = 'COLLECTION',
    Variable = 'VARIABLE'
}

/**
 * An edge in the dependency graph
 */
export interface GraphEdge {
    from: string;  // Source node ID
    to: string;    // Target node ID
    property: string;  // Property that creates the dependency
    type: EdgeType;
}

export enum EdgeType {
    Read = 'READ',
    Write = 'WRITE',
    Navigate = 'NAVIGATE',
    DataRead = 'DATA_READ',
    DataWrite = 'DATA_WRITE'
}

/**
 * Graph statistics
 */
export interface GraphStats {
    totalNodes: number;
    totalEdges: number;
    screens: number;
    controls: number;
    dataSources: number;
    collections: number;
    variables: number;
    mostConnectedNodes: Array<{ id: string; connections: number }>;
    circularDependencies: string[][];
}

/**
 * Export formats
 */
export type ExportFormat = 'json' | 'dot' | 'mermaid' | 'd2';

/**
 * Dependency Graph Manager
 */
export class DependencyGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: GraphEdge[] = [];
    private _onGraphChanged = new vscode.EventEmitter<void>();
    
    public readonly onGraphChanged = this._onGraphChanged.event;
    
    /**
     * Clear the graph
     */
    clear(): void {
        this.nodes.clear();
        this.edges = [];
        this._onGraphChanged.fire();
    }
    
    /**
     * Add a node to the graph
     */
    addNode(node: GraphNode): void {
        this.nodes.set(node.id, node);
    }
    
    /**
     * Add an edge to the graph
     */
    addEdge(edge: GraphEdge): void {
        // Avoid duplicate edges
        const exists = this.edges.some(e => 
            e.from === edge.from && 
            e.to === edge.to && 
            e.property === edge.property
        );
        
        if (!exists) {
            this.edges.push(edge);
        }
    }
    
    /**
     * Get a node by ID
     */
    getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }
    
    /**
     * Get all nodes
     */
    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }
    
    /**
     * Get all edges
     */
    getAllEdges(): GraphEdge[] {
        return [...this.edges];
    }
    
    /**
     * Get edges from a specific node
     */
    getOutgoingEdges(nodeId: string): GraphEdge[] {
        return this.edges.filter(e => e.from === nodeId);
    }
    
    /**
     * Get edges to a specific node
     */
    getIncomingEdges(nodeId: string): GraphEdge[] {
        return this.edges.filter(e => e.to === nodeId);
    }
    
    /**
     * Get all dependencies for a node (what it depends on)
     */
    getDependencies(nodeId: string): GraphNode[] {
        const targetIds = this.getOutgoingEdges(nodeId).map(e => e.to);
        return targetIds
            .map(id => this.nodes.get(id))
            .filter((n): n is GraphNode => n !== undefined);
    }
    
    /**
     * Get all dependents of a node (what depends on it)
     */
    getDependents(nodeId: string): GraphNode[] {
        const sourceIds = this.getIncomingEdges(nodeId).map(e => e.from);
        return sourceIds
            .map(id => this.nodes.get(id))
            .filter((n): n is GraphNode => n !== undefined);
    }
    
    /**
     * Find circular dependencies
     */
    findCircularDependencies(): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const path: string[] = [];
        
        const dfs = (nodeId: string): void => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);
            
            for (const edge of this.getOutgoingEdges(nodeId)) {
                if (!visited.has(edge.to)) {
                    dfs(edge.to);
                } else if (recursionStack.has(edge.to)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(edge.to);
                    cycles.push([...path.slice(cycleStart), edge.to]);
                }
            }
            
            path.pop();
            recursionStack.delete(nodeId);
        };
        
        for (const nodeId of this.nodes.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }
        
        return cycles;
    }
    
    /**
     * Calculate graph statistics
     */
    getStats(): GraphStats {
        const stats: GraphStats = {
            totalNodes: this.nodes.size,
            totalEdges: this.edges.length,
            screens: 0,
            controls: 0,
            dataSources: 0,
            collections: 0,
            variables: 0,
            mostConnectedNodes: [],
            circularDependencies: []
        };
        
        // Count by type
        for (const node of this.nodes.values()) {
            switch (node.type) {
                case NodeType.Screen: stats.screens++; break;
                case NodeType.Control: stats.controls++; break;
                case NodeType.Component: stats.controls++; break;
                case NodeType.DataSource: stats.dataSources++; break;
                case NodeType.Collection: stats.collections++; break;
                case NodeType.Variable: stats.variables++; break;
            }
        }
        
        // Find most connected nodes
        const connections = new Map<string, number>();
        for (const edge of this.edges) {
            connections.set(edge.from, (connections.get(edge.from) ?? 0) + 1);
            connections.set(edge.to, (connections.get(edge.to) ?? 0) + 1);
        }
        
        stats.mostConnectedNodes = Array.from(connections.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id, count]) => ({ id, connections: count }));
        
        // Find circular dependencies
        stats.circularDependencies = this.findCircularDependencies();
        
        return stats;
    }
    
    /**
     * Build graph from unpacked canvas app source
     */
    async buildFromSource(sourcePath: string): Promise<void> {
        // This would parse the msapp source files
        // For now, create a placeholder implementation
        this.clear();
        
        // TODO: Parse src/Screens/*.yaml
        // TODO: Parse src/Controls/*.yaml
        // TODO: Parse src/DataConnections/*.json
        
        this._onGraphChanged.fire();
    }
    
    /**
     * Add a control to the graph and analyze its formulas
     */
    addControl(
        name: string,
        screen: string,
        controlType: string,
        properties: Record<string, string>,
        filePath?: string
    ): void {
        const nodeId = `${screen}.${name}`;
        
        const propertyMap = new Map<string, PropertyInfo>();
        for (const [propName, formula] of Object.entries(properties)) {
            const analysis = analyzeFormula(formula);
            propertyMap.set(propName, {
                name: propName,
                formula,
                analysis
            });
            
            // Create edges for dependencies
            for (const dep of analysis.dependencies) {
                this.addEdgeForDependency(nodeId, propName, dep);
            }
        }
        
        this.addNode({
            id: nodeId,
            name,
            type: NodeType.Control,
            screen,
            properties: propertyMap,
            metadata: {
                filePath,
                controlType
            }
        });
    }
    
    /**
     * Add a screen to the graph
     */
    addScreen(
        name: string,
        properties: Record<string, string>,
        filePath?: string
    ): void {
        const propertyMap = new Map<string, PropertyInfo>();
        for (const [propName, formula] of Object.entries(properties)) {
            const analysis = analyzeFormula(formula);
            propertyMap.set(propName, {
                name: propName,
                formula,
                analysis
            });
            
            for (const dep of analysis.dependencies) {
                this.addEdgeForDependency(name, propName, dep);
            }
        }
        
        this.addNode({
            id: name,
            name,
            type: NodeType.Screen,
            properties: propertyMap,
            metadata: { filePath }
        });
    }
    
    private addEdgeForDependency(fromId: string, property: string, dep: Dependency): void {
        let toId = dep.path.join('.');
        let edgeType: EdgeType;
        
        switch (dep.type) {
            case DependencyType.Screen:
                edgeType = EdgeType.Navigate;
                toId = dep.name;
                break;
            case DependencyType.DataSource:
                edgeType = dep.isWrite ? EdgeType.DataWrite : EdgeType.DataRead;
                break;
            default:
                edgeType = dep.isWrite ? EdgeType.Write : EdgeType.Read;
        }
        
        // Ensure target node exists (create placeholder if needed)
        if (!this.nodes.has(toId)) {
            const nodeType = this.mapDependencyTypeToNodeType(dep.type);
            this.addNode({
                id: toId,
                name: dep.name,
                type: nodeType,
                properties: new Map(),
                metadata: {}
            });
        }
        
        this.addEdge({
            from: fromId,
            to: toId,
            property,
            type: edgeType
        });
    }
    
    private mapDependencyTypeToNodeType(depType: DependencyType): NodeType {
        switch (depType) {
            case DependencyType.Screen: return NodeType.Screen;
            case DependencyType.DataSource: return NodeType.DataSource;
            case DependencyType.Collection: return NodeType.Collection;
            case DependencyType.Variable:
            case DependencyType.GlobalVariable:
            case DependencyType.ContextVariable:
                return NodeType.Variable;
            case DependencyType.Component:
                return NodeType.Component;
            default:
                return NodeType.Control;
        }
    }
    
    /**
     * Export graph to various formats
     */
    export(format: ExportFormat): string {
        switch (format) {
            case 'json':
                return this.exportJSON();
            case 'dot':
                return this.exportDOT();
            case 'mermaid':
                return this.exportMermaid();
            case 'd2':
                return this.exportD2();
        }
    }
    
    private exportJSON(): string {
        return JSON.stringify({
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id,
                name: node.name,
                type: node.type,
                screen: node.screen,
                metadata: node.metadata
            })),
            edges: this.edges
        }, null, 2);
    }
    
    private exportDOT(): string {
        const lines: string[] = ['digraph DependencyGraph {'];
        lines.push('  rankdir=LR;');
        lines.push('  node [shape=box];');
        lines.push('');
        
        // Define node styles by type
        const nodeColors: Record<NodeType, string> = {
            [NodeType.Screen]: '#742774',
            [NodeType.Control]: '#0078d4',
            [NodeType.Component]: '#00bcf2',
            [NodeType.DataSource]: '#107c10',
            [NodeType.Collection]: '#ff8c00',
            [NodeType.Variable]: '#6b69d6'
        };
        
        // Add nodes
        for (const [id, node] of this.nodes) {
            const color = nodeColors[node.type] ?? '#666666';
            const label = node.screen ? `${node.screen}\\n${node.name}` : node.name;
            lines.push(`  "${id}" [label="${label}" fillcolor="${color}" style=filled fontcolor=white];`);
        }
        
        lines.push('');
        
        // Add edges
        for (const edge of this.edges) {
            const style = edge.type === EdgeType.Write || edge.type === EdgeType.DataWrite 
                ? 'bold' : 'solid';
            const color = edge.type === EdgeType.Navigate ? '#742774' : '#333333';
            lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.property}" style=${style} color="${color}"];`);
        }
        
        lines.push('}');
        return lines.join('\n');
    }
    
    private exportMermaid(): string {
        const lines: string[] = ['flowchart LR'];
        
        // Define subgraphs by screen
        const nodesByScreen = new Map<string, GraphNode[]>();
        for (const node of this.nodes.values()) {
            const screen = node.screen ?? '_global';
            if (!nodesByScreen.has(screen)) {
                nodesByScreen.set(screen, []);
            }
            nodesByScreen.get(screen)!.push(node);
        }
        
        // Add nodes grouped by screen
        for (const [screen, nodes] of nodesByScreen) {
            if (screen !== '_global') {
                lines.push(`  subgraph ${screen}`);
            }
            for (const node of nodes) {
                const shape = node.type === NodeType.Screen ? '[[' : '[';
                const closeShape = node.type === NodeType.Screen ? ']]' : ']';
                const safeId = node.id.replace(/\./g, '_');
                lines.push(`    ${safeId}${shape}"${node.name}"${closeShape}`);
            }
            if (screen !== '_global') {
                lines.push('  end');
            }
        }
        
        // Add edges
        for (const edge of this.edges) {
            const fromId = edge.from.replace(/\./g, '_');
            const toId = edge.to.replace(/\./g, '_');
            const arrow = edge.type === EdgeType.Write || edge.type === EdgeType.DataWrite 
                ? '==>' : '-->';
            lines.push(`  ${fromId} ${arrow}|${edge.property}| ${toId}`);
        }
        
        return lines.join('\n');
    }
    
    private exportD2(): string {
        const lines: string[] = [];
        
        // Add nodes with styling
        for (const [id, node] of this.nodes) {
            const shape = this.getD2Shape(node.type);
            lines.push(`${id.replace(/\./g, '_')}: "${node.name}" {`);
            lines.push(`  shape: ${shape}`);
            lines.push('}');
        }
        
        lines.push('');
        
        // Add edges
        for (const edge of this.edges) {
            const fromId = edge.from.replace(/\./g, '_');
            const toId = edge.to.replace(/\./g, '_');
            lines.push(`${fromId} -> ${toId}: ${edge.property}`);
        }
        
        return lines.join('\n');
    }
    
    private getD2Shape(type: NodeType): string {
        switch (type) {
            case NodeType.Screen: return 'page';
            case NodeType.DataSource: return 'cylinder';
            case NodeType.Collection: return 'stored_data';
            case NodeType.Variable: return 'hexagon';
            default: return 'rectangle';
        }
    }
    
    dispose(): void {
        this._onGraphChanged.dispose();
    }
}

/**
 * Create a dependency graph instance
 */
export function createDependencyGraph(): DependencyGraph {
    return new DependencyGraph();
}
