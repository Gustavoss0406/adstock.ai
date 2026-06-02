/**
 * OpenCode-specific constants.
 */

export const OPENCODE_TERMINAL_NAME_PREFIX = 'OpenCode';

/** Directory where the bridge writes JSONL transcript files. */
export { BRIDGE_OUTPUT_DIR as BRIDGE_SESSION_DIR } from './opencodeBridge.js';

/** Polling interval for the DB bridge (ms). */
export { BRIDGE_POLL_INTERVAL_MS } from './opencodeBridge.js';
