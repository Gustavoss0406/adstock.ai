/**
 * OpenCode DB Bridge: polls OpenCode's SQLite database and translates
 * session parts into Claude-compatible JSONL transcript files.
 *
 * Why a bridge? OpenCode stores all session state in SQLite, not JSONL files.
 * The existing fileWatcher/heuristic infrastructure expects *.jsonl files.
 * Instead of rewriting the watcher, this bridge converts DB records on the fly
 * and writes them to ~/.pixel-agents/sessions/*.jsonl -- files the watcher already
 * knows how to consume.
 *
 * Architecture:
 *   OpenCode SQLite DB --[500ms poll]--> OpenCodeBridge --[write]--> JSONL files
 *                                                                       |
 *                                                       fileWatcher polls & parses
 *                                                                       |
 *                                                              processTranscriptLine
 *                                                                       |
 *                                                                   webview
 */

import { DatabaseSync } from 'node:sqlite';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// -- Paths -------------------------------------------------------

const OPENCODE_DB_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
export const BRIDGE_OUTPUT_DIR = path.join(os.homedir(), '.pixel-agents', 'sessions');

// -- Configuration -----------------------------------------------

export const BRIDGE_POLL_INTERVAL_MS = 500;
const ACTIVE_SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const STALE_SESSION_CLEANUP_MS = 60 * 1000; // every 1 minute

// -- Types -------------------------------------------------------

interface RawPart {
  id: string;
  session_id: string;
  message_id: string;
  time_created: number;
  data: string;
}

interface OpenCodePartData {
  type: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    metadata?: Record<string, unknown>;
  };
  reason?: string;
  tokens?: { total: number; input: number; output: number; reasoning: number };
  cost?: number;
}

interface SessionInfo {
  id: string;
  directory: string;
  title: string;
  time_updated: number;
}

// -- Bridge class ------------------------------------------------

export class OpenCodeBridge {
  private db: DatabaseSync | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastPartId: string | null = null;
  private running = false;

  /** Start the bridge: open DB, seed last part, reconcile, begin polling. */
  start(): void {
    if (this.running) return;
    try {
      if (!fs.existsSync(OPENCODE_DB_PATH)) {
        console.log('[OpenCode Bridge] Database not found at', OPENCODE_DB_PATH);
        return;
      }

      if (!fs.existsSync(BRIDGE_OUTPUT_DIR)) {
        fs.mkdirSync(BRIDGE_OUTPUT_DIR, { recursive: true });
      }

      this.db = new DatabaseSync(OPENCODE_DB_PATH);
      this.running = true;

      // Seed the last part ID so we only pick up future changes.
    const row = this.db.prepare(
      'SELECT id FROM part ORDER BY time_created DESC LIMIT 1',
    ).get() as unknown as { id: string } | undefined;
      if (row) {
        this.lastPartId = row.id;
        console.log('[OpenCode Bridge] Seeded last part:', this.lastPartId);
      }

      // Create JSONL files for all recently-active sessions.
      this.reconcileActiveSessions();

      this.pollTimer = setInterval(() => this.poll(), BRIDGE_POLL_INTERVAL_MS);
      this.cleanupTimer = setInterval(() => this.cleanupStaleSessions(), STALE_SESSION_CLEANUP_MS);

      console.log('[OpenCode Bridge] Started - monitoring OpenCode sessions');
    } catch (err) {
      console.error('[OpenCode Bridge] Failed to start:', err);
      this.running = false;
    }
  }

