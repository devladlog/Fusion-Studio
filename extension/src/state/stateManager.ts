import * as vscode from 'vscode';

/**
 * Manages application state for the Fusion Studio extension
 * Handles environment selection, studio state observation, and persistence
 */
export class StateManager {
    private readonly context: vscode.ExtensionContext;
    private studioReady: boolean = false;
    private currentStudioState: StudioState | undefined;

    // Event emitters for state changes
    private readonly _onStudioStateChanged = new vscode.EventEmitter<StudioState>();
    public readonly onStudioStateChanged = this._onStudioStateChanged.event;

    private readonly _onEnvironmentChanged = new vscode.EventEmitter<string>();
    public readonly onEnvironmentChanged = this._onEnvironmentChanged.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Gets the currently selected environment ID
     */
    getCurrentEnvironment(): string | undefined {
        return this.context.workspaceState.get<string>('currentEnvironment');
    }

    /**
     * Sets the current environment
     */
    setCurrentEnvironment(environmentId: string): void {
        this.context.workspaceState.update('currentEnvironment', environmentId);
        this._onEnvironmentChanged.fire(environmentId);
    }

    /**
     * Gets whether the Studio WebView is ready
     */
    isStudioReady(): boolean {
        return this.studioReady;
    }

    /**
     * Sets the Studio ready state
     */
    setStudioReady(ready: boolean): void {
        this.studioReady = ready;
    }

    /**
     * Updates the observed Studio state (read-only observation)
     * This captures state without modifying the Studio
     */
    updateStudioState(state: Partial<StudioState>): void {
        this.currentStudioState = {
            ...this.currentStudioState,
            ...state,
            timestamp: new Date().toISOString()
        } as StudioState;

        this._onStudioStateChanged.fire(this.currentStudioState);

        // Store last known state for debugging/telemetry
        this.context.workspaceState.update('lastStudioState', this.currentStudioState);
    }

    /**
     * Gets the current observed Studio state
     */
    getStudioState(): StudioState | undefined {
        return this.currentStudioState;
    }

    /**
     * Gets recently opened apps from history
     */
    getRecentApps(): RecentApp[] {
        return this.context.globalState.get<RecentApp[]>('recentApps') || [];
    }

    /**
     * Adds an app to recent history
     */
    addRecentApp(app: RecentApp): void {
        const recent = this.getRecentApps();
        
        // Remove if already exists (will re-add at top)
        const filtered = recent.filter(a => a.id !== app.id);
        
        // Add to beginning, keep max 10
        const updated = [{ ...app, lastOpened: new Date().toISOString() }, ...filtered].slice(0, 10);
        
        this.context.globalState.update('recentApps', updated);
    }

    /**
     * Gets workspace-specific canvas app path
     */
    getCanvasAppSourcePath(): string | undefined {
        return this.context.workspaceState.get<string>('canvasAppSourcePath');
    }

    /**
     * Sets workspace-specific canvas app path
     */
    setCanvasAppSourcePath(path: string): void {
        this.context.workspaceState.update('canvasAppSourcePath', path);
    }

    /**
     * Gets telemetry opt-in status
     */
    isTelemetryEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('powerapps');
        return config.get<boolean>('enableTelemetry', false);
    }

    /**
     * Clears all cached state (useful for troubleshooting)
     */
    async clearState(): Promise<void> {
        await this.context.workspaceState.update('currentEnvironment', undefined);
        await this.context.workspaceState.update('lastStudioState', undefined);
        await this.context.workspaceState.update('canvasAppSourcePath', undefined);
        this.studioReady = false;
        this.currentStudioState = undefined;
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        this._onStudioStateChanged.dispose();
        this._onEnvironmentChanged.dispose();
    }
}

/**
 * Observed state from Fusion Studio (read-only)
 */
export interface StudioState {
    /** Currently active screen name */
    activeScreen?: string;
    
    /** Currently selected control name */
    selectedControl?: string;
    
    /** Last formula being edited (snapshot) */
    lastFormula?: string;
    
    /** Current app ID being edited */
    appId?: string;
    
    /** Current app name */
    appName?: string;
    
    /** Whether the app has unsaved changes */
    hasUnsavedChanges?: boolean;
    
    /** Timestamp of this state observation */
    timestamp: string;
}

/**
 * Recently opened app entry
 */
export interface RecentApp {
    id: string;
    name: string;
    environmentId: string;
    lastOpened: string;
    thumbnailUrl?: string;
}
