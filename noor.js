/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentMode = '';
let apiKey = '';
const modeHistory = { goal:[], build:[], buy:[], what:[], debt:[], subs:[] };

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  const el = document.getElementById('hdr-date');
  if(el) el.textContent = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  // Pre-render all data panels so stats are correct on first switch
  renderSubCards();
  updateSubStats();
  applyExtraPayment(); // initialises debt panel with $200 extra payment from the input default
  renderWishlist();
  renderWasteHistory(); // seed with initial entry
  // Sparkline drawn after user enters app (canvas is hidden, offsetWidth=0 here)
});

/* ══════════════════════════════════════
   ONBOARDING -> APP
══════════════════════════════════════ */
function enterApp(mode) {
  const stored = sessionStorage.getItem('noor_key');
  if(stored) apiKey = stored;
  showApp(mode);
}

function showKeyModal() {
  document.getElementById('layer-key').style.display = 'flex';
}

function submitKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if(!val.startsWith('sk-or-')) {
    const inp = document.getElementById('api-key-input');
    const wrap = inp.closest('.key-input-wrap');
    if(wrap) { wrap.style.borderColor = 'var(--danger)'; wrap.style.boxShadow = '0 0 0 3px rgba(255,77,109,0.2)'; }
    inp.value = '';
    inp.placeholder = 'Must start with sk-or-\u2026';
    setTimeout(() => {
      if(wrap) { wrap.style.borderColor = ''; wrap.style.boxShadow = ''; }
      inp.placeholder = 'sk-or-\u2026';
    }, 2500);
    return;
  }
  apiKey = val;
  sessionStorage.setItem('noor_key', val);
  document.getElementById('layer-key').style.display = 'none';
  if(window._pendingSend) { window._pendingSend(); window._pendingSend = null; }
}

function showApp(mode) {
  document.getElementById('layer-onboard').style.display = 'none';
  document.getElementById('layer-app').style.display = 'block';
  switchMode(mode);
  // Draw sparkline after layout is visible so canvas has real dimensions
  if(mode === 'goal') setTimeout(drawSparkline, 80);
}

/* ══════════════════════════════════════
   MODE SWITCHING
══════════════════════════════════════ */
const modeLabels = {
  goal:  { pill:'Goal Coach',       title:'Good morning, Manish',  placeholder:'Ask about your goals, budget, or spending\u2026' },
  build: { pill:'Budget Builder',   title:'Build your budget',     placeholder:'Tell me about your income, bills, or life changes\u2026' },
  buy:   { pill:'Buy or Wait',      title:'Purchase Advisor',      placeholder:'What are you thinking of buying?' },
  what:  { pill:'What If Planner',  title:'Scenario Planner',      placeholder:'What scenario do you want to explore?' },
  debt:  { pill:'Debt Destroyer',   title:'Debt Payoff Planner',   placeholder:'Ask about your debts, strategy, or extra payments\u2026' },
  subs:  { pill:'Sub Auditor',      title:'Subscription Auditor',  placeholder:'List your subscriptions \u2014 name and price\u2026' },
};

const ALL_MODES = ['goal','build','buy','what','debt','subs'];

function switchMode(mode) {
  const appLayer = document.getElementById('layer-app');
  const alreadyVisible = appLayer && appLayer.style.display !== 'none' && appLayer.style.display !== '';
  // Allow re-entry when entering app for first time; block only subsequent same-mode clicks
  if(mode === currentMode && alreadyVisible) {
    // Still redraw sparkline in case it rendered at 0 width
    if(mode === 'goal') setTimeout(drawSparkline, 50);
    return;
  }
  currentMode = mode;

  // Nav — remove active from all, add to current
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navEl = document.getElementById('nav-'+mode);
  if(navEl) navEl.classList.add('active');

  // Headers
  ALL_MODES.forEach(m => {
    const h = document.getElementById('hdr-'+m);
    if(h) h.style.display = m === mode ? 'flex' : 'none';
  });

  // Messages
  document.querySelectorAll('.msg-section').forEach(s => s.classList.remove('visible'));
  const msgsEl = document.getElementById('msgs-'+mode);
  if(msgsEl) msgsEl.classList.add('visible');

  // Suggestions
  ALL_MODES.forEach(m => {
    const s = document.getElementById('sug-'+m);
    if(s) s.style.display = m === mode ? 'flex' : 'none';
  });

  // Data panels
  document.querySelectorAll('.mode-section').forEach(s => s.classList.remove('visible'));
  const dpEl = document.getElementById('dp-'+mode);
  if(dpEl) dpEl.classList.add('visible');

  // Placeholder
  const inp = document.getElementById('chat-input');
  if(inp) inp.placeholder = modeLabels[mode].placeholder;

  // Mode-specific renders on switch
  if(mode === 'subs') { renderSubCards(); updateSubStats(); }
  if(mode === 'debt') { renderDebtCards(); renderDebtTimeline(); }
  if(mode === 'goal') { setTimeout(drawSparkline, 50); setTimeout(() => { if(currentMode === 'goal') checkWasteNudge(); }, 1200); }
  if(mode === 'buy')  { renderWishlist(); }

  scrollToBottom();
}

