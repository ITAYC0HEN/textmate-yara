"use strict";

import * as path from "path";
import * as vscode from "vscode";


const schema_path = path.join(__dirname, "..", "..", "..", "yara/src/modules_schema.json");
const schema: Object = require(schema_path);

// provide completion for YARA modules
// will have to be static until I can figure out a better method
export const modules = {
    possibleModules: function (doc: vscode.TextDocument): Array<string> {
        const importRegexp: RegExp = RegExp("^import \"(pe|elf|cuckoo|magic|hash|math|dotnet|time)\"\r$");
        let results: Array<string> = [];
        doc.getText().split("\n").forEach(line => {
            if (importRegexp.test(line)) {
                results.push(line.split("\"")[1]);
            }
        });
        return results;
    },
    get: function (doc: vscode.TextDocument, pos: vscode.Position, require_imports): null | (string | vscode.CompletionItemKind)[][] {
        let parsed: Array<string> = doc.lineAt(pos).text.split(" ");
        let symbols: Array<string> = parsed[parsed.length - 1].split(".");
        if (require_imports) {
            const filter: Array<string> = this.possibleModules(doc);
            if (filter.indexOf(symbols[0]) > -1) {
                // start at top level to make sure every symbol can be traced back to a module
                return parseSchema(symbols, schema, 0);
            }
            else { return null; }
        }
        else {
            // start at top level to make sure every symbol can be traced back to a module
            return parseSchema(symbols, schema, 0);
        }
    }
}

function parseSchema(symbols: Array<string>, schema: Object, depth: number): null | (string | vscode.CompletionItemKind)[][] {
    let items: null | (string | vscode.CompletionItemKind)[][] = [];
    let current_symbol: string = symbols[depth];
    if (depth == symbols.length - 1) {
        for (const key in schema) {
            const value: string = schema[key];
            let kind_type = vscode.CompletionItemKind.Class;
            if (value == "enum") { kind_type = vscode.CompletionItemKind.Enum; }
            else if (value == "property") { kind_type = vscode.CompletionItemKind.Property; }
            else if (value == "method") { kind_type = vscode.CompletionItemKind.Method; }
            items.push([key, kind_type]);
        }
    }
    else if (schema.hasOwnProperty(current_symbol)) {
        let child: any = schema[current_symbol];
        if (child instanceof Object) {
            items = parseSchema(symbols, child, depth + 1);
        }
    }
    return items;
}

export class YaraCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        return new Promise((resolve, reject) => {
            if (context == undefined || context.triggerCharacter == ".") {
                let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("yara");
                let items: vscode.CompletionItem[] = Array<vscode.CompletionItem>();
                let fields: any = modules.get(doc, pos, config.get("require_imports", false));
                if (fields != null) {
                    fields.forEach(field => {
                        items.push(new vscode.CompletionItem(field[0], field[1]));
                    });
                    resolve(items);
                }
            }
            reject();
        });
    }
/*
    public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        return new Promise((resolve, reject) => {
            console.log(`resolving ${JSON.stringify(item)}`);
            resolve(item);
        });
    }
*/
}
