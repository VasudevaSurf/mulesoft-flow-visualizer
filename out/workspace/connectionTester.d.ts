export interface TestConnectionResult {
    success: boolean;
    message: string;
    durationMs?: number;
}
/**
 * Genuinely checks network connectivity for configurations (HTTP requests, raw TCP sockets)
 * without using mocked or fake results.
 */
export declare class ConnectionTester {
    /**
     * Determines if a configuration's protocol and parameters can be genuinely tested.
     * If not genuine (e.g. cloud tokens, opaque runtimes, local files), returns false to omit the button.
     */
    static canTest(attributes: Record<string, any>, namespaceUri?: string, localName?: string): boolean;
    /**
     * Performs an authentic connection test.
     */
    static test(attributes: Record<string, any>, namespaceUri?: string, localName?: string): Promise<TestConnectionResult>;
    private static extractJdbcHostPort;
    private static findHost;
    private static findPort;
    private static findUrl;
    private static testHttp;
    private static testTcp;
}
//# sourceMappingURL=connectionTester.d.ts.map