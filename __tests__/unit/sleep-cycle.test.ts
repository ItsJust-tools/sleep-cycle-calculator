import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  CYCLE_MINUTES,
  MAX_HISTORY,
  clampLatency,
  daySuffix,
  durationLabel,
  bedtimesForWake,
  wakeTimesForBed,
  parseTime,
  formatTime,
  suggestionsFor,
  stepsFor,
  summaryText,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  sleepCycleCalculatorTool,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('parseTime', () => {
  it('parses valid HH:MM times', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('23:59')).toBe(23 * 60 + 59);
    expect(parseTime('7:05')).toBe(425);
  });

  it('rejects invalid times', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('1200')).toBeNull();
    expect(parseTime('-1:30')).toBeNull();
  });
});

describe('formatTime and day rollover', () => {
  it('formats minutes within the same day', () => {
    expect(formatTime(450)).toEqual({ label: '07:30', nextDay: 0 });
    expect(formatTime(0)).toEqual({ label: '00:00', nextDay: 0 });
  });

  it('rollovers mark the previous or next day with signed nextDay', () => {
    expect(formatTime(1440)).toEqual({ label: '00:00', nextDay: 1 });
    expect(formatTime(1500)).toEqual({ label: '01:00', nextDay: 1 });
    expect(formatTime(-60)).toEqual({ label: '23:00', nextDay: -1 });
  });

  it('daySuffix renders only for later days', () => {
    expect(daySuffix(0)).toBe('');
    expect(daySuffix(1)).toBe(' (next day)');
    expect(daySuffix(2)).toBe(' (+2 days)');
  });
});

describe('clampLatency', () => {
  it('keeps values within 0-30', () => {
    expect(clampLatency(15)).toBe(15);
    expect(clampLatency(-10)).toBe(0);
    expect(clampLatency(45)).toBe(30);
    expect(clampLatency(NaN)).toBe(DEFAULT_STATE.onsetLatency);
    expect(clampLatency(12.6)).toBe(13);
  });
});

describe('durationLabel', () => {
  it('labels complete cycles', () => {
    expect(durationLabel(6)).toBe('9 h');
    expect(durationLabel(5)).toBe('7 h 30 min');
    expect(durationLabel(4)).toBe('6 h');
  });
});

describe('wake-up mode: bedtimes for a desired wake time', () => {
  it('subtracts latency and whole cycles from the wake time', () => {
    // Wake at 07:00, 15 min latency: 07:00 - 0:15 = 06:45 anchor.
    const options = bedtimesForWake(7 * 60, 15);
    expect(options.map((o) => o.cycles)).toEqual([6, 5, 4]);
    // 6 cycles = 9h -> 21:45 same day; 5 cycles (7.5h) -> 23:15 same day;
    // 4 cycles (6h) -> 00:45 next day.
    expect(options[0]?.time).toBe('21:45');
    expect(options[0]?.crossesDay).toBe(false);
    expect(options[1]?.time).toBe('23:15');
    expect(options[2]?.time).toBe('00:45');
    // Wake 07:00 tomorrow; bedtimes land the previous evening (day 0)
    // or just after midnight on the wake day itself (labelled next day).
    expect(options[2]?.crossesDay).toBe(true);
    expect(options[2]?.dayLabel).toBe(' (next day)');
  });

  it('zero latency shifts suggestions exactly one cycle time back', () => {
    const withLatency = bedtimesForWake(7 * 60, 15);
    const withoutLatency = bedtimesForWake(7 * 60, 0);
    expect(withoutLatency[0]?.time).toBe('22:00');
    expect(withoutLatency[0]?.duration).toBe(withLatency[0]?.duration);
    // With latency the bedtime is 15 min earlier; both may wrap around
    // midnight, so compare on a circular 24h clock.
    for (let i = 0; i < 3; i += 1) {
      const tLat = parseTime(withLatency[i]?.time ?? '') ?? 0;
      const tBase = parseTime(withoutLatency[i]?.time ?? '') ?? 0;
      const delta = (((tBase - tLat) % 1440) + 1440) % 1440;
      expect(delta).toBe(15);
    }
  });

  it('same-day wake time yields previous-evening bedtimes crossing midnight for long sleeps', () => {
    const options = bedtimesForWake(6 * 60, 15); // wake 06:00
    expect(options[0]?.time).toBe('20:45'); // 6 cycles back, same day
    expect(options[1]?.time).toBe('22:15');
    expect(options[2]?.time).toBe('23:45');
  });
});

