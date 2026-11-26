'use client';

import React from 'react';
import { suggestionsFor, stepsFor, summaryText } from '../tool-definition';
import {
  MAX_ONSET_LATENCY,
  MIN_ONSET_LATENCY,
  MODES,
  type Suggestion,
  type ToolState,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function TimeField({
  label,
  value,
  onChangeState,
  testid,
}: {
  label: string;
  value: string;
  onChangeState: (next: string) => void;
  testid: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      <input
        type="time"
        value={value}
        onChange={(e) => onChangeState(e.target.value)}
        data-testid={testid}
        className={inputClass}
      />
    </label>
  );
}

function SuggestionCard({
  suggestion,
  onSaveHistory,
}: {
  suggestion: Suggestion;
  onSaveHistory?: (text: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0">
        <span className="block font-mono text-xl font-bold" data-testid="suggestion-time">
          {suggestion.time}
          <span className="ml-1 text-xs font-normal text-sky-600 dark:text-sky-400">
            {suggestion.dayLabel}
          </span>
        </span>
        <span
          className="block text-xs text-gray-500 dark:text-gray-400"
          data-testid="suggestion-detail"
        >
          {suggestion.cycles} cycles · {suggestion.duration} of sleep
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CopyButton value={suggestion.text} testid={`copy-suggestion-${suggestion.cycles}`} />
        {onSaveHistory ? (
          <button
            type="button"
            data-testid={`save-suggestion-${suggestion.cycles}`}
            onClick={() => onSaveHistory(suggestion.text)}
            className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            Save
          </button>
        ) : null}
      </div>
    </li>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const suggestions = suggestionsFor(state);
  const steps = stepsFor(state);
  const validTime = suggestions.length > 0;

  const timeInputs = (() => {
    if (state.mode === 'wake-up') {
      return (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="wake-inputs">
          <TimeField
            label="I want to wake up at"
            value={state.wakeTime}
            onChangeState={(v) => update({ wakeTime: v })}
            testid="input-wake-time"
          />
          <div className="hidden sm:block" />
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2" data-testid="bedtime-inputs">
        <TimeField
          label="I am going to bed at"
          value={state.bedTime}
          onChangeState={(v) => update({ bedTime: v })}
          testid="input-bed-time"
        />
        <div className="hidden sm:block" />
      </div>
    );
  })();

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 overflow-y-auto p-4 lg:p-6"
      id="main-content"
      data-testid="sleep-canvas"
    >
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Calculator mode"
        data-testid="mode-tabs"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={state.mode === mode.value}
            data-testid={`mode-tab-${mode.value}`}
            title={mode.hint}
            onClick={() => update({ mode: mode.value })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              state.mode === mode.value
                ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {timeInputs}

      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        Time to fall asleep: <span data-testid="latency-value">{state.onsetLatency} min</span>
        <input
          type="range"
          min={MIN_ONSET_LATENCY}
          max={MAX_ONSET_LATENCY}
          step={1}
          value={state.onsetLatency}
          onChange={(e) => update({ onsetLatency: Number(e.target.value) })}
          data-testid="input-latency"
          className="mt-2 w-full accent-sky-500"
        />
        <span className="mt-1 block text-[10px] text-gray-500 dark:text-gray-400">
          Average is 15 minutes. This shifts every suggestion by the same amount.
        </span>
      </label>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {state.mode === 'wake-up' ? 'Suggested bedtimes' : 'Suggested wake times'}
        </span>
        {validTime ? (
          <ul className="mt-2 space-y-2" data-testid="suggestion-list">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.cycles}
                suggestion={suggestion}
                onSaveHistory={onSaveHistory}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="invalid-hint">
            Enter a valid time to see {state.mode === 'wake-up' ? 'bedtimes' : 'wake times'}.
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <span className="text-xs text-gray-600 dark:text-gray-300" data-testid="result-summary">
            {summaryText(state)}
          </span>
          {validTime ? <CopyButton value={summaryText(state)} testid="copy-result" /> : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          How this is calculated
        </h3>
        <ol className="space-y-1 text-xs text-gray-700 dark:text-gray-300" data-testid="steps-list">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Saved suggestions
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved suggestions yet — press Save on a suggestion above.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="text-gray-700 dark:text-gray-300">{entry.text}</span>
                <CopyButton value={entry.text} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
