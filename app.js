"use strict";
const KEY = "mm.v1";
const CATS = ["Food", "Transport", "Phone & internet", "Tobacco", "Health", "Going out", "Home items", "Education", "Debt", "Other"];
const INCOME_KINDS = ["Loan", "Money back", "Gift", "Other"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthOf = s => s.slice(0, 7);
const thisMonth = () => monthOf(iso(new Date()));
const shiftMonth = (k, n) => { const d = new Date(+k.slice(0, 4), +k.slice(5) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthName = (k, opts = { month: "short", year: "numeric" }) => new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleString("en-US", opts);
const round2 = n => Math.round(n * 100) / 100;
const money = n => { n = round2(n); return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
// Shifts end after midnight, so anything logged before 5am belongs to the previous day.
const defaultDate = () => { const d = new Date(); if (d.getHours() < 5) d.setDate(d.getDate() - 1); return iso(d); };

function defaults() {
  return {
    version: 1,
    settings: { rate: 2.3, transport: 6.67, goalPct: 30 },
    bills: [{ id: uid(), name: "Phone & internet", amount: 67, cat: "Phone & internet" }],
    goals: [
      { id: uid(), name: "Clear the debt", target: 34, start: 0, note: "Last of the $400 loan" },
      { id: uid(), name: "Buy a UPS", target: 180, start: 0, note: "" },
      { id: uid(), name: "Emergency fund", target: 2520, start: 0, note: "6 months of personal spending" },
      { id: uid(), name: "Car + investing", target: null, start: 0, note: "70% car, 30% investing, once the emergency fund is full" },
    ],
    entries: [],
    hours: { "2026-09": 232 },
    reminders: [{ id: uid(), title: "Log today's tips & spending", time: "01:00", days: [0, 1, 2, 3, 4, 5, 6] }],
  };
}
const isValid = s => s && s.version === 1 && s.settings && Array.isArray(s.goals) && Array.isArray(s.entries) && Array.isArray(s.bills) && Array.isArray(s.reminders) && s.hours && typeof s.hours === "object";

let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
if (!isValid(S)) S = defaults();
S.invest ||= {};
S.migrated ||= [];
// One-time fix for entries logged before income/investment/one-off types existed (backup of 2026-10-20).
if (!S.migrated.includes("2026-10-types")) {
  const fixes = {
    bbo0cnckpczr: [50, { type: "income", kind: "Loan" }],
    py3i4xfrdjai: [100, { type: "invest", dir: "out", account: "CFI" }],
    dihsu1aesosu: [50, { type: "invest", dir: "out", account: "CFI" }],
    "2dafaql68vj8": [100, { type: "invest", dir: "in", account: "CFI" }],
    "0dxhjlgs0u8n": [50, { type: "invest", dir: "in", account: "CFI" }],
    o6b5aln68kxf: [252, { cat: "Education", oneoff: true }],
    "33r6d5b69sf3": [24, { oneoff: true }],
    "5k0tj7z8ijsc": [60, { cat: "Debt", oneoff: true }],
    "2u0gyq4s25uf": [26, { cat: "Phone & internet" }],
    qgg78c8s5hz3: [15, { cat: "Home items", oneoff: true }],
    oft5dbnkodgi: [10, { cat: "Other", oneoff: true }],
    "7gg67g4wf0f3": [1.5, { cat: "Tobacco" }],
    m0c0oqlykv4w: [10, { cat: "Tobacco" }],
    "7xd8wnus1v0f": [30, { cat: "Going out" }],
  };
  for (const e of S.entries) {
    const f = fixes[e.id];
    if (!f || e.amount !== f[0]) continue;
    Object.assign(e, f[1]);
    if (e.type !== "spend") { delete e.cat; delete e.oneoff; }
  }
  S.migrated.push("2026-10-types");
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast("Couldn't save on this phone. Free up some storage and try again."); }
}
save();
try { navigator.storage?.persist?.(); } catch {}

const ui = { tab: "today", month: thisMonth(), type: "spend", cat: "Food", goal: null, oneoff: false, kind: "Loan", dir: "in", account: "CFI", editGoal: null, editRem: null, editBill: null, editEntry: null, editInvest: null };

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el[k] = v;
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
let toastTimer;
function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }
function twoTap(btn, label, armedLabel, action) {
  btn.onclick = () => {
    if (btn.classList.contains("armed")) { action(); return; }
    btn.classList.add("armed"); btn.textContent = armedLabel;
    setTimeout(() => { btn.classList.remove("armed"); btn.textContent = label; }, 3000);
  };
  return btn;
}

function calc(m) {
  const inMonth = S.entries.filter(e => monthOf(e.date) === m);
  const sum = t => inMonth.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
  const paidFor = shiftMonth(m, -1);
  const pay = (S.hours[paidFor] || 0) * S.settings.rate;
  const tips = sum("tip"), spent = sum("spend"), toGoals = sum("goal"), other = sum("income");
  const investIn = inMonth.filter(e => e.type === "invest" && e.dir === "in").reduce((s, e) => s + e.amount, 0);
  const investOut = inMonth.filter(e => e.type === "invest" && e.dir === "out").reduce((s, e) => s + e.amount, 0);
  const everyday = inMonth.filter(e => e.type === "spend" && !e.oneoff).reduce((s, e) => s + e.amount, 0);
  const income = pay + tips;
  const reserve = income * (S.settings.goalPct || 0) / 100;
  const billsLeft = S.bills.reduce((s, b) => {
    const paid = inMonth.filter(e => e.type === "spend" && e.cat === b.cat).reduce((a, e) => a + e.amount, 0);
    return s + Math.max(0, b.amount - paid);
  }, 0);
  const goalsOut = Math.max(reserve, toGoals);
  const safe = income + other + investOut - investIn - spent - billsLeft - goalsOut;
  return { inMonth, paidFor, pay, tips, other, investIn, investOut, everyday, spent, toGoals, income, reserve, billsLeft, goalsOut, safe };
}
const goalSaved = g => (g.start || 0) + S.entries.filter(e => e.type === "goal" && e.goal === g.id).reduce((s, e) => s + e.amount, 0);
const currentGoal = () => S.goals.find(g => g.target && goalSaved(g) < g.target);

function render() {
  document.querySelectorAll("nav.tabs button").forEach(b => { if (b.dataset.tab === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  const app = document.getElementById("app");
  app.replaceChildren(...(ui.tab === "today" ? viewToday() : ui.tab === "goals" ? viewGoals() : viewMore()));
}
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; render(); scrollTo(0, 0); });

/* ---------- Today ---------- */
function viewToday() {
  const m = ui.month, cur = thisMonth(), isCur = m === cur;
  const c = calc(m);
  const out = [];
  out.push(h("header", { class: "top" },
    h("h1", null, "Michel's Money"),
    h("div", { class: "monthnav" },
      h("button", { "aria-label": "Previous month", onclick: () => { ui.month = shiftMonth(m, -1); render(); } }, "‹"),
      h("span", null, monthName(m)),
      h("button", { "aria-label": "Next month", disabled: m >= cur, onclick: () => { ui.month = shiftMonth(m, 1); render(); } }, "›"))));

  const now = new Date();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = dim - now.getDate() + 1;
  const perDay = c.safe / daysLeft;
  const rows = [
    [`Pay for ${monthName(c.paidFor, { month: "long" })} hours`, c.pay],
    ["Tips", c.tips],
    c.other ? ["Other income", c.other] : null,
    c.investIn || c.investOut ? ["Investments (out − in)", c.investOut - c.investIn] : null,
    S.bills.length ? ["Bills still to pay", -c.billsLeft] : null,
    c.goalsOut ? [c.toGoals > c.reserve ? "Put toward goals" : `Kept for goals (${S.settings.goalPct}%)`, -c.goalsOut] : null,
    ["Spent", -c.spent],
  ].filter(Boolean);
  out.push(h("section", { class: "hero", "aria-label": "Safe to spend" },
    h("span", { class: "label" }, isCur ? "Safe to spend this month" : `Left over in ${monthName(m, { month: "long" })}`),
    h("span", { class: "big" + (c.safe < 0 ? " neg" : "") }, money(c.safe)),
    isCur ? h("span", { class: "perday" }, c.safe > 0 ? [h("b", null, money(perDay)), ` a day for the next ${daysLeft} day${daysLeft > 1 ? "s" : ""}`] : "You're over for this month. Hold off on extras until next pay.") : null,
    h("div", { class: "math" }, rows.map(([l, v]) => h("div", null, h("span", null, l), h("span", null, (v < 0 ? "−" : "+") + money(Math.abs(v))))))));

  out.push(addPanel());
  out.push(payPanel(m));
  out.push(logPanel(c));
  return out;
}

const TYPES = [["spend", "Spent"], ["tip", "Tips"], ["income", "Income"], ["invest", "Invest"], ["goal", "Goal"]];
const accounts = () => [...new Set(["CFI", ...Object.keys(S.invest), ...S.entries.filter(e => e.type === "invest").map(e => e.account)])].filter(Boolean);
const isIn = e => e.type === "tip" || e.type === "income" || (e.type === "invest" && e.dir === "out");
const entryColor = e => ({ spend: "var(--spend)", tip: "var(--tip)", income: "var(--tip)", invest: "var(--muted)", goal: "var(--cedar)" })[e.type];
function entryName(e) {
  if (e.type === "spend") return e.cat;
  if (e.type === "tip") return "Tips";
  if (e.type === "income") return `Income · ${e.kind || "Other"}`;
  if (e.type === "invest") return `${e.account} · ${e.dir === "in" ? "put in" : "took out"}`;
  return S.goals.find(g => g.id === e.goal)?.name || "Deleted goal";
}
function chipGroup(options, selected, onPick) {
  const box = h("div", { class: "chips" });
  for (const [v, l] of options) {
    const b = h("button", { type: "button", "aria-pressed": String(v === selected) }, l);
    b.onclick = () => { box.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(v); };
    box.append(b);
  }
  return box;
}
// Type-specific fields; writes picks into v (ui for the add form, a draft copy in the editor).
function detailFields(type, v, onChange) {
  if (type === "spend") {
    const one = h("button", { type: "button", class: "toggle", "aria-pressed": String(!!v.oneoff) }, "One-off, not everyday");
    one.onclick = () => { v.oneoff = !v.oneoff; one.setAttribute("aria-pressed", String(v.oneoff)); };
    return [chipGroup(CATS.map(c => [c, c]), v.cat, x => v.cat = x), one];
  }
  if (type === "income") return [chipGroup(INCOME_KINDS.map(k => [k, k]), v.kind, x => v.kind = x)];
  if (type === "invest") {
    const acc = h("input", { type: "text", maxlength: "30", value: v.account || "", placeholder: "Account, e.g. CFI", "aria-label": "Account" });
    acc.oninput = () => { v.account = acc.value.trim(); onChange(); };
    const accChips = chipGroup(accounts().map(a => [a, a]), v.account, x => { v.account = x; acc.value = x; onChange(); });
    return [chipGroup([["in", "Put in"], ["out", "Took out"]], v.dir, x => v.dir = x), accChips, acc];
  }
  if (type === "goal") {
    if (!S.goals.some(g => g.id === v.goal)) v.goal = (currentGoal() || S.goals[0])?.id || null;
    if (!S.goals.length) return [h("p", { class: "hint" }, "Add a goal in the Goals tab first.")];
    return [chipGroup(S.goals.map(g => [g.id, g.name]), v.goal, x => { v.goal = x; onChange(); })];
  }
  return [];
}
function buildEntry(type, amount, date, note, v, base = {}) {
  const e = { id: base.id || uid(), type, amount: round2(amount), date, note: note || "", ts: base.ts || Date.now() };
  if (type === "spend") { e.cat = v.cat; if (v.oneoff) e.oneoff = true; }
  if (type === "income") e.kind = v.kind || "Other";
  if (type === "invest") { e.dir = v.dir || "in"; e.account = v.account || "CFI"; }
  if (type === "goal") e.goal = v.goal;
  return e;
}
const entryOk = (type, amount, v) => amount > 0 && (type !== "goal" || !!v.goal) && (type !== "invest" || !!v.account);

function addPanel() {
  const amount = h("input", { id: "amount", class: "amount", type: "number", inputmode: "decimal", min: "0", step: "0.01", placeholder: "$0.00", "aria-label": "Amount" });
  const date = h("input", { id: "date", type: "date", value: defaultDate(), "aria-label": "Date" });
  const note = h("input", { id: "note", type: "text", maxlength: "80", placeholder: "Note (optional)", "aria-label": "Note" });
  const addBtn = h("button", { class: "btn", disabled: true }, "Add");
  const validate = () => { addBtn.disabled = !entryOk(ui.type, parseFloat(amount.value), ui); };
  amount.oninput = validate;

  const seg = h("div", { class: "seg seg5", role: "group", "aria-label": "Entry type" },
    TYPES.map(([t, l]) => h("button", { "aria-pressed": String(ui.type === t), onclick: () => {
      ui.type = t; const keep = [amount.value, note.value, date.value]; render();
      const a = document.getElementById("amount");
      [a.value, document.getElementById("note").value, document.getElementById("date").value] = keep;
      a.dispatchEvent(new Event("input"));
    } }, l)));

  addBtn.onclick = () => {
    const v = parseFloat(amount.value);
    if (!entryOk(ui.type, v, ui)) return;
    const entry = buildEntry(ui.type, v, date.value || defaultDate(), note.value.trim(), ui);
    ui.oneoff = false;
    addEntry(entry);
  };
  const t = S.settings.transport;
  const quick = ui.type === "spend" ? h("div", { class: "quick" },
    h("button", { onclick: () => addEntry(buildEntry("spend", t, date.value || defaultDate(), "Transport", { cat: "Transport" })) }, `+ Transport ${money(t)}`),
    h("button", { onclick: () => addEntry(buildEntry("spend", t * 2, date.value || defaultDate(), "Transport, round trip", { cat: "Transport" })) }, `+ Round trip ${money(round2(t * 2))}`)) : null;
  setTimeout(validate);
  return h("section", { class: "panel", "aria-label": "Add" }, seg,
    h("div", { class: "row" }, h("div", { style: "flex:1;min-width:0" }, amount), h("div", { style: "flex:1.15;min-width:0" }, date)),
    detailFields(ui.type, ui, validate), note, addBtn, quick);
}
function addEntry(entry) {
  S.entries.push(entry); save();
  ui.month = monthOf(entry.date);
  render();
  toast(`Added ${money(entry.amount)} · ${entryName(entry)}`);
}

function payPanel(m) {
  const prev = shiftMonth(m, -1);
  const hoursInput = (key) => h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "0.5", placeholder: "0", value: S.hours[key] ?? "",
    onchange: ev => { const v = parseFloat(ev.target.value); if (isNaN(v) || v <= 0) delete S.hours[key]; else S.hours[key] = v; save(); render(); } });
  return h("section", { class: "panel", "aria-label": "Hours and pay" },
    h("h2", null, "Hours & pay"),
    h("div", { class: "paygrid" },
      h("label", { class: "f" }, `${monthName(prev, { month: "long" })} hours`, hoursInput(prev), h("small", null, `Paid ${monthName(m, { month: "short" })} 1–5 · ${money((S.hours[prev] || 0) * S.settings.rate)}`)),
      h("label", { class: "f" }, `${monthName(m, { month: "long" })} hours so far`, hoursInput(m), h("small", null, `Paid ${monthName(shiftMonth(m, 1), { month: "short" })} 1–5 · ${money((S.hours[m] || 0) * S.settings.rate)}`))));
}

function entryEditor(e) {
  const v = { cat: e.cat || "Food", oneoff: !!e.oneoff, kind: e.kind || "Loan", dir: e.dir || "in", account: e.account || "CFI", goal: e.goal || null };
  let type = e.type;
  const amount = h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "0.01", value: e.amount, "aria-label": "Amount" });
  const date = h("input", { type: "date", value: e.date, "aria-label": "Date" });
  const note = h("input", { type: "text", maxlength: "80", value: e.note || "", placeholder: "Note (optional)", "aria-label": "Note" });
  const details = h("div", { style: "display:flex;flex-direction:column;gap:10px" });
  const draw = () => details.replaceChildren(...detailFields(type, v, () => {}));
  const seg = chipGroup(TYPES, type, x => { type = x; draw(); });
  draw();
  const del = twoTap(h("button", { class: "btn small ghost del" }, "Delete"), "Delete", "Tap again to delete", () => {
    S.entries = S.entries.filter(x => x.id !== e.id); ui.editEntry = null; save(); render(); toast("Entry deleted");
  });
  return h("div", { class: "editor", style: "margin-block:6px" },
    seg,
    h("div", { class: "row" }, h("div", { style: "flex:1;min-width:0" }, amount), h("div", { style: "flex:1.15;min-width:0" }, date)),
    details, note,
    h("div", { class: "actions" },
      h("button", { class: "btn small", onclick: () => {
        const a = parseFloat(amount.value);
        if (!entryOk(type, a, v) || !date.value) { toast("Check the amount, date and details."); return; }
        const i = S.entries.findIndex(x => x.id === e.id);
        S.entries[i] = buildEntry(type, a, date.value, note.value.trim(), v, e);
        ui.editEntry = null; save(); render(); toast("Entry updated");
      } }, "Save"),
      h("button", { class: "btn small ghost", onclick: () => { ui.editEntry = null; render(); } }, "Cancel"), del));
}