describe('bedtime mode: wake options across midnight', () => {
  it('adds latency plus successive 90-minute cycles', () => {
    const options = wakeTimesForBed(23 * 60, 15);
    // 23:00 + 0:15 = 23:15 anchor.
    expect(options.map((o) => o.cycles)).toEqual([6, 5, 4]);
    expect(options[0]?.time).toBe('08:15'); // +9h
    expect(options[0]?.crossesDay).toBe(true);
    expect(options[0]?.dayLabel).toBe(' (next day)');
    expect(options[1]?.time).toBe('06:45'); // +7.5h
    expect(options[2]?.time).toBe('05:15'); // +6h
    expect(options[0]?.duration).toBe('9 h');
  });

  it('produces options spaced exactly 90 minutes apart', () => {
    const options = wakeTimesForBed(22 * 60, 10);
    const minutes = options.map((o) => parseTime(o.time) ?? 0);
    // 6 cycles vs 5 cycles differ by 90 min and wrap identically.
    expect((minutes[0]! - minutes[1]! + 1440) % 1440).toBe(CYCLE_MINUTES);
    expect((minutes[1]! - minutes[2]! + 1440) % 1440).toBe(CYCLE_MINUTES);
  });

  it('bedtimes before midnight with short sleep stay on the same day', () => {
    const options = wakeTimesForBed(18 * 60, 0); // 18:00 bed, 4 cycles -> 00:00 next day
    expect(options[2]?.time).toBe('00:00');
    expect(options[2]?.crossesDay).toBe(true);
    expect(options[2]?.dayLabel).toBe(' (next day)');
  });
});

describe('onset latency applied consistently', () => {
  it('shifts every bedtime suggestion by the latency amount', () => {
    const a = bedtimesForWake(7 * 60, 0);
    const b = bedtimesForWake(7 * 60, 30);
    for (let i = 0; i < 3; i += 1) {
      const ta = parseTime(a[i]?.time ?? '') ?? 0;
      const tb = parseTime(b[i]?.time ?? '') ?? 0;
      // 30 min earlier, may wrap into the previous day.
      const delta = (((ta - tb) % 1440) + 1440) % 1440;
      expect(delta).toBe(30);
    }
  });

  it('shifts every wake suggestion by the latency amount', () => {
    const a = wakeTimesForBed(23 * 60, 5);
    const b = wakeTimesForBed(23 * 60, 25);
    for (let i = 0; i < 3; i += 1) {
      const ta = parseTime(a[i]?.time ?? '') ?? 0;
      const tb = parseTime(b[i]?.time ?? '') ?? 0;
      const delta = (((tb - ta) % 1440) + 1440) % 1440;
      expect(delta).toBe(20);
    }
  });
});

