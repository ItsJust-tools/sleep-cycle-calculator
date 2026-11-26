import { DEFAULT_STATE, MODES, type Mode, type ToolState } from './types';

export { MODES, DEFAULT_STATE };

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.mode === 'string' && typeof v.onsetLatency === 'number' && DEFAULT_STATE !== undefined
  );
}