function logPanel(c) {
  const list = c.inMonth;
  const items = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const box = h("div", { class: "log" });
  if (!items.length) box.append(h("p", { class: "empty" }, "Nothing logged this month yet."));
  let day = null;
  for (const e of items) {
    if (e.date !== day) { day = e.date; box.append(h("div", { class: "day" }, new Date(e.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }))); }
    if (ui.editEntry === e.id) { box.append(entryEditor(e)); continue; }
    box.append(h("div", { class: "item" },
      h("span", { class: "dot", style: `background:${entryColor(e)}` }),
      h("span", { class: "what" }, entryName(e), e.oneoff ? h("span", { class: "tag" }, "one-off") : null, e.note ? h("small", null, e.note) : null),
      h("span", { class: "v" }, (isIn(e) ? "+" : "−") + money(e.amount)),
      h("button", { class: "del", "aria-label": "Edit entry", onclick: () => { ui.editEntry = e.id; render(); } }, "Edit")));
  }
  const spends = list.filter(e => e.type === "spend");
  const byCat = {};
  spends.filter(e => !e.oneoff).forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  let pace = null;
  if (spends.length) {
    const first = spends.map(e => e.date).sort()[0];
    const isCur = monthOf(first) === thisMonth();
    const last = isCur ? new Date() : new Date(+first.slice(0, 4), +first.slice(5, 7), 0);
    const days = Math.max(1, Math.round((new Date(last.getFullYear(), last.getMonth(), last.getDate()) - new Date(first + "T00:00")) / 864e5) + 1);
    const oneoffs = c.spent - c.everyday;
    pace = h("div", { class: "pace" },
      h("div", null, h("small", null, "Everyday spending"), h("b", null, money(c.everyday)), h("small", null, `${money(c.everyday / days)} a day`)),
      h("div", null, h("small", null, "One-offs"), h("b", null, money(oneoffs)), h("small", null, `${spends.filter(e => e.oneoff).length} items`)));
  }
  const catLine = cats.length ? h("p", { class: "hint" }, "Everyday: " + cats.map(([k, v]) => `${k} ${money(v)}`).join(" · ")) : null;
  return h("section", { class: "panel", "aria-label": "Log" }, h("h2", null, "This month"), pace, catLine, box);
}

