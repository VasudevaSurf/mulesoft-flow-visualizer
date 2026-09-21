"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceScanner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Scans the workspace to find Mule XML files and locate the nearest pom.xml for a given Mule XML file.
 */
class WorkspaceScanner {
    /**
     * Checks if a file is a Mule XML file by checking for <mule root element.
     */
    static isMuleXml(content) {
        const trimmed = content.trim();
        // Quick regex check for <mule or <mule:mule with xml namespace
        return /<([a-zA-Z0-9_-]+:)?mule[\s>]/.test(trimmed) &&
            (trimmed.includes('http://www.mulesoft.org/schema/mule/core') || trimmed.includes('xmlns="http://www.mulesoft.org/schema/mule/core"'));
    }
    /**
     * Finds all Mule XML files in the workspace.
     */
    static async findMuleXmlFiles() {
        const xmlUris = await vscode.workspace.findFiles('**/*.xml', '**/target/**');
        const muleFiles = [];
        for (const uri of xmlUris) {
            try {
                const doc = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(doc).toString('utf-8');
                if (this.isMuleXml(text)) {
                    muleFiles.push(uri);
                }
            }
            catch {
                // Skip unreadable files
            }
        }
        return muleFiles;
    }
    /**
     * Finds the nearest pom.xml by walking up the directory tree from the given Mule XML file path.
     */
    static findNearestPom(xmlFilePath) {
        let currentDir = path.dirname(xmlFilePath);
        const root = path.parse(currentDir).root;
        while (currentDir && currentDir !== root) {
            const pomPath = path.join(currentDir, 'pom.xml');
            if (fs.existsSync(pomPath)) {
                return pomPath;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break;
            }
            currentDir = parentDir;
        }
        return null;
    }
}
exports.WorkspaceScanner = WorkspaceScanner;
//# sourceMappingURL=scanner.js.map