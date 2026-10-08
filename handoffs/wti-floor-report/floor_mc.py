"""Stylized Monte Carlo for the WTI front-month over the next ~63 trading days (Oct 9 2026 - Jan 8 2027),
conditional on the BASE scenario (no deal, closures persist).

Log price mean-reverts toward a no-deal 'fundamental anchor' with diffusion plus headline jumps:
  - down-jumps: deal/talks rumours, release announcements, demand scares (they fade, because no deal lands)
  - up-jumps: tanker/pipeline attacks, strike threats
Parameters are calibrated so total daily volatility (~3.2%) matches the ~50% annualized realized/implied
vol seen since August (Brent 20-60d realized 51-54%, OVX 48.6 on Oct 7)."""
import math, random, statistics, sys

random.seed(20261008)
N = 40000
DAYS = 63
S0 = float(sys.argv[1]) if len(sys.argv) > 1 else 92.75
ANCHOR_MED = float(sys.argv[2]) if len(sys.argv) > 2 else 91.0
ANCHOR_SD = 0.05            # uncertainty in the no-deal fair value
ANCHOR_DRIFT = 0.005 / 21   # +0.5%/month: buffers thin as emergency barrels run out
KAPPA = math.log(2) / 12    # 12-trading-day half-life back to the anchor
SIG = 0.022                 # daily diffusion
LD, JD, JDS = 1.0 / 21, -0.07, 0.03   # ~1 down-jump a month, -7% +/- 3%
LU, JU, JUS = 1.0 / 21, 0.06, 0.03    # ~1 up-jump a month, +6% +/- 3%

levels = [90, 85, 83, 80, 78, 75, 70]
hit_daily = {L: 0 for L in levels}
hit_weekly = {L: 0 for L in levels}
mins_d, mins_w, ends = [], [], []
for _ in range(N):
    a = math.log(ANCHOR_MED) + random.gauss(0, ANCHOR_SD)
    x = math.log(S0)
    md = mw = S0
    for t in range(1, DAYS + 1):
        a += ANCHOR_DRIFT
        x += KAPPA * (a - x) + random.gauss(0, SIG)
        if random.random() < LD:
            x += random.gauss(JD, JDS)
        if random.random() < LU:
            x += random.gauss(JU, JUS)
        p = math.exp(x)
        md = min(md, p)
        if t % 5 == 0:
            mw = min(mw, p)
    mins_d.append(md); mins_w.append(mw); ends.append(math.exp(x))
    for L in levels:
        hit_daily[L] += md < L
        hit_weekly[L] += mw < L

def pct(v, q):
    s = sorted(v); return s[int(q * (len(s) - 1))]

print(f"S0={S0}  anchor median={ANCHOR_MED}  paths={N}")
print("P(close below level at least once before Jan 8):")
for L in levels:
    print(f"  ${L}: daily close {hit_daily[L]/N:5.0%}   weekly close {hit_weekly[L]/N:5.0%}")
print("3-month minimum, daily closes : " + "  ".join(f"p{int(q*100)} {pct(mins_d,q):.1f}" for q in (0.05, 0.10, 0.20, 0.50)))
print("3-month minimum, weekly closes: " + "  ".join(f"p{int(q*100)} {pct(mins_w,q):.1f}" for q in (0.05, 0.10, 0.20, 0.50)))
print(f"Jan 8 level: p10 {pct(ends,0.10):.1f}  median {statistics.median(ends):.1f}  p90 {pct(ends,0.90):.1f}")
dr = [math.log(b) for b in ends]
print(f"(check) implied annualized vol of log level change ~ {statistics.pstdev([d - math.log(S0) for d in dr]) / math.sqrt(DAYS/252):.0%}")