/* ══════════════════════════════════════
   CHAT
══════════════════════════════════════ */
function handleKey(e) {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120)+'px';
}
function fillInput(btn) {
  const inp = document.getElementById('chat-input');
  inp.value = btn.textContent;
  autoResize(inp);
  inp.focus();
}
function scrollToBottom() {
  const c = document.getElementById('chat-messages');
  if(c) c.scrollTop = c.scrollHeight;
}

async function sendMessage() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if(!text) return;

  // Gate on API key only at send time
  if(!apiKey) {
    window._pendingSend = () => sendMessage();
    inp.value = text;
    showKeyModal();
    return;
  }

  inp.value = '';
  inp.style.height = 'auto';

  const container = document.getElementById('msgs-'+currentMode);

  // Append user message
  container.appendChild(buildMsg('user', text));
  scrollToBottom();

  // Track history
  modeHistory[currentMode].push({ role:'user', content: text });

  // Show typing
  const typingEl = buildTyping();
  container.appendChild(typingEl);
  scrollToBottom();

  try {
    const reply = await callOpenRouter(currentMode, modeHistory[currentMode]);
    typingEl.remove();
    modeHistory[currentMode].push({ role:'assistant', content: reply });
    container.appendChild(buildMsg('ai', reply));
    scrollToBottom();
  } catch(err) {
    typingEl.remove();
    const errMsg = err.message.includes('401') ? 'Invalid API key \u2014 click the key icon in the sidebar to update it.'
      : err.message.includes('429') ? 'Rate limit hit \u2014 wait a moment and try again.'
      : 'Something went wrong: ' + err.message;
    container.appendChild(buildMsg('ai', errMsg, true));
    scrollToBottom();
  }
}