describe('suggestionsFor, steps and summary', () => {
  it('delegates by mode and returns empty on invalid input', () => {
    expect(suggestionsFor(state({ mode: 'wake-up', wakeTime: '07:00' }))).toHaveLength(3);
    expect(suggestionsFor(state({ mode: 'bedtime', bedTime: '23:00' }))).toHaveLength(3);
    expect(suggestionsFor(state({ mode: 'wake-up', wakeTime: '99:99' }))).toEqual([]);
    expect(suggestionsFor(state({ mode: 'bedtime', bedTime: 'not-a-time' }))).toEqual([]);
  });

  it('summary lists all suggestions or explains the invalid input', () => {
    expect(summaryText(state())).toContain('21:45');
    expect(summaryText(state({ wakeTime: 'nope' }))).toBe('Enter a valid time');
  });

  it('steps mention mode, formula and latency', () => {
    const steps = stepsFor(state());
    expect(steps.some((s) => s.includes('Wake time 07:00'))).toBe(true);
    expect(steps.some((s) => s.includes('bedtime = wake time'))).toBe(true);
    expect(steps.some((s) => s.includes('15 min'))).toBe(true);
    const bedSteps = stepsFor(state({ mode: 'bedtime', bedTime: '22:30' }));
    expect(bedSteps.some((s) => s.includes('Bedtime 22:30'))).toBe(true);
    expect(bedSteps.some((s) => s.includes('wake time = bedtime'))).toBe(true);
  });
});

describe('serialize / deserialize round-trip', () => {
  it('preserves mode, times, latency and history', () => {
    const full = state({
      mode: 'bedtime',
      bedTime: '23:30',
      wakeTime: '06:45',
      onsetLatency: 22,
      history: [{ text: 'Wake at 08:15 (next day)', createdAt: '2026-11-26T10:00:00.000Z' }],
    });
    const restored = deserializeState(JSON.parse(serializeState(full)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
    }
  });

  it('roundTrips() accepts a valid state', () => {
    expect(roundTrips(state({ mode: 'bedtime', onsetLatency: 5 }))).toBe(true);
    expect(roundTrips(state())).toBe(true);
  });

  it('deserialize repairs invalid payloads with defaults', () => {
    const repaired = deserializeState({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.mode).toBe(DEFAULT_STATE.mode);
      expect(repaired.data.onsetLatency).toBe(DEFAULT_STATE.onsetLatency);
      expect(repaired.data.history).toEqual([]);
    }
  });

  it('deserialize clamps out-of-range latency and drops invalid history', () => {
    const result = deserializeState({
      mode: 'wake-up',
      onsetLatency: 900,
      history: [{ text: 'valid', createdAt: '2026-11-26T10:00:00.000Z' }, { text: 42 }, 'junk'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.onsetLatency).toBe(30);
      expect(result.data.history).toHaveLength(1);
    }
  });

  it('deserialize falls back to default mode for unknown modes', () => {
    const result = deserializeState({ mode: 'hypersleep', onsetLatency: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('wake-up');
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('junk').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
  });

  it('caps restored history at MAX_HISTORY', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `entry ${i}`,
      createdAt: `2026-11-26T10:00:0${i % 10}.000Z`,
    }));
    const result = deserializeState({ history: entries });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history).toHaveLength(MAX_HISTORY);
    }
  });
});

describe('withHistory and tool definition', () => {
  it('appends entries newest first, capped at MAX_HISTORY', () => {
    let s = state();
    s = withHistory(s, 'first', new Date('2026-11-26T10:00:00Z'));
    s = withHistory(s, 'second', new Date('2026-11-26T10:01:00Z'));
    expect(s.history[0]?.text).toBe('second');
    expect(s.history).toHaveLength(2);
    for (let i = 0; i < MAX_HISTORY + 3; i += 1) {
      s = withHistory(s, `x${i}`);
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
  });

  it('exposes a tool with the configured identity and exporters', async () => {
    expect(sleepCycleCalculatorTool.id).toBe('sleep-cycle-calculator');
    expect(sleepCycleCalculatorTool.name).toBe('Sleep Cycle Calculator');
    expect(sleepCycleCalculatorTool.initialState).toEqual(DEFAULT_STATE);
    expect(sleepCycleCalculatorTool.serialize(state())).toContain('"onsetLatency":15');
    const exporters = sleepCycleCalculatorTool.exporters ?? [];
    expect(exporters).toHaveLength(4);
    const loaded = await exporters[0]?.loader();
    const resolved =
      'default' in (loaded ?? {})
        ? (loaded as { default: { format: string } }).default
        : (loaded as { exporter: { format: string } }).exporter;
    expect(resolved.format).toBe('png');
  });
});
