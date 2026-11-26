'use client';

import React from 'react';
import { MODES, type ToolState } from '../types';

export const SIDEBAR_TEST_ID = 'sleep-sidebar';

export const Sidebar: React.FC<{
  state: ToolState;
  onChange: (next: ToolState) => void;
}> = ({ state, onChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid={SIDEBAR_TEST_ID}>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Modes</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {MODES.map((mode) => (
            <li key={mode.value} className="flex justify-between gap-2">
              <span>{mode.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{mode.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">About sleep cycles</h3>
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <p>
            Sleep runs in roughly <strong>90-minute cycles</strong>. Waking up at the end of a
            complete cycle — during light sleep — feels far easier than being jolted out of deep
            sleep mid-cycle.
          </p>
          <p>
            Most adults need <strong>4–6 cycles</strong> per night. Six cycles (9 hours) leaves you
            fully rested, while four and a half cycles (6 hours) is the short end of a normal night.
          </p>
          <p>
            The <strong>fall-asleep time</strong> shifts everything: on average it takes about 15
            minutes to drift off, so aim to be in bed that much earlier than the suggested times.
          </p>
          <p>
            Times that cross midnight are labelled <em>next day</em> so you never mix up evenings
            and mornings.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved suggestions</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>W</kbd> — Wake-up mode
          </li>
          <li>
            <kbd>B</kbd> — Bedtime mode
          </li>
          <li>
            <kbd>Y</kbd> — Copy suggestions
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current time and latency
          settings; open it to restore this calculation.
        </p>
      </div>
    </div>
  );
};
