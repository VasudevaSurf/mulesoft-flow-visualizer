import * as path from 'path';
import * as fs from 'fs';
import Module from 'module';

export const mockDocuments = new Map<string, string>();

export class MockPosition {
  constructor(public line: number, public character: number) {}
}

export class MockRange {
  constructor(public start: MockPosition, public end: MockPosition) {}
}

export class MockWorkspaceEdit {
  public edits: Array<any> = [];
  replace(uri: any, range: MockRange, text: string) {
    this.edits.push({ type: 'replace', uri, range, text });
  }
  insert(uri: any, pos: MockPosition, text: string) {
    this.edits.push({ type: 'insert', uri, pos, text });
  }
  delete(uri: any, range: MockRange) {
    this.edits.push({ type: 'delete', uri, range });
  }
}

export const mockVscode: any = {
  Uri: {
    file: (f: string) => ({
      fsPath: path.resolve(f),
      toString: () => path.resolve(f),
    }),
    joinPath: (base: any, ...parts: string[]) => ({
      fsPath: path.resolve(base.fsPath || base, ...parts),
      toString: () => path.resolve(base.fsPath || base, ...parts),
    }),
  },
  Range: MockRange,
  Position: MockPosition,
  WorkspaceEdit: MockWorkspaceEdit,
  ViewColumn: {
    One: 1,
    Beside: 2,
  },
  window: {
    activeTextEditor: undefined as any,
    showErrorMessage: () => {},
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    createOutputChannel: () => ({ appendLine: () => {} }),
    onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    createWebviewPanel: () => ({
      webview: {
        html: '',
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: () => Promise.resolve(true),
        asWebviewUri: (uri: any) => uri,
      },
      reveal: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
      dispose: () => {},
      title: '',
    }),
  },
  workspace: {
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    getConfiguration: () => ({ get: () => undefined }),
    openTextDocument: async (uri: any) => {
      const filePath = uri.fsPath || uri;
      const text = mockDocuments.has(filePath)
        ? mockDocuments.get(filePath)!
        : (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      const lines = text.split(/\r?\n/);
      return {
        uri: typeof uri === 'string' ? mockVscode.Uri.file(uri) : uri,
        lineCount: lines.length,
        lineAt: (lineNum: number) => {
          const lineText = lines[lineNum] ?? '';
          return {
            text: lineText,
            range: new MockRange(
              new MockPosition(lineNum, 0),
              new MockPosition(lineNum, lineText.length)
            ),
          };
        },
        getText: (range?: MockRange) => {
          if (!range) return text;
          if (range.start.line === range.end.line) {
            return (lines[range.start.line] ?? '').substring(range.start.character, range.end.character);
          }
          let res = (lines[range.start.line] ?? '').substring(range.start.character) + '\n';
          for (let l = range.start.line + 1; l < range.end.line; l++) {
            res += (lines[l] ?? '') + '\n';
          }
          res += (lines[range.end.line] ?? '').substring(0, range.end.character);
          return res;
        },
        positionAt: (offset: number) => {
          const sub = text.substring(0, offset);
          const subLines = sub.split(/\r?\n/);
          return new MockPosition(subLines.length - 1, subLines[subLines.length - 1].length);
        },
        offsetAt: (pos: MockPosition) => {
          let offset = 0;
          for (let l = 0; l < pos.line; l++) {
            offset += (lines[l] ?? '').length + 1;
          }
          return offset + pos.character;
        },
        save: async () => true,
      };
    },
    applyEdit: async (edit: MockWorkspaceEdit) => {
      for (const e of edit.edits) {
        const filePath = e.uri.fsPath || e.uri;
        let docText = mockDocuments.has(filePath)
          ? mockDocuments.get(filePath)!
          : (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
        const lines = docText.split(/\r?\n/);
        const getOffset = (pos: MockPosition) => {
          let off = 0;
          for (let l = 0; l < pos.line; l++) off += (lines[l] ?? '').length + 1;
          return off + pos.character;
        };

        if (e.type === 'replace') {
          const start = getOffset(e.range.start);
          const end = getOffset(e.range.end);
          docText = docText.substring(0, start) + e.text + docText.substring(end);
        } else if (e.type === 'insert') {
          const pos = getOffset(e.pos);
          docText = docText.substring(0, pos) + e.text + docText.substring(pos);
        } else if (e.type === 'delete') {
          const start = getOffset(e.range.start);
          const end = getOffset(e.range.end);
          docText = docText.substring(0, start) + docText.substring(end);
        }
        mockDocuments.set(filePath, docText);
        if (fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, docText, 'utf-8');
        }
      }
      return true;
    },
  },
};

// Hook require for vscode
const origRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return origRequire.apply(this, arguments);
};
