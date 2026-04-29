# Match Up

> Donate, the sponsor doubles it 1:1 up to the cap, the charity gets the lot.

Match Up is a small Stellar Testnet dApp where donors pledge XLM to a cause and a sponsor matches every donation 1:1 up to a fixed cap. The interesting part is the on-chain match-cap math; the rest is a friendly y2k-style UI on top. The README is in FAQ form, so feel free to skim.
<img width="1257" height="712" alt="image" src="https://github.com/user-attachments/assets/1608cde0-de91-4e4e-9643-d93353387756" />


[![CI](https://github.com/TMTriet002/charity-match/actions/workflows/ci.yml/badge.svg)](https://github.com/TMTriet002/charity-match/actions)
[![Live](https://img.shields.io/badge/live-demo-ec4899)](https://match-up-stellar.vercel.app)

## Why This Is Different

- **Sponsor 1:1 match.** Every donation triggers `min(donation, remaining_cap)` added to the matched counter. Cap-aware, can't go negative.
- **Auto-refund branch.** If the deadline passes without the sponsor closing, donors can pull their pledges out one by one. Idempotent via a `Refunded(addr)` flag.
- **Sponsor close vs charity claim.** Only the sponsor can finalise; the charity is a recipient address, not an actor.
- **Live match counter.** The UI shows `donated`/`matched` as a two-tone bar that updates as new donations land.
- **Y2K bubbly UI.** Soft pink/purple gradient, rounded everything, pill CTAs with soft shadows.

## FAQ

### What is this?

A donor pool with a sponsor-matched bonus. The sponsor pre-commits a match cap; for every XLM donated, the contract bumps a "matched" counter by `min(donation, remaining_cap)`. When the sponsor closes the campaign, the charity receives `donated + matched`. If the deadline passes without close, donors can refund.

### What does it do on-chain?

The contract stores: charity address, sponsor address, title, match_cap, donated total, matched total, deadline, donor count, and per-address donation + refunded flags. Three writes: `donate(donor, amount)`, `close(sponsor)`, `refund(donor)`. Three reads: `info()`, `donation_of(donor)`, `refunded(donor)`. State machine is just Open -> Closed (refunds happen in the Open-after-deadline branch). Amounts live as `i128` stroops; the contract is accounting only and does not custody real XLM via the SAC.

### How do I run it locally?

```bash
git clone https://github.com/TMTriet002/charity-match.git
cd charity-match
npm install
cp .env.example .env.local
./scripts/deploy.sh alice
npm run dev
```

Open http://localhost:3000 and connect a wallet.

### What environment variables does it need?

See `.env.example`. Two project-specific ones:

- `NEXT_PUBLIC_MAIN_CONTRACT_ID` - written by the deploy script.
- `NEXT_PUBLIC_SPONSOR_ADDRESS` - the sponsor's address. The "Close" button only appears for this account.

### What contracts are deployed?

| Item | Address |
|---|---|
| Main contract | _(filled in after `scripts/deploy.sh`)_ |
| Network | Stellar Testnet |
| Sample tx | _(paste a `donate` or `close` hash here)_ |

### Is there a live demo?

Yes - https://match-up-stellar.vercel.app. Open it on a phone, connect a wallet, and try a donation. The sponsor's match counter ticks up live alongside the donated total.

### Where is the demo video?

_1-min walkthrough goes here once recorded._

### How do I deploy my own contracts?

```bash
TITLE="Free WiFi at the library" \
MATCH_CAP_XLM=200 \
DEADLINE_SECS=604800 \
SPONSOR=$(stellar keys address bob) \
./scripts/deploy.sh alice
```

`scripts/deploy.sh` builds `contract/main`, deploys with the constructor args, and writes the contract id + sponsor address into `.env.local`. Without overrides the deployer is both charity and sponsor (handy for testing).

### How do the tests work?

```bash
cd contract && cargo test
```

Eight tests covering: 1:1 matching on the happy path, cap enforcement on a donation that exceeds the remaining cap, donor-count dedupe across re-donations, deadline guard, sponsor close + payout math, non-sponsor close rejection, refund-after-deadline, and refund-after-close rejection.
<img width="680" height="190" alt="image" src="https://github.com/user-attachments/assets/57aa8355-0b43-462c-a453-13af7dff518c" />


### Does CI run?

Yes. `.github/workflows/ci.yml` runs `cargo test` on the contract and `next build` on the frontend. The badge at the top of this README links to the latest run.

### How does deployment work?

Frontend: Vercel's GitHub integration auto-builds on every push to `main` using the config in `vercel.json`. Contract: manual via `scripts/deploy.sh` (keeps the Stellar signing key out of CI secrets, where it has no business being). Step-by-step is in [`deployment.md`](./deployment.md).

### What about mobile?

Mobile-first. The CTA pill stays full width below 640px, the gradient bar collapses to two stacked rows, the wallet button shows only the address shorthand. 
<img width="423" height="646" alt="image" src="https://github.com/user-attachments/assets/9c86cabb-59ba-4782-a1d1-19086e47df0c" />


### What errors does it handle?

- `WalletNotFoundError` - no Stellar wallet detected in the browser.
- `UserRejectedError` - user dismissed the wallet's confirmation dialog.
- `InsufficientBalanceError` - account does not have enough XLM for the fee.

### What is NOT in here on purpose?

No REST API endpoints, no server-side caching, no telemetry, no auth beyond wallet connect, no fee bump, no Reflector or Stellar Asset Contract integration. The point is the state machine plus a polished UI; everything else is deliberately out of scope.
