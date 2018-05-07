"use strict";

/*
Note: This example test is leveraging the Mocha test framework.
Please refer to their documentation on https://mochajs.org/ for help.
*/

import * as path from "path";
import * as vscode from "vscode";
import { YaraCompletionItemProvider } from "../yara/src/completionProvider";
import { YaraDefinitionProvider } from "../yara/src/definitionProvider";
import { YaraReferenceProvider } from "../yara/src/referenceProvider";
import { CompileRule } from "../yara/src/diagnostics";


let workspace = path.join(__dirname, "..", "..", "test/rules/");
let diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('yara');

suite("YARA: Provider", function () {
    test("rule definition", function (done) {
        const filepath: string = path.join(workspace, "peek_rules.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            const defProvider: vscode.DefinitionProvider = new YaraDefinitionProvider();
            // SyntaxExample: Line 43, Col 14
            // line numbers start at 0, so we have to subtract one for the lookup
            let pos: vscode.Position = new vscode.Position(42, 14);
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let result = defProvider.provideDefinition(doc, pos, tokenSource.token);
            if (result instanceof vscode.Location) {
                let resultWordRange: vscode.Range = doc.getWordRangeAtPosition(result.range.start);
                let resultWord: string = doc.getText(resultWordRange);
                if (resultWord == "SyntaxExample") { done(); }
            }
            else if (result instanceof Array) {
                let resultWordRange: vscode.Range = doc.getWordRangeAtPosition(result[0].range.start);
                let resultWord: string = doc.getText(resultWordRange);
                if (resultWord == "SyntaxExample") { done(); }
            }
            else if (result instanceof Promise) {
                result.then(function (definition) {
                    let resultWordRange: vscode.Range = doc.getWordRangeAtPosition(definition.range.start);
                    let resultWord: string = doc.getText(resultWordRange);
                    if (resultWord == "SyntaxExample" && definition.range.start.line == 5) { done(); }
                });
            }
        });
    });

    test("variable definition", function (done) {
        const filepath: string = path.join(workspace, "peek_rules.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            const defProvider: vscode.DefinitionProvider = new YaraDefinitionProvider();
            // $hex_string: Line 25, Col 14
            // line numbers start at 0, so we have to subtract one for the lookup
            let pos: vscode.Position = new vscode.Position(24, 14);
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let result = defProvider.provideDefinition(doc, pos, tokenSource.token);
            if (result instanceof vscode.Location) {
                let resultWordRange: vscode.Range = doc.getWordRangeAtPosition(result.range.start);
                let resultWord: string = doc.getText(resultWordRange);
                if (resultWord == "hex_string") { done(); }
            }
            else if (result instanceof Array) {
                // Should only get one result, so we've failed if an Array is returned
            }
            else if (result instanceof Promise) {
                result.then(function (definition) {
                    let resultWordRange: vscode.Range = doc.getWordRangeAtPosition(definition.range.start);
                    let resultWord: string = doc.getText(resultWordRange);
                    if (resultWord == "hex_string") { done(); }
                });
            }
        });
    });

    test("symbol references", function (done) {
        const filepath: string = path.join(workspace, "peek_rules.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            const refProvider: vscode.ReferenceProvider = new YaraReferenceProvider();
            // $dstring: Line 22, Col 11
            let pos: vscode.Position = new vscode.Position(21, 11);
            // console.log(`search term: ${doc.getText(doc.getWordRangeAtPosition(pos))}`);
            let ctx: vscode.ReferenceContext | null = null;
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let results = refProvider.provideReferences(doc, pos, ctx, tokenSource.token);
            let passed: boolean = true;
            const acceptableLines: Set<number> = new Set([21, 28, 29]);
            if (results instanceof Array && results.length == 3) {
                results.forEach(reference => {
                    let refWordRange: vscode.Range = doc.getWordRangeAtPosition(reference.range.start);
                    let refWord: string = doc.getText(refWordRange);
                    if (refWord != "dstring" || !acceptableLines.has(reference.range.start.line)) { passed = false; }
                });
                if (passed) { done(); }
            }
            else if (results instanceof Promise) {
                results.then(function (references) {
                    if (references.length != 3) {
                        passed = false;
                    }
                    else {
                        references.forEach(reference => {
                            let refWordRange = doc.getWordRangeAtPosition(reference.range.start);
                            let refWord: string = doc.getText(refWordRange);
                            if (refWord != "dstring" || !acceptableLines.has(reference.range.start.line)) { passed = false; }
                        });
                        if (passed) { done(); }
                    }
                });
            }
        });
    });

    test("wildcard references", function (done) {
        const filepath: string = path.join(workspace, "peek_rules.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            const refProvider: vscode.ReferenceProvider = new YaraReferenceProvider();
            // $hex_*: Line 31, Col 11
            let pos: vscode.Position = new vscode.Position(30, 11);
            // console.log(`search term: ${doc.getText(doc.getWordRangeAtPosition(pos))}`);
            let ctx: vscode.ReferenceContext | null = null;
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let results = refProvider.provideReferences(doc, pos, ctx, tokenSource.token);
            let passed: boolean = true;
            const acceptableLines: Set<number> = new Set([19, 20, 24]);
            if (results instanceof Array && results.length == 3) {
                results.forEach(reference => {
                    let refWordRange: vscode.Range = doc.getWordRangeAtPosition(reference.range.start);
                    let refWord: string = doc.getText(refWordRange);
                    if (!acceptableLines.has(reference.range.start.line)) { passed = false; }
                });
                if (passed) { done(); }
            }
            else if (results instanceof Promise) {
                results.then(function (references) {
                    if (references.length != 3) {
                        passed = false;
                    }
                    else {
                        references.forEach(reference => {
                            let refWordRange = doc.getWordRangeAtPosition(reference.range.start);
                            let refWord: string = doc.getText(refWordRange);
                            if (!acceptableLines.has(reference.range.start.line)) { passed = false; }
                        });
                        if (passed) { done(); }
                    }
                });
            }
        });
    });

    test("code completion", function (done) {
        const filepath: string = path.join(workspace, "code_completion.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            const ccProvider: YaraCompletionItemProvider = new YaraCompletionItemProvider();
            // "cuckoo.": Line 8, Col 12
            let pos: vscode.Position = new vscode.Position(9, 12);
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let items: Thenable<vscode.CompletionItem[] | vscode.CompletionList> | vscode.CompletionItem[] | vscode.CompletionList = ccProvider.provideCompletionItems(doc, pos, tokenSource.token, undefined);
            if (items instanceof Promise) {
                items.then(function (items) {
                    if (items[0].label == "network" || items[0].kind == vscode.CompletionItemKind.Class &&
                        items[1].label == "registry" || items[1].kind == vscode.CompletionItemKind.Class &&
                        items[2].label == "filesystem" || items[2].kind == vscode.CompletionItemKind.Class &&
                        items[3].label == "sync" || items[3].kind == vscode.CompletionItemKind.Class) {
                        done();
                    }
                });
            }
            else if (items instanceof vscode.CompletionList) {
                if (items.items[0].label == "network" || items.items[0].kind == vscode.CompletionItemKind.Class &&
                    items.items[1].label == "registry" || items.items[1].kind == vscode.CompletionItemKind.Class &&
                    items.items[2].label == "filesystem" || items.items[2].kind == vscode.CompletionItemKind.Class &&
                    items.items[3].label == "sync" || items.items[3].kind == vscode.CompletionItemKind.Class) {
                    done();
                }
            }
            else if (items instanceof Array) {
                if (items[0].label == "network" || items[0].kind == vscode.CompletionItemKind.Class &&
                    items[1].label == "registry" || items[1].kind == vscode.CompletionItemKind.Class &&
                    items[2].label == "filesystem" || items[2].kind == vscode.CompletionItemKind.Class &&
                    items[3].label == "sync" || items[3].kind == vscode.CompletionItemKind.Class) {
                    done();
                }
            }
        });
    });

    /*
        Trying to capture $hex_string but not $hex_string2
        Should collect references for:
            $hex_string = { E2 34 ?? C8 A? FB [2-4] }
            $hex_string
        But not:
            $hex_string2 = { F4 23 ( 62 B4 | 56 ) 45 }
    */
    test("issue #17", function (done) {
        const filepath: string = path.join(workspace, "peek_rules.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            let refProvider: vscode.ReferenceProvider = new YaraReferenceProvider();
            // $hex_string: Line 20, Col 11
            let pos: vscode.Position = new vscode.Position(19, 11);
            // console.log(`search term: ${doc.getText(doc.getWordRangeAtPosition(pos))}`);
            let ctx: vscode.ReferenceContext | null = null;
            let tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
            let results = refProvider.provideReferences(doc, pos, ctx, tokenSource.token);
            let passed: boolean = true;
            const acceptableLines: Set<number> = new Set([19, 24, 39, 41]);
            if (results instanceof Array && results.length == 4) {
                results.forEach(reference => {
                    let refWordRange: vscode.Range = doc.getWordRangeAtPosition(reference.range.start);
                    let refWord: string = doc.getText(refWordRange);
                    if (refWord != "hex_string" && acceptableLines.has(reference.range.start.line)) { passed = false; }
                });
                if (passed) { done(); }
            }
            else if (results instanceof Promise) {
                results.then(function (references) {
                    if (references.length != 4) {
                        passed = false;
                    }
                    else {
                        references.forEach(reference => {
                            let refWordRange = doc.getWordRangeAtPosition(reference.range.start);
                            let refWord: string = doc.getText(refWordRange);
                            if (refWord != "hex_string" && acceptableLines.has(reference.range.start.line)) { passed = false; }
                        });
                        if (passed) { done(); }
                    }
                });
            }
        });
    });
});

