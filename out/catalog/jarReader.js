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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JarReader = void 0;
const fs = __importStar(require("fs"));
const jszip_1 = __importDefault(require("jszip"));
const xsdClassifier_1 = require("./xsdClassifier");
const iconStore_1 = require("./iconStore");
class JarReader {
    /**
     * Reads a mule-plugin jar file and extracts its XSD descriptors, icon, and artifact metadata.
     */
    static async readJar(jarPath, groupId, artifactId, version) {
        if (!fs.existsSync(jarPath)) {
            return null;
        }
        try {
            const buffer = fs.readFileSync(jarPath);
            const zip = await jszip_1.default.loadAsync(buffer);
            const iconId = `${groupId}:${artifactId}`;
            // 1. Read mule-artifact.json if present
            let extensionDisplayName = artifactId;
            const artifactJsonFile = zip.file('META-INF/mule-artifact/mule-artifact.json');
            if (artifactJsonFile) {
                try {
                    const jsonStr = await artifactJsonFile.async('string');
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.name) {
                        extensionDisplayName = parsed.name;
                    }
                }
                catch {
                    // Ignore json parse error
                }
            }
            // 2. Read connector icon (META-INF/mule-artifact/icon.svg, icon/icon.svg, etc.)
            let foundIcon = false;
            const iconFile = zip.file('META-INF/mule-artifact/icon.svg') ||
                zip.file('icon/icon.svg') ||
                zip.file('icon.svg') ||
                zip.file('META-INF/icon.svg');
            if (iconFile) {
                try {
                    const rawSvg = await iconFile.async('string');
                    iconStore_1.IconStore.sanitizeSvg(rawSvg, iconId);
                    foundIcon = true;
                }
                catch (e) {
                    console.warn(`Failed reading icon from ${jarPath}:`, e);
                }
            }
            // If no icon found, search for any .svg in the jar
            if (!foundIcon) {
                const svgEntries = zip.file(/\.svg$/i);
                const bestSvg = svgEntries.find((f) => f.name.toLowerCase().includes('icon')) || svgEntries[0];
                if (bestSvg) {
                    try {
                        const rawSvg = await bestSvg.async('string');
                        iconStore_1.IconStore.sanitizeSvg(rawSvg, iconId);
                        foundIcon = true;
                    }
                    catch {
                        // Ignore
                    }
                }
            }
            // Fall back to generic connector or unknown icon if none present in jar
            if (!foundIcon) {
                // We will fallback to core:generic-operation icon at render time if needed
            }
            // 3. Find and parse XSD files in META-INF/
            const xsdFiles = zip.file(/META-INF\/.*\.xsd$/i);
            const allDescriptors = [];
            let detectedNamespaceUri;
            for (const xsdZipEntry of xsdFiles) {
                try {
                    const xsdContent = await xsdZipEntry.async('string');
                    const result = xsdClassifier_1.XsdClassifier.classifyXsd(xsdContent, iconId);
                    if (result && result.descriptors.length > 0) {
                        detectedNamespaceUri = result.namespaceUri;
                        allDescriptors.push(...result.descriptors);
                    }
                }
                catch (e) {
                    console.warn(`Failed parsing XSD ${xsdZipEntry.name} in ${jarPath}:`, e);
                }
            }
            return {
                groupId,
                artifactId,
                version,
                name: extensionDisplayName,
                namespaceUri: detectedNamespaceUri,
                iconId,
                descriptors: allDescriptors,
            };
        }
        catch (e) {
            console.error(`Failed to read jar ${jarPath}:`, e);
            return null;
        }
    }
}
exports.JarReader = JarReader;
//# sourceMappingURL=jarReader.js.map