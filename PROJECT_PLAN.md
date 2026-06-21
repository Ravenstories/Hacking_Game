# Hacking Game Project Plan

## Vision

Build a browser-based hacking game made from a set of tense, readable minigames. The player takes contracts, studies targets, chooses tools, performs hacks, manages trace risk, and grows from a low-skill operator into an elite hacker.

The game should feel like an operations console: tactical, reactive, clear, and stylish without becoming a generic dashboard.

## Core Pillars

- **Readable hacking fantasy**: hacking is represented through understandable game systems, not real-world exploit instructions.
- **Skill-gated depth**: player hacking stat changes available jobs, difficulty, interface clarity, and information quality.
- **Fast mission loop**: contracts should be playable in short sessions with clear stakes and consequences.
- **Multiple minigame types**: door hacks, safe hacks, firewall penetration, packet surveillance, and hacker-vs-AI duels.
- **Progression through mastery**: success unlocks tools, reputation, harder targets, and better intel.

## Recommended Stack

### Frontend

- **Vite + TypeScript**: fast local development and simple build pipeline.
- **React**: menus, profile screens, mission selection, HUD, tool panels, settings, and overlays.
- **Phaser 3**: 2D minigame canvas, timing puzzles, node graphs, packet streams, visual effects, and input handling.
- **Zustand**: lightweight shared state between React UI and game scenes.
- **CSS variables**: theme tokens for colors, spacing, typography, danger states, and skill-level styling.

### Backend

- **Phase 1**: local save data while prototyping.
- **Phase 2**: Supabase for user accounts, profiles, saved progress, unlocks, contract history, and leaderboards.
- **Later**: WebSocket backend only if we add real-time player-vs-player hacking.

### Testing and QA

- Unit tests for progression rules, difficulty scaling, scoring, and unlocks.
- Browser smoke tests for loading, navigation, minigame start/end, and save behavior.
- Playtest checklist for readability, difficulty curves, mobile layout, and failure clarity.

## Game Loop

1. Player opens the operations console.
2. Player chooses a contract based on available skill level, tools, and reputation.
3. Game shows target intel, with information quality based on hacking stat.
4. Player selects a tool loadout.
5. Player enters one or more hacking minigames.
6. Mistakes raise trace risk, lockout risk, or AI countermeasures.
7. Player succeeds, fails, aborts, or is traced.
8. Rewards update profile, tools, unlocks, intel, and reputation.

## Player Profile

### Core Stats

- **Hacking stat**: 1-5
- **Reputation**
- **Available tools**
- **Completed contracts**
- **Failed contracts**
- **Unlocked minigames**
- **Known targets/factions**

### Hacking Stat Behavior

| Stat | Access | Difficulty | Information Quality |
| --- | --- | --- | --- |
| 1 | Basic door hacks | Very hard timing, little forgiveness | Vague labels, noisy signals |
| 2 | Door hacks, simple safe hacks | Hard but learnable | Some hints and partial labels |
| 3 | Firewall routes, packet filters | Standard challenge | Clearer objectives and warnings |
| 4 | Advanced safes, AI counterplay | More systems, more tools | Strong intel and trace predictions |
| 5 | Elite contracts, advanced AI duels | Complex but fair | Deep system insight and rare options |

## Minigame Designs

### Door Opening Hacks

Fantasy: bypass electronic locks, badge readers, and access relays.

Possible mechanics:
- Route power through circuits before a lockout timer expires.
- Match signal patterns to spoof access.
- Balance voltage/frequency bands while avoiding detection spikes.

First implementation target:
- Circuit routing puzzle with timer, trace meter, and stat-based hints.

### Safe Hacks

Fantasy: crack physical/electronic safes using signal feedback.

Possible mechanics:
- Rotary dial timing puzzle with audio/visual feedback.
- Keypad side-channel inference.
- Thermal/noise pattern reconstruction.

First implementation target:
- Dial timing minigame with increasingly precise zones.

### Firewall Penetration

Fantasy: breach a protected network by navigating rules and detection systems.

Possible mechanics:
- Node graph traversal.
- Detection nodes, decoys, locked routes, and one-way links.
- Tools to scan, spoof, disable, or reroute.

First implementation target:
- Node graph pathfinding puzzle with trace risk.

### Wireshark / Line Surveillance

Fantasy: monitor fictional network traffic and extract useful intel.

Possible mechanics:
- Filter packet streams.
- Reconstruct messages from fragments.
- Identify credentials, commands, or target behavior.
- Higher stats reveal protocol labels and useful metadata.

First implementation target:
- Packet stream filtering puzzle with noisy data and stat-based clarity.

### Hacker vs Hacker AI

Fantasy: duel against an active defender or rival hacker.

Possible mechanics:
- Turn-based network control duel.
- Player attacks, scans, spoofs, patches, or hides.
- AI traces, blocks, decoys, locks, and counterattacks.

First implementation target:
- Turn-based duel on a small node network.

## Frontend Experience

### Main Screens

- **Operations Console**: mission board, current profile, active contracts, alerts.
- **Profile**: hacking stat, reputation, tools, unlocks, contract history.
- **Target Briefing**: target description, known defenses, payout, risk, required skill.
- **Loadout**: choose tools before starting a hack.
- **Active Hack**: Phaser minigame with React HUD around it.
- **Results**: success/failure, rewards, trace outcome, new intel, unlocks.

### Active Hack Layout

- Center: minigame playfield.
- Left: target context, objective, access status.
- Right: tools, intel, scan results.
- Bottom: trace meter, timer, connection stability, current action prompts.

### Visual Direction