/* ══════════════════════════════════════
   OPENROUTER API CALL
══════════════════════════════════════ */
const SYSTEM_PROMPTS = {
  goal: `You are Noor, a warm and precise personal finance coach focused on helping users track their savings goals and spending. The user (Manish) has the following financial profile:
- Monthly take-home: $5,200
- Fixed costs: $2,430/mo (rent $1,850, car $380, credit card $200)
- Savings goals: Emergency Fund ($3,840 saved of $5,000 target), Japan Trip ($820 of $3,500)
- Budget health score: 80/100
- Current month: Dining at 78% ($218/$280), Groceries 72% ($290/$400), Entertainment 43% ($48/$110)
- Left to spend this month: $1,247 with 10 days remaining

Your role: proactively track spending against goals, celebrate wins, warn early about overages, and help the user reallocate budget through conversation. Be concise, direct, and math-first. Never moralize. Always give a concrete answer before asking a follow-up question. Keep replies under 120 words.`,

  build: `You are Noor, a financial setup assistant helping users build a complete monthly budget through natural conversation — not forms.
You guide users through 5 steps: (1) income, (2) fixed costs, (3) savings goals, (4) variable spending categories, (5) review and confirm.
Currently Manish is on step 3. He has: income $5,200/mo base + $667/mo bonus avg, fixed costs $2,430/mo, leaving $2,770 unallocated.
Ask one clear question at a time. Extract numbers from natural language. When a step is complete, confirm the summary and move forward. Keep replies under 100 words.`,

  buy: `You are Noor, a sharp purchase advisor. When a user describes something they want to buy, you:
1. Check it against their current discretionary budget ($340 remaining this month, $820 total)
2. Check impact on active goals (Emergency Fund: $3,840/$5,000, Japan Trip: $820/$3,500)
3. Give a clear verdict: buy now, wait, or a specific better timing
4. Show the math: how much over, how many weeks delayed, what alternatives exist
5. Never moralize — just the numbers and the options.
Manish's next bonus (~$2,000) is due in June. Keep replies under 110 words.`,

  what: `You are Noor, a financial scenario planning assistant. When users ask "what if" questions, you:
1. Model the change against their real budget (income $5,200/mo, fixed $2,430/mo, discretionary $820/mo)
2. Show the immediate monthly impact (change in discretionary, savings rate)
3. Show the long-term impact (use 7% annual growth for investment scenarios, show 10yr and 20yr figures)
4. Surface second-order effects they might not have thought of
5. Compare 2 variations if asked
Keep projections concrete and specific. Use numbers. Keep replies under 130 words. Offer to save scenarios.`,

  debt: `You are Noor, a debt payoff strategist. Manish has three debts:
- Credit Card: $3,200 balance, 22.9% APR, $96 minimum payment
- Car Loan: $8,100 balance, 6.4% APR, $220 minimum payment
- Personal Loan: $3,280 balance, 11.5% APR, $98 minimum payment
Total minimums: $414/mo. He has discretionary budget of $820/mo.

Avalanche strategy (default): highest APR first → Credit Card → Personal Loan → Car Loan. Freedom: March 2028. Interest saved vs minimums only: $1,840.
Snowball strategy: lowest balance first → Credit Card → Personal Loan → Car Loan. Freedom: May 2028. Interest saved: $1,210.

When user asks about extra payments, calculate the new payoff date and updated interest saved. When they ask to switch strategies, confirm the trade-off clearly. Always end with the debt-freedom date. Keep responses under 130 words.`,

  subs: `You are Noor, a subscription auditor. Your job:
1. Parse any list of subscriptions the user gives you — handle messy formats, abbreviations, annual vs monthly costs
2. Confirm what you found: list each item with its normalized monthly cost
3. Calculate total monthly and annual spend
4. Flag subscriptions that are: (a) duplicates/overlapping, (b) high cost relative to typical value, (c) likely forgotten
5. Give a ranked cancellation list: start with highest cost + lowest perceived value
6. Be direct. No moralizing. Just the math and the recommendation.
7. If the user says they cancelled something, acknowledge it and update the running total.
Keep responses under 150 words. Always end with the updated monthly total.`,
};

async function callOpenRouter(mode, history) {
  if(!apiKey) throw new Error('No API key set');

  const messages = history.slice(-10).map(m => ({ role: m.role, content: m.content }));

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Noor Finance',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-8b-instruct:free',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode] },
        ...messages,
      ],
    }),
  });

  if(!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(response.status + ': ' + (err?.error?.message || response.statusText));
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/* ══════════════════════════════════════
   DOM HELPERS
══════════════════════════════════════ */
function buildMsg(type, text, isError=false) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;

  const av = document.createElement('div');
  av.className = 'msg-av ' + (type === 'ai' ? 'ai' : 'user-av');
  av.textContent = type === 'ai' ? 'N' : 'M';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if(isError) bubble.style.color = 'var(--danger)';
  bubble.textContent = text;

  div.appendChild(av);
  div.appendChild(bubble);
  return div;
}

function buildTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = `
    <div class="msg-av ai">N</div>
    <div class="typing-bubble">
      <div class="t-dot"></div>
      <div class="t-dot"></div>
      <div class="t-dot"></div>
    </div>`;
  return wrap;
}

/* ══════════════════════════════════════
   SUBSCRIPTION STATE + INTERACTIVITY
══════════════════════════════════════ */
const subs = [
  { id:1, name:'Netflix',              cost:15.49, cat:'streaming'    },
  { id:2, name:'Spotify',              cost:10.99, cat:'music'        },
  { id:3, name:'Adobe Creative Cloud', cost:54.99, cat:'productivity' },
  { id:4, name:'iCloud 200GB',         cost:2.99,  cat:'cloud'        },
  { id:5, name:'Gym membership',       cost:49.99, cat:'fitness'      },
  { id:6, name:'Hulu',                 cost:17.99, cat:'streaming'    },
  { id:7, name:'ChatGPT Plus',         cost:20.00, cat:'productivity' },
  { id:8, name:'LinkedIn Premium',     cost:39.99, cat:'productivity' },
];

