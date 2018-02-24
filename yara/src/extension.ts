"use strict";

import * as proc from "child_process";
import * as tmp from "tempy";
import * as vscode from "vscode";


// variables have a few possible first characters - use these to identify vars vs. rules
const varFirstChar: Set<string> = new Set(["$", "#", "@", "!"]);
let diagnosticCollection: vscode.DiagnosticCollection;

/*
    Compile the current file in the VSCode workspace as a YARA rule
*/
export function CompileRule(doc: vscode.TextDocument | null) {
    if (!doc) {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Couldn't get the active text editor");
            console.log("Couldn't get the text editor");
            return new Promise((resolve, reject) => { null; });
        }
        doc = editor.document;
    }
    let ofile = tmp.file({ name: "yarac.tmp" });
    let flags = [doc.fileName, ofile];
    let diagnostics: Array<vscode.Diagnostic> = [];

    return new Promise((resolve, reject) => {
        const result: proc.ChildProcess = proc.spawn("yarac", flags);
        // console.log(`Attempting to compile ${doc.fileName}`);
        let errors: string | null = null;
        let diagnostic_errors: number = 0;
        result.stderr.on('data', (data) => {
            data.toString().split("\n").forEach(line => {
                let current: vscode.Diagnostic | null = ParseOutput(line, doc);
                if (current != null) {
                    diagnostics.push(current);
                    if (current.severity == vscode.DiagnosticSeverity.Error) {
                        // track how many Error diagnostics there are to determine if file compiled or not later
                        diagnostic_errors++;
                    }
                }
                else if (line.startsWith("unknown option")) {
                    vscode.window.showErrorMessage(line);
                    console.log(`[Error] ${line}`);
                    errors = line;
                }
            });
        });
        result.on("error", (err) => {
            errors = err.message.endsWith("ENOENT") ? "Cannot compile YARA rule. Please specify an install path" : `Error: ${err.message}`;
            vscode.window.showErrorMessage(errors);
            console.log(`[CompileRuleError] ${errors}`);
            reject(errors);
        });
        result.on("close", (code) => {
            diagnosticCollection.set(vscode.Uri.file(doc.fileName), diagnostics);
            if (diagnostic_errors == 0 && errors == null) {
                // status bar message goes away after 3 seconds
                vscode.window.setStatusBarMessage("File compiled successfully!", 3000);
                // console.log("File compiled successfully!");
            }
            resolve(diagnostics);
        });
    });
}

/*
    Get the start and end boundaries for the current YARA rule based on a symbol's position
*/
function GetRuleRange(lines: string[], symbol: vscode.Position) {
    let begin: vscode.Position | null = null;
    let end: vscode.Position | null = null;
    const startRuleRegexp = RegExp("^rule ");
    const endRuleRegexp = RegExp("^\}");
    // find the nearest reference to "rule" by traversing the lines in reverse order
    for (let lineNo = symbol.line; lineNo >= 0; lineNo--) {
        if (startRuleRegexp.test(lines[lineNo])) {
            begin = new vscode.Position(lineNo, 0);
            break;
        }
    }
    // start up this loop again using the beginning of the rule
    // and find the line with just a curly brace to identify the end of a rule
    for (let lineNo = begin.line; lineNo < lines.length; lineNo++) {
        if (endRuleRegexp.test(lines[lineNo])) {
            end = new vscode.Position(lineNo, 0);
            break;
        }
    }
    return new vscode.Range(begin, end);
}

/*
    Parse YARA STDERR output and create Diagnostics for the window
    :line: The YARA command's current output line
    :doc: The current workspace document to draw diagnostics data on

    yara.exe .\test\rules\compile_fail.yara .\file.txt
    .\test\rules\compile_fail.yara(9): error: unterminated string
    .\test\rules\compile_fail.yara(9): error: syntax error, unexpected $end, expecting _TEXT_STRING_

    yara.exe .\test\rules\compile_warn.yara .\file.txt
    .\test\rules\compile_warn.yara(10): warning: Using deprecated "entrypoint" keyword. Use the "entry_point" function from PE module instead.
*/
function ParseOutput(line: string, doc: vscode.TextDocument) {
    try {
        // regex to match line number in resulting YARAC output
        const pattern: RegExp = RegExp("\\([0-9]+\\)");
        let parsed: Array<string> = line.trim().split(": ");
        let matches: RegExpExecArray = pattern.exec(parsed[0]);
        let severity: vscode.DiagnosticSeverity = parsed[1] == "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
        if (matches != null) {
            // remove the surrounding parentheses
            let line_no: number = parseInt(matches[0].replace("(", "").replace(")", "")) - 1;
            let start: vscode.Position = new vscode.Position(line_no, doc.lineAt(line_no).firstNonWhitespaceCharacterIndex);
            let end: vscode.Position = new vscode.Position(line_no, Number.MAX_VALUE);
            let line_range: vscode.Range = new vscode.Range(start, end);
            return new vscode.Diagnostic(line_range, parsed.pop(), severity);
        }
        return null;
    }
    catch (error) {
        vscode.window.showErrorMessage(error);
        console.log(`[ConvertStderrToDiagnosticError] ${error}`);
        return null;
    }
}