- Dark operations-console base.
- Avoid pure green terminal cliche as the only identity.
- Use cyan for access/data, amber for warnings, red for trace/danger, white/gray for readable text.
- Reserve glitch effects for trace spikes, system errors, AI attacks, and mission outcomes.
- Keep the playfield clear; panels should support the hack, not bury it.

## Systems

### Difficulty Scaling

Difficulty should be calculated from:
- Player hacking stat.
- Contract security level.
- Target type.
- Chosen tools.
- Mistake count.
- Current trace level.

Low-stat players should not simply face impossible games. They should get:
- Fewer contract types.
- Less information.
- More noise.
- Less forgiving timing.
- Fewer tool options.

High-stat players should get:
- More contract types.
- More information.
- More complex systems.
- Better tools.
- More strategic choices.

### Trace System

Trace is the main tension mechanic.

Trace increases when:
- The player makes a mistake.
- The player uses loud tools.
- Time runs long.
- The AI successfully counters.

Trace decreases or pauses when:
- The player uses stealth tools.
- The player completes optional cleanup actions.
- The player routes through safe nodes.

Failure states:
- Lockout.
- Partial success with reduced rewards.
- Trace event.
- Tool burned.
- Contract reputation penalty.

### Tools

Initial tool ideas:
- **Scanner**: reveals hidden routes or useful packet metadata.
- **Spoof Token**: bypasses one auth check.
- **Packet Filter**: reduces noise in surveillance puzzles.
- **Signal Stabilizer**: slows trace gain temporarily.
- **Rollback**: undo one mistake.
- **Exploit Kit**: opens a risky shortcut.

## Milestones

### Milestone 0: Project Setup

- [x] Initialize Vite + React + TypeScript project.
- [x] Add Phaser.
- [x] Add Zustand.
- [ ] Set up linting/formatting.
- [x] Create basic app shell.
- [x] Create theme variables.
- [x] Add placeholder operations console.

### Milestone 1: First Playable Vertical Slice

Goal: one complete contract from mission select to result screen.

- [x] Create local player profile.
- [x] Add hacking stat 1-5.
- [x] Create mission board with one door hack contract.
- [x] Create target briefing screen.
- [x] Create basic loadout screen.
- [x] Implement door circuit minigame.
- [x] Add timer and trace meter.
- [x] Add success/failure result screen.
- [x] Save local progress.
- [x] Add basic unlock/reward logic.

### Milestone 2: Progression and Difficulty

- [x] Add multiple contract security levels.
- [x] Add stat-based information quality.
- [x] Add stat-based minigame tuning.
- [x] Add reputation rewards.
- [x] Add tool unlocks.
- [x] Add contract history.

### Milestone 3: Additional Minigames

- [x] Implement safe dial minigame.
- [ ] Implement firewall node graph minigame.
- [ ] Implement packet surveillance minigame.
- [ ] Add contracts that chain multiple minigames together.

### Milestone 4: Hacker vs AI

- [ ] Design AI opponent states.
- [ ] Implement small network duel board.
- [ ] Add player actions: scan, breach, spoof, hide, patch.
- [ ] Add AI actions: trace, lock, decoy, counterattack.
- [ ] Add duel contracts and boss-style encounters.

### Milestone 5: Backend Profiles

- [ ] Add Supabase project.
- [ ] Add authentication.
- [ ] Store player profile remotely.
- [ ] Store contract history.
- [ ] Store tool unlocks.
- [ ] Add leaderboard or challenge records.

### Milestone 6: Polish and Playtesting

- [ ] Add sound effects.
- [ ] Add motion and feedback polish.
- [ ] Add accessibility settings.
- [ ] Add mobile layout pass.
- [ ] Add browser smoke tests.
- [ ] Run structured playtests.
- [ ] Tune difficulty and rewards.

## Initial Data Model

### Player Profile

```ts
type PlayerProfile = {
  id: string;
  displayName: string;
  hackingStat: 1 | 2 | 3 | 4 | 5;
  reputation: number;
  unlockedTools: string[];
  unlockedMinigames: string[];
  completedContracts: string[];
  failedContracts: string[];
};
```

### Contract

```ts
type Contract = {
  id: string;
  title: string;
  targetType: "door" | "safe" | "firewall" | "surveillance" | "duel";
  securityLevel: 1 | 2 | 3 | 4 | 5;
  requiredHackingStat: 1 | 2 | 3 | 4 | 5;
  payout: number;
  reputationReward: number;
  traceRisk: number;
  minigames: string[];
};
```

### Tool

```ts
type Tool = {
  id: string;
  name: string;
  description: string;
  requiredHackingStat: 1 | 2 | 3 | 4 | 5;
  charges?: number;
  traceModifier?: number;
};
```

## First Build Target

The first build should be:

**A single playable door hack contract.**

Player flow:

1. Start on operations console.
2. See profile with hacking stat.
3. Select "Maintenance Door Relay" contract.
4. Review briefing.
5. Choose scanner or spoof token.
6. Play circuit routing door hack.
7. Win or fail based on route, timer, and trace.
8. See result screen.
9. Save reward or failure to local profile.

This gives us the full shape of the game without overbuilding early systems.

## Open Design Questions

- Should the player be a solo operator, a contractor, part of a crew, or a corporate security tester?
- Should the tone be realistic, cyberpunk, tactical espionage, or slightly arcade?
- Should contracts happen on a city map, faction board, or simple mission list?
- Should hacking stat improve through XP, story milestones, purchased training, or successful contract streaks?
- Should failed hacks have permanent consequences, temporary consequences, or only mission-level consequences?

## Immediate Next Steps

1. Confirm the stack: Vite, React, TypeScript, Phaser, local save first.
2. Choose the tone and setting.
3. Scaffold the frontend project.
4. Build the operations console shell.
5. Implement the first door hack vertical slice.
