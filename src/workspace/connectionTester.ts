import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface TestConnectionResult {
  success: boolean;
  message: string;
  durationMs?: number;
}

/**
 * Genuinely checks network connectivity for configurations (HTTP requests, raw TCP sockets)
 * without using mocked or fake results.
 */
export class ConnectionTester {
  /**
   * Determines if a configuration's protocol and parameters can be genuinely tested.
   * If not genuine (e.g. cloud tokens, opaque runtimes, local files), returns false to omit the button.
   */
  public static canTest(attributes: Record<string, any>, namespaceUri?: string, localName?: string): boolean {
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
  public static async test(
    attributes: Record<string, any>,
    namespaceUri?: string,
    localName?: string
  ): Promise<TestConnectionResult> {
    const urlStr = this.findUrl(attributes);
    if (urlStr) {
      try {
        const u = new URL(urlStr);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          return this.testHttp(urlStr);
        }
      } catch {
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

  private static extractJdbcHostPort(urlStr: string): { host: string; port: number } | null {
    if (!urlStr || typeof urlStr !== 'string') return null;
    if (urlStr.includes('${') || urlStr.includes('#[')) return null;

    const match = urlStr.match(/(?:jdbc:[a-zA-Z0-9_-]+:\/\/|\/\/)([a-zA-Z0-9.-]+)(?::([0-9]+))?/i);
    if (match && match[1]) {
      const host = match[1];
      const port = match[2] ? parseInt(match[2], 10) : 3306;
      return { host, port };
    }
    return null;
  }

  private static findHost(attributes: Record<string, any>): string | null {
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
      if (jdbc) return jdbc.host;
    }

    return null;
  }

  private static findPort(attributes: Record<string, any>, namespaceUri?: string, localName?: string): number | null {
    const candidates = ['port', 'portNumber'];
    for (const key of candidates) {
      const val = attributes[key];
      if (val !== undefined && val !== null) {
        const p = parseInt(String(val), 10);
        if (!isNaN(p) && p > 0) return p;
      }
    }

    const urlVal = attributes['url'] || attributes['baseUri'];
    if (typeof urlVal === 'string') {
      const jdbc = this.extractJdbcHostPort(urlVal);
      if (jdbc) return jdbc.port;
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

  private static findUrl(attributes: Record<string, any>): string | null {
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

  private static testHttp(targetUrl: string, timeoutMs = 5000): Promise<TestConnectionResult> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(targetUrl);
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
      } catch (e: any) {
        resolve({
          success: false,
          message: `Invalid URL: ${e.message}`,
        });
      }
    });
  }

  private static testTcp(host: string, port: number, timeoutMs = 4000): Promise<TestConnectionResult> {
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

      socket.on('error', (err: any) => {
        socket.destroy();
        resolve({
          success: false,
          message: `Connection failed to ${host}:${port} (${err.code || err.message}).`,
        });
      });

      try {
        socket.connect(port, host);
      } catch (err: any) {
        resolve({
          success: false,
          message: `Failed to initiate socket connection: ${err.message}`,
        });
      }
    });
  }
}
