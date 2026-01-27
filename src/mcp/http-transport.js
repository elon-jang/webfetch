/**
 * MCP HTTP session manager for Streamable HTTP transport.
 * Used by the web server to handle /mcp endpoint requests.
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { registerTools } from './tools.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('mcp-http');

/** @type {Map<string, StreamableHTTPServerTransport>} */
const sessions = new Map();

/**
 * Handle an incoming MCP HTTP request (POST, GET, or DELETE).
 * Routes to existing session or creates a new one on initialize.
 */
export async function handleMcpRequest(req, res, parsedBody) {
  const sessionId = req.headers['mcp-session-id'];

  // DELETE — session termination
  if (req.method === 'DELETE') {
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
      return;
    }
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    return;
  }

  // GET — SSE stream for existing session
  if (req.method === 'GET') {
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
      return;
    }
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res);
    return;
  }

  // POST — existing session
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res, parsedBody);
    return;
  }

  // POST — new initialize request
  if (!sessionId && isInitializeRequest(parsedBody)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        log.info(`MCP session created: ${id}`);
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        log.info(`MCP session closed: ${sid}`);
        sessions.delete(sid);
      }
    };

    const server = new McpServer({ name: 'webfetch', version: '1.0.0' });
    registerTools(server);
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
    return;
  }

  // Invalid request
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
    id: null,
  }));
}

/**
 * Get the number of active MCP sessions.
 */
export function getSessionCount() {
  return sessions.size;
}

/**
 * Close all active sessions (for graceful shutdown).
 */
export async function closeAllSessions() {
  for (const [id, transport] of sessions) {
    try {
      await transport.close();
    } catch (err) {
      log.error(`Error closing session ${id}: ${err.message}`);
    }
  }
  sessions.clear();
}
