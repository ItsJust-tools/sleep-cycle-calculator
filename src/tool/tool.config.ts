import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'sleep-cycle-calculator',
  name: 'Sleep Cycle Calculator',
  description:
    'Calculate optimal bedtimes and wake-up times based on 90-minute sleep cycles so users wake up refreshed.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.12)',
    brand: 'Sleep Cycle Calculator',
    icon: '🌙',
  },
  shortcuts: [
    {
      title: 'Sleep Cycle Calculator',
      shortcuts: [
        { keys: 'W', label: 'Wake-up mode', description: 'switch to wake-up mode' },
        { keys: 'B', label: 'Bedtime mode', description: 'switch to bedtime mode' },
        {
          keys: 'Y',
          label: 'Copy result',
          description: 'copy the chosen suggestion to the clipboard',
        },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