export class YaraDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(doc: vscode.TextDocument, pos: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
        return new Promise((resolve, reject) => {
            let definition: vscode.Location | null = null;
            const fileUri: vscode.Uri = vscode.Uri.file(doc.fileName);
            const range: vscode.Range = doc.getWordRangeAtPosition(pos);
            const symbol: string = doc.getText(range);
            // console.log(`Providing definition for symbol '${symbol}'`);
            let possibleVarStart: vscode.Position = new vscode.Position(range.start.line, range.start.character - 1);
            let possibleVarRange: vscode.Range = new vscode.Range(possibleVarStart, range.end);
            let possibleVar: string = doc.getText(possibleVarRange);
            const lines: string[] = doc.getText().split("\n");
            if (varFirstChar.has(possibleVar.charAt(0))) {
                // console.log(`Variable detected: ${possibleVar}`);
                let currentRuleRange: vscode.Range = GetRuleRange(lines, pos);
                // console.log(`Curr rule range: ${currentRuleRange.start.line+1} -> ${currentRuleRange.end.line+1}`);
                for (let lineNo = currentRuleRange.start.line; lineNo < currentRuleRange.end.line; lineNo++) {
                    let character: number = lines[lineNo].indexOf(`$${symbol} =`);
                    if (character != -1) {
                        // console.log(`Found defintion of '${possibleVar}' on line ${lineNo + 1} at character ${character + 1}`);
                        // gotta add one because VSCode won't recognize the '$' as part of the symbol
                        let defPosition: vscode.Position = new vscode.Position(lineNo, character + 1);
                        definition = new vscode.Location(fileUri, defPosition);
                        break;
                    }
                }
            }
            else {
                for (let lineNo = 0; lineNo < pos.line; lineNo++) {
                    let character: number = lines[lineNo].indexOf(symbol);
                    if (character != -1 && lines[lineNo].startsWith("rule")) {
                        // console.log(`Found ${symbol} on line ${lineNo} at character ${character}`);
                        let defPosition: vscode.Position = new vscode.Position(lineNo, character);
                        definition = new vscode.Location(fileUri, defPosition);
                        break;
                    }
                }
            }
            if (definition != null) {
                resolve(definition);
            }
            else {
                reject();
            }
        });
    }
}

export class YaraReferenceProvider implements vscode.ReferenceProvider {
    public provideReferences(doc: vscode.TextDocument, pos: vscode.Position, options: { includeDeclaration: boolean }, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        return new Promise((resolve, reject) => {
            const fileUri: vscode.Uri = vscode.Uri.file(doc.fileName);
            const range: vscode.Range = doc.getWordRangeAtPosition(pos);
            let lines: string[] = doc.getText().split("\n");
            let references: vscode.Location[] = new Array<vscode.Location>();
            let symbol: string = doc.getText(range);
            // console.log(`Providing references for symbol '${symbol}'`);
            let possibleVarStart: vscode.Position = new vscode.Position(range.start.line, range.start.character - 1);
            let possibleVarRange: vscode.Range = new vscode.Range(possibleVarStart, range.end);
            let possibleVar: string = doc.getText(possibleVarRange);
            if (varFirstChar.has(possibleVar.charAt(0))) {
                // console.log(`Identified symbol as a variable: ${symbol}`);
                let lineNo = 0;
                lines.forEach(line => {
                    let character: number = line.search(`[\$#@!]${symbol}[^a-zA-Z0-9_]`);
                    if (character != -1) {
                        // console.log(`Found ${symbol} on line ${lineNo} at character ${character}`);
                        // have to readjust the character index
                        let refPosition: vscode.Position = new vscode.Position(lineNo, character + 1);
                        references.push(new vscode.Location(fileUri, refPosition));
                    }
                    lineNo++;
                });
            }
            else {
                let lineNo = 0;
                lines.forEach(line => {
                    let character: number = line.indexOf(symbol);
                    if (character != -1) {
                        // console.log(`Found ${symbol} on line ${lineNo} at character ${character}`);
                        let refPosition: vscode.Position = new vscode.Position(lineNo, character);
                        references.push(new vscode.Location(fileUri, refPosition));
                    }
                    lineNo++;
                });
            }
            if (references != null) {
                resolve(references);
            }
            else {
                reject();
            }
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    // console.log("Activating Yara extension");
    let YARA: vscode.DocumentSelector = { language: "yara", scheme: "file" };
    let definitionDisposable: vscode.Disposable = vscode.languages.registerDefinitionProvider(YARA, new YaraDefinitionProvider());
    let referenceDisposable: vscode.Disposable = vscode.languages.registerReferenceProvider(YARA, new YaraReferenceProvider());
    let saveSubscription = vscode.workspace.onDidSaveTextDocument(() => { CompileRule(null) });
    diagnosticCollection = vscode.languages.createDiagnosticCollection('yara');
    context.subscriptions.push(definitionDisposable);
    context.subscriptions.push(referenceDisposable);
    context.subscriptions.push(saveSubscription);
    context.subscriptions.push(diagnosticCollection);
};

export function deactivate(context: vscode.ExtensionContext) {
    // console.log("Deactivating Yara extension");
    context.subscriptions.forEach(disposable => {
        disposable.dispose();
    });
};
