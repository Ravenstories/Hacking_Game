import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  DoorOpen,
  Play,
  Radar,
  RotateCcw,
  ShieldAlert,
  Signal,
  UserRound,
  Zap,
} from "lucide-react";
import { PhaserGameStage } from "./components/PhaserGameStage";
import { TerminalHackStage } from "./components/TerminalHackStage";
import { contracts } from "./data/contracts";
import { tools } from "./data/tools";
import { createDoorRelayConfig, type DoorRelayOptions } from "./game/doorRelay/doorRelayLogic";
import { gameEvents, type HackStatus } from "./game/gameEvents";
import { createSafeDialConfig, type SafeDialOptions } from "./game/safeDial/safeDialLogic";
import { createTerminalHackConfig, type TerminalHackOptions } from "./game/terminal/terminalHackLogic";
import { useProfileStore } from "./store/profileStore";
import type { HackingStat, ModuleInventory, ModuleResourceId } from "./types";

const moduleResourceLabels: Record<ModuleResourceId, string> = {
  stabilizer: "STAB",
  bypass: "BYP",
  inverter: "INV",
  amplifier: "AMP",
  filter: "FLT",
};

const moduleResourceNames: Record<ModuleResourceId, string> = {
  stabilizer: "Stabilizer",
  bypass: "Bypass",
  inverter: "Inverter",
  amplifier: "Amplifier",
  filter: "Filter",
};

const moduleResourceIds = Object.keys(moduleResourceLabels) as ModuleResourceId[];

