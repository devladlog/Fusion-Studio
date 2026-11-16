/**
 * Status Bar Integration
 * Shows Power Apps status in VS Code status bar
 */

import * as vscode from 'vscode';
import { StateManager } from '../state/stateManager';
import { GitService } from './gitService';
import { FileWatcherService } from './fileWatcher';

/**
 * Status Bar Manager
 */
export class StatusBarManager {
    private studioStatusItem: vscode.StatusBarItem;
    private gitStatusItem: vscode.StatusBarItem;
    private watcherStatusItem: vscode.StatusBarItem;
    private environmentStatusItem: vscode.StatusBarItem;
    
    constructor(
        private stateManager: StateManager,
        private gitService: GitService,
        private fileWatcher: FileWatcherService
    ) {
        // Create status bar items (right to left by priority)
        this.environmentStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.environmentStatusItem.command = 'powerapps.selectEnvironment';
        this.environmentStatusItem.tooltip = 'Click to select Power Platform environment';
        
        this.studioStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.studioStatusItem.command = 'powerapps.openStudio';
        this.studioStatusItem.tooltip = 'Click to open Fusion Studio';
        
        this.gitStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.gitStatusItem.command = 'powerapps.gitCommit';
        this.gitStatusItem.tooltip = 'Click to commit changes';
        
        this.watcherStatusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            97
        );
        this.watcherStatusItem.command = 'powerapps.toggleWatcher';
        this.watcherStatusItem.tooltip = 'Click to toggle file watcher';
        
        // Subscribe to state changes
        this.setupListeners();
        
        // Initial update
        this.updateAll();
        
        // Show items
        this.environmentStatusItem.show();
        this.studioStatusItem.show();
    }
    
    private setupListeners(): void {
        // Studio state changes
        this.stateManager.onStudioStateChanged(() => {
            this.updateStudioStatus();
        });
        
        // Environment changes
        this.stateManager.onEnvironmentChanged(() => {
            this.updateEnvironmentStatus();
        });
        
        // File watcher changes
        this.fileWatcher.onFileChanged(() => {
            this.updateWatcherStatus();
        });
    }
    
    /**
     * Update all status items
     */
    async updateAll(): Promise<void> {
        this.updateStudioStatus();
        this.updateEnvironmentStatus();
        await this.updateGitStatus();
        this.updateWatcherStatus();
    }
    
    /**
     * Update Studio connection status
     */
    private updateStudioStatus(): void {
        const isReady = this.stateManager.isStudioReady();
        const state = this.stateManager.getStudioState();
        
        if (isReady) {
            this.studioStatusItem.text = '$(zap) Studio';
            this.studioStatusItem.backgroundColor = undefined;
            
            if (state?.activeScreen) {
                this.studioStatusItem.text = `$(zap) ${state.activeScreen}`;
            }
        } else {
            this.studioStatusItem.text = '$(plug) Studio';
            this.studioStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }
    
    /**
     * Update environment status
     */
    private updateEnvironmentStatus(): void {
        const env = this.stateManager.getCurrentEnvironment();
        
        if (env) {
            // Shorten environment name for status bar
            const shortName = env.length > 20 ? env.substring(0, 17) + '...' : env;
            this.environmentStatusItem.text = `$(globe) ${shortName}`;
            this.environmentStatusItem.backgroundColor = undefined;
        } else {
            this.environmentStatusItem.text = '$(globe) No Environment';
            this.environmentStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }
    
    /**
     * Update Git status
     */
    async updateGitStatus(): Promise<void> {
        try {
            const isRepo = await this.gitService.isRepository();
            
            if (!isRepo) {
                this.gitStatusItem.text = '$(git-branch) No Repo';
                this.gitStatusItem.tooltip = 'Click to initialize Git repository';
                this.gitStatusItem.command = 'powerapps.gitInit';
                this.gitStatusItem.show();
                return;
            }
            
            const branch = await this.gitService.getCurrentBranch();
            const status = await this.gitService.getStatus();
            
            const modified = status.filter(s => s.status === 'modified').length;
            const added = status.filter(s => s.status === 'added' || s.status === 'untracked').length;
            
            let text = `$(git-branch) ${branch}`;
            if (modified > 0 || added > 0) {
                text += ` $(circle-filled) ${modified + added}`;
            }
            
            this.gitStatusItem.text = text;
            this.gitStatusItem.tooltip = `Branch: ${branch}\nModified: ${modified}\nNew: ${added}\nClick to commit`;
            this.gitStatusItem.command = 'powerapps.gitCommit';
            this.gitStatusItem.show();
            
        } catch {
            this.gitStatusItem.hide();
        }
    }
    
    /**
     * Update file watcher status
     */
    private updateWatcherStatus(): void {
        const isWatching = this.fileWatcher.isWatching();
        const sourcePath = this.fileWatcher.getSourcePath();
        
        if (isWatching && sourcePath) {
            const folderName = sourcePath.split(/[/\\]/).pop();
            this.watcherStatusItem.text = `$(eye) ${folderName}`;
            this.watcherStatusItem.tooltip = `Watching: ${sourcePath}\nClick to stop`;
            this.watcherStatusItem.backgroundColor = undefined;
            this.watcherStatusItem.show();
        } else {
            this.watcherStatusItem.text = '$(eye-closed) Not watching';
            this.watcherStatusItem.tooltip = 'Click to start watching source folder';
            this.watcherStatusItem.show();
        }
    }
    
    /**
     * Show a quick progress notification
     */
    showProgress(message: string): vscode.Disposable {
        this.studioStatusItem.text = `$(sync~spin) ${message}`;
        
        return {
            dispose: () => {
                this.updateStudioStatus();
            }
        };
    }
    
    /**
     * Show temporary message in status bar
     */
    showMessage(message: string, duration: number = 3000): void {
        const originalText = this.studioStatusItem.text;
        this.studioStatusItem.text = `$(info) ${message}`;
        
        setTimeout(() => {
            this.studioStatusItem.text = originalText;
        }, duration);
    }
    
    /**
     * Dispose resources
     */
    dispose(): void {
        this.studioStatusItem.dispose();
        this.gitStatusItem.dispose();
        this.watcherStatusItem.dispose();
        this.environmentStatusItem.dispose();
    }
}
