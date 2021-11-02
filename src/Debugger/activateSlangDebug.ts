/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { slangDebugSession } from './slangDebug';
import { FileAccessor } from './slangRuntime';

export function activateslangDebug(context: vscode.ExtensionContext, factory?: vscode.DebugAdapterDescriptorFactory) {

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.slang-debug.runEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
		
				vscode.debug.startDebugging(undefined, {
						type: 'slang',
						name: 'Run File',
						request: 'launch',
						program: targetResource.fsPath
					},
					{ noDebug: true }
				);
			}
		}),
		vscode.commands.registerCommand('extension.slang-debug.debugEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				vscode.debug.startDebugging(undefined, {
					type: 'slang',
					name: 'Debug File',
					request: 'launch',
					program: targetResource.fsPath
				});
			}
		}),
		vscode.commands.registerCommand('extension.slang-debug.toggleFormatting', (variable) => {
			const ds = vscode.debug.activeDebugSession;
			if (ds) {
				ds.customRequest('toggleFormatting');
			}
		})
	);

	context.subscriptions.push(vscode.commands.registerCommand('extension.slang-debug.getProgramName', config => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a slang file in the workspace folder",
			value: "readme.md"
		});
	}));

	// register a configuration provider for 'slang' debug type
	const providerAp = new slangConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('ap', providerAp));

	// register a configuration provider for 'slang' debug type
	const providerFgl = new slangConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('fgl', providerFgl));

	// register a configuration provider for 'slang' debug type
	const providerSlang = new slangConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('slang', providerSlang));

	// register a dynamic configuration provider for 'slang' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('slang', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return [
				{
					name: "slang Launch",
					request: "launch",
					type: "slang",
					program: "${file}"
				}
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	// register a dynamic configuration provider for 'slang' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('slang', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return [
				{
					name: "fgl Launch",
					request: "launch",
					type: "fgl",
					program: "${file}"
				}
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	// register a dynamic configuration provider for 'slang' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('slang', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return [
				{
					name: "Enter debugger and await breakpoint or exception",
					request: "attach",
					type: "ap",
					program: "${file}"
				},
				{
					name: "Enter debugger and halt at start of current AP file",
					request: "launch",
					type: "ap",
					program: "${file}"
				},
				{
					name: "Enter debugger and halt at start of ANY AP file",
					request: "launch",
					type: "ap",
					program: ""
				}
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	if (!factory) {
		factory = new InlineDebugAdapterFactory();
	}
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('ap', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('fgl', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}	
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('slang', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}
}

class slangConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'ap') {
				config.type = 'ap';
				config.name = 'Launch';
				config.request = 'launch';
				config.program = '${file}';
				config.stopOnEntry = true;
			}
			if (editor && editor.document.languageId === 'fgl') {
				config.type = 'fgl';
				config.name = 'Launch';
				config.request = 'launch';
				config.program = '${file}';
				config.stopOnEntry = true;
			}
			if (editor && editor.document.languageId === 'slang') {
				config.type = 'slang';
				config.name = 'Launch';
				config.request = 'launch';
				config.program = '${file}';
				config.stopOnEntry = true;
			}			
		}

		if (!config.program) {
			return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
				return undefined;	// abort launch
			});
		}

		return config;
	}
}

export const workspaceFileAccessor: FileAccessor = {
	async readFile(path: string) {
		try {
			const uri = vscode.Uri.file(path);
			const bytes = await vscode.workspace.fs.readFile(uri);
			const contents = Buffer.from(bytes).toString('utf8');
			return contents;
		} catch(e) {
			try {
				const uri = vscode.Uri.parse(path);
				const bytes = await vscode.workspace.fs.readFile(uri);
				const contents = Buffer.from(bytes).toString('utf8');
				return contents;
			} catch (e) {
				return `cannot read '${path}'`;
			}
		}
	}
};

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
//	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		// since DebugAdapterInlineImplementation is proposed API, a cast to <any> is required for now
		return <any> new vscode.DebugAdapterInlineImplementation(<any> new slangDebugSession(workspaceFileAccessor));
	}
}