export function App() {
  const {
    profile,
    lastResult,
    applyHackResult,
    resetProfile,
    updateProfileForTesting,
    updateModuleInventoryForTesting,
  } = useProfileStore();
  const [activeContractId, setActiveContractId] = useState(contracts[0].id);
  const [selectedToolId, setSelectedToolId] = useState("scanner");
  const [hackStarted, setHackStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const activeContract = useMemo(
    () => contracts.find((contract) => contract.id === activeContractId) ?? contracts[0],
    [activeContractId],
  );

  const unlockedTools = useMemo(
    () => {
      const unlockedToolIds = new Set(profile.unlockedTools);
      if (profile.hackingStat >= 2) {
        unlockedToolIds.add("signal-stabilizer");
      }

      return tools.filter((tool) => unlockedToolIds.has(tool.id) && tool.requiredHackingStat <= profile.hackingStat);
    },
    [profile.hackingStat, profile.unlockedTools],
  );

  const selectedTool = unlockedTools.find((tool) => tool.id === selectedToolId) ?? unlockedTools[0];
  const selectedToolName = selectedTool?.name ?? "No Tool";
  const relayOptions: DoorRelayOptions = useMemo(
    () => ({
      contractId: activeContract.id,
      hackingStat: profile.hackingStat,
      securityLevel: activeContract.securityLevel,
      traceRisk: activeContract.traceRisk,
      toolId: selectedTool?.id ?? "none",
      toolTraceModifier: selectedTool?.traceModifier ?? 0,
      moduleInventory: profile.moduleInventory,
    }),
    [
      activeContract.id,
      activeContract.securityLevel,
      activeContract.traceRisk,
      profile.hackingStat,
      profile.moduleInventory,
      selectedTool?.id,
      selectedTool?.traceModifier,
    ],
  );
  const relayConfig = useMemo(() => createDoorRelayConfig(relayOptions), [relayOptions]);
  const safeOptions: SafeDialOptions = useMemo(
    () => ({
      contractId: activeContract.id,
      hackingStat: profile.hackingStat,
      securityLevel: activeContract.securityLevel,
      lockLevel: activeContract.lockLevel ?? activeContract.securityLevel,
      traceRisk: activeContract.traceRisk,
      toolId: selectedTool?.id ?? "none",
      toolTraceModifier: selectedTool?.traceModifier ?? 0,
    }),
    [
      activeContract.id,
      activeContract.lockLevel,
      activeContract.securityLevel,
      activeContract.traceRisk,
      profile.hackingStat,
      selectedTool?.id,
      selectedTool?.traceModifier,
    ],
  );
  const safeConfig = useMemo(() => createSafeDialConfig(safeOptions), [safeOptions]);
  const terminalOptions: TerminalHackOptions = useMemo(
    () => ({
      contractId: activeContract.id,
      hackingStat: profile.hackingStat,
      securityLevel: activeContract.securityLevel,
      traceRisk: activeContract.traceRisk,
      toolId: selectedTool?.id ?? "none",
      toolTraceModifier: selectedTool?.traceModifier ?? 0,
    }),
    [
      activeContract.id,
      activeContract.securityLevel,
      activeContract.traceRisk,
      profile.hackingStat,
      selectedTool?.id,
      selectedTool?.traceModifier,
    ],
  );
  const terminalConfig = useMemo(() => createTerminalHackConfig(terminalOptions), [terminalOptions]);
  const activeConfig =
    activeContract.targetType === "safe" ? safeConfig : activeContract.targetType === "firewall" ? terminalConfig : relayConfig;
  const isUnderleveled = profile.hackingStat < activeContract.requiredHackingStat;
  const initialHackStatus = useMemo<HackStatus>(
    () => ({
      trace: activeConfig.startingTrace,
      timeRemaining: activeConfig.timeLimit,
      progress: 0,
      mistakes: 0,
      shieldCharges: "shieldCharges" in activeConfig ? activeConfig.shieldCharges : 0,
      scannerHintIndex: "scannerActive" in activeConfig && activeConfig.scannerActive ? 0 : undefined,
      message:
        isUnderleveled
          ? `Overreach active. Recommended stat ${activeContract.requiredHackingStat}; trace pressure is severe.`
          : activeContract.targetType === "safe"
          ? safeConfig.stabilizerActive
            ? "Signal Stabilizer ready. Watchdog trace is dampened."
            : "Safe dial ready. Catch three tumbler windows."
          : activeContract.targetType === "firewall"
            ? terminalConfig.scannerActive
              ? "Scanner ready. Terminal duds will be removed."
              : "Terminal ready. Pick a password candidate and read likeness feedback."
          : relayConfig.scannerActive
            ? "Scanner ready. It will mark the next stable relay."
            : relayConfig.shieldCharges > 0
              ? "Spoof token ready. One bad pulse will be absorbed."
              : "Briefing loaded. Choose your loadout and start the relay.",
    }),
    [
      activeConfig,
      activeContract.requiredHackingStat,
      activeContract.targetType,
      isUnderleveled,
      relayConfig.scannerActive,
      relayConfig.shieldCharges,
      safeConfig.stabilizerActive,
      terminalConfig.scannerActive,
    ],
  );
  const [hackStatus, setHackStatus] = useState<HackStatus>(initialHackStatus);

  const intel = activeContract.intelByStat[profile.hackingStat];
  const activeResult = lastResult?.contractId === activeContract.id ? lastResult : undefined;
  const rewardText = activeResult?.moduleRewards ? formatModuleInventoryDelta(activeResult.moduleRewards) : "";
  const consumedText = activeResult?.consumedModules?.length ? formatConsumedModules(activeResult.consumedModules) : "";
  const progressLabel =
    activeContract.targetType === "safe" ? "Tumblers" : activeContract.targetType === "firewall" ? "Guesses" : "Bridge";
  const assistLabel = activeContract.targetType === "safe" ? "Assist" : "Shield";
  const contractKindLabel =
    activeContract.targetType === "safe" ? "Safe hack" : activeContract.targetType === "firewall" ? "Firewall hack" : "Door hack";

  useEffect(() => {
    const offStatus = gameEvents.on("door-hack:status", setHackStatus);
    const offComplete = gameEvents.on("door-hack:complete", (result) => {
      applyHackResult(result);
      setHackStarted(false);
    });
    const offSafeStatus = gameEvents.on("safe-hack:status", setHackStatus);
    const offSafeComplete = gameEvents.on("safe-hack:complete", (result) => {
      applyHackResult(result);
      setHackStarted(false);
    });
    const offTerminalStatus = gameEvents.on("terminal-hack:status", setHackStatus);
    const offTerminalComplete = gameEvents.on("terminal-hack:complete", (result) => {
      applyHackResult(result);
      setHackStarted(false);
    });

    return () => {
      offStatus();
      offComplete();
      offSafeStatus();
      offSafeComplete();
      offTerminalStatus();
      offTerminalComplete();
    };
  }, [applyHackResult]);

  useEffect(() => {
    if (!hackStarted) {
      setHackStatus(initialHackStatus);
    }
  }, [hackStarted, initialHackStatus]);

  function startHack() {
    setHackStatus(initialHackStatus);
    setHackStarted(true);
    setRunKey((value) => value + 1);
  }

  function selectContract(contractId: string) {
    if (hackStarted) {
      return;
    }

    setActiveContractId(contractId);
  }

  function resetRun() {
    setHackStarted(false);
    setHackStatus(initialHackStatus);
    setRunKey((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <aside className="left-rail" aria-label="Operator and contracts">
        <section className="brand-block">
          <div className="brand-mark">
            <Signal size={20} />
          </div>
          <div>
            <p className="eyebrow">OPS CONSOLE</p>
            <h1>RelayOps</h1>
          </div>
        </section>

        <section className="panel profile-panel">
          <div className="panel-title">
            <UserRound size={16} />
            <span>Profile</span>
          </div>
          <div className="operator-row">
            <div>
              <p className="muted">Handle</p>
              <strong>{profile.displayName}</strong>
            </div>
            <div className="stat-badge">LVL {profile.hackingStat}</div>
          </div>
          <div className="meter-group">
            <div className="meter-label">
              <span>HACKING STAT</span>
              <span>{profile.hackingStat}/5</span>
            </div>
            <div className="segmented-meter" aria-label={`Hacking stat ${profile.hackingStat} out of 5`}>
              {[1, 2, 3, 4, 5].map((level) => (
                <span key={level} className={level <= profile.hackingStat ? "active" : ""} />
              ))}
            </div>
          </div>
          <div className="profile-stats">
            <span>
              <BadgeCheck size={14} /> REP {profile.reputation}
            </span>
            <span>
              <CircleDollarSign size={14} /> {profile.credits}
            </span>
          </div>
          <div className="test-editor">
            <div className="panel-title compact">
              <Activity size={14} />
              <span>Test Rig</span>
            </div>
            <label>
              <span>Handle</span>
              <input
                value={profile.displayName}
                onChange={(event) => updateProfileForTesting({ displayName: event.target.value })}
                disabled={hackStarted}
              />
            </label>
            <div className="test-grid">
              <label>
                <span>Stat</span>
                <select
                  value={profile.hackingStat}
                  onChange={(event) => updateProfileForTesting({ hackingStat: Number(event.target.value) as HackingStat })}
                  disabled={hackStarted}
                >
                  {[1, 2, 3, 4, 5].map((stat) => (
                    <option key={stat} value={stat}>
                      {stat}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Rep</span>
                <input
                  type="number"
                  min="0"
                  value={profile.reputation}
                  onChange={(event) => updateProfileForTesting({ reputation: Number(event.target.value) })}
                  disabled={hackStarted}
                />
              </label>
              <label>
                <span>Credits</span>
                <input
                  type="number"
                  min="0"
                  value={profile.credits}
                  onChange={(event) => updateProfileForTesting({ credits: Number(event.target.value) })}
                  disabled={hackStarted}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <DoorOpen size={16} />
            <span>Mission Board</span>
          </div>
          <div className="contract-list">
            {contracts.map((contract) => {
              const overreach = profile.hackingStat < contract.requiredHackingStat;
              const completed = profile.completedContracts.includes(contract.id);

              return (
                <button
                  className={[
                    "contract-card",
                    contract.id === activeContract.id ? "selected" : "",
                    overreach ? "overreach" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={contract.id}
                  type="button"
                  onClick={() => selectContract(contract.id)}
                  disabled={hackStarted}
                >
                  <span className="contract-type">
                    {overreach
                      ? `Overreach / Rec stat ${contract.requiredHackingStat}`
                      : contract.targetType === "safe"
                        ? "Safe hack"
                        : contract.targetType === "firewall"
                          ? "Firewall hack"
                        : "Door hack"}
                  </span>
                  <strong>{contract.title}</strong>
                  <span className="contract-meta">
                    Sec {contract.securityLevel}
                    {contract.targetType === "safe" ? ` / Lock ${contract.lockLevel ?? contract.securityLevel}` : ""} / Payout{" "}
                    {contract.payout}
                    {completed ? " / Cleared" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <button className="ghost-button" type="button" onClick={resetProfile}>
          <RotateCcw size={15} />
          Reset profile
        </button>
      </aside>

      <section className="main-stage">
        <header className="stage-header">
          <div>
            <p className="eyebrow">Active Contract</p>
            <h2>{activeContract.title}</h2>
          </div>
          <button className="primary-button" type="button" onClick={startHack} disabled={hackStarted}>
            <Play size={17} />
            START HACK
          </button>
        </header>

        <section className="briefing-strip">
          <div>
            <span>Objective</span>
            <p>{activeContract.summary}</p>
          </div>
          <div>
            <span>Intel quality</span>
            <p>{intel}</p>
          </div>
        </section>

        <section className="playfield-panel">
          {hackStarted ? (
            activeContract.targetType === "firewall" ? (
              <TerminalHackStage key={runKey} options={terminalOptions} />
            ) : (
              <PhaserGameStage
                key={runKey}
                contractType={activeContract.targetType}
                doorOptions={relayOptions}
                safeOptions={safeOptions}
              />
            )
          ) : activeResult ? (
            <div className={activeResult.success ? "result-playfield success" : "result-playfield failure"}>
              <div className="result-mark">{activeResult.success ? <BadgeCheck size={54} /> : <ShieldAlert size={54} />}</div>
              <p className="eyebrow">Contract Result</p>
              <h3>
                {activeResult.success
                  ? activeContract.targetType === "safe"
                    ? "Safe open"
                    : activeContract.targetType === "firewall"
                      ? "Firewall opened"
                    : "Access granted"
                  : activeContract.targetType === "safe"
                    ? "Safe locked"
                    : activeContract.targetType === "firewall"
                      ? "Terminal locked"
                    : "Access denied"}
              </h3>
              <p>
                {activeResult.success
                  ? activeContract.targetType === "safe"
                    ? "The tumblers aligned and the safe contents were logged."
                    : activeContract.targetType === "firewall"
                      ? "The terminal accepted the password and exposed the archive index."
                    : "The relay accepted the bridge and the operation was recorded."
                  : activeContract.targetType === "safe"
                    ? "The safe interface locked down. No reward was issued."
                    : activeContract.targetType === "firewall"
                      ? "The terminal locked out. No reward was issued."
                    : "The relay rejected the bridge. No reward was issued."}
              </p>
              <div className="result-grid">
                <div>
                  <span>Reward</span>
                  <strong>{activeResult.success ? `${activeContract.payout} credits` : "0 credits"}</strong>
                </div>
                <div>
                  <span>Reputation</span>
                  <strong>{activeResult.success ? `+${activeContract.reputationReward}` : "+0"}</strong>
                </div>
                <div>
                  <span>Trace</span>
                  <strong>{activeResult.trace}%</strong>
                </div>
                <div>
                  <span>Mistakes</span>
                  <strong>{activeResult.mistakes}</strong>
                </div>
                <div>
                  <span>{activeContract.targetType === "safe" ? "Precision" : "Tool"}</span>
                  <strong>
                    {activeContract.targetType === "safe"
                      ? `${activeResult.precision ?? 0}%`
                      : tools.find((tool) => tool.id === activeResult.toolId)?.name ?? "Scanner"}
                  </strong>
                </div>
                <div>
                  <span>{activeContract.targetType === "safe" ? "Performance" : "Shielded"}</span>
                  <strong>
                    {activeContract.targetType === "safe"
                      ? activeResult.performanceLabel ?? "No lock"
                    : activeContract.targetType === "firewall"
                      ? activeResult.performanceLabel ?? "No session"
                      : `${activeResult.shieldAbsorbed} pulse`}
                  </strong>
                </div>
                <div>
                  <span>Modules</span>
                  <strong>{rewardText || consumedText || "No change"}</strong>
                </div>
              </div>
              <button className="primary-button" type="button" onClick={startHack}>
                <Play size={17} />
                RERUN CONTRACT
              </button>
            </div>
          ) : (
            <div className="idle-playfield">
              <Radar size={54} />
              <h3>
                {isUnderleveled
                  ? "Overreach target armed"
                  : activeContract.targetType === "safe"
                    ? "Safe dial awaiting contact"
                    : activeContract.targetType === "firewall"
                      ? "Terminal awaiting login"
                    : "Door relay awaiting handshake"}
              </h3>
              <p>
                {isUnderleveled
                  ? `You can attempt it now, but this target expects stat ${activeContract.requiredHackingStat}. Trace, timing, and mistakes will be much harsher.`
                  : activeContract.targetType === "safe"
                    ? "Start the hack to catch three tumbler windows before trace seals the safe."
                    : activeContract.targetType === "firewall"
                      ? "Start the hack to pick a password candidate and use likeness feedback to narrow the word list."
                    : "Start the hack to place modules and route a live cable before trace reaches lock."}
              </p>
            </div>
          )}
        </section>
      </section>

      <aside className="right-rail" aria-label="Tools and trace">
        <section className="panel">
          <div className="panel-title">
            <Zap size={16} />
            <span>LOADOUT</span>
          </div>
          <p className="panel-note">{contractKindLabel} / Selected: {selectedToolName}</p>
          <div className="tool-list">
            {unlockedTools.map((tool) => (
              <button
                className={tool.id === selectedTool?.id ? "tool-card selected" : "tool-card"}
                key={tool.id}
                type="button"
                onClick={() => setSelectedToolId(tool.id)}
              >
                <strong>{tool.name}</strong>
                <span>{tool.description}</span>
              </button>
            ))}
          </div>
          <div className="module-inventory">
            <div className="panel-title compact">
              <DoorOpen size={14} />
              <span>Door Modules</span>
            </div>
            <div className="module-resource-grid">
              {moduleResourceIds.map((moduleId) => (
                <label key={moduleId} title={moduleResourceNames[moduleId]}>
                  <span>{moduleResourceLabels[moduleId]}</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={profile.moduleInventory[moduleId]}
                    onChange={(event) =>
                      updateModuleInventoryForTesting({ [moduleId]: Number(event.target.value) } as Partial<ModuleInventory>)
                    }
                    disabled={hackStarted}
                  />
                </label>
              ))}
            </div>
            <p className="panel-note">Placed modules are consumed when a door run resolves. Terminal wins recover parts.</p>
          </div>
        </section>

        <section className="panel status-panel">
          <div className="panel-title">
            <ShieldAlert size={16} />
            <span>TRACE</span>
          </div>
          <div className="trace-readout">
            <strong>{Math.round(hackStatus.trace)}%</strong>
            <span>{hackStatus.message}</span>
          </div>
          <div className="trace-bar" aria-label={`Trace ${Math.round(hackStatus.trace)} percent`}>
            <span style={{ width: `${Math.min(100, hackStatus.trace)}%` }} />
          </div>
          <div className="status-grid">
            <div>
              <span>Time</span>
              <strong>{hackStatus.timeRemaining}s</strong>
            </div>
            <div>
              <span>{progressLabel}</span>
              <strong>{Math.round(hackStatus.progress * 100)}%</strong>
            </div>
          </div>
          <div className="status-grid">
            <div>
              <span>Mistakes</span>
              <strong>{hackStatus.mistakes}</strong>
            </div>
            <div>
              <span>{assistLabel}</span>
              <strong>{activeContract.targetType === "safe" ? (safeConfig.stabilizerActive ? "On" : "Off") : hackStatus.shieldCharges}</strong>
            </div>
          </div>
          <button className="ghost-button full" type="button" onClick={resetRun}>
            <Activity size={15} />
            Reset run
          </button>
        </section>
      </aside>
    </main>
  );
}

function formatModuleInventoryDelta(rewards: Partial<ModuleInventory>) {
  return moduleResourceIds
    .filter((moduleId) => rewards[moduleId])
    .map((moduleId) => `+${rewards[moduleId]} ${moduleResourceLabels[moduleId]}`)
    .join(" / ");
}

function formatConsumedModules(modules: ModuleResourceId[]) {
  const counts = modules.reduce<Partial<Record<ModuleResourceId, number>>>((accumulator, moduleId) => {
    accumulator[moduleId] = (accumulator[moduleId] ?? 0) + 1;
    return accumulator;
  }, {});

  return moduleResourceIds
    .filter((moduleId) => counts[moduleId])
    .map((moduleId) => `-${counts[moduleId]} ${moduleResourceLabels[moduleId]}`)
    .join(" / ");
}
