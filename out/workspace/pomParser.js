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
exports.PomParser = void 0;
const fs = __importStar(require("fs"));
const fast_xml_parser_1 = require("fast-xml-parser");
class PomParser {
    /**
     * Parses a pom.xml and extracts all dependencies with <classifier>mule-plugin</classifier>.
     */
    static parse(pomPath) {
        if (!fs.existsSync(pomPath)) {
            return [];
        }
        try {
            const xmlContent = fs.readFileSync(pomPath, 'utf-8');
            const parsed = this.parser.parse(xmlContent);
            const project = parsed.project;
            if (!project) {
                return [];
            }
            // Collect properties
            const properties = {};
            if (project.properties && typeof project.properties === 'object') {
                for (const [key, val] of Object.entries(project.properties)) {
                    if (typeof val === 'string' || typeof val === 'number') {
                        properties[key] = String(val);
                    }
                }
            }
            // Built-in / project properties
            if (project.groupId) {
                properties['project.groupId'] = String(project.groupId);
            }
            if (project.artifactId) {
                properties['project.artifactId'] = String(project.artifactId);
            }
            if (project.version) {
                properties['project.version'] = String(project.version);
            }
            else if (project.parent?.version) {
                properties['project.version'] = String(project.parent.version);
            }
            // Collect managed dependencies from dependencyManagement
            const managedDeps = new Map(); // key: groupId:artifactId -> version
            const depMgmt = project.dependencyManagement?.dependencies?.dependency;
            if (depMgmt) {
                const rawList = Array.isArray(depMgmt) ? depMgmt : [depMgmt];
                for (const d of rawList) {
                    if (d.groupId && d.artifactId && d.version) {
                        const gid = this.resolveValue(String(d.groupId), properties);
                        const aid = this.resolveValue(String(d.artifactId), properties);
                        const ver = this.resolveValue(String(d.version), properties);
                        managedDeps.set(`${gid}:${aid}`, ver);
                    }
                }
            }
            // Collect project dependencies
            const rawDeps = project.dependencies?.dependency;
            if (!rawDeps) {
                return [];
            }
            const depList = Array.isArray(rawDeps) ? rawDeps : [rawDeps];
            const mulePlugins = [];
            for (const d of depList) {
                const classifier = d.classifier ? this.resolveValue(String(d.classifier), properties) : undefined;
                // In Mule 4, connectors are declared with <classifier>mule-plugin</classifier>
                if (classifier !== 'mule-plugin') {
                    continue;
                }
                const groupId = this.resolveValue(String(d.groupId || ''), properties);
                const artifactId = this.resolveValue(String(d.artifactId || ''), properties);
                let version = d.version ? this.resolveValue(String(d.version), properties) : undefined;
                if (!version) {
                    version = managedDeps.get(`${groupId}:${artifactId}`);
                }
                if (groupId && artifactId && version) {
                    mulePlugins.push({
                        groupId,
                        artifactId,
                        version,
                        classifier: 'mule-plugin',
                        type: d.type ? this.resolveValue(String(d.type), properties) : 'jar'
                    });
                }
            }
            return mulePlugins;
        }
        catch (e) {
            console.error(`Failed to parse pom.xml at ${pomPath}:`, e);
            return [];
        }
    }
    static resolveValue(val, properties) {
        return val.replace(/\$\{([^}]+)\}/g, (match, propName) => {
            return properties[propName] ?? match;
        });
    }
}
exports.PomParser = PomParser;
PomParser.parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
});
//# sourceMappingURL=pomParser.js.map