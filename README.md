# SOLMARA — Open-World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01-v4/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01-v4/reward.svg)](https://make.fun/bounty/gta6-01)

Bounty: [gta6-01 on make.fun](https://make.fun/bounty/gta6-01) — build an
open-world crime game. Referral: https://make.fun/r/m4psg5rh (code `m4psg5rh`).

**SOLMARA** is a sun-soaked coastal island city at golden hour: downtown
towers, a port, a beach and bay, hills to the north. You are **Dante Reyes**,
a driver who owes a debt. **Mara Voss** runs jobs out of the Ember Garage, and
the **Vultures** — led by **Silas Rook** — stand between Dante and freedom.

## Play

Serve it locally and open it in a browser (no build step, no network at runtime):

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| Mouse / F | Shoot |
| E | Enter or exit a car · lockpick · start a race (context) |
| Shift | Run (on foot) |
| Space | Jump |
| R | Cycle radio station (4 stations) |
| G | Garage — near the Ember Garage |
| C | Crew |
| B | Bribe — on foot, near police, wanted ≤ 2 ($500, −1 star) |
| 1 / 2 / 3 | Switch weapon (pistol / SMG / shotgun) |
| Esc | Pause |

## Features

- **15 missions, two story arcs** — from "First Gear" to the "Rook's Return" finale against Silas Rook
- **Crew of 3** — Mara, Jax and Lena, each with a gameplay bonus
- **Garage** — store up to 4 cars, repair, repaint, 3 upgrade levels
- **Respect ranks** — Nobody → Street Hustler → Wheelman → Made → Shot Caller → King of Solmara
- **District standing** — earn standing per district (missions, seagulls, race gold); higher tiers pay bigger mission payouts
- **3-slot save** — progress, garage, crew, respect, weapons, seagulls and district standing persist
- **4 radio stations** with DJ idents, all synthesized WebAudio (no audio files)
- **Safehouse** (heals), **4 shops**, street races (repeatable, gold/silver/bronze payouts)
- **12 Golden Seagulls** hidden across the districts (+$250 each, $2,000 bonus for all 12)
- **Wanted system** — 5 stars, SMPD cruisers, AIR-1 helicopter, roadblocks, spike strips at 4+ stars, bribes
- **3 weapons** — pistol, SMG, shotgun (pickups at the port warehouse and beach lifeguard hut)
- Traffic, pedestrians, golden-hour lighting, minimap, full HUD

## Screenshots

Four in-game renders live in `screenshots/`: the Street Kings race (cover),
the "End of the Vultures" finale, a Golden Seagull pickup on the beach, and a
wide aerial of downtown and the bay. Each is captured from the live game with
`?shot=cover|mission|activity|city`.

## Tech

Three.js r158 (vendored under `game/vendor/`), plain ES modules, WebAudio
synthesis, no runtime network requests. Entry: `game/index.html`.

## License

MIT — see [LICENSE](LICENSE).
