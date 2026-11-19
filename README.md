# ZFT Research weekly market reads

Small Node project that saves daily source data, calculates the ZFT read, renders a 1600×1100 PNG and draw-on GIF, writes Facebook and X/Threads drafts, and checks the artifacts. Nothing posts. No account credentials are read. No host is installed or enabled by this local delivery.

| Manila slot | Start | Market |
| --- | --- | --- |
| Wednesday 20:00 | 19:45 | Gold futures (GC=F) |
| Friday 20:00 | 19:45 | S&P 500 (^GSPC), with Nasdaq (^IXIC) context |
| Sunday 20:00 | 19:45 | Bitcoin (BTC-USD) |

Each market runs once a week. Cadence stays the same when George is away; missed slots skip, with no catch-up. Choose **one** host. Actions and Vultr do not share locks, so running both could duplicate computation. There is no posting route to duplicate.

## Local offline review

Node 20 or newer. Dependencies are pinned in package.json: sharp 0.35.5 and ffmpeg-static 5.2.0. No packages were downloaded or installed for this delivery. For this Windows workstation, PowerShell:

```powershell
$env:SHARP_PATH='C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/cua_node/bin/node_modules/sharp'
$env:FFMPEG='C:/Users/Zeefreaks/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'
node src/run.js --market gold --from-dir D:/Media/Claude/market-reads-sample/data
```

That command keeps production checks, including the real slot date and deadline. For the requested historical **visual and numerical replay**, add the test-only override:

```powershell
node src/run.js --market gold --slot-id 2026-11-18-gold-test-review --from-dir D:/Media/Claude/market-reads-sample/data --ignore-deadline
node src/run.js --market us --slot-id 2026-11-20-us-test-review --from-dir D:/Media/Claude/market-reads-sample/data --ignore-deadline
node src/run.js --market btc --slot-id 2026-11-22-btc-test-review --from-dir D:/Media/Claude/market-reads-sample/data --ignore-deadline
node test/pipeline.test.js
node test/compare.js
```

**Sample replay is quarantined.** The approved sample has about 12 months of history, provisional gold/BTC endpoint candles, and a null/missing BTC day. It cannot simultaneously match the approved numbers and pass the requested completed-candle/13-month rules. `--from-dir` alone uses raw saved Yahoo JSON with strict production validation. `--from-dir` plus `--ignore-deadline` explicitly replays finite fixture rows, preserving the approved numbers. Replay can never be READY: RESULT is SKIPPED if artifact checks pass, or FAILED if they do not. `checks.json` distinguishes `assetPassed` from `productionEligible`. This is a test exception, never a live-data fallback. No invented candles or history are added.

Results are immutable per slot ID; rerunning returns its saved RESULT. Use a new `-test-...` suffix on the correct market weekday for a new replay. `test/compare.png` shows each new chart on the left and the approved sample on the right; `test/compare-phone.png` shows 400-pixel previews.

Production command: `node src/run.js --market gold` (or us/btc/pse). Default slot ID is the most recent matching Manila weekday, so a delayed run cannot silently roll forward. PSE always writes SKIPPED with `PSE history source not approved`. READY means local technical artifacts passed, not editorial approval or permission to publish.

Outputs under `runs/<slot-id>/`: raw JSON, completed-candle CSV and metadata with hashes; analysis.json; copy.json and captions.md; SVG/PNG/GIF, phone and decoded GIF previews; checks.json; RESULT.json, plus SKIPPED.json when applicable. Frames are retained for local recovery. Failures exit nonzero; intentional skips exit zero. If ffmpeg cannot spawn, PNG and frames remain with GIF-PENDING.txt, verification fails, and the keeper can run `node src/gif.js --dir <run-directory>` then verify again. The old RESULT remains the record of the failed attempt.

## Data and calculations

