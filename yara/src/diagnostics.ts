"use strict";

import * as proc from "child_process";
import * as tmp from "tempy";
import * as vscode from "vscode";


/*
    Compile the current file in the VSCode workspace as a YARA rule
    :doc: The current workspace document to draw diagnostics data on
    :diagnosticCollection: Set of diagnostics data for VSCode to draw on the screen
*/
export function CompileRule(doc: vscode.TextDocument | null, diagnosticCollection: vscode.DiagnosticCollection) {
    if (!doc) {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Couldn't get the active text editor");
            // console.log("Couldn't get the text editor");
            return new Promise((resolve, reject) => { reject(null); });
        }
        doc = editor.document;
    }
    if (doc.languageId != "yara") {
        return new Promise((resolve, reject) => { reject(null); });
    }
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara", doc.uri);
    // use user's installation path if one exists, else assume "yarac" is available in the $PATH
    const compilerPath: string = config.get("install_path") !== null ? `${config.get("install_path")}/yarac` : "yarac";
    const compileFlags: string | null | Array<string> = config.get("compile_flags");
    const ofile = tmp.file({ extension: "yarac" });
    let flags: Array<string>;
    if (compileFlags && typeof compileFlags === "string") {
        flags = [compileFlags, doc.fileName, ofile];
    }
    else if (compileFlags && compileFlags instanceof Array) {
        flags = [compileFlags.join(" "), doc.fileName, ofile];
    }
    else {
        flags = [doc.fileName, ofile];
    }
    let diagnostics: Array<vscode.Diagnostic> = [];

    return new Promise((resolve, reject) => {
        const result: proc.ChildProcess = proc.spawn(compilerPath, flags);
        // console.log(`Attempting to compile ${doc.fileName} with flags: ${flags}`);
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
                    vscode.window.showErrorMessage(`YARA Compile Flags: ${line}`);
                    // console.log(`[YARA Compile Flags] ${line}`);
                    reject(line);
                }
            });
        });
        result.on("error", (err) => {
            errors = err.message.endsWith("ENOENT") ? "Cannot compile YARA rule. Please specify an install path and reload the window" : `YARA Error: ${err.message}`;
            vscode.window.showErrorMessage(errors);
            // set indefinitely
            vscode.window.setStatusBarMessage("yarac not installed");
            reject(errors);
        });
        result.on("close", (code) => {
            if (diagnostic_errors == 0 && errors == null) {
                // status bar message goes away after 3 seconds
                vscode.window.setStatusBarMessage("File compiled successfully!", 3000);
                // console.log("File compiled successfully!");
            }
            diagnosticCollection.set(vscode.Uri.file(doc.fileName), diagnostics);
            resolve(diagnostics);
        });
    });
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
        // console.log(error);
        return null;
    }
}