suite("YARA: Diagnostics", function () {
    test("compile success", function (done) {
        const filepath: string = path.join(workspace, "compile_success.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                if (diagnostics.length == 0) {
                    done();
                }
            });
        });
    });

    test("compile fail", function (done) {
        const filepath: string = path.join(workspace, "compile_fail.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                let passed: boolean = false;
                if (diagnostics.length == 2) {
                    diagnostics.forEach(function (diagnostic) {
                        if (diagnostic.severity == vscode.DiagnosticSeverity.Error) {
                            if (diagnostic.range.start.line == 8 && diagnostic.range.end.line == 8) {
                                passed = true;
                                return;
                            }
                        }
                        passed = false;
                    });
                }
                if (passed) { done(); }
            });
        });
    });

    test("compile warning", function (done) {
        const filepath: string = path.join(workspace, "compile_warn.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                if (diagnostics.length == 1) {
                    if (diagnostics[0].severity == vscode.DiagnosticSeverity.Warning) {
                        if (diagnostics[0].range.start.line == 9 && diagnostics[0].range.end.line == 9) {
                            done();
                        }
                    }
                }
            });
        });
    });
});

suite.skip("YARA: Commands", function () {
    test("CompileRule", function (done) {
        const filepath: string = path.join(workspace, "compile_success.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc: vscode.TextDocument) {
            console.log(`doc: ${JSON.stringify(doc)}`);
            vscode.commands.executeCommand("yara.CompileRule", doc, diagnosticCollection).then(
                function (diagnostics: Array<vscode.Diagnostic>) {
                    console.log(diagnostics);
                    if (diagnostics.length == 0) {
                        done();
                    }
            });
        });
    });
});

