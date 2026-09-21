import { MavenDependency } from './pomParser';
export declare class MavenRepo {
    private localRepoPath;
    constructor(customPath?: string | null);
    /**
     * Returns the resolved local repository path.
     */
    getLocalRepoPath(): string;
    /**
     * Resolves the full path to the jar for a given Maven dependency.
     * Format: <localRepo>/<groupId as path>/<artifactId>/<version>/<artifactId>-<version>-<classifier>.jar
     * or <artifactId>-<version>.jar
     */
    resolveJarPath(dep: MavenDependency): string | null;
    /**
     * Discovers installed Mule plugin jars in the local repository under org/mule/connectors and org/mule/modules.
     */
    findInstalledMulePlugins(): {
        dep: MavenDependency;
        jarPath: string;
    }[];
    private scanDirectoryForPlugins;
    private detectLocalRepo;
}
//# sourceMappingURL=mavenRepo.d.ts.map