/* ---------- Goals ---------- */
function viewGoals() {
  const now = currentGoal();
  const list = h("div", { style: "display:flex;flex-direction:column;gap:12px" });
  S.goals.forEach((g, i) => {
    if (ui.editGoal === g.id) { list.append(goalEditor(g)); return; }
    const saved = goalSaved(g), done = g.target && saved >= g.target;
    const move = (d) => { const j = i + d; [S.goals[i], S.goals[j]] = [S.goals[j], S.goals[i]]; save(); render(); };
    list.append(h("div", { class: "goal" + (done ? " done" : g === now ? " now" : "") },
      h("span", { class: "step" }, done ? "✓" : i + 1),
      h("span", { class: "name" }, g.name),
      h("span", { class: "amt" }, g.target ? `${money(Math.min(saved, g.target))} / ${money(g.target)}` : saved ? money(saved) + " saved" : "later"),
      g.target ? h("div", { class: "track" }, h("i", { style: `width:${Math.min(saved / g.target * 100, 100)}%` })) : null,
      g.note ? h("div", { class: "note" }, g.note) : null,
      h("div", { class: "tools" },
        h("button", { class: "iconbtn", "aria-label": `Move ${g.name} up`, disabled: i === 0, onclick: () => move(-1) }, "↑"),
        h("button", { class: "iconbtn", "aria-label": `Move ${g.name} down`, disabled: i === S.goals.length - 1, onclick: () => move(1) }, "↓"),
        h("button", { class: "iconbtn", onclick: () => { ui.editGoal = g.id; render(); } }, "Edit"))));
  });
  if (ui.editGoal === "new") list.append(goalEditor({ id: "new", name: "", target: null, start: 0, note: "" }));
  if (!S.goals.length && ui.editGoal !== "new") list.append(h("p", { class: "empty" }, "No goals yet. Add your first one."));
  return [
    h("header", { class: "top" }, h("h1", null, "The plan")),
    h("p", { class: "hint" }, "Goals are paid in order, top first. Put money toward one from the Today tab with “To a goal”."),
    h("section", { class: "panel" }, list,
      ui.editGoal ? null : h("button", { class: "btn ghost", onclick: () => { ui.editGoal = "new"; render(); } }, "+ Add a goal")),
    investPanel(),
  ];
}
function investPanel() {
  const accs = accounts().filter(a => S.invest[a] || S.entries.some(e => e.type === "invest" && e.account === a));
  if (!accs.length) return null;
  return h("section", { class: "panel", "aria-label": "Investments" },
    h("h2", null, "Investments"),
    h("p", { class: "hint" }, "Log money you move in or out with “Invest” on the Today tab. Update the current value whenever you check the account."),
    accs.map(a => {
      const es = S.entries.filter(e => e.type === "invest" && e.account === a);
      const put = es.filter(e => e.dir === "in").reduce((s, e) => s + e.amount, 0);
      const took = es.filter(e => e.dir === "out").reduce((s, e) => s + e.amount, 0);
      const val = S.invest[a]?.value;
      const result = val == null ? null : val + took - put;
      const input = h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "0.01", value: val ?? "", placeholder: "Enter value",
        onchange: ev => { const x = parseFloat(ev.target.value); S.invest[a] = isNaN(x) || x < 0 ? {} : { value: round2(x), asOf: iso(new Date()) }; save(); render(); } });
      return h("div", { class: "inv" },
        h("strong", null, a),
        h("div", { class: "invgrid" },
          h("div", null, h("small", null, "Put in"), h("b", null, money(put))),
          h("div", null, h("small", null, "Taken out"), h("b", null, money(took))),
          h("div", null, h("small", null, "Still in, net"), h("b", null, money(put - took)))),
        h("label", { class: "f" }, `Current value${S.invest[a]?.asOf ? " (as of " + S.invest[a].asOf + ")" : ""}`, input),
        result == null ? null : h("p", { class: "hint", style: `color:${result >= 0 ? "var(--cedar)" : "var(--spend)"}` },
          `${result >= 0 ? "Up" : "Down"} ${money(Math.abs(result))} overall (value + taken out − put in)`));
    }));
}
function goalEditor(g) {
  const name = h("input", { type: "text", maxlength: "40", value: g.name, placeholder: "e.g. New phone" });
  const target = h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "1", value: g.target ?? "", placeholder: "Leave empty for later" });
  const start = h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "0.01", value: g.start || "", placeholder: "0" });
  const note = h("input", { type: "text", maxlength: "90", value: g.note || "", placeholder: "Optional" });
  const saveBtn = h("button", { class: "btn small", onclick: () => {
    if (!name.value.trim()) { toast("Give the goal a name."); name.focus(); return; }
    const data = { name: name.value.trim(), target: parseFloat(target.value) > 0 ? round2(parseFloat(target.value)) : null, start: parseFloat(start.value) > 0 ? round2(parseFloat(start.value)) : 0, note: note.value.trim() };
    if (g.id === "new") S.goals.push({ id: uid(), ...data }); else Object.assign(S.goals.find(x => x.id === g.id), data);
    ui.editGoal = null; save(); render(); toast("Goal saved");
  } }, "Save");
  const cancel = h("button", { class: "btn small ghost", onclick: () => { ui.editGoal = null; render(); } }, "Cancel");
  const del = g.id === "new" ? null : twoTap(h("button", { class: "btn small ghost del" }, "Delete goal"), "Delete goal", "Tap again to delete", () => {
    S.goals = S.goals.filter(x => x.id !== g.id); ui.editGoal = null; save(); render(); toast("Goal deleted");
  });
  return h("div", { class: "editor" },
    h("label", { class: "f" }, "Name", name),
    h("div", { class: "row" }, h("label", { class: "f" }, "Target ($)", target), h("label", { class: "f" }, "Already saved ($)", start)),
    h("label", { class: "f" }, "Note", note),
    h("div", { class: "actions" }, saveBtn, cancel, del));
}

