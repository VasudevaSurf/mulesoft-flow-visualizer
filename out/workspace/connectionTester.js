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
exports.ConnectionTester = void 0;
const net = __importStar(require("net"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
/**
 * Genuinely checks network connectivity for configurations (HTTP requests, raw TCP sockets)
 * without using mocked or fake results.
 */
class ConnectionTester {
    /**
     * Determines if a configuration's protocol and parameters can be genuinely tested.
     * If not genuine (e.g. cloud tokens, opaque runtimes, local files), returns false to omit the button.
     */
    static canTest(attributes, namespaceUri, localName) {
        const urlStr = this.findUrl(attributes);
        if (urlStr) {
            if (urlStr.includes('${') || urlStr.includes('#[')) {
                return false;
            }
            if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
                return true;
            }
            const jdbcHostPort = this.extractJdbcHostPort(urlStr);
            if (jdbcHostPort !== null) {
                return true;
            }
            return false;
        }
        const host = this.findHost(attributes);
        if (host) {
            if (host.includes('${') || host.includes('#[')) {
                return false;
            }
            const port = this.findPort(attributes, namespaceUri, localName);
            return port !== null && port > 0;
        }
        return false;
    }
    /**
     * Performs an authentic connection test.
     */
    static async test(attributes, namespaceUri, localName) {
        const urlStr = this.findUrl(attributes);
        if (urlStr) {
            try {
                const u = new url_1.URL(urlStr);
                if (u.protocol === 'http:' || u.protocol === 'https:') {
                    return this.testHttp(urlStr);
                }
            }
            catch {
                const jdbc = this.extractJdbcHostPort(urlStr);
                if (jdbc) {
                    return this.testTcp(jdbc.host, jdbc.port);
                }
            }
        }
        const host = this.findHost(attributes);
        const port = this.findPort(attributes, namespaceUri, localName);
        if (!host || !port) {
            return {
                success: false,
                message: 'Missing host or port required for connection test.',
            };
        }
        // For local listener binds (0.0.0.0), test loopback interface 127.0.0.1
        const targetHost = host === '0.0.0.0' ? '127.0.0.1' : host;
        return this.testTcp(targetHost, port);
    }
    static extractJdbcHostPort(urlStr) {
        if (!urlStr || typeof urlStr !== 'string')
            return null;
        if (urlStr.includes('${') || urlStr.includes('#['))
            return null;
        const match = urlStr.match(/(?:jdbc:[a-zA-Z0-9_-]+:\/\/|\/\/)([a-zA-Z0-9.-]+)(?::([0-9]+))?/i);
        if (match && match[1]) {
            const host = match[1];
            const port = match[2] ? parseInt(match[2], 10) : 3306;
            return { host, port };
        }
        return null;
    }
    static findHost(attributes) {
        const candidates = ['host', 'hostname', 'server', 'address', 'hostName', 'ip'];
        for (const key of candidates) {
            const val = attributes[key];
            if (val && typeof val === 'string' && val.trim()) {
                return val.trim();
            }
        }
        // Check if url contains host
        const urlVal = attributes['url'] || attributes['baseUri'];
        if (typeof urlVal === 'string') {
            const jdbc = this.extractJdbcHostPort(urlVal);
            if (jdbc)
                return jdbc.host;
        }
        return null;
    }
    static findPort(attributes, namespaceUri, localName) {
        const candidates = ['port', 'portNumber'];
        for (const key of candidates) {
            const val = attributes[key];
            if (val !== undefined && val !== null) {
                const p = parseInt(String(val), 10);
                if (!isNaN(p) && p > 0)
                    return p;
            }
        }
        const urlVal = attributes['url'] || attributes['baseUri'];
        if (typeof urlVal === 'string') {
            const jdbc = this.extractJdbcHostPort(urlVal);
            if (jdbc)
                return jdbc.port;
        }
        const lowerLocal = (localName || '').toLowerCase();
        const lowerNs = (namespaceUri || '').toLowerCase();
        if (lowerLocal.includes('listener') || lowerNs.includes('http')) {
            const protocol = String(attributes['protocol'] || 'HTTP').toUpperCase();
            return protocol === 'HTTPS' ? 443 : 8081;
        }
        if (lowerNs.includes('db') || lowerLocal.includes('db')) {
            return 3306;
        }
        return null;
    }
    static findUrl(attributes) {
        const candidates = ['url', 'baseUri', 'uri', 'address'];
        for (const key of candidates) {
            const val = attributes[key];
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('jdbc:')) {
                    return trimmed;
                }
            }
        }
        return null;
    }
    static testHttp(targetUrl, timeoutMs = 5000) {
        return new Promise((resolve) => {
            try {
                const parsed = new url_1.URL(targetUrl);
                const client = parsed.protocol === 'https:' ? https : http;
                const startTime = Date.now();
                const req = client.request(parsed, { method: 'HEAD', timeout: timeoutMs }, (res) => {
                    const durationMs = Date.now() - startTime;
                    resolve({
                        success: true,
                        message: `HTTP connection successful! Server responded with status ${res.statusCode} (${res.statusMessage || 'OK'}) in ${durationMs}ms.`,
                        durationMs,
                    });
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        message: `Connection timed out after ${timeoutMs}ms reaching ${parsed.host}.`,
                    });
                });
                req.on('error', (err) => {
                    resolve({
                        success: false,
                        message: `Connection failed to ${parsed.host}: ${err.message}`,
                    });
                });
                req.end();
            }
            catch (e) {
                resolve({
                    success: false,
                    message: `Invalid URL: ${e.message}`,
                });
            }
        });
    }
    static testTcp(host, port, timeoutMs = 4000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const socket = new net.Socket();
            socket.setTimeout(timeoutMs);
            socket.on('connect', () => {
                const durationMs = Date.now() - startTime;
                socket.destroy();
                resolve({
                    success: true,
                    message: `Connection successful! Reached ${host}:${port} in ${durationMs}ms.`,
                    durationMs,
                });
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    success: false,
                    message: `Connection timed out after ${timeoutMs}ms connecting to ${host}:${port}.`,
                });
            });
            socket.on('error', (err) => {
                socket.destroy();
                resolve({
                    success: false,
                    message: `Connection failed to ${host}:${port} (${err.code || err.message}).`,
                });
            });
            try {
                socket.connect(port, host);
            }
            catch (err) {
                resolve({
                    success: false,
                    message: `Failed to initiate socket connection: ${err.message}`,
                });
            }
        });
    }
}
exports.ConnectionTester = ConnectionTester;
//# sourceMappingURL=connectionTester.js.map