suite.skip("YARA: Configuration", function () {
    test("install_path success", function (done) {
        // compile the failed file and make sure the same is returned as if yarac is in the $PATH
        const filepath: string = path.join(workspace, "compile_fail.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", doc.uri);
            const old_install_path: string | null = config.get("install_path");
            // set the install_path to the yarac binary
            config.update("install_path", `${process.env.APPDATA}\\Yara`, null);
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                let passed: boolean = false;
                if (diagnostics.length == 2) {
                    diagnostics.forEach(function (diagnostic) {
                        if (diagnostic.severity == vscode.DiagnosticSeverity.Error) {
                            if (diagnostic.range.start.line == 8 && diagnostic.range.end.line == 8) {
                                passed = true;
                                return;
                            }
                        }
                        passed = false;
                    });
                }
                if (passed) { done(); }
            });
            // reset the install_path
            config.update("install_path", old_install_path, null);
        });
    });

    test("install_path failure", function (done) {
        // set the install_path to the yarac binary
        // compile the failed file and make sure the same is returned as if yarac is in the $PATH
        const filepath: string = path.join(workspace, "compile_fail.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", doc.uri);
            const old_install_path: string | null = config.get("install_path");
            // set the install_path to the yarac binary
            config.update("install_path", `${process.env.APPDATA}\\DoesntExist`, null);
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                // if CompileRule completes then something went wrong
            }).catch(function (error: Error) {
                console.log(error.message);
                // we got the appropriate error. Yay!
                if (error.message == "Cannot compile YARA rule. Please specify an install path") {
                    done();
                }
            });
            // reset the install_path
            config.update("install_path", old_install_path, null);
        });
    });

    test("compile_flags success", function (done) {
        // compile the warnings file and make sure nothing is returned
        const filepath: string = path.join(workspace, "compile_warn.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", doc.uri);
            const old_compile_flags: string | null | Array<string> = config.get("compile_flags");
            // set the compile_flags to exclude warnings
            config.update("compile_flags", "--no-warnings", null).then(function () {
                CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                    if (diagnostics.length == 0) { done(); }
                });
            });
            // reset the compile_flags
            config.update("compile_flags", old_compile_flags, null);
        });
    });

    test("compile_flags failure", function (done) {
        // compile the warnings file with a flag that doesn't exist and make sure VSCode doesn't shit the bed
        const filepath: string = path.join(workspace, "compile_warn.yara");
        vscode.workspace.openTextDocument(filepath).then(function (doc) {
            let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", doc.uri);
            const old_compile_flags: string | null | Array<string> = config.get("compile_flags");
            // set the compile_flags to exclude warnings
            config.update("compile_flags", "--catfacts", false);
            CompileRule(doc, diagnosticCollection).then(function (diagnostics: Array<vscode.Diagnostic>) {
                if (diagnostics.length == 0) { done(); }
            });
            // reset the compile_flags
            config.update("compile_flags", old_compile_flags, false);
        });
    });
});