Yahoo chart API requests `range=2y&interval=1d`. This fallback is authorized only through **31 Dec 2026 Manila time, legal docket 49**; live fetch refuses after that cutoff. The adapter is isolated in `src/sources/yahoo.js` for replacement. Fetching was not network-tested under this job's explicit restriction. Raw fixture responses were parsed offline.

Current incomplete daily candles are removed. BTC uses the UTC day boundary; GC=F and US indices use Yahoo's regular session end for the current session and a conservative next-UTC-day boundary for older sessions. Metadata records the source timezone. Null OHLCV, bad prices, duplicate/unordered dates, BTC missing dates, missing expected US/gold sessions, and history under 13 months fail closed. An offline rule-based US holiday calendar covers normal cash-session closures; gold permits weekends, observed New Year/Christmas and Good Friday, while shortened trading days still need a candle. Exceptional exchange closures are unapproved gaps until the calendar adapter is updated. These rules were tested offline, not verified against a current exchange calendar. Stale data skips: more than four days for gold/US or two days for BTC. No live prices, news, trade recommendations or fabricated Darvas classifications.

Math follows the sample: SMA20/50/100, MA score weighted 1/2/3 (0–6), AOTS+/AOTS/iAOTS, Wilder RSI14, three-month wick support/resistance with one-month closing support, D50 midpoint in white, and Fib 23.6/38.2/50 from the six-month highest wick to the lowest later wick. Six calendar months are charted. The sample's Fib is a measured downswing reference; a bullish state does not turn it into a price promise. Copy treats a break and retest as a working scenario, with support and failure conditions. Nine trend/location states each have at least three slot-seeded headlines. Nasdaq context follows its own state. Every quoted caption number is checked against analysis; “500” in the proper name S&P 500 is an instrument label.

## Hosting, free-only

The inactive GitHub Actions definition starts at `45 11 * * 3,5,0` UTC, dispatches by Manila weekday, locks per slot, allows 30 minutes, and retains artifacts for 14 days. The application checks the 20:00 Manila deadline on entry and between stages. It records SKIPPED if the deadline passes during rendering; artifacts may exist but are ineligible. GitHub cron can be delayed. No secrets are referenced and no posting step exists. Dependency installation in that future workflow needs internet on its host; it was not run here. The first host installation generates its dependency lockfile; direct dependency versions are pinned here, transitive versions are not yet locked.

Alternative definitions in `scripts/vultr-timer/` are **not installed**. They assume a dedicated unprivileged `market-reads` user, existing `/opt/market-reads` checkout, Node/dependencies and a writable runs directory provisioned by the keeper. The timer does not catch up missed runs. CPU and memory are bounded to protect existing bots. Vultr is already-paid hosting, not a free tier: use only approved spare resources with no additional spend, resize or instance. A private Actions repo with available included minutes/storage is the free-tier candidate; quotas and account eligibility were not checked. No paid models or services are called.

## What is not done

No posting code, live scheduling, deployment, git action, network test, account authorization or token handling. No automated weekly critics: READY still requires independent editorial review before future publication. This build's two independent critic reports are separate local review records. PSE history is not approved and PSE automation is excluded. No promise of free native GIF publishing on any channel is made.

## George must do

1. Choose the host: GitHub Actions in a private repo with free minutes, or existing Vultr tr-bots with approved spare resources. Keeper enables one host only; neither is enabled here.
2. For posting later: supply a Meta app and Page token for ZFT Research, Threads authorization, and an X developer app with write access. Check that the X free tier permits media upload as well as writing; otherwise X stays manual. Verify native animated GIF support for each channel. No purchases are authorized.
3. Give his own **typed go for the first live slot**. The present job authorizes artifact generation only.
4. For PSE, give **typed OK for the TradingView snapshot** or approve a history source. Until then PSE remains SKIPPED.

See quality/BRIEF.md for the 12-item rubric. Independent critics each need at least 27/36 with no zero, at most three rounds. No builder self-score counts.
