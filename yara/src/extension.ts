"use strict";

import * as vscode from "vscode";
import { YaraCompletionItemProvider } from "./completionProvider";
import { YaraDefinitionProvider } from "./definitionProvider";
import { YaraReferenceProvider } from "./referenceProvider";
import { CompileRule } from "./diagnostics";


export function activate(context: vscode.ExtensionContext) {
    // console.log("Activating Yara extension");
    const YARA: vscode.DocumentSelector = { language: "yara", scheme: "file" };
    let definitionDisposable: vscode.Disposable = vscode.languages.registerDefinitionProvider(YARA, new YaraDefinitionProvider());
    let referenceDisposable: vscode.Disposable = vscode.languages.registerReferenceProvider(YARA, new YaraReferenceProvider());
    let completionDisposable: vscode.Disposable = vscode.languages.registerCompletionItemProvider(YARA, new YaraCompletionItemProvider(), '.');
    let diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('yara');
    let compileCommand: vscode.Disposable = vscode.commands.registerCommand("yara.CompileRule", function (doc?: vscode.TextDocument | null) {
       return CompileRule(doc, diagnosticCollection);
    });
    let compileAllCommand: vscode.Disposable = vscode.commands.registerCommand("yara.CompileAllRules", function () {
        const glob: vscode.GlobPattern = "**/*.{yara,yar}"
        vscode.workspace.findFiles(glob, null, 100).then(function (results: vscode.Uri[]) {
            console.log(`findFiles result: ${JSON.stringify(results)}`);
            results.forEach(uri => {
                
            });
        });
    });
    let saveSubscription: vscode.Disposable = vscode.workspace.onDidSaveTextDocument(function () {
        let fileUri: vscode.Uri = vscode.window.activeTextEditor.document.uri;
        let localConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", fileUri);
        if (localConfig.get("compile_on_save")) {
            CompileRule(null, diagnosticCollection).catch(function (err: string) {
                if (err.startsWith("Cannot compile YARA rule")) {
                    localConfig.update("compile_on_save", false);
                }
            });
        }
    });
    context.subscriptions.push(definitionDisposable);
    context.subscriptions.push(referenceDisposable);
    context.subscriptions.push(completionDisposable);
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(compileCommand);
    context.subscriptions.push(compileAllCommand);
    context.subscriptions.push(saveSubscription);
};

export function deactivate(context: vscode.ExtensionContext) {
    // console.log("Deactivating Yara extension");
    context.subscriptions.forEach(disposable => {
        disposable.dispose();
    });
};