/* ---------- Settings ---------- */
function numField(label, get, set, step = "0.01") {
  return h("label", { class: "f" }, label, h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step, value: get(),
    onchange: ev => { const v = parseFloat(ev.target.value); if (isNaN(v) || v < 0) { ev.target.value = get(); return; } set(v); save(); toast("Saved"); } }));
}
function viewMore() {
  const s = S.settings;
  const general = h("section", { class: "panel" }, h("h2", null, "Money"),
    h("div", { class: "row" },
      numField("Hourly rate ($)", () => s.rate, v => s.rate = v),
      numField("Daily transport ($)", () => s.transport, v => s.transport = v)),
    h("div", { class: "row" }, numField("Keep for goals (% of income)", () => s.goalPct, v => s.goalPct = Math.min(v, 100), "1")),
    h("p", { class: "hint" }, "This share of each month's pay and tips is held back from “safe to spend” for your goals."));

  const bills = h("section", { class: "panel" }, h("h2", null, "Monthly bills"),
    h("p", { class: "hint" }, "Held back from “safe to spend” until you log the payment in the matching category."),
    S.bills.map(b => ui.editBill === b.id ? billEditor(b) : h("div", { class: "item", style: "grid-template-columns:1fr auto auto" },
      h("span", { class: "what" }, b.name, h("small", null, `Counts “${b.cat}” spending`)),
      h("span", { class: "v" }, money(b.amount)),
      h("button", { class: "iconbtn", onclick: () => { ui.editBill = b.id; render(); } }, "Edit"))),
    ui.editBill === "new" ? billEditor({ id: "new", name: "", amount: "", cat: "Other" }) : null,
    ui.editBill ? null : h("button", { class: "btn ghost", onclick: () => { ui.editBill = "new"; render(); } }, "+ Add a bill"));

  const rems = h("section", { class: "panel" }, h("h2", null, "Reminders"),
    h("p", { class: "hint" }, "Reminders go into your Google Calendar as repeating events, so your phone notifies you even when this app is closed. Tap “Add to Google Calendar”, then Save in Calendar."),
    S.reminders.map(r => ui.editRem === r.id ? remEditor(r) : h("div", { class: "rem" },
      h("strong", null, r.title),
      h("span", { class: "when" }, `${fmtTime(r.time)} · ${r.days.length === 7 ? "Every day" : r.days.map(d => DAYS[d]).join(", ")}`),
      h("div", { class: "actions" },
        h("a", { class: "btn small", href: calendarUrl(r), target: "_blank", rel: "noopener" }, "Add to Google Calendar"),
        h("button", { class: "iconbtn", onclick: () => { ui.editRem = r.id; render(); } }, "Edit")))),
    ui.editRem === "new" ? remEditor({ id: "new", title: "", time: "20:00", days: [0, 1, 2, 3, 4, 5, 6] }) : null,
    ui.editRem ? null : h("button", { class: "btn ghost", onclick: () => { ui.editRem = "new"; render(); } }, "+ Add a reminder"),
    h("p", { class: "hint" }, "Changed or deleted a reminder here? Change or delete the event in Google Calendar too."));

  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: ev => importFile(ev.target.files[0]) });
  const backup = h("section", { class: "panel" }, h("h2", null, "Backup"),
    h("p", { class: "hint" }, `Everything lives only on this phone (${S.entries.length} entries). Export a backup now and then, and send it to Claude when you want a review.`),
    h("div", { class: "actions" },
      h("button", { class: "btn", onclick: exportData }, "Export backup"),
      h("button", { class: "btn ghost", onclick: () => file.click() }, "Import backup")), file);

  return [h("header", { class: "top" }, h("h1", null, "Settings")), general, bills, rems, backup];
}
function billEditor(b) {
  const name = h("input", { type: "text", maxlength: "40", value: b.name, placeholder: "e.g. Gym" });
  const amount = h("input", { class: "num", type: "number", inputmode: "decimal", min: "0", step: "0.01", value: b.amount });
  const cat = h("select", null, CATS.map(c => h("option", { value: c, selected: c === b.cat }, c)));
  const del = b.id === "new" ? null : twoTap(h("button", { class: "btn small ghost del" }, "Delete"), "Delete", "Tap again", () => { S.bills = S.bills.filter(x => x.id !== b.id); ui.editBill = null; save(); render(); });
  return h("div", { class: "editor" },
    h("label", { class: "f" }, "Name", name),
    h("div", { class: "row" }, h("label", { class: "f" }, "Amount ($)", amount), h("label", { class: "f" }, "Paid as", cat)),
    h("div", { class: "actions" },
      h("button", { class: "btn small", onclick: () => {
        const a = parseFloat(amount.value);
        if (!name.value.trim() || !(a > 0)) { toast("Add a name and an amount."); return; }
        const data = { name: name.value.trim(), amount: round2(a), cat: cat.value };
        if (b.id === "new") S.bills.push({ id: uid(), ...data }); else Object.assign(S.bills.find(x => x.id === b.id), data);
        ui.editBill = null; save(); render();
      } }, "Save"),
      h("button", { class: "btn small ghost", onclick: () => { ui.editBill = null; render(); } }, "Cancel"), del));
}
function remEditor(r) {
  const title = h("input", { type: "text", maxlength: "60", value: r.title, placeholder: "e.g. Log tips" });
  const time = h("input", { type: "time", value: r.time });
  const days = new Set(r.days);
  const dayBox = h("div", { class: "days", role: "group", "aria-label": "Days" }, DAYS.map((d, i) => {
    const b = h("button", { "aria-pressed": String(days.has(i)) }, d);
    b.onclick = () => { days.has(i) ? days.delete(i) : days.add(i); b.setAttribute("aria-pressed", String(days.has(i))); };
    return b;
  }));
  const del = r.id === "new" ? null : twoTap(h("button", { class: "btn small ghost del" }, "Delete"), "Delete", "Tap again", () => { S.reminders = S.reminders.filter(x => x.id !== r.id); ui.editRem = null; save(); render(); });
  return h("div", { class: "editor" },
    h("label", { class: "f" }, "What to remind you", title),
    h("label", { class: "f" }, "Time", time),
    dayBox,
    h("div", { class: "actions" },
      h("button", { class: "btn small", onclick: () => {
        if (!title.value.trim() || !time.value || !days.size) { toast("Add a title, a time and at least one day."); return; }
        const data = { title: title.value.trim(), time: time.value, days: [...days].sort() };
        if (r.id === "new") S.reminders.push({ id: uid(), ...data }); else Object.assign(S.reminders.find(x => x.id === r.id), data);
        ui.editRem = null; save(); render(); toast("Reminder saved. Now add it to Google Calendar.");
      } }, "Save"),
      h("button", { class: "btn small ghost", onclick: () => { ui.editRem = null; render(); } }, "Cancel"), del));
}
const fmtTime = t => { const [H, M] = t.split(":").map(Number); return `${(H % 12) || 12}:${pad(M)} ${H < 12 ? "am" : "pm"}`; };
function calendarUrl(r) {
  const [H, M] = r.time.split(":").map(Number);
  const d = new Date(); d.setHours(H, M, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  while (!r.days.includes(d.getDay())) d.setDate(d.getDate() + 1);
  const end = new Date(d.getTime() + 10 * 60000);
  const stamp = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const rule = r.days.length === 7 ? "RRULE:FREQ=DAILY" : "RRULE:FREQ=WEEKLY;BYDAY=" + r.days.map(i => RRULE_DAYS[i]).join(",");
  const p = new URLSearchParams({ action: "TEMPLATE", text: r.title, details: "Open Michel's Money and log it.", dates: `${stamp(d)}/${stamp(end)}`, recur: rule });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

async function exportData() {
  const name = `michels-money-${iso(new Date())}.json`;
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  try {
    const f = new File([blob], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: "Michel's Money backup" }); return; }
  } catch (e) { if (e?.name === "AbortError") return; }
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Backup saved to Downloads");
}
async function importFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("That file isn't a Michel's Money backup."); return; }
  if (!isValid(data)) { toast("That file isn't a Michel's Money backup."); return; }
  const app = document.getElementById("app");
  const panel = h("section", { class: "panel", style: "border-color:var(--spend)" },
    h("strong", null, `Replace everything on this phone with the backup (${data.entries.length} entries)?`),
    h("div", { class: "actions" },
      h("button", { class: "btn danger", onclick: () => { S = data; save(); ui.month = thisMonth(); render(); toast("Backup restored"); } }, "Replace"),
      h("button", { class: "btn ghost", onclick: render }, "Cancel")));
  app.prepend(panel); scrollTo(0, 0);
}

let lastDay = iso(new Date());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && iso(new Date()) !== lastDay) { lastDay = iso(new Date()); ui.month = thisMonth(); render(); }
});
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
