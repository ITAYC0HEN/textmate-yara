"use strict";

import * as vscode from "vscode";
import { YaraCompletionItemProvider } from "./completionProvider";
import { YaraDefinitionProvider } from "./definitionProvider";
import { YaraReferenceProvider } from "./referenceProvider";
import { CompileRule } from "./diagnostics";

let saveSubscription: vscode.Disposable | null = null;

export function activate(context: vscode.ExtensionContext) {
    // console.log("Activating Yara extension");
    const YARA: vscode.DocumentSelector = { language: "yara", scheme: "file" };
    let definitionDisposable: vscode.Disposable = vscode.languages.registerDefinitionProvider(YARA, new YaraDefinitionProvider());
    let referenceDisposable: vscode.Disposable = vscode.languages.registerReferenceProvider(YARA, new YaraReferenceProvider());
    let completionDisposable: vscode.Disposable = vscode.languages.registerCompletionItemProvider(YARA, new YaraCompletionItemProvider(), '.');
    let diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('yara');
    let compileCommand: vscode.Disposable = vscode.commands.registerCommand("yara.CompileRule", function () {
        CompileRule(null, diagnosticCollection);
    });
    saveSubscription = vscode.workspace.onDidSaveTextDocument(function () {
        // ugly, ugly way to dispose of a subscription
        CompileRule(null, diagnosticCollection).catch(function (err) {
            if (err == "Cannot compile YARA rule. Please specify an install path") {
                console.log("Disposing of saveSubscription");
                saveSubscription.dispose();
            }
        });
    });
    context.subscriptions.push(definitionDisposable);
    context.subscriptions.push(referenceDisposable);
    context.subscriptions.push(completionDisposable);
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(compileCommand);
    context.subscriptions.push(saveSubscription);
};

export function deactivate(context: vscode.ExtensionContext) {
    // console.log("Deactivating Yara extension");
    context.subscriptions.forEach(disposable => {
        disposable.dispose();
    });
};