  /** Stop the bridge: clear timers, close DB. */
  stop(): void {
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }
    this.db?.close();
    this.db = null;
    console.log('[OpenCode Bridge] Stopped');
  }

  // -- Session file management ---------------------------------

  /** Scan for active sessions and create JSONL files with existing history. */
  private reconcileActiveSessions(): void {
    if (!this.db) return;

    const cutoff = Date.now() - ACTIVE_SESSION_MAX_AGE_MS;
    const sessions = this.db.prepare(`
      SELECT id, directory, title, time_updated FROM session
      WHERE time_updated > ?
      ORDER BY time_updated DESC
    `).all(cutoff) as unknown as SessionInfo[];

    for (const s of sessions) {
      const jsonlPath = this.sessionJsonlPath(s.id);
      const lines = this.readExistingParts(s.id);
      // Always rewrite to ensure fresh DB data (truncates stale content from previous runs)
      fs.writeFileSync(jsonlPath, '', 'utf-8');
      if (lines.length > 0) {
        fs.appendFileSync(jsonlPath, lines.join('\n') + '\n', 'utf-8');
        console.log(
          `[OpenCode Bridge] Reconciled ${s.id}: ${lines.length} records (${s.title})`,
        );
      } else {
        console.log(`[OpenCode Bridge] Active session: ${s.id} (${s.title})`);
      }
    }
  }

  /** Load all existing parts for a session and convert to JSONL lines. */
  private readExistingParts(sessionId: string): string[] {
    if (!this.db) return [];
    const parts = this.db.prepare(`
      SELECT id, time_created, data FROM part
      WHERE session_id = ? ORDER BY time_created ASC
    `).all(sessionId) as unknown as RawPart[];

    return this.convertPartsToLines(parts);
  }

  /** Poll for new parts since lastPartId, write to session JSONL files. */
  private poll(): void {
    if (!this.db || !this.lastPartId) return;

    try {
      const newParts = this.db.prepare(`
        SELECT p.id, p.session_id, p.message_id, p.time_created, p.data
        FROM part p WHERE p.id > ? ORDER BY p.time_created ASC
      `).all(this.lastPartId) as unknown as RawPart[];

      if (newParts.length === 0) return;

      const bySession = new Map<string, RawPart[]>();
      for (const part of newParts) {
        let list = bySession.get(part.session_id);
        if (!list) { list = []; bySession.set(part.session_id, list); }
        list.push(part);
        this.lastPartId = part.id;
      }

      for (const [sessionId, parts] of bySession) {
        const jsonlPath = this.sessionJsonlPath(sessionId);
        if (!fs.existsSync(jsonlPath)) {
          fs.writeFileSync(jsonlPath, '', 'utf-8');
        }
        const lines = this.convertPartsToLines(parts);
        if (lines.length > 0) {
          fs.appendFileSync(jsonlPath, lines.join('\n') + '\n', 'utf-8');
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'SQLITE_BUSY') {
        console.error('[OpenCode Bridge] Poll error:', err);
      }
    }
  }

  /** Remove JSONL files for sessions not updated recently. */
  private cleanupStaleSessions(): void {
    try {
      if (!fs.existsSync(BRIDGE_OUTPUT_DIR)) return;
      const files = fs.readdirSync(BRIDGE_OUTPUT_DIR).filter((f) => f.endsWith('.jsonl'));
      const cutoff = Date.now() - ACTIVE_SESSION_MAX_AGE_MS;

      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        // Skip Synkra agent sessions — managed externally
        if (sessionId.startsWith('synkra-')) continue;
        if (!this.db) continue;
        const row = this.db.prepare(
          'SELECT time_updated FROM session WHERE id = ?',
        ).get(sessionId) as unknown as { time_updated: number } | undefined;

        if (!row || row.time_updated < cutoff) {
          const jsonlPath = path.join(BRIDGE_OUTPUT_DIR, file);
          try {
            fs.unlinkSync(jsonlPath);
            console.log(`[OpenCode Bridge] Removed stale: ${sessionId}`);
          } catch { /* stale file already gone */ }
        }
      }
    } catch { /* dir might not exist */ }
  }

  // -- Conversion: OpenCode parts -> Claude JSONL records -------

  /**
   * Convert raw OpenCode parts into Claude-compatible JSONL record strings.
   *
   * Claude JSONL format used by processTranscriptLine:
   *   - {"type":"assistant","message":{"content":[{"type":"tool_use",...}]}}
   *   - {"type":"user","message":{"content":[{"type":"tool_result",...}]}}
   *   - {"type":"system","subtype":"turn_duration"}
   *   - {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
   *
   * OpenCode part types:
   *   - "text"      -> user message prompt
   *   - "reasoning" -> AI thinking text
   *   - "tool"      -> AI tool call (status: completed/running/error)
   *   - "step-start"  -> turn boundary
   *   - "step-finish" -> turn boundary (carries token usage)
   *   - "patch", "file", "compaction" -> skipped (internal)
   */
  private convertPartsToLines(parts: RawPart[]): string[] {
    const lines: string[] = [];
    // Current step tracking: reasoning is accumulated, then flushed before tools.
    let reasoningBuf = '';

    const flushReasoning = (): void => {
      if (!reasoningBuf) return;
      lines.push(JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: reasoningBuf }] },
      }));
      reasoningBuf = '';
    };

    for (const part of parts) {
      const data = safeParse(part.data);
      if (!data) continue;

      switch (data.type) {
        case 'text': {
          // User message -- new turn starting.
          flushReasoning();
          lines.push(JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'text', text: data.text || '' }] },
          }));
          break;
        }

        case 'reasoning': {
          if (data.text) reasoningBuf += (reasoningBuf ? '\n' : '') + data.text;
          break;
        }

        case 'tool': {
          const toolName = data.tool || 'unknown';
          const callID = data.callID || `oc-${part.id}`;
          const state = data.state;

          if (!state?.input) break;

          // Flush accumulated reasoning before tool blocks.
          flushReasoning();

          const usage = data.tokens
            ? { input_tokens: data.tokens.input, output_tokens: data.tokens.output }
            : { input_tokens: 0, output_tokens: 0 };

          // Emit the tool_use block.
          lines.push(JSON.stringify({
            type: 'assistant',
            message: {
              content: [{
                type: 'tool_use',
                id: callID,
                name: toolName,
                input: state.input,
              }],
              usage,
            },
          }));

          // Emit the tool_result block when completed.
          if (state.status === 'completed' || state.status === 'error') {
            lines.push(JSON.stringify({
              type: 'user',
              message: {
                content: [{ type: 'tool_result', tool_use_id: callID }],
              },
            }));
          }
          break;
        }

        case 'step-finish': {
          flushReasoning();
          lines.push(JSON.stringify({
            type: 'system',
            subtype: 'turn_duration',
          }));
          break;
        }

        case 'step-start':
        case 'patch':
        case 'file':
        case 'compaction':
          // Internal/system parts -- no JSONL output needed.
          break;
      }
    }

    // Flush any trailing reasoning.
    flushReasoning();

    return lines;
  }

  private sessionJsonlPath(sessionId: string): string {
    return path.join(BRIDGE_OUTPUT_DIR, `${sessionId}.jsonl`);
  }
}

// -- Singleton ---------------------------------------------------

let bridgeInstance: OpenCodeBridge | null = null;

export function getOpenCodeBridge(): OpenCodeBridge {
  if (!bridgeInstance) {
    bridgeInstance = new OpenCodeBridge();
  }
  return bridgeInstance;
}

function safeParse(raw: string): OpenCodePartData | null {
  try { return JSON.parse(raw) as OpenCodePartData; }
  catch { return null; }
}
