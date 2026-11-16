/**
 * Git Integration Service
 * Provides Git operations specific to Power Apps source control
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

/**
 * Git commit info
 */
export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: Date;
}

/**
 * Git status for a file
 */
export interface GitFileStatus {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
    staged: boolean;
}

/**
 * Git Integration Service
 */
export class GitService {
    private workspaceRoot: string | undefined;
    
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    
    /**
     * Check if Git is available
     */
    async isGitAvailable(): Promise<boolean> {
        try {
            await this.execute(['--version']);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Check if current directory is a Git repository
     */
    async isRepository(): Promise<boolean> {
        try {
            await this.execute(['rev-parse', '--git-dir']);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Initialize a new Git repository
     */
    async init(): Promise<void> {
        await this.execute(['init']);
        
        // Create .gitignore for Power Apps
        await this.createGitIgnore();
        
        vscode.window.showInformationMessage('Git repository initialized');
    }
    
    /**
     * Get current branch name
     */
    async getCurrentBranch(): Promise<string> {
        const result = await this.execute(['rev-parse', '--abbrev-ref', 'HEAD']);
        return result.trim();
    }
    
    /**
     * Get list of changed files
     */
    async getStatus(): Promise<GitFileStatus[]> {
        const result = await this.execute(['status', '--porcelain']);
        const lines = result.split('\n').filter(l => l.trim());
        
        return lines.map(line => {
            const staged = line[0] !== ' ' && line[0] !== '?';
            const statusChar = staged ? line[0] : line[1];
            
            let status: GitFileStatus['status'];
            switch (statusChar) {
                case 'M': status = 'modified'; break;
                case 'A': status = 'added'; break;
                case 'D': status = 'deleted'; break;
                case 'R': status = 'renamed'; break;
                case '?': status = 'untracked'; break;
                default: status = 'modified';
            }
            
            return {
                path: line.substring(3),
                status,
                staged
            };
        });
    }
    
    /**
     * Stage files for commit
     */
    async stage(paths: string[]): Promise<void> {
        await this.execute(['add', ...paths]);
    }
    
    /**
     * Stage all changes
     */
    async stageAll(): Promise<void> {
        await this.execute(['add', '-A']);
    }
    
    /**
     * Commit staged changes
     */
    async commit(message: string): Promise<void> {
        await this.execute(['commit', '-m', message]);
        vscode.window.showInformationMessage(`Committed: ${message}`);
    }
    
    /**
     * Create a commit for Power Apps changes with a standardized message
     */
    async commitPowerAppsChanges(appName: string, changeType: string): Promise<void> {
        const timestamp = new Date().toISOString().split('T')[0];
        const message = `[Power Apps] ${changeType}: ${appName} (${timestamp})`;
        
        await this.stageAll();
        await this.commit(message);
    }
    
    /**
     * Get recent commits
     */
    async getRecentCommits(count: number = 10): Promise<GitCommit[]> {
        const format = '%H|%h|%s|%an|%aI';
        const result = await this.execute([
            'log',
            `-${count}`,
            `--format=${format}`
        ]);
        
        const lines = result.split('\n').filter(l => l.trim());
        
        return lines.map(line => {
            const [hash, shortHash, message, author, dateStr] = line.split('|');
            return {
                hash,
                shortHash,
                message,
                author,
                date: new Date(dateStr)
            };
        });
    }
    
    /**
     * Get diff for a specific file
     */
    async getDiff(filePath: string): Promise<string> {
        try {
            const result = await this.execute(['diff', filePath]);
            return result;
        } catch {
            return '';
        }
    }
    
    /**
     * Get diff for staged files
     */
    async getStagedDiff(): Promise<string> {
        try {
            const result = await this.execute(['diff', '--cached']);
            return result;
        } catch {
            return '';
        }
    }
    
    /**
     * Create a Power Apps-specific .gitignore
     */
    private async createGitIgnore(): Promise<void> {
        const gitignorePath = path.join(this.workspaceRoot!, '.gitignore');
        
        const content = `# Power Apps
*.msapp
*.zip

# Build outputs
out/
dist/
build/

# Dependencies
node_modules/

# IDE
.vscode/
*.vsix

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Environment files
.env
.env.local

# Cached files
.cache/
*.tmp
`;
        
        const uri = vscode.Uri.file(gitignorePath);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    }
    
    /**
     * Create a feature branch for app development
     */
    async createBranch(branchName: string): Promise<void> {
        // Sanitize branch name
        const safeName = branchName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-');
        
        await this.execute(['checkout', '-b', `feature/${safeName}`]);
        vscode.window.showInformationMessage(`Created branch: feature/${safeName}`);
    }
    
    /**
     * Push to remote
     */
    async push(remote: string = 'origin', branch?: string): Promise<void> {
        const currentBranch = branch ?? await this.getCurrentBranch();
        
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Pushing to ${remote}/${currentBranch}...`
            },
            async () => {
                await this.execute(['push', '-u', remote, currentBranch]);
            }
        );
        
        vscode.window.showInformationMessage(`Pushed to ${remote}/${currentBranch}`);
    }
    
    /**
     * Pull from remote
     */
    async pull(remote: string = 'origin', branch?: string): Promise<void> {
        const currentBranch = branch ?? await this.getCurrentBranch();
        
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Pulling from ${remote}/${currentBranch}...`
            },
            async () => {
                await this.execute(['pull', remote, currentBranch]);
            }
        );
        
        vscode.window.showInformationMessage(`Pulled from ${remote}/${currentBranch}`);
    }
    
    /**
     * Execute a Git command
     */
    private execute(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const process = spawn('git', args, {
                cwd: this.workspaceRoot,
                shell: true
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });
            
            process.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });
            
            process.on('close', (code: number | null) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Git command failed with code ${code}`));
                }
            });
            
            process.on('error', (err: Error) => {
                reject(err);
            });
        });
    }
}

/**
 * Create Git service instance
 */
export function createGitService(): GitService {
    return new GitService();
}
