"""Crisis-period statistics for Brent (FMP daily closes): swing lows, drawdowns, volatility,
and a zero-drift GBM 'minimum over horizon' band used as a statistical cross-check."""
import csv, math, sys
from datetime import date
from statistics import NormalDist, median

path = sys.argv[1]
rows = []
with open(path) as f:
    for r in csv.DictReader(f):
        d = date.fromisoformat(r["date"])
        if d.weekday() < 5:  # drop Sunday-evening prints
            rows.append((d, float(r["brent"])))
# collapse exchange-holiday duplicates (same price as the next day)
clean = [rows[0]]
for d, p in rows[1:]:
    clean.append((d, p))
rows = clean
dates = [d for d, _ in rows]
px = [p for _, p in rows]

war = date(2026, 2, 28)
pre = [p for d, p in rows if d < war]
print(f"Pre-war (Jan 1 - Feb 27): min {min(pre):.2f}  max {max(pre):.2f}  last {pre[-1]:.2f}")
crisis = [(d, p) for d, p in rows if d >= war]
cd = [d for d, _ in crisis]; cp = [p for _, p in crisis]
print(f"Crisis (Mar 2 - Oct 8): n={len(cp)}  min {min(cp):.2f} on {cd[cp.index(min(cp))]}  max {max(cp):.2f} on {cd[cp.index(max(cp))]}  mean {sum(cp)/len(cp):.2f}  median {median(cp):.2f}")

def vol(ps):
    r = [math.log(b / a) for a, b in zip(ps, ps[1:])]
    m = sum(r) / len(r)
    return math.sqrt(sum((x - m) ** 2 for x in r) / (len(r) - 1)) * math.sqrt(252)
print(f"Realized vol (annualized): crisis {vol(cp):.0%}, last 60d {vol(cp[-61:]):.0%}, last 20d {vol(cp[-21:]):.0%}")

# swing lows: local minima within +/- 5 trading days
print("\nSwing lows (local min over +/-5 trading days) during crisis:")
k = 5
for i in range(len(cp)):
    lo, hi = max(0, i - k), min(len(cp), i + k + 1)
    if cp[i] == min(cp[lo:hi]) and 0 < i < len(cp) - 1:
        # rebound within next 10 trading days
        fwd = cp[i + 1:i + 11]
        reb = (max(fwd) / cp[i] - 1) if fwd else float('nan')
        print(f"  {cd[i]}  {cp[i]:7.2f}   max rebound next 10d: {reb:+.0%}")

print("\nSwing highs (local max over +/-5 trading days):")
for i in range(len(cp)):
    lo, hi = max(0, i - k), min(len(cp), i + k + 1)
    if cp[i] == max(cp[lo:hi]) and 0 < i < len(cp) - 1:
        print(f"  {cd[i]}  {cp[i]:7.2f}")

# worst drawdown from each start date within the next 63 trading days (3 months)
H = 63
dd = []
for i in range(len(cp) - H):
    window = cp[i + 1:i + 1 + H]
    dd.append((min(window) / cp[i] - 1, cd[i]))
if dd:
    vals = sorted(v for v, _ in dd)
    q = lambda p: vals[min(len(vals) - 1, int(p * len(vals)))]
    print(f"\nWorst 3-month (63d) drawdown from each crisis start date: n={len(vals)}  median {median(vals):+.0%}  25th pct {q(0.25):+.0%}  10th pct {q(0.10):+.0%}  worst {vals[0]:+.0%}")

# zero-drift GBM: probability the minimum over T falls below L is 2*Phi(ln(L/S)/(sigma*sqrt(T)))
S = cp[-1]
T = 0.25
N = NormalDist()
print(f"\nGBM minimum-over-3-months band from S={S:.2f} (zero drift):")
for sigma in (0.35, 0.45, 0.55):
    for prob in (0.10, 0.25, 0.50):
        z = N.inv_cdf(prob / 2)
        L = S * math.exp(z * sigma * math.sqrt(T))
        print(f"  sigma {sigma:.0%}: {prob:.0%} chance the 3-month low is below {L:6.2f}")
