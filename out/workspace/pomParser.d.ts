export interface MavenDependency {
    groupId: string;
    artifactId: string;
    version: string;
    classifier?: string;
    type?: string;
}
export declare class PomParser {
    private static parser;
    /**
     * Parses a pom.xml and extracts all dependencies with <classifier>mule-plugin</classifier>.
     */
    static parse(pomPath: string): MavenDependency[];
    private static resolveValue;
}
//# sourceMappingURL=pomParser.d.ts.map