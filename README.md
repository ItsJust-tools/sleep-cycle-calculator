# Sleep Cycle Calculator

Calculate optimal bedtimes and wake-up times based on 90-minute sleep cycles so you wake up refreshed.

**Live:** [sleep-cycle-calculator.itsjust.tools](https://sleep-cycle-calculator.itsjust.tools)

## How it works

Sleep runs in roughly 90-minute cycles. Waking up between cycles — during light sleep — feels much easier than being jolted out of deep sleep. This tool only suggests times that land on complete cycle boundaries.

- **Wake-up mode:** enter when you want to wake up and get bedtimes for 6, 5 and 4 complete cycles (9 h, 7.5 h, 6 h)
- **Bedtime mode:** enter when you are going to bed and get wake times at complete cycle boundaries
- **Fall-asleep time slider (0–30 min):** the average person takes about 15 minutes to drift off; every suggestion is shifted by this amount
- Times crossing midnight are labelled **next day** so evening and morning never get mixed up
- Every suggestion shows its cycle count and total sleep duration, with one-tap copy
- Shareable state via URL, `.itsjust.json` import/export and image/PDF export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key | Action           |
| --- | ---------------- |
| `W` | Wake-up mode     |
| `B` | Bedtime mode     |
| `Y` | Copy suggestions |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t sleep-cycle-calculator .
docker run -p 3000:3000 sleep-cycle-calculator
```

## License

MIT
