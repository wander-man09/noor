# Noor — Personal Financial Clarity

Noor (Arabic: *نور*, light/clarity) is a personal finance chat app that puts an AI advisor directly in your pocket. Six intelligent modes cover every angle of your financial life — from daily spending to debt payoff to subscription audits — all in one dark, minimal interface.

No backend. No accounts. No tracking. Runs entirely in your browser.

---

## Features

### Six Modes

| Mode | What it does |
|------|--------------|
| **Goal Coach** | Daily financial home base — tracks savings goals, spending progress, and fires proactive nudges before you overspend |
| **Budget Builder** | Builds your monthly budget through conversation, not forms |
| **Buy or Wait** | In-the-moment purchase advisor with verdict, trade-offs, and timing |
| **What If** | Scenario planner — model job changes, extra savings, or life events |
| **Debt Destroyer** | Avalanche or snowball payoff plans with a real debt-freedom date |
| **Subscription Auditor** | Finds subscriptions draining your budget and ranks cancellation priority |

### Pantry Waste Tracking
Embedded directly in Goal Coach — log thrown-out groceries in under 20 seconds. Noor tracks your waste ratio, surfaces it when you're budgeting, and nudges you toward smarter buying habits.

### Design
- Dark-first, mint green accent (`#00e5a0`)
- SVG icons only — no emoji
- Fonts: DM Serif Display · DM Sans · JetBrains Mono
- Fully responsive down to mobile

---

## Tech Stack

Pure vanilla — no framework, no build step, no dependencies.

```
noor.html   — app shell, onboarding, all mode layouts
noor.css    — design tokens, component styles, animations
noor.js     — state, mode switching, AI calls, all interactive logic
```

AI is powered by [OpenRouter](https://openrouter.ai) using `meta-llama/llama-3.3-8b-instruct:free` — a free model that requires no payment to use.

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/noor.git
cd noor
```

### 2. Get a free OpenRouter API key

Go to [openrouter.ai/keys](https://openrouter.ai/keys) and create a free account. Copy your key — it starts with `sk-or-`.

### 3. Open the app

Just open `noor.html` in your browser. No server needed.

```bash
open noor.html        # macOS
start noor.html       # Windows
xdg-open noor.html    # Linux
```

### 4. Enter your key

The first time you send a message, Noor will prompt for your OpenRouter API key. Paste it in — it's stored in `sessionStorage` only (cleared when you close the tab, never sent anywhere except OpenRouter).

To persist the key across sessions, create a `.env` file:

```bash
cp .env.example .env
# then edit .env and paste your key
```

> Note: `.env` is gitignored — never commit your API key.

---

## Project Structure

```
noor/
├── noor.html        # App shell
├── noor.css         # All styles and design tokens
├── noor.js          # All logic
├── .env.example     # Key template
├── .gitignore
└── README.md
```

---

## Customising Your Financial Data

All financial data (income, goals, debts, subscriptions) is hardcoded in `noor.js` for the demo. Search for the following sections to update them with your own numbers:

- **Income & goals** → `SYSTEM_PROMPTS.goal` and `SYSTEM_PROMPTS.build`
- **Debts** → `const debts = [...]`
- **Subscriptions** → `const subs = [...]`
- **Wishlist** → `let wishlist = [...]`
- **Sparkline data** → `const SPARKLINE_DATA`

---

## Roadmap

- [ ] Budget Health Re-check (weekly score refresh)
- [ ] Net Worth Tracker
- [ ] Savings Rate Coach
- [ ] Persistent storage (IndexedDB) so data survives tab closes
- [ ] CSV/bank statement import
- [ ] Mobile PWA packaging

---

## License

MIT — do whatever you want with it.

---

Built by Manish · Powered by [OpenRouter](https://openrouter.ai) · No data leaves your browser
