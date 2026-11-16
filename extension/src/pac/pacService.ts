import * as vscode from 'vscode';
import { spawn, SpawnOptions } from 'child_process';
import * as path from 'path';

/**
 * Service for interacting with PAC CLI (Power Platform CLI)
 * Wraps all pac commands with proper error handling and output parsing
 */
export class PacService {
    private pacPath: string | undefined;

    constructor() {
        this.detectPacCli();
    }

    /**
     * Detects PAC CLI installation path
     */
    private async detectPacCli(): Promise<void> {
        const config = vscode.workspace.getConfiguration('powerapps');
        const configuredPath = config.get<string>('pacCliPath');

        if (configuredPath && configuredPath.length > 0) {
            this.pacPath = configuredPath;
            return;
        }

        // Try common installation paths
        const possiblePaths = process.platform === 'win32'
            ? [
                'pac',
                path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'PowerAppsCli', 'pac.exe'),
                path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'PowerAppsCli', 'pac.exe')
            ]
            : ['pac', '/usr/local/bin/pac', '~/.dotnet/tools/pac'];

        for (const pacPath of possiblePaths) {
            try {
                await this.execute('--version', [], pacPath);
                this.pacPath = pacPath;
                console.log(`PAC CLI found at: ${pacPath}`);
                return;
            } catch {
                // Continue to next path
            }
        }

        vscode.window.showWarningMessage(
            'PAC CLI not found. Please install Power Platform CLI or configure the path in settings.'
        );
    }

    /**
     * Executes a PAC CLI command
     */
    private execute(
        command: string,
        args: string[] = [],
        pacPathOverride?: string
    ): Promise<PacResult> {
        return new Promise((resolve, reject) => {
            const pacExecutable = pacPathOverride || this.pacPath || 'pac';
            const fullArgs = [command, ...args];

            const options: SpawnOptions = {
                shell: true,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            };

            const process = spawn(pacExecutable, fullArgs, options);

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
                    resolve({
                        success: true,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: code || 0
                    });
                } else {
                    reject({
                        success: false,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: code || 1
                    });
                }
            });

            process.on('error', (err: Error) => {
                reject({
                    success: false,
                    stdout: '',
                    stderr: err.message,
                    exitCode: 1
                });
            });
        });
    }

    /**
     * Lists authentication profiles
     * Command: pac auth list
     */
    async listAuthProfiles(): Promise<AuthProfile[]> {
        try {
            const result = await this.execute('auth', ['list']);
            return this.parseAuthList(result.stdout);
        } catch (error) {
            console.error('Failed to list auth profiles:', error);
            return [];
        }
    }

    /**
     * Creates a new authentication profile (opens browser)
     * Command: pac auth create
     */
    async createAuthProfile(): Promise<boolean> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Authenticating with Power Platform...',
                    cancellable: false
                },
                async () => {
                    await this.execute('auth', ['create']);
                }
            );
            vscode.window.showInformationMessage('Successfully authenticated with Power Platform');
            return true;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Authentication failed: ${errorMessage}`);
            return false;
        }
    }

    /**
     * Lists available organizations/environments
     * Command: pac org list
     */
    async listOrganizations(): Promise<Organization[]> {
        try {
            const result = await this.execute('org', ['list']);
            return this.parseOrgList(result.stdout);
        } catch (error) {
            console.error('Failed to list organizations:', error);
            return [];
        }
    }

    /**
     * Selects an organization/environment
     * Command: pac org select --environment <url>
     */
    async selectOrganization(environmentUrl: string): Promise<boolean> {
        try {
            await this.execute('org', ['select', '--environment', environmentUrl]);
            vscode.window.showInformationMessage(`Selected environment: ${environmentUrl}`);
            return true;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to select environment: ${errorMessage}`);
            return false;
        }
    }

    /**
     * Unpacks a Canvas App (.msapp) to source folder
     * Command: pac canvas unpack --msapp <file> --sources <folder>
     */
    async unpackCanvasApp(msappPath: string, outputFolder: string): Promise<boolean> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Unpacking Canvas App...',
                    cancellable: false
                },
                async () => {
                    await this.execute('canvas', [
                        'unpack',
                        '--msapp', `"${msappPath}"`,
                        '--sources', `"${outputFolder}"`
                    ]);
                }
            );
            vscode.window.showInformationMessage(`Canvas App unpacked to: ${outputFolder}`);
            
            // Open the output folder
            const uri = vscode.Uri.file(outputFolder);
            vscode.commands.executeCommand('revealInExplorer', uri);
            
            return true;
        } catch (error: unknown) {
            const pacError = error as PacResult;
            vscode.window.showErrorMessage(`Failed to unpack: ${pacError.stderr || pacError.stdout}`);
            return false;
        }
    }

    /**
     * Packs source folder back to Canvas App (.msapp)
     * Command: pac canvas pack --sources <folder> --msapp <file>
     */
    async packCanvasApp(sourceFolder: string, msappPath: string): Promise<boolean> {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Packing Canvas App...',
                    cancellable: false
                },
                async () => {
                    await this.execute('canvas', [
                        'pack',
                        '--sources', `"${sourceFolder}"`,
                        '--msapp', `"${msappPath}"`
                    ]);
                }
            );
            vscode.window.showInformationMessage(`Canvas App packed: ${msappPath}`);
            return true;
        } catch (error: unknown) {
            const pacError = error as PacResult;
            vscode.window.showErrorMessage(`Failed to pack: ${pacError.stderr || pacError.stdout}`);
            return false;
        }
    }

    /**
     * Gets PAC CLI version
     */
    async getVersion(): Promise<string> {
        try {
            const result = await this.execute('--version');
            return result.stdout;
        } catch {
            return 'Unknown';
        }
    }

    /**
     * Parses pac auth list output
     */
    private parseAuthList(output: string): AuthProfile[] {
        const profiles: AuthProfile[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        // Skip header lines
        for (const line of lines) {
            // Typical format: Index | Active | Kind | Name | User | Cloud | ...
            const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
            if (parts.length >= 4 && !isNaN(parseInt(parts[0]))) {
                profiles.push({
                    index: parseInt(parts[0]),
                    active: parts[1] === '*' || parts[1].toLowerCase() === 'true',
                    kind: parts[2],
                    name: parts[3],
                    user: parts[4] || '',
                    cloud: parts[5] || 'Public'
                });
            }
        }

        return profiles;
    }

    /**
     * Parses pac org list output
     */
    private parseOrgList(output: string): Organization[] {
        const orgs: Organization[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            // Typical format: Active | Display Name | Environment ID | Environment URL | Type | ...
            const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
            if (parts.length >= 4 && parts[0] !== 'Active') {
                const isActive = parts[0] === '*' || parts[0].toLowerCase() === 'true';
                const offset = isActive ? 1 : 0;
                
                orgs.push({
                    active: isActive,
                    friendlyName: parts[offset] || parts[0],
                    environmentId: parts[offset + 1] || parts[1],
                    url: parts[offset + 2] || parts[2],
                    type: parts[offset + 3] || 'Production'
                });
            }
        }

        return orgs;
    }
}

/**
 * Result from PAC CLI execution
 */
interface PacResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Authentication profile from pac auth list
 */
export interface AuthProfile {
    index: number;
    active: boolean;
    kind: string;
    name: string;
    user: string;
    cloud: string;
}

/**
 * Organization/Environment from pac org list
 */
export interface Organization {
    active: boolean;
    friendlyName: string;
    environmentId: string;
    url: string;
    type: string;
}
