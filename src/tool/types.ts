export type Mode = 'wake-up' | 'bedtime';

export interface HistoryEntry {
  /** Short human readable description of the saved suggestion. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Active mode: 'wake-up' finds bedtimes, 'bedtime' finds wake times. */
  mode: Mode;
  /** Desired wake time in 'HH:MM' (wake-up mode). */
  wakeTime: string;
  /** Current or intended bedtime in 'HH:MM' (bedtime mode). */
  bedTime: string;
  /** Sleep-onset latency in minutes (0-30). */
  onsetLatency: number;
  /** Saved suggestions, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  mode: 'wake-up',
  wakeTime: '07:00',
  bedTime: '23:00',
  onsetLatency: 15,
  history: [],
};

export const MAX_HISTORY = 20;

/** One sleep cycle in minutes. */
export const CYCLE_MINUTES = 90;

/** Suggested cycle counts, from most sleep (6 cycles) to least (4 cycles). */
export const CYCLE_COUNTS = [6, 5, 4] as const;

export const MIN_ONSET_LATENCY = 0;
export const MAX_ONSET_LATENCY = 30;

export const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'wake-up', label: 'Wake up at', hint: 'find the best bedtimes' },
  { value: 'bedtime', label: 'Go to bed now', hint: 'find the best wake times' },
];

/** Clamp the sleep-onset latency into the allowed 0-30 minute range. */
export function clampLatency(latency: number): number {
  if (!Number.isFinite(latency)) return DEFAULT_STATE.onsetLatency;
  return Math.min(MAX_ONSET_LATENCY, Math.max(MIN_ONSET_LATENCY, Math.round(latency)));
}

/** Parse an 'HH:MM' time string into minutes since midnight; null when invalid. */
export function parseTime(input: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Result of formatting a minutes-since-midnight value. */
export interface TimeLabel {
  /** 'HH:MM' label modulo a 24-hour day. */
  label: string;
  /** 0 = same day as the anchor, 1 = next day, 2 = day after that. */
  nextDay: number;
}

/** Format minutes since midnight in 24-hour 'HH:MM' with signed day rollover. */
export function formatTime(minutes: number): TimeLabel {
  const rounded = Math.round(minutes);
  const normalized = ((rounded % 1440) + 1440) % 1440;
  const nextDay = Math.floor(rounded / 1440);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return {
    label: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
    nextDay,
  };
}

/** Day-aware suffix for a formatted time ('', ' (next day)', ...). */
export function daySuffix(nextDay: number): string {
  if (nextDay <= 0) return '';
  if (nextDay === 1) return ' (next day)';
  return ` (+${nextDay} days)`;
}

/** Human-readable total sleep duration for a number of cycles. */
export function durationLabel(cycles: number): string {
  const minutes = cycles * CYCLE_MINUTES;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/** One bedtime or wake-time suggestion. */
export interface Suggestion {
  /** Number of complete sleep cycles. */
  cycles: number;
  /** 'HH:MM' time label. */
  time: string;
  /** Day-aware suffix, e.g. ' (next day)'. */
  dayLabel: string;
  /** Total sleep duration label, e.g. '7 h 30 min'. */
  duration: string;
  /** True when the suggested time lands on a later calendar day. */
  crossesDay: boolean;
  /** Full human-readable line used for copies and history. */
  text: string;
}

/**
 * Build one suggestion. Bedtimes are anchored to the wake day (= tomorrow):
 * a bedtime still on the previous evening has nextDay 0, one after midnight
 * lands on the wake day itself and is labelled 'next day'. Wake times are
 * anchored to the bedtime day (= tonight).
 */
function buildSuggestion(
  minutes: number,
  cycles: number,
  kind: 'bedtime' | 'wake time'
): Suggestion {
  const label = formatTime(minutes);
  const nextDay = kind === 'bedtime' ? label.nextDay + 1 : label.nextDay;
  const dayLabel = daySuffix(nextDay);
  return {
    cycles,
    time: label.label,
    dayLabel,
    duration: durationLabel(cycles),
    crossesDay: kind === 'bedtime' ? nextDay === 1 : nextDay >= 1,
    text:
      kind === 'bedtime'
        ? `Bedtime ${label.label}${dayLabel} — ${cycles} cycles (${durationLabel(cycles)})`
        : `Wake at ${label.label}${dayLabel} — ${cycles} cycles (${durationLabel(cycles)})`,
  };
}

/**
 * Bedtime options for a desired wake time: bedtime = wake − latency − cycles×90.
 * Ordered from 6 cycles down to 4 cycles.
 */
export function bedtimesForWake(wakeMinutes: number, latency: number): Suggestion[] {
  return CYCLE_COUNTS.map((cycles) =>
    buildSuggestion(wakeMinutes - clampLatency(latency) - cycles * CYCLE_MINUTES, cycles, 'bedtime')
  );
}

/**
 * Wake-time options for a given bedtime: wake = bedtime + latency + cycles×90.
 * Successive 90-minute steps, rolling over midnight.
 */
export function wakeTimesForBed(bedMinutes: number, latency: number): Suggestion[] {
  return CYCLE_COUNTS.map((cycles) =>
    buildSuggestion(
      bedMinutes + clampLatency(latency) + cycles * CYCLE_MINUTES,
      cycles,
      'wake time'
    )
  );
}

/** Suggestions for the active mode, or an empty list for invalid inputs. */
export function suggestionsFor(state: ToolState): Suggestion[] {
  if (state.mode === 'wake-up') {
    const wake = parseTime(state.wakeTime);
    if (wake === null) return [];
    return bedtimesForWake(wake, state.onsetLatency);
  }
  const bed = parseTime(state.bedTime);
  if (bed === null) return [];
  return wakeTimesForBed(bed, state.onsetLatency);
}

/** Compact summary for the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const list = suggestionsFor(state);
  if (list.length === 0) return 'Enter a valid time';
  return list.map((s) => `${s.time}${s.dayLabel}`).join(', ');
}

/** One explanation line per suggestion step. */
export function stepsFor(state: ToolState): string[] {
  const latency = state.onsetLatency;
  const base =
    state.mode === 'wake-up' ? `Wake time ${state.wakeTime}` : `Bedtime ${state.bedTime}`;
  const formula =
    state.mode === 'wake-up'
      ? 'Formula: bedtime = wake time − onset latency − cycles × 90 min'
      : 'Formula: wake time = bedtime + onset latency + cycles × 90 min';
  return [
    base,
    formula,
    `Sleep onset latency: ${latency} min`,
    `${CYCLE_COUNTS.length} options computed with complete 90-minute cycles.`,
  ];
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.mode === 'string' && typeof v.onsetLatency === 'number' && DEFAULT_STATE !== undefined
  );
}
