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
exports.MavenRepo = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fast_xml_parser_1 = require("fast-xml-parser");
class MavenRepo {
    constructor(customPath) {
        this.localRepoPath = this.detectLocalRepo(customPath);
    }
    /**
     * Returns the resolved local repository path.
     */
    getLocalRepoPath() {
        return this.localRepoPath;
    }
    /**
     * Resolves the full path to the jar for a given Maven dependency.
     * Format: <localRepo>/<groupId as path>/<artifactId>/<version>/<artifactId>-<version>-<classifier>.jar
     * or <artifactId>-<version>.jar
     */
    resolveJarPath(dep) {
        const groupPath = dep.groupId.replace(/\./g, path.sep);
        const artifactDir = path.join(this.localRepoPath, groupPath, dep.artifactId, dep.version);
        if (!fs.existsSync(artifactDir)) {
            return null;
        }
        // Try with classifier first, e.g. artifactId-version-mule-plugin.jar
        if (dep.classifier) {
            const jarWithClassifier = path.join(artifactDir, `${dep.artifactId}-${dep.version}-${dep.classifier}.jar`);
            if (fs.existsSync(jarWithClassifier)) {
                return jarWithClassifier;
            }
        }
        // Fall back to standard jar name: artifactId-version.jar
        const standardJar = path.join(artifactDir, `${dep.artifactId}-${dep.version}.jar`);
        if (fs.existsSync(standardJar)) {
            return standardJar;
        }
        return null;
    }
    /**
     * Discovers installed Mule plugin jars in the local repository under org/mule/connectors and org/mule/modules.
     */
    findInstalledMulePlugins() {
        const results = [];
        const searchRoots = [
            path.join(this.localRepoPath, 'org', 'mule', 'connectors'),
            path.join(this.localRepoPath, 'org', 'mule', 'modules'),
        ];
        for (const root of searchRoots) {
            if (!fs.existsSync(root))
                continue;
            this.scanDirectoryForPlugins(root, results);
        }
        return results;
    }
    scanDirectoryForPlugins(dir, results, depth = 0) {
        if (depth > 4)
            return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    this.scanDirectoryForPlugins(fullPath, results, depth + 1);
                }
                else if (entry.name.endsWith('-mule-plugin.jar')) {
                    // e.g. mule-http-connector-1.11.1-mule-plugin.jar
                    const match = entry.name.match(/^(.+)-(\d+\.\d+[\w.-]*)-mule-plugin\.jar$/);
                    if (match) {
                        const artifactId = match[1];
                        const version = match[2];
                        const isModule = fullPath.includes(`${path.sep}modules${path.sep}`);
                        const groupId = isModule ? 'org.mule.modules' : 'org.mule.connectors';
                        results.push({
                            dep: {
                                groupId,
                                artifactId,
                                version,
                                classifier: 'mule-plugin',
                            },
                            jarPath: fullPath,
                        });
                    }
                }
            }
        }
        catch {
            // Ignore read errors
        }
    }
    detectLocalRepo(customPath) {
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }
        // Check MAVEN_REPO or M2_REPO environment variable
        if (process.env.M2_REPO && fs.existsSync(process.env.M2_REPO)) {
            return process.env.M2_REPO;
        }
        if (process.env.MAVEN_REPO && fs.existsSync(process.env.MAVEN_REPO)) {
            return process.env.MAVEN_REPO;
        }
        const homeDir = os.homedir();
        const settingsPath = path.join(homeDir, '.m2', 'settings.xml');
        if (fs.existsSync(settingsPath)) {
            try {
                const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: true, trimValues: true });
                const parsed = parser.parse(fs.readFileSync(settingsPath, 'utf-8'));
                const configuredRepo = parsed.settings?.localRepository;
                if (configuredRepo && typeof configuredRepo === 'string' && fs.existsSync(configuredRepo)) {
                    return configuredRepo;
                }
            }
            catch {
                // Fallback to default
            }
        }
        return path.join(homeDir, '.m2', 'repository');
    }
}
exports.MavenRepo = MavenRepo;
//# sourceMappingURL=mavenRepo.js.map