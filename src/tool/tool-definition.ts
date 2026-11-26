import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  clampLatency,
  suggestionsFor,
  stepsFor,
  summaryText,
  type HistoryEntry,
  type Mode,
  type ToolState,
} from './types';

const VALID_MODES: Mode[] = ['wake-up', 'bedtime'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    mode: state.mode,
    wakeTime: state.wakeTime,
    bedTime: state.bedTime,
    onsetLatency: state.onsetLatency,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected sleep cycle calculator state object',
    };
  }
  const v = data as Record<string, unknown>;
  const mode: Mode = VALID_MODES.includes(v.mode as Mode) ? (v.mode as Mode) : DEFAULT_STATE.mode;
  const latencyRaw =
    typeof v.onsetLatency === 'number' ? v.onsetLatency : DEFAULT_STATE.onsetLatency;
  const state: ToolState = {
    mode,
    wakeTime: stringOr(v.wakeTime, DEFAULT_STATE.wakeTime),
    bedTime: stringOr(v.bedTime, DEFAULT_STATE.bedTime),
    onsetLatency: clampLatency(latencyRaw),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const sleepCycleCalculatorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { suggestionsFor, stepsFor, summaryText, clampLatency };
