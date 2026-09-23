# Running on Empty — practice app

A PWA for the daily practice from Jonice Webb's *Running on Empty*. The book
describes Childhood Emotional Neglect and hands you a set of exercises and
paper "Change Sheets" to keep for weeks. On paper that falls apart: no
reminders, no history, and a vocabulary of several hundred feeling words is
awkward to leaf through. This moves the practice onto a phone.

The interface is in Russian, built around the Russian edition («Почти на нуле»).

**The book is not included** and this app does not replace it — or therapy.

## What's inside

| Module | Source |
|---|---|
| **Feelings log** — record what you feel several times a day, with the six-step Identify-and-Name exercise | Chapter 6 |
| **Feelings vocabulary** — 38 groups, 797 words, search and your own additions | Recovery Resources |
| **IAAA** — a four-step wizard: Identify → Accept → Attribute → Act | Chapter 6 |
| **Change Sheets** — "Saying no", "Asking for help", the Three Things Program | Chapter 7 |
| **Questionnaire** — 22 items, retakeable and comparable over time | Opening chapter |
| **"I fell off"** — a way back into the practice with no reproach | Chapter 5 |

The remaining six Change Sheets are declared in `src/content/trackers.ts` with
`implemented: false`. The engine already renders sheets by type; what's missing
are components for `list`, `scale` and `habit`.

## Principles baked into the UI

The author is explicit: change goes "two steps forward, one back", and
self-criticism and avoidance are the main enemies of progress. So:

- **no streaks that burn**, and no "you missed 3 days";
- an empty day in the history is just an empty day — it resets nothing;
- **at most two active skills** — the UI won't let you start a third;
- every Change Sheet can be rewritten in your own words, because the author
  insists there is no one-size-fits-all template.

## Design: a notebook

The practice in the book is paper Change Sheets filled in by hand. Hence the
visual language: every section is a **ruled form field** with its title cut into
the frame, so section boundaries are obvious. Inside, rows are separated by
**ruling**, and a narrow margin on the left carries annotations: the time of an
entry, a refusal count, a chapter number. There is not a single rounded box in
the interface.

Counters are drawn as **tally marks**, the way you count in a margin: four
strokes and a fifth across.

Two typefaces with distinct jobs: **Literata** for what a person writes
(feeling words, notes, quotes from the book); **Golos Text** for what is
"printed in the notebook before you" (labels, buttons, margin notes).

Heavy and light states are coloured as **two equal inkwells** — violet ink and
sepia. Not a traffic light: the book states plainly that there are no bad
emotions, so colour must not hint at which feeling is the "right" one.

Fonts are self-hosted (`public/fonts`, 280 KB) — the app has to open with no
network. Rebuild them with `python scripts/fetch-fonts.py`.

## Privacy

The journal lives **only in the browser** (IndexedDB) and is never sent
anywhere.

Reminders are built so as not to break that: the server receives the push
delivery endpoint and the window to send in — nothing else. The notification
itself arrives **with no payload**; the service worker picks the wording on the
device. The server physically cannot reveal anything about your state, because
it knows nothing about it.

The flip side: clearing site data wipes the journal. Settings has JSON export
and import — import **merges**, it does not overwrite.

## How reminders work

There are deliberately no fixed times. Exactly 14:00 every day is an alarm
clock you stop reacting to. Instead you set a **window** (say 09:00 to 22:00),
**how many times a day**, and a **minimum gap** between reminders. The actual
moments are drawn at random inside the window, freshly each day.

The gap keeps randomness from bunching two reminders together. The UI works out
how many fit in the window with the chosen gap and won't let you pick more: a
09:00–22:00 window with a three-hour gap holds five at most.

The scheduling maths lives in `shared/schedule.ts` and is shared by both sides:
the browser uses it to show today's times, the worker uses it to decide when to
send. The day's plan is drawn once and stored in KV, so repeated cron runs never
send duplicates.

## Access

The whole app is behind a password. The gate sits in the worker, so a stranger
gets a login form — not the page, not the bundle, not the vocabulary. The
password lives in Cloudflare secrets, and the session is a signed cookie.

Reminder endpoints additionally require a subscription token issued at
subscribe time, so knowing someone's push endpoint isn't enough to disable
their reminders or relay pushes with their VAPID key.

## Stack

- Vite + React 19 + TypeScript, Tailwind CSS v4
- Dexie (IndexedDB), react-router, date-fns
- `vite-plugin-pwa` in `injectManifest` mode — a hand-written service worker for `push`
- one Cloudflare Worker: serves the static build, hosts the API, runs the cron trigger

Why Cloudflare rather than Vercel: on the free tier Vercel cron fires once a
day, which is not enough for several reminders. Cloudflare goes down to a
minute, KV is free, and the `assets` binding keeps the static build and the cron
in a single project.

Why a PWA rather than a Telegram Mini App: Web Push works natively on Android,
while a mini app would require a bot and move a private journal into a
messenger. The reminder channel sits behind the `ReminderChannel` interface
(`src/reminders/channel.ts`) — switching to Telegram or iOS means replacing one
implementation.

## Running it

Step by step in [ЗАПУСК.md](ЗАПУСК.md) *(in Russian)*: local run, deploying to
Cloudflare with notifications, installing on a phone, and what to check when a
push doesn't arrive.

Short version:

```bash
npm install
npm run dev        # run locally
npm run deploy     # build and ship
```

## Data from the book

The vocabulary is **not** in this repository. Those 797 words are a direct
extract from the book's appendix, and shipping them with the code would not be
right. `src/content/emotionWords.generated.ts` is gitignored; in its place sits
`emotionWords.example.ts`, a small independent set of 8 groups.
`scripts/ensure-emotions.mjs` drops it in before a build when the full
vocabulary is absent, so a fresh clone builds and runs straight away. An
existing full vocabulary is left untouched.

Build the full one from your own copy of the book:

```bash
python scripts/extract-emotions.py "path/to/book.pdf"
```

The script has no dependencies — the PDF is parsed with the Python standard
library. The PDF itself is gitignored.

## License

MIT — see [LICENSE](LICENSE). The book and its contents are not covered by it.
