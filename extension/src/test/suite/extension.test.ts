import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher.powerapps-studio-vscode'));
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(commands.includes('powerapps.openStudio'));
        assert.ok(commands.includes('powerapps.unpackApp'));
        assert.ok(commands.includes('powerapps.packApp'));
        assert.ok(commands.includes('powerapps.selectEnvironment'));
        assert.ok(commands.includes('powerapps.authStatus'));
    });
});