function toggleSub(id) {
  const sub = subs.find(s => s.id === id);
  if(!sub) return;
  sub.flagged = !sub.flagged;
  renderSubCards();
  updateSubStats();
}

function keepSub(id) {
  const sub = subs.find(s => s.id === id);
  if(sub) { sub.flagged = false; renderSubCards(); updateSubStats(); }
}

function renderSubCards() {
  const list = document.getElementById('sub-card-list');
  if(!list) return;
  list.innerHTML = subs.map(s => `
    <div class="sub-card${s.flagged ? ' flagged' : ''}" id="sub-${s.id}">
      <div class="sub-card-top">
        <span class="sub-name${s.flagged ? ' struck' : ''}">${s.name}</span>
        <span class="sub-cost">$${s.cost.toFixed(2)}</span>
      </div>
      <div class="sub-annual">$${(s.cost * 12).toFixed(2)} / year</div>
      <div class="sub-meta">
        <span class="sub-tag ${s.cat}">${s.cat}</span>
        <div class="sub-actions">
          <button class="sub-btn keep" onclick="keepSub(${s.id})">Keep</button>
          <button class="sub-btn cancel" onclick="toggleSub(${s.id})">${s.flagged ? 'Undo' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  `).join('');
}

function updateSubStats() {
  const total = subs.reduce((a,s) => a + s.cost, 0);
  const flagged = subs.filter(s => s.flagged);
  const savings = flagged.reduce((a,s) => a + s.cost, 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setEl('sub-stat-monthly',  '$' + total.toFixed(2));
  setEl('sub-stat-annual',   '$' + (total * 12).toFixed(0));
  setEl('sub-stat-count',    subs.length);
  setEl('sub-stat-flagged',  flagged.length);
  setEl('sub-savings-monthly','$' + savings.toFixed(2) + '/mo');
  setEl('sub-savings-annual', '$' + (savings * 12).toFixed(0) + '/yr');

  const itemsEl = document.getElementById('sub-savings-items');
  if(itemsEl) {
    itemsEl.innerHTML = flagged.length === 0
      ? '<div style="font-size:11px;color:var(--text-muted)">No subscriptions flagged yet</div>'
      : flagged.map(s => `<div class="savings-item"><span>${s.name}</span><span>-$${s.cost.toFixed(2)}</span></div>`).join('');
  }
}

/* ══════════════════════════════════════
   FEATURE #2 — SPENDING TIMELINE SPARKLINE
══════════════════════════════════════ */
const SPARKLINE_DATA = {
  dining: {
    // 21 days of cumulative dining spend (realistic: big weekend spikes)
    values: [0,12,12,24,34,34,52,68,68,80,92,92,110,124,124,140,156,156,172,196,218],
    budget: 280, label: 'Dining', spent: 218, pace: 10.4
  },
  groceries: {
    values: [0,0,48,48,48,80,80,80,120,120,160,160,160,200,200,240,260,260,275,290,290],
    budget: 400, label: 'Groceries', spent: 290, pace: 13.8
  },
  all: {
    values: [0,62,114,166,228,298,396,522,622,734,876,1002,1148,1312,1442,1598,1764,1904,2060,2244,2448],
    budget: 3700, label: 'All Categories', spent: 2448, pace: 116.6
  },
};

let activeSparkline = 'dining';

function switchSparkline(key, btn) {
  activeSparkline = key;
  document.querySelectorAll('.spark-tab').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  drawSparkline();
}

function drawSparkline() {
  const canvas = document.getElementById('sparkline-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = SPARKLINE_DATA[activeSparkline];
  const vals = data.values;
  const W = canvas.offsetWidth || 300;
  const H = canvas.offsetHeight || 80;
  canvas.width = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, W, H);
  const maxVal = data.budget * 1.1;
  const pad = { top:6, right:8, bottom:4, left:4 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const toX = i => pad.left + (i / (vals.length - 1)) * chartW;
  const toY = v => pad.top + chartH - (v / maxVal) * chartH;

  // Budget line
  const budgetY = toY(data.budget);
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(245,166,35,0.35)';
  ctx.lineWidth = 1;
  ctx.moveTo(pad.left, budgetY);
  ctx.lineTo(W - pad.right, budgetY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Projected line (extrapolate to end of month)
  const daysInMonth = 30;
  const daysElapsed = 21;
  const projectedFinal = (data.spent / daysElapsed) * daysInMonth;
  const projY = toY(Math.min(projectedFinal, maxVal));
  ctx.beginPath();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(0,229,160,0.25)';
  ctx.lineWidth = 1;
  ctx.moveTo(toX(vals.length - 1), toY(vals[vals.length - 1]));
  ctx.lineTo(W - pad.right, projY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fill under line
  const grad = ctx.createLinearGradient(0, pad.top, 0, H);
  grad.addColorStop(0, 'rgba(0,229,160,0.18)');
  grad.addColorStop(1, 'rgba(0,229,160,0.0)');
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(vals[0]));
  vals.forEach((v,i) => ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(vals.length - 1), H);
  ctx.lineTo(toX(0), H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Main line
  ctx.beginPath();
  ctx.strokeStyle = '#00e5a0';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  vals.forEach((v,i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.stroke();

  // End dot
  const lastX = toX(vals.length - 1);
  const lastY = toY(vals[vals.length - 1]);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#00e5a0';
  ctx.fill();

  // Update footer
  const projected = Math.round((data.spent / daysElapsed) * daysInMonth);
  const isOver = projected > data.budget;
  const setEl = (id, val, cls) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = val;
    el.className = 'spark-foot-val' + (cls ? ' ' + cls : '');
  };
  const fmt = v => v >= 1000 ? '$' + (v/1000).toFixed(1) + 'k' : '$' + v;
  setEl('spark-current', fmt(data.spent), isOver ? 'neg' : 'warn');
  setEl('spark-budget',  fmt(data.budget));
  setEl('spark-pace',    '$' + data.pace.toFixed(1) + '/d');
  setEl('spark-projected', fmt(projected), isOver ? 'neg' : 'pos');
}

// Sparkline drawn on goal mode switch (handled in switchMode + boot below)

/* ══════════════════════════════════════
   FEATURE #3 — DEBT DESTROYER
══════════════════════════════════════ */
const debts = [
  { id:1, name:'Credit Card',    balance:3200, apr:22.9, min:96,  color:'var(--danger)' },
  { id:2, name:'Car Loan',       balance:8100, apr:6.4,  min:220, color:'var(--warn)'   },
  { id:3, name:'Personal Loan',  balance:3280, apr:11.5, min:98,  color:'var(--info)'   },
];

let debtStrategy = 'avalanche';
let debtExtra = 200;

const DEBT_PLANS = {
  avalanche: {
    order: [1,3,2], // credit card → personal loan → car
    freedomDate: 'March 2028',
    monthsLeft: 33,
    interestSaved: 1840,
  },
  snowball: {
    order: [1,3,2], // same order by coincidence here, but different dates
    freedomDate: 'May 2028',
    monthsLeft: 35,
    interestSaved: 1210,
  }
};

function setStrategy(strat) {
  debtStrategy = strat;
  document.querySelectorAll('.strat-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('strat-' + strat);
  if(btn) btn.classList.add('active');
  applyExtraPayment();
}

function applyExtraPayment() {
  const inp = document.getElementById('extra-payment');
  const raw = inp ? inp.value.replace(/[^0-9.]/g,'') : '0';
  debtExtra = parseFloat(raw) || 0;
  if(inp) inp.value = debtExtra > 0 ? '$' + debtExtra : '$0';

  const plan = DEBT_PLANS[debtStrategy];
  // Simplified: each $100 extra saves ~1.5 months and ~$150 interest
  const monthsSaved = Math.floor(debtExtra / 100) * 1.5;
  const interestBonus = Math.floor(debtExtra / 100) * 150;

  const baseMonths = plan.monthsLeft;
  const newMonths = Math.max(8, Math.round(baseMonths - monthsSaved));
  const newInterest = plan.interestSaved + interestBonus;

  // Calculate new freedom date
  const now = new Date();
  now.setMonth(now.getMonth() + newMonths);
  const newDate = now.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  const totalBal = debts.reduce((a,d) => a + d.balance, 0);
  const setEl = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('debt-freedom-date', newDate);
  setEl('debt-months-left', newMonths + ' mo');
  setEl('debt-interest-saved', '$' + newInterest.toLocaleString());
  setEl('debt-total-bal', '$' + totalBal.toLocaleString());
  setEl('debt-hdr-meta', debts.length + ' debts · free by ' + newDate.split(' ')[1]);

  renderDebtCards();
  renderDebtTimeline();
}

function renderDebtCards() {
  const list = document.getElementById('debt-card-list');
  if(!list) return;
  const plan = DEBT_PLANS[debtStrategy];
  const orderedIds = debtStrategy === 'avalanche'
    ? [...debts].sort((a,b) => b.apr - a.apr).map(d => d.id)
    : [...debts].sort((a,b) => a.balance - b.balance).map(d => d.id);

  list.innerHTML = orderedIds.map((id, rank) => {
    const d = debts.find(x => x.id === id);
    const isFirst = rank === 0;
    const pct = Math.round((1 - d.balance / (d.balance * 1.4)) * 100);
    return `
    <div class="debt-card">
      <div class="debt-card-top">
        <span class="debt-name">${d.name}</span>
        ${isFirst ? '<span class="debt-badge next">Attack now</span>' : `<span class="debt-badge" style="background:transparent;border-color:var(--border-subtle);color:var(--text-muted)">#${rank+1}</span>`}
      </div>
      <div class="debt-stats">
        <div class="debt-stat-item">
          <div class="debt-stat-lbl">Balance</div>
          <div class="debt-stat-val">$${d.balance.toLocaleString()}</div>
        </div>
        <div class="debt-stat-item">
          <div class="debt-stat-lbl">APR</div>
          <div class="debt-stat-val rate">${d.apr}%</div>
        </div>
        <div class="debt-stat-item">
          <div class="debt-stat-lbl">Min. pay</div>
          <div class="debt-stat-val">$${d.min}</div>
        </div>
      </div>
      <div class="payoff-bar-wrap">
        <div class="payoff-bar-lbl">
          <span>Paid off</span><span>${pct}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${d.color}"></div></div>
      </div>
    </div>`;
  }).join('');
}

function renderDebtTimeline() {
  const tl = document.getElementById('debt-timeline');
  if(!tl) return;
  const orderedIds = debtStrategy === 'avalanche'
    ? [...debts].sort((a,b) => b.apr - a.apr).map(d => d.id)
    : [...debts].sort((a,b) => a.balance - b.balance).map(d => d.id);

  const now = new Date();
  const monthOffsets = [4, 16, 33]; // approximate payoff months per debt
  tl.innerHTML = orderedIds.map((id, i) => {
    const d = debts.find(x => x.id === id);
    const payoffDate = new Date(now);
    payoffDate.setMonth(payoffDate.getMonth() + Math.max(4, monthOffsets[i] - Math.floor(debtExtra/100)));
    const dateStr = payoffDate.toLocaleDateString('en-US', { month:'short', year:'numeric' });
    const isFirst = i === 0;
    return `
    <div class="tl-row ${isFirst ? 'tl-active' : ''}">
      <div class="tl-lbl">${d.name}</div>
      <div class="tl-val ${isFirst ? 'pos' : ''}">${dateStr}</div>
      <div class="tl-sub">$${d.balance.toLocaleString()} at ${d.apr}% APR</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   FEATURE #4 — WISHLIST / PARKING LOT
══════════════════════════════════════ */
const DISCRETIONARY_LEFT = 340;
let wishlist = [
  { id:1, name:'Sony Camera', price:1200, date:'Mar 15, 2026', affordable: false },
  { id:2, name:'Standing Desk', price:450, date:'Apr 2, 2026', affordable: false },
];
let nextWishId = 3;

function addWishItem() {
  const nameEl = document.getElementById('wish-name-input');
  const priceEl = document.getElementById('wish-price-input');
  if(!nameEl || !priceEl) return;
  const name = nameEl.value.trim();
  const price = parseFloat(priceEl.value.replace(/[^0-9.]/g,''));
  if(!name || !price) return;
  wishlist.push({
    id: nextWishId++,
    name,
    price,
    date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
    affordable: price <= DISCRETIONARY_LEFT,
  });
  nameEl.value = '';
  priceEl.value = '';
  renderWishlist();
}

function removeWishItem(id) {
  wishlist = wishlist.filter(w => w.id !== id);
  renderWishlist();
}

function renderWishlist() {
  const el = document.getElementById('wishlist-items');
  if(!el) return;
  if(wishlist.length === 0) {
    el.innerHTML = `<div class="wishlist-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      No parked items yet. Add something you're waiting to buy.
    </div>`;
    return;
  }
  el.innerHTML = wishlist.map(w => {
    const canAfford = w.price <= DISCRETIONARY_LEFT;
    return `
    <div class="wish-card ${canAfford ? 'affordable' : ''}">
      <div class="wish-card-top">
        <span class="wish-name">${w.name}</span>
        <span class="wish-price">$${w.price.toLocaleString()}</span>
      </div>
      <div class="wish-date">Parked ${w.date}</div>
      <div class="wish-status ${canAfford ? 'ready' : 'waiting'}">
        ${canAfford
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> You can afford this now`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Need $${(w.price - DISCRETIONARY_LEFT).toLocaleString()} more`
        }
      </div>
      <div class="wish-actions">
        ${canAfford ? `<button class="wish-btn buy-now" onclick="removeWishItem(${w.id})">Buy it</button>` : ''}
        <button class="wish-btn remove" onclick="removeWishItem(${w.id})">Remove</button>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   WASTE TRACKING
══════════════════════════════════════ */
const WASTE_CAT_LABELS = {
  produce:   'Produce',
  dairy:     'Dairy',
  meat:      'Meat / Fish',
  pantry:    'Pantry / Dry',
  leftovers: 'Leftovers',
  other:     'Other',
};

// Seed with one realistic entry so the feature is visible immediately
let wasteLog = [
  {
    id: 1,
    cats: ['produce'],
    amount: 12,
    note: 'spinach and herbs',
    date: (() => {
      const d = new Date(); d.setDate(d.getDate() - 8);
      return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    })(),
  }
];
let nextWasteId = 2;
let selectedWasteCats = [];

/* ── Modal open / close ── */
function openWasteLog() {
  selectedWasteCats = [];
  document.querySelectorAll('.waste-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.waste-preset').forEach(p => p.classList.remove('active'));
  const amtInp = document.getElementById('waste-amount-input');
  const noteInp = document.getElementById('waste-note-input');
  if(amtInp) amtInp.value = '';
  if(noteInp) noteInp.value = '';

  document.getElementById('waste-overlay').style.display = 'block';
  document.getElementById('waste-modal').style.display = 'block';
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeWasteLog() {
  const overlay = document.getElementById('waste-overlay');
  const modal   = document.getElementById('waste-modal');
  if(overlay) overlay.style.display = 'none';
  if(modal)   modal.style.display   = 'none';
  document.body.style.overflow = '';
}

function toggleWasteChip(btn) {
  const cat = btn.dataset.cat;
  if(btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    selectedWasteCats = selectedWasteCats.filter(c => c !== cat);
  } else {
    btn.classList.add('selected');
    selectedWasteCats.push(cat);
  }
}

function setWasteAmount(val) {
  const inp = document.getElementById('waste-amount-input');
  if(inp) inp.value = val;
  document.querySelectorAll('.waste-preset').forEach(p => {
    p.classList.toggle('active', parseInt(p.textContent.replace(/[^0-9]/g,'')) === val);
  });
}

function submitWasteLog() {
  const amtRaw = document.getElementById('waste-amount-input')?.value;
  const note   = document.getElementById('waste-note-input')?.value.trim();
  const amount = parseFloat(amtRaw) || 0;

  if(selectedWasteCats.length === 0) {
    const chips = document.getElementById('waste-chips');
    if(chips) {
      chips.style.animation = 'none';
      void chips.offsetHeight; // force reflow
      chips.style.animation = 'shakeX 0.4s ease-out';
    }
    return;
  }
  if(amount <= 0) {
    const inp = document.getElementById('waste-amount-input');
    if(inp) { inp.focus(); inp.placeholder = 'Enter amount'; }
    return;
  }

  const now = new Date();
  wasteLog.unshift({
    id: nextWasteId++,
    cats: [...selectedWasteCats],
    amount,
    note: note || '',
    date: now.toLocaleDateString('en-US',{month:'short',day:'numeric'}),
  });

  closeWasteLog();
  renderWasteHistory();
  checkWasteNudge();
}

/* ── Render waste history in data panel ── */
function renderWasteHistory() {
  if(wasteLog.length === 0) return;

  const section = document.getElementById('waste-history-section');
  if(section) section.style.display = 'block';

  // Total wasted
  const total = wasteLog.reduce((s,e) => s + e.amount, 0);
  const groceryBudget = 400;
  const ratio = Math.round((total / groceryBudget) * 100);

  // Summary card
  const card = document.getElementById('waste-summary-card');
  if(card) {
    let insight = '';
    if(ratio >= 15) insight = `At this rate you'll waste ~$${Math.round(total*(30/21))} by month-end. Buying produce every 10 days instead of weekly could cut this by half.`;
    else if(ratio >= 8)  insight = `Waste is ${ratio}% of your grocery budget — worth watching. Consider meal-prepping to use produce before it turns.`;
    else                  insight = `Waste under 8% — you're managing well. Keep noting it and Noor will surface patterns over time.`;

    card.innerHTML = `
      <div class="waste-sum-row">
        <div class="waste-sum-val">$${total.toFixed(0)}</div>
        <div class="waste-sum-label">wasted this month</div>
      </div>
      <div class="waste-sum-ratio">${ratio}% of your $${groceryBudget} grocery budget</div>
      <div class="waste-sum-insight">${insight}</div>
    `;
  }

  // Entry list
  const list = document.getElementById('waste-log-list');
  if(list) {
    list.innerHTML = wasteLog.slice(0,6).map(e => {
      const catLabel = e.cats.map(c => WASTE_CAT_LABELS[c]).join(', ');
      const catIcon = getCatIcon(e.cats[0]);
      return `
        <div class="waste-entry">
          <div class="waste-entry-cat">
            ${catIcon}
            <span>${catLabel}${e.note ? ' — ' + e.note : ''}</span>
          </div>
          <span class="waste-entry-amt">-$${e.amount.toFixed(0)}</span>
          <span class="waste-entry-date">${e.date}</span>
        </div>
      `;
    }).join('');
  }

  // Inline stat under progress bar
  const total2 = wasteLog.reduce((s,e) => s + e.amount, 0);
  const inlineStat = document.getElementById('waste-inline-stat');
  const inlineText = document.getElementById('waste-inline-text');
  if(inlineStat) inlineStat.style.display = 'flex';
  if(inlineText) inlineText.textContent = `$${total2.toFixed(0)} wasted this month (${ratio}% of budget)`;

  // Budget builder callout
  const callout = document.getElementById('waste-build-callout');
  const calloutText = document.getElementById('waste-build-callout-text');
  if(callout) callout.style.display = 'flex';
  if(calloutText) calloutText.textContent = `You've wasted ~$${total2.toFixed(0)} on groceries so far this month — ${ratio}% of your budget. Consider buying less at once or meal-prepping to reduce this.`;
}

function getCatIcon(cat) {
  const icons = {
    produce:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0110 10c0 5.52-4.48 10-10 10S2 17.52 2 12"/><path d="M12 2C6.48 2 2 6.48 2 12"/></svg>`,
    dairy:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l2 6H6L8 2z"/><path d="M6 8v12a2 2 0 002 2h8a2 2 0 002-2V8"/></svg>`,
    meat:      `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>`,
    pantry:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
    leftovers: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
    other:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  };
  return icons[cat] || icons.other;
}

/* ── Weekly nudge — injected into Goal Coach chat ── */
let wasteNudgeFired = false;
function checkWasteNudge() {
  if(wasteNudgeFired || wasteLog.length === 0) return;
  if(currentMode !== 'goal') return;

  const total = wasteLog.reduce((s,e) => s + e.amount, 0);
  const ratio  = Math.round((total / 400) * 100);

  wasteNudgeFired = true;
  const container = document.getElementById('msgs-goal');
  if(!container) return;

  const nudgeMsg = buildMsg('ai',
    `Quick waste check: you've logged $${total.toFixed(0)} in thrown-out groceries this month — ${ratio}% of your grocery budget. ` +
    `${ratio >= 12
      ? `That's ~$${Math.round(total * 12)} a year. Buying produce twice a month instead of weekly typically cuts this by 40–50%.`
      : `You're on the lower end — good habits. Keep logging and I'll surface patterns over time.`}`
  );
  nudgeMsg.querySelector('.msg-bubble').style.borderColor = 'rgba(255,77,109,0.2)';
  container.appendChild(nudgeMsg);
  scrollToBottom();
}

// Add shake animation to CSS keyframes via JS (once)
(function addShakeKeyframe(){
  const style = document.createElement('style');
  style.textContent = `@keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`;
  document.head.appendChild(style);
})();

// Boot-time initialisation for all panels (merged into single listener in boot block above)
