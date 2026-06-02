import * as fs from 'fs';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import {
  BASH_COMMAND_DISPLAY_MAX_LENGTH,
  TASK_DESCRIPTION_DISPLAY_MAX_LENGTH,
} from '../../../constants.js';
import {
  BRIDGE_SESSION_DIR,
  OPENCODE_TERMINAL_NAME_PREFIX,
} from './constants.js';
import { getOpenCodeBridge } from './opencodeBridge.js';

// ── formatToolStatus: OpenCode tool names → display text ──

export function formatToolStatus(toolName: string, input?: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p.toString()) : '');
  switch (toolName) {
    case 'read':
      return `Reading ${base(inp.filePath)}`;
    case 'edit':
      return `Editing ${base(inp.filePath)}`;
    case 'write':
      return `Writing ${base(inp.filePath)}`;
    case 'bash': {
      const cmd = typeof inp.command === 'string' ? inp.command : (inp.command as string) || '';
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
    }
    case 'glob':
      return 'Searching files';
    case 'grep':
      return 'Searching code';
    case 'webfetch':
      return 'Fetching web content';
    case 'websearch':
      return 'Searching the web';
    case 'task':
    case 'agent': {
      const desc = typeof inp.description === 'string' ? inp.description : '';
      return desc
        ? `Subtask: ${desc.length > TASK_DESCRIPTION_DISPLAY_MAX_LENGTH ? desc.slice(0, TASK_DESCRIPTION_DISPLAY_MAX_LENGTH) + '\u2026' : desc}`
        : 'Running subtask';
    }
    case 'question':
      return 'Waiting for your answer';
    case 'todowrite':
      return 'Updating tasks';
    case 'skill':
      return 'Loading skill';
    case 'apply_patch':
      return 'Applying patch';
    default:
      return `Using ${toolName}`;
  }
}

// ── Session dirs: bridge output directory ────────────────────────

function getSessionDirs(_workspacePath: string): string[] {
  if (!fs.existsSync(BRIDGE_SESSION_DIR)) {
    fs.mkdirSync(BRIDGE_SESSION_DIR, { recursive: true });
  }
  return [BRIDGE_SESSION_DIR];
}

function getAllSessionRoots(): string[] {
  return [BRIDGE_SESSION_DIR];
}

function buildLaunchCommand(
  sessionId: string,
  cwd: string,
  opts?: { bypassPermissions?: boolean },
): { command: string; args: string[]; env?: Record<string, string> } {
  const args = ['--session-id', sessionId];
  if (opts?.bypassPermissions) args.push('--dangerously-skip-permissions');
  return { command: 'opencode', args, env: { PWD: cwd } };
}

// ── normalizeHookEvent: leveraged by the bridge now ──────────────

function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  // Bridge-generated events arrive as JSONL, not hook POSTs.
  // This function handles raw hook payloads when/if OpenCode adds a hooks API.
  // For now, the bridge converts DB parts to Claude-compatible JSONL records
  // that processTranscriptLine parses directly.
  void raw;
  return null;
}

// ── parseTranscriptLine: provider-level parser for custom formats ──

function parseTranscriptLine(line: string): AgentEvent | null {
  try {
    const record = JSON.parse(line) as Record<string, unknown>;

    // Tool events from bridge-generated JSONL (already in Claude-compatible format)
    // The main transcriptParser handles these natively. This fallback catches
    // any OpenCode-specific record types that Claude's parser doesn't understand.
    if (record.type === 'tool-start' || record.type === 'tool') {
      const tool = record.tool as string | undefined;
      const callID = record.callID as string | undefined;
      const state = record.state as Record<string, unknown> | undefined;
      if (tool && callID) {
        if (state?.status === 'completed' || state?.status === 'error') {
          return { kind: 'toolEnd', toolId: callID };
        }
        return {
          kind: 'toolStart',
          toolId: callID,
          toolName: tool,
          input: state?.input ?? {},
        };
      }
    }
    if (record.type === 'step-finish' || record.type === 'turn-end') {
      return { kind: 'turnEnd' };
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

// ── Hook installers: start/stop the bridge ───────────────────────

async function installHooks(_serverUrl: string, _authToken: string): Promise<void> {
  getOpenCodeBridge().start();
}

async function uninstallHooks(): Promise<void> {
  getOpenCodeBridge().stop();
}

async function areHooksInstalled(): Promise<boolean> {
  return false;
}

// ── The provider ─────────────────────────────────────────────────

export const opencodeProvider: HookProvider = {
  kind: 'hook',
  id: 'opencode',
  displayName: 'OpenCode',
  protocolVersion: 1,

  normalizeHookEvent,

  installHooks,
  uninstallHooks,
  areHooksInstalled,

  formatToolStatus,
  permissionExemptTools: new Set(['task', 'question', 'todowrite', 'skill']),
  subagentToolNames: new Set(['task']),
  readingTools: new Set(['read', 'grep', 'glob', 'webfetch', 'websearch']),
  terminalNamePrefix: OPENCODE_TERMINAL_NAME_PREFIX,

  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: '*.jsonl',
  parseTranscriptLine,
  buildLaunchCommand,
};
