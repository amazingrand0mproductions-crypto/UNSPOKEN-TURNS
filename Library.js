var CP_VERSION = "1.3";

// Shared by both systems' name/entity detection (TWISTS AND TURNS'
// findEntityInSentence and UNSAID's CODEX_NAME_TOKEN below) — the set of
// characters allowed within a capitalized name token after its required
// leading capital letter. These lived as two separately-maintained copies
// for a long time, and drifted out of sync on the exact same gap three
// times in a row: apostrophes (O'Brien), hyphens (Draconic-Ballgown), and
// digits (a designation like Agent47 or Unit9 has no word-boundary between
// the letter and the digit, so it silently failed to match at all). One
// shared definition means a future gap only needs finding and fixing once.
var NAME_ALPHANUM = "a-zA-Z0-9";

// UNSPOKEN TURNS runtime governor. AI Dungeon executes modifiers inside a
// time-limited isolated VM, so every advanced subsystem must be able to
// yield lower-priority maintenance instead of taking the whole Context hook
// down with a hard timeout. The governor never cancels user-forced commands;
// it only defers automatic scanning/maintenance until the next real turn.
var UT_DEFAULT_CONTEXT_BUDGET_MS = 900;
var UT_ACTIVE_RUNTIME_PHASE = null;

function utClockNow() {
  try { return Date.now(); } catch (e) { return 0; }
}

function utEnsureRuntimeHealth() {
  if (typeof state === "undefined" || !state) return null;
  if (!state.unspokenTurnsRuntime || typeof state.unspokenTurnsRuntime !== "object") {
    state.unspokenTurnsRuntime = {
      phases: {},
      skips: {},
      errors: {},
      totalSkips: 0,
      totalErrors: 0,
      lastSkip: null,
      lastError: null
    };
  }
  const h = state.unspokenTurnsRuntime;
  if (!h.phases || typeof h.phases !== "object") h.phases = {};
  if (!h.skips || typeof h.skips !== "object") h.skips = {};
  if (!h.errors || typeof h.errors !== "object") h.errors = {};
  if (typeof h.totalSkips !== "number") h.totalSkips = 0;
  if (typeof h.totalErrors !== "number") h.totalErrors = 0;
  return h;
}

function utRuntimeBudgetMs() {
  try {
    const cfg = state && state.contingencyConfig;
    const requested = cfg && Number(cfg.performanceBudgetMs);
    if (isFinite(requested) && requested >= 400 && requested <= 1500) return requested;
  } catch (e) {}
  return UT_DEFAULT_CONTEXT_BUDGET_MS;
}

function utRuntimeGovernorEnabled() {
  try {
    const cfg = state && state.contingencyConfig;
    return !cfg || cfg.adaptivePerformance !== false;
  } catch (e) { return true; }
}

function utBeginRuntimePhase(name) {
  const token = { name: name || "unknown", started: utClockNow(), budget: utRuntimeBudgetMs() };
  UT_ACTIVE_RUNTIME_PHASE = token;
  return token;
}

function utRuntimeElapsed(token) {
  const t = token || UT_ACTIVE_RUNTIME_PHASE;
  if (!t || !t.started) return 0;
  const now = utClockNow();
  return now ? Math.max(0, now - t.started) : 0;
}

function utHasRuntimeBudget(reserveMs) {
  if (!utRuntimeGovernorEnabled()) return true;
  const t = UT_ACTIVE_RUNTIME_PHASE;
  if (!t) return true;
  const reserve = Math.max(0, Number(reserveMs) || 0);
  return utRuntimeElapsed(t) < Math.max(120, t.budget - reserve);
}

function utSkipRuntimeTask(task) {
  const name = String(task || "maintenance");
  const h = utEnsureRuntimeHealth();
  if (!h) return;
  h.skips[name] = (h.skips[name] || 0) + 1;
  h.totalSkips += 1;
  h.lastSkip = { task: name, turn: (state.unsaid && state.unsaid.turn) || (state.contingency && state.contingency.turn) || 0 };
}

function utRecordRuntimeError(where, error) {
  const name = String(where || "unknown");
  const h = utEnsureRuntimeHealth();
  if (!h) return;
  h.errors[name] = (h.errors[name] || 0) + 1;
  h.totalErrors += 1;
  h.lastError = {
    where: name,
    message: String(error && error.message ? error.message : error || "unknown error").slice(0, 180),
    turn: (state.unsaid && state.unsaid.turn) || (state.contingency && state.contingency.turn) || 0
  };
}

function utEndRuntimePhase(token) {
  const t = token || UT_ACTIVE_RUNTIME_PHASE;
  if (!t) return;
  const elapsed = utRuntimeElapsed(t);
  const h = utEnsureRuntimeHealth();
  if (h) {
    const old = h.phases[t.name] || { runs: 0, lastMs: 0, avgMs: 0, maxMs: 0, overBudget: 0 };
    old.runs += 1;
    old.lastMs = elapsed;
    old.avgMs = old.runs === 1 ? elapsed : Math.round((old.avgMs * 0.8) + (elapsed * 0.2));
    old.maxMs = Math.max(old.maxMs || 0, elapsed);
    if (elapsed > t.budget) old.overBudget = (old.overBudget || 0) + 1;
    h.phases[t.name] = old;
  }
  if (UT_ACTIVE_RUNTIME_PHASE === t) UT_ACTIVE_RUNTIME_PHASE = null;
}

function utRuntimeHealthReport() {
  const h = utEnsureRuntimeHealth();
  if (!h) return "Runtime health data is unavailable.";
  const phaseNames = Object.keys(h.phases || {});
  const phaseLines = phaseNames.length
    ? phaseNames.map(name => {
        const p = h.phases[name] || {};
        return `${name}: last ${p.lastMs || 0} ms · avg ${p.avgMs || 0} ms · max ${p.maxMs || 0} ms · runs ${p.runs || 0}${p.overBudget ? ` · over budget ${p.overBudget}` : ""}`;
      })
    : ["No measured hook runs yet."];
  const skipLines = Object.keys(h.skips || {}).sort((a,b) => (h.skips[b]||0) - (h.skips[a]||0)).slice(0, 8)
    .map(k => `${k}: ${h.skips[k]}`);
  const errorLines = Object.keys(h.errors || {}).sort((a,b) => (h.errors[b]||0) - (h.errors[a]||0)).slice(0, 8)
    .map(k => `${k}: ${h.errors[k]}`);
  const unsaidState = state && state.unsaid ? state.unsaid : {};
  const codexState = unsaidState.codex || {};
  const minds = unsaidState.minds || {};
  const mindNames = Object.keys(minds);
  const adaptiveSlots = mindNames.reduce((sum, name) => sum + (Array.isArray(minds[name] && minds[name].thoughtOrder) ? minds[name].thoughtOrder.length : 0), 0);
  const aliasCount = Object.keys(unsaidState.aliases || {}).reduce((sum, name) => sum + (Array.isArray(unsaidState.aliases[name]) ? unsaidState.aliases[name].length : 0), 0);
  const storyCardCount = (typeof storyCards !== "undefined" && Array.isArray(storyCards)) ? storyCards.length : 0;
  const candidateCount = Object.keys(codexState.mentionCounts || {}).length;
  return [
    "UNSPOKEN TURNS — Runtime Health",
    `Adaptive governor: ${utRuntimeGovernorEnabled() ? "ON" : "OFF"}`,
    `Internal context budget: ${utRuntimeBudgetMs()} ms (kept deliberately below the platform hook timeout)`,
    `Working set: ${storyCardCount} Story Cards · ${candidateCount} Codex candidates · ${mindNames.length} minds · ${adaptiveSlots} adaptive slots · ${aliasCount} manual aliases`,
    "",
    "Hook timings:", ...phaseLines,
    "",
    `Deferred automatic tasks: ${h.totalSkips || 0}`,
    ...(skipLines.length ? skipLines : ["none"]),
    "",
    `Caught script errors: ${h.totalErrors || 0}`,
    ...(errorLines.length ? errorLines : ["none"]),
    h.lastError ? `\nLast error: ${h.lastError.where} — ${h.lastError.message}` : ""
  ].filter(Boolean).join("\n");
}

var CP_DEFAULTS = {
  enabled: true,
  intensity: "medium",
  strictLogic: true,
  allowWildcard: false,
  allowCompoundTwists: true,
  involvePlayer: true,
  showTwistLog: false,
  minSeedsForPayoff: 2,
  minTurnsForPayoff: 8,
  payoffCooldown: 10,
  establishedFactsCap: 8,
  maxThreadsPerEntity: 5,
  allowMatureTwists: false,
  twistRetryCooldown: 2,
  scenarioAdaptation: true,
  scenarioOverride: "",
  crossSystemSynergy: true,
  // Automatically defer low-priority maintenance before the isolated VM can
  // time out. Forced commands always remain immediate.
  adaptivePerformance: true,
  performanceBudgetMs: 900,

  categoryBias: ""

};

var CP_INTENSITY_PACING = { low: 10, medium: 6, high: 3 };

// Scenario adaptation is intentionally advisory rather than a rigid genre lock.
// The script can encounter hybrid settings (e.g. historical fantasy, romantic
// horror, cyberpunk westerns), so detection keeps several weighted tags and uses
// them to avoid *unsupported* assumptions without preventing evidence-backed
// twists from working.
var CP_SCENARIO_SIGNALS = [
  { tag: "fantasy", rx: /\b(fantasy|magic|magical|mage|wizard|witch|sorcer|spell|enchanted|mana|dragon|elf|dwarf|orc|fae|prophecy|rune|demon|angel|necromanc|potion)\w*/gi, weight: 2 },
  { tag: "sci-fi", rx: /\b(sci[- ]?fi|science fiction|starship|spaceship|spacecraft|galaxy|planet|alien|android|robot|cyborg|warp|hyperdrive|quantum|colony|orbital|terraform|cryosleep|nanotech|synthetic|interstellar|spacesuit)\w*/gi, weight: 2 },
  { tag: "cyberpunk", rx: /\b(cyberpunk|megacorp|neon|implant|cyberware|netrunner|braindance|augmented|augmentation|corporate enclave|street samurai|data shard)\w*/gi, weight: 3 },
  { tag: "contemporary", rx: /\b(contemporary|modern|present[- ]day|smartphone|cell ?phone|text message|social media|internet|rideshare|office|apartment|college|university|hospital|police station|airport|highway|coffee shop|streaming)\w*/gi, weight: 1 },
  { tag: "historical", rx: /\b(historical|victorian|medieval|renaissance|regency|edwardian|ancient|century|empire|emperor|pharaoh|samurai|shogun|musketeer|telegraph|steamship|carriage|blacksmith)\w*/gi, weight: 2 },
  { tag: "western", rx: /\b(cowboy|sheriff|saloon|frontier|outlaw|gunslinger|cattle|ranch|stagecoach|marshal|prospector|homestead)\w*/gi, weight: 3 },
  { tag: "horror", rx: /\b(horror|haunted|ghost|nightmare|ritual|possessed|eldritch|terror|dread|stalker|slasher|undead|vampire|werewolf)\w*/gi, weight: 2 },
  { tag: "mystery", rx: /\b(mystery|detective|investigat|clue|suspect|alibi|evidence|case|murder|missing person|crime scene|interrogat|forensic)\w*/gi, weight: 2 },
  { tag: "crime/noir", rx: /\b(crime|noir|mafia|mobster|gangster|cartel|smuggler|heist|detective|fixer|underworld|blackmail|informant|nightclub|dirty cop)\w*/gi, weight: 2 },
  { tag: "romance", rx: /\b(romance|romantic|dating|crush|kiss|lover|boyfriend|girlfriend|fianc|wedding|marriage|heartbreak|attraction)\w*/gi, weight: 2 },
  { tag: "slice-of-life", rx: /\b(slice of life|roommate|school day|classmate|coworker|neighbor|family dinner|homework|shift at|day off|weekend|caf[eé]|friend group)\w*/gi, weight: 2 },
  { tag: "school/campus", rx: /\b(high school|academy|college|university|campus|student|teacher|professor|classroom|dorm|semester|club meeting|prom)\w*/gi, weight: 2 },
  { tag: "superhero", rx: /\b(superhero|supervillain|masked hero|secret identity|superpower|metahuman|vigilante|cape|powered individual|hero agency)\w*/gi, weight: 3 },
  { tag: "post-apocalyptic", rx: /\b(post[- ]apocal|wasteland|fallout|ruins|survivors?|bunker|radiation|collapse|infected|zombie|scaveng|supply run)\w*/gi, weight: 2 },
  { tag: "survival", rx: /\b(survival|stranded|shipwreck|shelter|rations|forage|dehydration|hypothermia|wilderness|supplies|rescue signal)\w*/gi, weight: 2 },
  { tag: "military/war", rx: /\b(military|soldier|army|navy|marine|air force|platoon|battalion|regiment|commanding officer|mission briefing|battlefield|war|front line|special forces)\w*/gi, weight: 2 },
  { tag: "political/intrigue", rx: /\b(politic|senator|parliament|congress|minister|election|campaign|diplomat|embassy|court intrigue|succession|treaty|governor|president)\w*/gi, weight: 2 },
  { tag: "medical", rx: /\b(doctor|nurse|surgeon|patient|diagnosis|hospital|clinic|medicine|treatment|operation|ward|paramedic)\w*/gi, weight: 2 },
  { tag: "legal", rx: /\b(lawyer|attorney|courtroom|judge|jury|trial|lawsuit|prosecutor|defense counsel|legal case|verdict)\w*/gi, weight: 2 },
  { tag: "sports", rx: /\b(sports?|athlete|coach|tournament|championship|league|training camp|locker room|boxing|football|basketball|baseball|soccer|hockey|tennis|rugby|cricket|wrestling|MMA)\w*/gi, weight: 2 },
  { tag: "music/celebrity", rx: /\b(band|singer|actor|actress|musician|concert|album|recording studio|celebrity|record label|film set|audition|premiere|backstage)\w*/gi, weight: 2 },
  { tag: "pirate/nautical", rx: /\b(pirate|galleon|harbor|harbour|port|sailing|sailor|seafaring|ocean|navy|treasure map|privateer|corsair|yacht|marina)\w*/gi, weight: 2 },
  { tag: "comedy", rx: /\b(comedy|comic|sitcom|absurd|ridiculous|hilarious|prank|joke|farce)\w*/gi, weight: 2 }
];

var CP_SPECULATIVE_ONLY_KEYS = new Set([
  "bodySwap", "familyCurse", "theIllusion", "wrongTimeline", "theSimulation",
  "dreamWithinReality", "futureMessage", "realityLeak", "notFullyHuman",
  "theTransferal", "theVessel", "possessedObject", "sentientPlace",
  "dormantTransformation", "falseProphecy", "thePropheciesTwist",
  "fatesLoophole", "destinyDeferred", "theSign", "circleComplete"
]);
var CP_MAGIC_SUPERNATURAL_KEYS = new Set([
  "familyCurse", "possessedObject", "sentientPlace", "dreamWithinReality",
  "theVessel", "falseProphecy", "thePropheciesTwist", "fatesLoophole",
  "destinyDeferred", "theSign", "circleComplete"
]);

var CP_CATEGORIES = {
  hiddenIdentity: "someone in the story isn't who they appear to be",
  falseAlly: "a trusted figure has been working against the player",
  ulteriorMotive: "help that was given for free turns out not to have been free",
  buriedPast: "two people or factions share a history nobody mentioned",
  fakedDefeat: "a death, loss, or defeat wasn't what it looked like",
  secretDebt: "an old favor or bargain comes due at the worst time",
  doubleAgent: "someone has quietly been serving two sides at once",
  misdirection: "the real cause or threat was never where it looked",
  hiddenNature: "an object, place, or fact turns out to be other than assumed",
  trustedFlip: "someone's loyalty shifts, for reasons that were there all along",
  longConGame: "something that looked spontaneous had actually been planned far in advance",
  theTest: "what looked like a real crisis was secretly a deliberate test",
  notTheOriginal: "someone or something is a replacement for what everyone assumed was the real thing",
  sharedFate: "two seemingly unconnected people or events turn out to share the same hidden cause",
  theWarningWasReal: "a rumor, prophecy, or threat everyone dismissed turns out to be true",
  wrongEnemy: "the one blamed wasn't actually responsible",
  theCostWasHidden: "a past victory or gift came with a price that's only now coming due",
  allianceOfConvenience: "two forces that appear opposed have secretly been cooperating",
  theOriginStory: "the accepted account of how something began is false, and the real one is darker",
  theRescuerNeedsRescuing: "someone believed safe or secure was already compromised the whole time",

  secretRelation: "two characters are secretly related and don't know it",
  sleeperAgent: "someone was placed long ago and has only now been activated",
  bodySwap: "an identity or consciousness has been swapped with someone else's",
  theMirror: "an antagonist turns out to be a dark reflection of the protagonist",
  unreliableMemory: "a character's own memory of events turns out to be wrong",
  splitPersonality: "one person has secretly been acting as two distinct identities",
  theActor: "someone has performed a role so long they've nearly become it",
  disguisedEnemy: "an enemy has been hiding in plain sight since before the story began",
  theSubstitute: "a character was quietly swapped for someone else mid-story",
  livingLegend: "a figure believed mythical or long dead is real and present",

  secretSibling: "a character has a sibling nobody knew about",
  secretParentage: "a character's real parent is someone else in the story",
  arrangedFate: "two characters were bound to each other long before they met",
  theInheritance: "a character secretly stands to inherit something significant",
  disownedHeir: "someone was cut off from their family for a reason kept hidden",
  theWard: "a character was raised by someone who wasn't who they claimed",
  loversPast: "two characters share a hidden romantic history",
  theRival: "a friendly rival is secretly driven by an old grudge",
  familyCurse: "a bloodline carries a hidden burden passed down in secret",
  secretMarriage: "two characters are already bound by a vow no one else knows about",

  theFigurehead: "a leader turns out to be a puppet for someone else entirely",
  hiddenSuccessor: "the true heir to power is someone nobody expected",
  coupInMotion: "a takeover has already quietly begun",
  theUsurpersRegret: "whoever seized power now secretly wants to undo it",
  falseAuthority: "someone's claimed rank or title turns out to be fake",
  theKingmaker: "someone behind the scenes has been shaping events unseen",
  rebellionWithin: "loyalists are secretly plotting against the very leader they serve",
  theExile: "a long-banished figure has secretly returned",
  stolenLegacy: "someone has been living off an achievement that belongs to another",
  theSuccessionWar: "multiple parties are already competing for a position no one knows is open",

  forbiddenKnowledge: "a character knows something they were never meant to learn",
  theWitness: "someone saw something crucial and has stayed silent about it",
  codedMessage: "information has been hidden in plain sight all along",
  theArchive: "records exist that contradict the accepted version of events",
  suppressedTruth: "an authority has been actively hiding a fact it already knows",
  theConfession: "someone has been trying to admit something and keeps being stopped",
  falseMemoryImplant: "a memory was deliberately planted in someone's mind",
  theTranslator: "a message was altered or mistranslated on purpose",
  hiddenJournal: "a written record reveals what someone actually believed",
  hushMoney: "someone has been paid to stay quiet about what they know",

  theRelic: "an ordinary-seeming object carries real power or history",
  falseMap: "directions or knowledge everyone trusted were deliberately wrong",
  theVault: "a hidden cache of something important sits nearby, unnoticed",
  cursedGift: "something given generously carries a hidden cost",
  theKey: "an unremarkable item turns out to unlock something major",
  secretPassage: "a hidden route or room has existed in plain sight the whole time",
  theForgery: "a trusted object or document is fake, and someone already knows it",
  livingWeapon: "something everyone assumed inert is not",
  theSanctuary: "a place assumed safe isn't — or a dangerous one secretly is",
  buriedEvidence: "physical proof of something has been sitting nearby, hidden",

  theGreaterGood: "harmful actions turn out to have served a hidden, well-meant goal",
  selfishRescue: "a heroic-looking act turns out to have been self-interested",
  theRedemption: "a villain has secretly been trying to atone",
  falseVictim: "someone presenting as wronged actually orchestrated their own suffering",
  theBreakingPoint: "a loyal character has been pushed to a private limit and is about to snap",
  mercyKilling: "an apparent act of violence was actually meant to spare someone worse",
  theProvocateur: "someone has been deliberately stoking a conflict for their own reasons",
  guiltDriven: "a character's current behavior is driven by an unconfessed past wrong",
  theInterventionist: "someone has been secretly manipulating events \"for the protagonist's own good\"",
  falseFlag: "an attack or crime was staged to look like someone else's doing",

  theFlashback: "a past event wasn't what everyone believed at the time",
  alreadyHappened: "the threat everyone fears is coming already happened once before, unremembered",
  theCountdown: "a hidden deadline is closer than anyone realizes",
  loopedFate: "this exact situation has played out before, to someone else",
  prematureVictory: "the conflict declared over was never actually resolved",
  theOmen: "a prophecy already came true, quietly, without anyone noticing",
  delayedConsequence: "an action from long ago is only now catching up",
  theSetup: "current events were engineered far in advance to lead here",
  secondChance: "someone is quietly being given another shot at a choice they already made once",
  theRecurrence: "a pattern from the past is about to repeat itself",

  hiddenFaction: "an organized group exists that no one in the story knows about",
  infiltratedOrder: "a trusted institution has already been compromised from within",
  theCult: "a group's true purpose is very different from its stated one",
  dividedLoyalties: "an organization is secretly split into opposing camps",
  theOutcast: "someone the group shunned turns out to have been right all along",
  collectiveAmnesia: "an entire community has quietly agreed, consciously or not, to forget something",
  theGatekeepers: "access to something is being secretly controlled by unseen hands",
  falseConsensus: "what \"everyone agrees on\" was manufactured by only a few",
  theInsurance: "a group has a contingency plan nobody else knows about",
  splinterGroup: "a faction broke away and has been operating independently in secret",

  theIllusion: "what characters have been perceiving isn't physically real",
  wrongTimeline: "events aren't happening in the order or timeframe everyone assumes",
  theDouble: "two separate people have been mistaken for one this whole time",
  theSimulation: "the current reality is a constructed or controlled environment",
  sharedDelusion: "multiple characters have been unknowingly led to believe the same false thing",
  theGaslight: "a character has been deliberately made to doubt their own perception",
  wrongVillain: "the true antagonist has been operating unnoticed the entire time",
  theRecording: "a captured image, sound, or account contradicts what people remember",
  dreamWithinReality: "what seemed like imagination was actually a real warning or memory",
  theStandin: "a decoy has been used in place of the real event or person",

  thePropheciesTwist: "a prophecy's true meaning wasn't what everyone assumed",
  bornForThis: "a character was shaped, groomed, or chosen for a role from birth",
  theSacrificePlanned: "someone has always intended to give themselves up when the time came",
  inheritedEnemy: "a conflict was inherited from a previous generation, not started fresh",
  theChosenWrong: "the person everyone believed was \"the one\" isn't actually",
  fatesLoophole: "a way around what seemed unavoidable existed all along",
  theBargain: "a deal struck long ago has terms that are only now coming due",
  destinyDeferred: "someone deliberately avoided their fate once, and it's catching up now",
  theSign: "an overlooked omen actually pointed to exactly what's happening now",
  circleComplete: "current events mirror or complete something from generations back",

  hiddenAffair: "a romantic betrayal has been going on right under everyone's nose",
  theBlackmail: "someone is quietly being controlled by a secret someone else is holding over them",
  secretDependency: "a character has been hiding a dependency or vice that's starting to cost them control",
  theExploiter: "someone has been quietly taking advantage of another's trust or vulnerability for personal gain",
  corruptedOath: "someone sworn to protect or serve has been compromised for personal gain",
  theObsession: "someone's fixation on another character runs far deeper, and darker, than it's let on",
  criminalTies: "a character has an ongoing, hidden tie to something illicit",
  theCoverUp: "someone with power has been actively covering up real wrongdoing to protect themselves",
  soldOut: "a character quietly betrayed something or someone they claimed to believe in, for personal gain",
  forbiddenBond: "two characters share a connection the people around them would never accept",

  hiddenAilment: "someone has been hiding a worsening condition that's about to become impossible to conceal",
  theInfection: "something has been quietly spreading through a person, place, or group, changing them from within",
  notFullyHuman: "someone isn't entirely what their body appears to be",
  theRegression: "someone is reverting to an earlier, more dangerous version of themselves",
  inheritedTrait: "a trait passed down through blood carries consequences nobody warned about",
  theTransferal: "something has moved from one body to another, and it wasn't supposed to",
  slowPoison: "someone has been worn down gradually by something, not struck all at once",
  theAdaptation: "someone or something has been quietly changing to survive a threat no one else has noticed yet",
  buriedInstinct: "an old, suppressed nature is starting to resurface",
  theVessel: "someone's body is carrying, containing, or channeling something that isn't their own",

  // Additional long-form twist pool — v1.2
  stolenIdentity: "someone has been living under a name or identity that originally belonged to someone else",
  stagedDefection: "an apparent betrayal or defection was staged as part of a deeper plan",
  secretProtector: "someone acting hostile has secretly been protecting the target",
  falseConfession: "a confession was deliberately false to protect someone or redirect blame",
  secretAdoption: "a character was adopted or raised under a false account of their family",
  hiddenGuardian: "someone thought unrelated has secretly been a guardian or protector for years",
  inheritanceTrap: "an inheritance was designed as a trap, test, or source of leverage",
  controlledOpposition: "the opposition is secretly being funded or directed by the power it claims to resist",
  coupWithinCoup: "the apparent coup is itself being used by another faction to seize control",
  emergencyPowers: "a temporary crisis measure was designed to become permanent",
  puppetSuccessor: "the expected successor is being positioned as a controllable puppet",
  plantedEvidence: "evidence was deliberately planted to create a false conclusion",
  fabricatedAlibi: "an alibi was manufactured by someone with access or influence",
  impossibleWitness: "a witness knows something they could not have seen through ordinary means",
  censoredRecord: "an official record was selectively altered rather than wholly forged",
  possessedObject: "an object carries a will, spirit, or intelligence of its own",
  sentientPlace: "a location is aware of the people inside it and reacts to them",
  changingMap: "a map or route changes because the place itself is shifting",
  duplicateKey: "two supposedly unique keys or artifacts exist, proving the accepted story false",
  stagedRescue: "a rescue was engineered so the rescuer could gain trust or leverage",
  unknowingAccomplice: "someone has been helping a harmful plan without realizing what they were enabling",
  secretBenefactor: "someone believed hostile has quietly been funding or protecting the protagonist",
  falseChoice: "a supposed choice was structured so every option served the same hidden agenda",
  futureMessage: "a message or warning came from a future version of someone involved",
  missingTime: "a stretch of time is missing from the characters' memory or records",
  timeDebt: "an earlier change to fate or time created a consequence that now has to be paid",
  parallelPlan: "two plans believed unrelated were synchronized around the same hidden deadline",
  proxyWar: "two groups are fighting a conflict secretly arranged or financed by a third",
  manufacturedRivalry: "a rivalry between groups was deliberately created to keep them divided",
  ghostOrganization: "a feared organization is a fabricated identity or front used by someone else",
  hiddenMutiny: "a crew or team has already split into secret loyalties",
  memoryAnchor: "one person or object preserves the true memory while everyone else's perception has changed",
  realityLeak: "details from another reality or timeline are bleeding into the present",
  decoyTarget: "the obvious target was only bait to hide what the attacker actually wanted",
  observerEffect: "events change depending on who witnesses or remembers them",
  falseProphecy: "a prophecy was fabricated by someone trying to manufacture the foretold outcome",
  inheritedBargain: "a bargain made by an earlier generation binds the present one",
  chosenByAccident: "the chosen figure received the role through an accident, substitution, or mistake",
  destinyTransfer: "a fate meant for one person has attached itself to another",
  cleanHands: "a respectable figure keeps their hands clean by outsourcing wrongdoing",
  protectedCriminal: "someone dangerous has been shielded by an institution for practical reasons",
  evidenceBroker: "someone has been buying, selling, or trading secrets between rival sides",
  compromisedMentor: "a mentor has been steering someone for a private agenda",
  dormantTransformation: "a transformation has already begun but is being delayed or suppressed",
  adaptiveEnemy: "an enemy is learning specifically from each encounter with the protagonists",
  healingCost: "unnatural healing transfers the damage, debt, or cost somewhere else",
  bodyClock: "a hidden biological or supernatural countdown is changing a character from within",
  secretIntimacy: "two consenting adult characters have concealed an intimate relationship or history",
  pastHookup: "two adults who act casual share a one-time intimate past neither has disclosed",
  friendsWithBenefits: "two consenting adults publicly seem like friends but privately have an intimate arrangement",
  openRelationshipSecret: "an adult couple is consensually non-monogamous but keeps that arrangement hidden",
  polyamorySecret: "several consenting adults share a relationship that outsiders do not know about",
  privateKink: "an adult character has a private consensual intimate preference they fear being judged for",
  hiddenPregnancy: "an adult character is concealing a pregnancy or the significance of it",
  disputedParentage: "the assumed parentage of a child is not what the adults involved have claimed",
  secretParenthood: "an adult has a child they have never publicly acknowledged",
  marriageOfConvenience: "an adult marriage exists mainly for practical, political, or financial reasons",
  secretEngagement: "two adults are secretly engaged or privately promised to each other",
  secretDivorce: "an adult couple is already separated or divorced but is hiding it",
  doubleLifePartner: "an adult maintains a hidden spouse or partner in another part of their life",
  workplaceRomance: "adult colleagues have a concealed consensual relationship that complicates their loyalties",
  exSpouseReturns: "an adult's supposedly distant former spouse returns with unfinished business",
  financialInfidelity: "an adult partner has hidden major debt, spending, assets, or financial commitments",
  gamblingDebt: "an adult character's concealed gambling debt is driving their current choices",
  substanceRelapse: "an adult character has secretly relapsed into substance misuse and is hiding the consequences",
  adultVenueConnection: "an adult character has a hidden connection to an adults-only venue or social scene",
  hiddenSexWorkPast: "an adult character has concealed consensual sex-work history or involvement",
  secretSurrogacy: "adults arranged a hidden surrogacy or parenthood plan that is now affecting the story",
  fertilitySecret: "an adult partner has concealed a major reproductive or fertility decision",
  prenupTrap: "an adult marriage contract contains a hidden condition, penalty, or source of leverage",
  loverIsInformant: "an adult romantic partner is secretly passing information to another side",
  revengeRomance: "an adult romance began as a calculated scheme for revenge or access, then became emotionally real",

};
var CP_CATEGORY_KEYS = Object.keys(CP_CATEGORIES);

var CP_CATEGORY_CLUSTERS = {
  "Identity & Deception": ["hiddenIdentity","falseAlly","fakedDefeat","doubleAgent","notTheOriginal","theRescuerNeedsRescuing","secretRelation","sleeperAgent","bodySwap","theMirror","unreliableMemory","splitPersonality","theActor","disguisedEnemy","theSubstitute","livingLegend","stolenIdentity","stagedDefection","secretProtector","falseConfession"],
  "Family & Relationship": ["theOriginStory","secretSibling","secretParentage","arrangedFate","theInheritance","disownedHeir","theWard","loversPast","theRival","familyCurse","secretMarriage","secretAdoption","hiddenGuardian","inheritanceTrap"],
  "Power & Authority": ["theFigurehead","hiddenSuccessor","coupInMotion","theUsurpersRegret","falseAuthority","theKingmaker","rebellionWithin","theExile","stolenLegacy","theSuccessionWar","controlledOpposition","coupWithinCoup","emergencyPowers","puppetSuccessor"],
  "Knowledge & Secrets": ["buriedPast","forbiddenKnowledge","theWitness","codedMessage","theArchive","suppressedTruth","theConfession","falseMemoryImplant","theTranslator","hiddenJournal","hushMoney","plantedEvidence","fabricatedAlibi","impossibleWitness","censoredRecord"],
  "Object & Place": ["hiddenNature","theRelic","falseMap","theVault","cursedGift","theKey","secretPassage","theForgery","livingWeapon","theSanctuary","buriedEvidence","possessedObject","sentientPlace","changingMap","duplicateKey"],
  "Motive & Morality": ["ulteriorMotive","trustedFlip","theTest","wrongEnemy","theGreaterGood","selfishRescue","theRedemption","falseVictim","theBreakingPoint","mercyKilling","theProvocateur","guiltDriven","theInterventionist","falseFlag","stagedRescue","unknowingAccomplice","secretBenefactor","falseChoice"],
  "Time & Sequence": ["longConGame","theFlashback","alreadyHappened","theCountdown","loopedFate","prematureVictory","theOmen","delayedConsequence","theSetup","secondChance","theRecurrence","futureMessage","missingTime","timeDebt","parallelPlan"],
  "Group & Society": ["allianceOfConvenience","hiddenFaction","infiltratedOrder","theCult","dividedLoyalties","theOutcast","collectiveAmnesia","theGatekeepers","falseConsensus","theInsurance","splinterGroup","proxyWar","manufacturedRivalry","ghostOrganization","hiddenMutiny"],
  "Perception & Reality": ["misdirection","theIllusion","wrongTimeline","theDouble","theSimulation","sharedDelusion","theGaslight","wrongVillain","theRecording","dreamWithinReality","theStandin","memoryAnchor","realityLeak","decoyTarget","observerEffect"],
  "Fate & Destiny": ["secretDebt","sharedFate","theWarningWasReal","theCostWasHidden","thePropheciesTwist","bornForThis","theSacrificePlanned","inheritedEnemy","theChosenWrong","fatesLoophole","theBargain","destinyDeferred","theSign","circleComplete","falseProphecy","inheritedBargain","chosenByAccident","destinyTransfer"],
  "Vice & Corruption": ["theBlackmail","secretDependency","theExploiter","corruptedOath","theObsession","criminalTies","theCoverUp","soldOut","forbiddenBond","cleanHands","protectedCriminal","evidenceBroker","compromisedMentor"],
  "Body & Transformation": ["hiddenAilment","theInfection","notFullyHuman","theRegression","inheritedTrait","theTransferal","slowPoison","theAdaptation","buriedInstinct","theVessel","dormantTransformation","adaptiveEnemy","healingCost","bodyClock"],
  "Mature & Adult (18+)": ["hiddenAffair","secretIntimacy","pastHookup","friendsWithBenefits","openRelationshipSecret","polyamorySecret","privateKink","hiddenPregnancy","disputedParentage","secretParenthood","marriageOfConvenience","secretEngagement","secretDivorce","doubleLifePartner","workplaceRomance","exSpouseReturns","financialInfidelity","gamblingDebt","substanceRelapse","adultVenueConnection","hiddenSexWorkPast","secretSurrogacy","fertilitySecret","prenupTrap","loverIsInformant","revengeRomance"]
};
var CP_CLUSTER_NAMES = Object.keys(CP_CATEGORY_CLUSTERS);
var CP_CATEGORY_TO_CLUSTER = {};
CP_CLUSTER_NAMES.forEach(function(cluster) {
  CP_CATEGORY_CLUSTERS[cluster].forEach(function(key) { CP_CATEGORY_TO_CLUSTER[key] = cluster; });
});

// Mature themes are opt-in and only target characters with clear adult evidence.
var CP_MATURE_KEYS = new Set([
  "hiddenAffair", "secretIntimacy", "pastHookup", "friendsWithBenefits", "openRelationshipSecret", "polyamorySecret", "privateKink", "hiddenPregnancy", "disputedParentage", "secretParenthood", "marriageOfConvenience", "secretEngagement", "secretDivorce", "doubleLifePartner", "workplaceRomance", "exSpouseReturns", "financialInfidelity", "gamblingDebt", "substanceRelapse", "adultVenueConnection", "hiddenSexWorkPast", "secretSurrogacy", "fertilitySecret", "prenupTrap", "loverIsInformant", "revengeRomance"
]);

var CP_CATEGORY_LABELS = {
  hiddenIdentity: "Hidden Identity",
  falseAlly: "False Ally",
  ulteriorMotive: "Ulterior Motive",
  buriedPast: "Buried Past",
  fakedDefeat: "Faked Defeat",
  secretDebt: "Secret Debt",
  doubleAgent: "Double Agent",
  misdirection: "Misdirection",
  hiddenNature: "Hidden Nature",
  trustedFlip: "Loyalty Turn",
  longConGame: "Long Con",
  theTest: "It Was a Test",
  notTheOriginal: "Not the Original",
  sharedFate: "Shared Fate",
  theWarningWasReal: "Warning Was Real",
  wrongEnemy: "Wrong Enemy",
  theCostWasHidden: "Hidden Cost",
  allianceOfConvenience: "Alliance of Convenience",
  theOriginStory: "False Origin",
  theRescuerNeedsRescuing: "Compromised Rescuer",

  secretRelation: "Secret Relation",
  sleeperAgent: "Sleeper Agent",
  bodySwap: "Body Swap",
  theMirror: "Dark Mirror",
  unreliableMemory: "Unreliable Memory",
  splitPersonality: "Split Identity",
  theActor: "The Actor",
  disguisedEnemy: "Disguised Enemy",
  theSubstitute: "The Substitute",
  livingLegend: "Living Legend",

  secretSibling: "Secret Sibling",
  secretParentage: "Secret Parentage",
  arrangedFate: "Arranged Fate",
  theInheritance: "The Inheritance",
  disownedHeir: "Disowned Heir",
  theWard: "The Ward",
  loversPast: "Past Lovers",
  theRival: "The Rival's Grudge",
  familyCurse: "Family Curse",
  secretMarriage: "Secret Marriage",

  theFigurehead: "The Figurehead",
  hiddenSuccessor: "Hidden Successor",
  coupInMotion: "Coup in Motion",
  theUsurpersRegret: "Usurper's Regret",
  falseAuthority: "False Authority",
  theKingmaker: "The Kingmaker",
  rebellionWithin: "Rebellion Within",
  theExile: "The Exile Returns",
  stolenLegacy: "Stolen Legacy",
  theSuccessionWar: "Succession War",

  forbiddenKnowledge: "Forbidden Knowledge",
  theWitness: "The Silent Witness",
  codedMessage: "Coded Message",
  theArchive: "The Archive",
  suppressedTruth: "Suppressed Truth",
  theConfession: "The Confession",
  falseMemoryImplant: "Planted Memory",
  theTranslator: "Altered Translation",
  hiddenJournal: "Hidden Journal",
  hushMoney: "Hush Money",

  theRelic: "The Relic",
  falseMap: "False Map",
  theVault: "The Hidden Vault",
  cursedGift: "Cursed Gift",
  theKey: "The Key",
  secretPassage: "Secret Passage",
  theForgery: "The Forgery",
  livingWeapon: "Living Weapon",
  theSanctuary: "False Sanctuary",
  buriedEvidence: "Buried Evidence",

  theGreaterGood: "The Greater Good",
  selfishRescue: "Selfish Rescue",
  theRedemption: "Quiet Redemption",
  falseVictim: "False Victim",
  theBreakingPoint: "Breaking Point",
  mercyKilling: "Mercy Killing",
  theProvocateur: "The Provocateur",
  guiltDriven: "Guilt-Driven",
  theInterventionist: "The Interventionist",
  falseFlag: "False Flag",

  theFlashback: "The Flashback",
  alreadyHappened: "Already Happened",
  theCountdown: "The Countdown",
  loopedFate: "Looped Fate",
  prematureVictory: "Premature Victory",
  theOmen: "The Omen Fulfilled",
  delayedConsequence: "Delayed Consequence",
  theSetup: "The Long Setup",
  secondChance: "Second Chance",
  theRecurrence: "The Recurrence",

  hiddenFaction: "Hidden Faction",
  infiltratedOrder: "Infiltrated Order",
  theCult: "The True Purpose",
  dividedLoyalties: "Divided Loyalties",
  theOutcast: "The Vindicated Outcast",
  collectiveAmnesia: "Collective Amnesia",
  theGatekeepers: "The Gatekeepers",
  falseConsensus: "False Consensus",
  theInsurance: "The Insurance Plan",
  splinterGroup: "Splinter Group",

  theIllusion: "The Illusion",
  wrongTimeline: "Wrong Timeline",
  theDouble: "The Double",
  theSimulation: "The Simulation",
  sharedDelusion: "Shared Delusion",
  theGaslight: "The Gaslight",
  wrongVillain: "Wrong Villain",
  theRecording: "The Recording",
  dreamWithinReality: "Dream Within Reality",
  theStandin: "The Stand-In",

  thePropheciesTwist: "Prophecy Misread",
  bornForThis: "Born for This",
  theSacrificePlanned: "The Planned Sacrifice",
  inheritedEnemy: "Inherited Enemy",
  theChosenWrong: "Wrong Chosen One",
  fatesLoophole: "Fate's Loophole",
  theBargain: "The Old Bargain",
  destinyDeferred: "Destiny Deferred",
  theSign: "The Overlooked Sign",
  circleComplete: "Circle Complete",

  hiddenAffair: "Hidden Affair (18+)",
  theBlackmail: "The Blackmail",
  secretDependency: "Secret Dependency",
  theExploiter: "The Exploiter",
  corruptedOath: "Corrupted Oath",
  theObsession: "The Obsession",
  criminalTies: "Criminal Ties",
  theCoverUp: "The Cover-Up",
  soldOut: "Sold Out",
  forbiddenBond: "Forbidden Bond",

  hiddenAilment: "Hidden Ailment",
  theInfection: "The Infection",
  notFullyHuman: "Not Fully Human",
  theRegression: "The Regression",
  inheritedTrait: "Inherited Trait",
  theTransferal: "The Transferal",
  slowPoison: "Slow Poison",
  theAdaptation: "The Adaptation",
  buriedInstinct: "Buried Instinct",
  theVessel: "The Vessel",


  // v1.2 additions
  stolenIdentity: "Stolen Identity",
  stagedDefection: "Staged Defection",
  secretProtector: "Secret Protector",
  falseConfession: "False Confession",
  secretAdoption: "Secret Adoption",
  hiddenGuardian: "Hidden Guardian",
  inheritanceTrap: "Inheritance Trap",
  controlledOpposition: "Controlled Opposition",
  coupWithinCoup: "Coup Within a Coup",
  emergencyPowers: "Emergency Powers",
  puppetSuccessor: "Puppet Successor",
  plantedEvidence: "Planted Evidence",
  fabricatedAlibi: "Fabricated Alibi",
  impossibleWitness: "Impossible Witness",
  censoredRecord: "Censored Record",
  possessedObject: "Possessed Object",
  sentientPlace: "Sentient Place",
  changingMap: "Changing Map",
  duplicateKey: "Duplicate Key",
  stagedRescue: "Staged Rescue",
  unknowingAccomplice: "Unknowing Accomplice",
  secretBenefactor: "Secret Benefactor",
  falseChoice: "False Choice",
  futureMessage: "Message From the Future",
  missingTime: "Missing Time",
  timeDebt: "Time Debt",
  parallelPlan: "Parallel Plan",
  proxyWar: "Proxy War",
  manufacturedRivalry: "Manufactured Rivalry",
  ghostOrganization: "Ghost Organization",
  hiddenMutiny: "Hidden Mutiny",
  memoryAnchor: "Memory Anchor",
  realityLeak: "Reality Leak",
  decoyTarget: "Decoy Target",
  observerEffect: "Observer Effect",
  falseProphecy: "Fabricated Prophecy",
  inheritedBargain: "Inherited Bargain",
  chosenByAccident: "Chosen by Accident",
  destinyTransfer: "Transferred Destiny",
  cleanHands: "Clean Hands",
  protectedCriminal: "Protected Criminal",
  evidenceBroker: "Evidence Broker",
  compromisedMentor: "Compromised Mentor",
  dormantTransformation: "Dormant Transformation",
  adaptiveEnemy: "Adaptive Enemy",
  healingCost: "Cost of Healing",
  bodyClock: "Hidden Body Clock",
  secretIntimacy: "Secret Intimacy (18+)",
  pastHookup: "Past Hookup (18+)",
  friendsWithBenefits: "Friends With Benefits (18+)",
  openRelationshipSecret: "Open Relationship Secret (18+)",
  polyamorySecret: "Hidden Polyamory (18+)",
  privateKink: "Private Kink (18+)",
  hiddenPregnancy: "Hidden Pregnancy (18+)",
  disputedParentage: "Disputed Parentage (18+)",
  secretParenthood: "Secret Parenthood (18+)",
  marriageOfConvenience: "Marriage of Convenience (18+)",
  secretEngagement: "Secret Engagement (18+)",
  secretDivorce: "Secret Divorce (18+)",
  doubleLifePartner: "Double-Life Partner (18+)",
  workplaceRomance: "Workplace Romance (18+)",
  exSpouseReturns: "Ex-Spouse Returns (18+)",
  financialInfidelity: "Financial Infidelity (18+)",
  gamblingDebt: "Gambling Debt (18+)",
  substanceRelapse: "Substance Relapse (18+)",
  adultVenueConnection: "Adults-Only Venue Connection (18+)",
  hiddenSexWorkPast: "Hidden Sex-Work Past (18+)",
  secretSurrogacy: "Secret Surrogacy (18+)",
  fertilitySecret: "Fertility Secret (18+)",
  prenupTrap: "Prenup Trap (18+)",
  loverIsInformant: "Lover Is an Informant (18+)",
  revengeRomance: "Revenge Romance (18+)",

};

var CP_TWIST_CARD_TYPE = "Twist / Turn";

var CP_LOOSE_THREAD_PATTERNS = [
  { rx: /\b(seemed to know (more|too much)|knew more than (they|he|she) let on)\b/i, cat: "ulteriorMotive" },
  { rx: /\b(something (felt|seemed) off|didn't add up|too convenient|too easy)\b/i, cat: "misdirection" },
  { rx: /\b(wouldn't meet (their|his|her) eyes|hesitated before answering|avoided the question|changed the subject)\b/i, cat: "hiddenIdentity" },
  { rx: /\b(kept .{0,15} secret|didn't (mention|explain)|never (said|spoke of))\b/i, cat: "buriedPast" },
  { rx: /\b(disappeared without|vanished without|no body was (ever )?found|never (found|recovered) the body)\b/i, cat: "fakedDefeat" },
  { rx: /\b(owed (him|her|them)|a debt (was|is) owed|called in a favor)\b/i, cat: "secretDebt" },
  { rx: /\b(lied about|wasn't telling the (whole )?truth|a half-truth)\b/i, cat: "hiddenIdentity" },
  { rx: /\b(for reasons (of )?(their|his|her) own|refused to explain|declined to say why)\b/i, cat: "ulteriorMotive" },
  { rx: /\b(more (to (this|it) )?than (it|they) (seemed|let on)|not (everything|the whole story))\b/i, cat: "misdirection" },
  { rx: /\b(reported dead|presumed dead|thought (dead|lost) )\b/i, cat: "fakedDefeat" },
  { rx: /\b(had been planning|this was no coincidence|part of something (bigger|larger))\b/i, cat: "longConGame" },
  { rx: /\b(a test|being tested|to see (if|whether) (they|he|she))\b/i, cat: "theTest" },
  { rx: /\b(wasn't (the )?(real|original)|an impostor|had (replaced|been replacing))\b/i, cat: "notTheOriginal" },
  { rx: /\b(dismissed as|nobody believed|written off as (a )?(rumor|myth|legend))\b/i, cat: "theWarningWasReal" },
  { rx: /\b(blamed for something (they|he|she) didn't do|wrongly accused|took the blame for)\b/i, cat: "wrongEnemy" },
  { rx: /\b(secretly (working|allied) with|an uneasy alliance|behind closed doors)\b/i, cat: "allianceOfConvenience" },
  { rx: /\b(hadn't always been|wasn't always (this|so)|used to be different)\b/i, cat: "buriedPast" },
  { rx: /\b(everyone assumed|it was assumed that|no one questioned|no one thought to ask)\b/i, cat: "misdirection" },
  { rx: /\b(kept (their|his|her) distance|stayed out of sight|watched from a distance)\b/i, cat: "ulteriorMotive" },
  { rx: /\b(went quiet|fell silent|didn't answer right away)\s+(at|when|after)\b/i, cat: "hiddenIdentity" },
  { rx: /\b(saw (it all|everything) and said nothing|had witnessed|witnessed the whole thing)\b/i, cat: "theWitness" },
  { rx: /\b(paid (him|her|them) to keep quiet|paid for (his|her|their) silence|bought (his|her|their) silence)\b/i, cat: "hushMoney" },
  { rx: /\b(made it look like|staged to look like|framed to look like)\b/i, cat: "falseFlag" },
  { rx: /\b(made (him|her|them) doubt|convinced (him|her|them) (it|they)(?:'d)? imagined)\b/i, cat: "theGaslight" },
  { rx: /\b(no one (spoke of|mentioned) it (again|since)|agreed never to (speak|mention) (of )?it)\b/i, cat: "collectiveAmnesia" },
  { rx: /\b(running out of time|less time than (he|she|they|it) thought|closer than anyone realized)\b/i, cat: "theCountdown" },
  { rx: /\b(thought it was (finally )?over|wasn't (truly|really) over|far from over)\b/i, cat: "prematureVictory" },
  { rx: /\b(couldn't forgive (himself|herself|themselves)|haunted by what (he|she|they) (did|had done))\b/i, cat: "guiltDriven" },
  { rx: /\b(close to (the |a )?breaking point|couldn't take much more|at (his|her|their) limit)\b/i, cat: "theBreakingPoint" },
  { rx: /\b(took credit for|claimed credit for) .{0,20}(work|discovery|achievement)/i, cat: "stolenLegacy" },
  { rx: /\b(trying to make up for|trying to atone for|seeking redemption for)\b/i, cat: "theRedemption" },
  { rx: /\b(waiting for (this|the) (moment|signal)|the signal (finally )?came)\b/i, cat: "sleeperAgent" },
  { rx: /\b(wasn't a coincidence that (they|he|she) (met|found|arrived)|too neatly arranged)\b/i, cat: "theSetup" },
  { rx: /\b(had happened before, to someone else|had played out before)\b/i, cat: "loopedFate" },

  { rx: /\b(stolen glances|more than (just )?friends|shouldn't have (happened|been there)|a moment (they|he|she) shouldn't have shared)\b/i, cat: "hiddenAffair" },
  { rx: /\b(had leverage over|held something over|threatened to expose|knew too much to be ignored|compliance bought with silence)\b/i, cat: "theBlackmail" },
  { rx: /\b(couldn't stop even (though|when)|needed it just to (function|get through)|a hidden habit|hands shook without it)\b/i, cat: "secretDependency" },
  { rx: /\b(took advantage of (his|her|their) trust|used (his|her|their) (vulnerability|dependence)|preyed on)\b/i, cat: "theExploiter" },
  { rx: /\b(looked the other way for|took the bribe|sworn to protect.{0,20}but|compromised (his|her|their) position for)\b/i, cat: "corruptedOath" },
  { rx: /\b(couldn't stop thinking about|watched (him|her|them) from afar|fixated on|obsessed over)\b/i, cat: "theObsession" },
  { rx: /\b(still owed (the|his|her|their) (old )?crew|hadn't really left that life behind|one foot still in that world)\b/i, cat: "criminalTies" },
  { rx: /\b(buried the report|made the (evidence|problem) disappear|quietly made it go away|scrubbed from the record)\b/i, cat: "theCoverUp" },
  { rx: /\b(sold (?:\w+\s+){0,2}out|betrayed (?:his|her|their|\w+'s) own (?:side|crew|people|team|family))\b/i, cat: "soldOut" },

  { rx: /\b(kept (?:it|the pain|this) (?:hidden|secret|to (?:himself|herself|themselves))|hadn't told anyone how (?:sick|bad) it had gotten)\b/i, cat: "hiddenAilment" },
  { rx: /\b(spreading (?:through|beneath) (?:his|her|their) skin|something was (?:wrong|changing) beneath the surface)\b/i, cat: "theInfection" },
  { rx: /\b(eyes (?:flickered|shifted) unnaturally|something (?:moved|shifted) beneath (?:his|her|their) skin|not (?:entirely|fully|quite) human)\b/i, cat: "notFullyHuman" },
  { rx: /\b(revert(?:ing|ed) to (?:an? )?(?:old|former|earlier) self|slipping back into (?:old|former) habits (?:no one|nobody) (?:thought|believed) (?:were gone|had ended))\b/i, cat: "theRegression" },
  { rx: /\b(had been getting (?:worse|sicker) for (?:weeks|months|days)|something in (?:his|her|their) (?:food|water|drink) all along)\b/i, cat: "slowPoison" },
  { rx: /\b(old instincts? (?:resurfacing|returning|clawing back)|couldn't explain the sudden urge)\b/i, cat: "buriedInstinct" },

  // v1.2 — direct detection coverage for every twist category, including the opt-in adult set.
  { rx: /\b(shared (?:the same )?fate|their fates? (?:were|are) linked|bound by the same hidden cause)\b/i, cat: "sharedFate" },
  { rx: /\b(hidden cost|price (?:no one|nobody) mentioned|victory came with a price|the cost was concealed)\b/i, cat: "theCostWasHidden" },
  { rx: /\b(origin story was (?:false|a lie)|wasn\'t how it really began|accepted origin was (?:wrong|false))\b/i, cat: "theOriginStory" },
  { rx: /\b(rescuer (?:was|is) compromised|the one sent to save .{0,20} needed saving|already compromised before the rescue)\b/i, cat: "theRescuerNeedsRescuing" },
  { rx: /\b(dark reflection of|mirror image of|more alike than (?:he|she|they) wanted to admit)\b/i, cat: "theMirror" },
  { rx: /\b(second personality|alternate personality|another personality took over|two personalities)\b/i, cat: "splitPersonality" },
  { rx: /\b(playing a role for so long|the performance became (?:his|her|their) identity|pretending for years)\b/i, cat: "theActor" },
  { rx: /\b(swapped out midway|substituted without anyone noticing|replacement took (?:his|her|their) place)\b/i, cat: "theSubstitute" },
  { rx: /\b(raised by someone who wasn\'t who they claimed|secret ward of|guardian wasn\'t who (?:he|she|they) claimed)\b/i, cat: "theWard" },
  { rx: /\b(used to be lovers|former lovers|old flame|shared a romantic past)\b/i, cat: "loversPast" },
  { rx: /\b(true successor|hidden successor|secret heir to (?:the )?(?:throne|position|office|command))\b/i, cat: "hiddenSuccessor" },
  { rx: /\b(usurper.{0,30}regret|wanted to give (?:the )?power back|seizing power was a mistake)\b/i, cat: "theUsurpersRegret" },
  { rx: /\b(succession (?:struggle|war) had already begun|multiple claimants were already competing|fight over the succession)\b/i, cat: "theSuccessionWar" },
  { rx: /\b(archive.{0,30}contradict|sealed records? contradicted|records? in the archive told a different story)\b/i, cat: "theArchive" },
  { rx: /\b(planted memory|memory was implanted|memories were implanted|false memory was inserted)\b/i, cat: "falseMemoryImplant" },
  { rx: /\b(mistranslated on purpose|translation was altered|translator changed the message|deliberate mistranslation)\b/i, cat: "theTranslator" },
  { rx: /\b(map was (?:false|fake|deliberately wrong)|false map|map led them the wrong way on purpose)\b/i, cat: "falseMap" },
  { rx: /\b(turned out to be the key|ordinary .{0,20} unlocked something major|was the only key to)\b/i, cat: "theKey" },
  { rx: /\b(living weapon|weapon was alive|weapon had a mind of its own|artifact awakened as a weapon)\b/i, cat: "livingWeapon" },
  { rx: /\b(sanctuary was a trap|safe place wasn\'t safe|supposedly safe .{0,20} compromised|dangerous place was secretly safe)\b/i, cat: "theSanctuary" },
  { rx: /\b(for the greater good|did terrible things to save|harm was meant to protect everyone|cruelty served a hidden good)\b/i, cat: "theGreaterGood" },
  { rx: /\b(for (?:your|his|her|their) own good|secretly steering .{0,25} to protect|manipulated events to protect)\b/i, cat: "theInterventionist" },
  { rx: /\b(past event wasn\'t what it seemed|what happened back then was different|flashback revealed a different truth)\b/i, cat: "theFlashback" },
  { rx: /\b(second chance at the same choice|same choice again|another chance to choose differently)\b/i, cat: "secondChance" },
  { rx: /\b(outcast was right|exiled .{0,20} was right all along|shunned .{0,20} had been right)\b/i, cat: "theOutcast" },
  { rx: /\b(secretly controlling access|gatekeepers controlled|access was being controlled by unseen hands)\b/i, cat: "theGatekeepers" },
  { rx: /\b(consensus was manufactured|everyone agrees .{0,20} manufactured|only a few made it seem everyone agreed)\b/i, cat: "falseConsensus" },
  { rx: /\b(secret contingency plan|insurance plan no one knew about|backup plan was already in place)\b/i, cat: "theInsurance" },
  { rx: /\b(wrong timeline|not the year they thought|events were out of order|timeframe was wrong)\b/i, cat: "wrongTimeline" },
  { rx: /\b(the simulation|constructed reality|controlled environment masquerading as reality|reality was simulated)\b/i, cat: "theSimulation" },
  { rx: /\b(recording contradicted|footage didn\'t match|audio contradicted|captured image told a different story)\b/i, cat: "theRecording" },
  { rx: /\b(dream was real|vision was a real warning|what seemed like a dream actually happened)\b/i, cat: "dreamWithinReality" },
  { rx: /\b(stand-in for the real|decoy stood in for|substitute was used in place of the real)\b/i, cat: "theStandin" },
  { rx: /\b(prophecy meant something else|misread prophecy|true meaning of the prophecy|prophecy had been misunderstood)\b/i, cat: "thePropheciesTwist" },
  { rx: /\b(wrong chosen one|chosen one wasn\'t actually|picked the wrong chosen|the chosen was mistaken)\b/i, cat: "theChosenWrong" },
  { rx: /\b(loophole in fate|way around destiny|fate could be cheated|escape clause in the prophecy)\b/i, cat: "fatesLoophole" },
  { rx: /\b(escaped destiny once|avoided fate before|destiny was catching up|deferred fate)\b/i, cat: "destinyDeferred" },
  { rx: /\b(overlooked sign|sign had pointed to|omen pointed directly to|the sign was there all along)\b/i, cat: "theSign" },
  { rx: /\b(identity belonged to someone else|living under someone else\'s name|stole (?:his|her|their) identity)\b/i, cat: "stolenIdentity" },
  { rx: /\b(defection was staged|pretended to defect|fake betrayal was part of the plan)\b/i, cat: "stagedDefection" },
  { rx: /\b(secretly protecting|hostility was a cover for protection|enemy had been protecting)\b/i, cat: "secretProtector" },
  { rx: /\b(false confession|confessed to protect someone|confession was deliberately untrue)\b/i, cat: "falseConfession" },
  { rx: /\b(secretly adopted|adoption was hidden|raised as (?:their|his|her) own but not born to)\b/i, cat: "secretAdoption" },
  { rx: /\b(secret guardian|had been watching over .{0,25} for years|unseen protector since childhood)\b/i, cat: "hiddenGuardian" },
  { rx: /\b(inheritance was a trap|will contained a hidden condition|inheritance was designed as a test)\b/i, cat: "inheritanceTrap" },
  { rx: /\b(opposition was secretly funded by|controlled opposition|rebels were being financed by the regime)\b/i, cat: "controlledOpposition" },
  { rx: /\b(coup within a coup|used the coup to seize power from the plotters|second takeover behind the first)\b/i, cat: "coupWithinCoup" },
  { rx: /\b(emergency powers were meant to become permanent|temporary powers .{0,20} permanent|crisis powers were the real goal)\b/i, cat: "emergencyPowers" },
  { rx: /\b(successor was a puppet|heir was being groomed to be controlled|controllable successor)\b/i, cat: "puppetSuccessor" },
  { rx: /\b(evidence was planted|planted evidence|proof had been placed there deliberately)\b/i, cat: "plantedEvidence" },
  { rx: /\b(alibi was fabricated|manufactured alibi|someone created (?:his|her|their) alibi)\b/i, cat: "fabricatedAlibi" },
  { rx: /\b(witness knew something (?:he|she|they) couldn\'t have seen|impossible witness|could not have witnessed)\b/i, cat: "impossibleWitness" },
  { rx: /\b(record was selectively altered|pages had been removed from the record|official record was censored)\b/i, cat: "censoredRecord" },
  { rx: /\b(object was possessed|spirit inside the (?:object|weapon|artifact)|artifact had a will of its own)\b/i, cat: "possessedObject" },
  { rx: /\b(place was alive|building was aware|forest was watching|location itself reacted)\b/i, cat: "sentientPlace" },
  { rx: /\b(map kept changing|route moved on the map|roads shifted when no one looked)\b/i, cat: "changingMap" },
  { rx: /\b(two identical keys|supposedly unique .{0,20} had a duplicate|second copy of the unique artifact)\b/i, cat: "duplicateKey" },
  { rx: /\b(rescue was staged|engineered the rescue|danger had been arranged so .{0,20} could save)\b/i, cat: "stagedRescue" },
  { rx: /\b(unknowing accomplice|helping without knowing what it enabled|had been assisting the plan without realizing)\b/i, cat: "unknowingAccomplice" },
  { rx: /\b(secret benefactor|quietly funding|anonymous protector was actually|enemy had been financing)\b/i, cat: "secretBenefactor" },
  { rx: /\b(false choice|every option served the same plan|choice was rigged so either way)\b/i, cat: "falseChoice" },
  { rx: /\b(message from the future|future self sent|warning came from a future version)\b/i, cat: "futureMessage" },
  { rx: /\b(missing time|hours? (?:he|she|they) couldn\'t remember|gap in (?:his|her|their) memory and the records)\b/i, cat: "missingTime" },
  { rx: /\b(time debt|changing the past had a price|timeline demanded repayment|cost of altering time)\b/i, cat: "timeDebt" },
  { rx: /\b(two plans were synchronized|parallel plans shared the same deadline|unrelated plans were timed together)\b/i, cat: "parallelPlan" },
  { rx: /\b(proxy war|both sides were funded by a third|third party arranged the conflict)\b/i, cat: "proxyWar" },
  { rx: /\b(rivalry was manufactured|kept the groups divided on purpose|feud had been engineered)\b/i, cat: "manufacturedRivalry" },
  { rx: /\b(organization never really existed|ghost organization|fabricated group used as a front)\b/i, cat: "ghostOrganization" },
  { rx: /\b(mutiny was already underway|crew had split into secret loyalties|secret mutiny)\b/i, cat: "hiddenMutiny" },
  { rx: /\b(memory anchor|only .{0,25} remembered the true version|object preserved the original memory)\b/i, cat: "memoryAnchor" },
  { rx: /\b(another reality was bleeding through|reality leak|details from another timeline appeared)\b/i, cat: "realityLeak" },
  { rx: /\b(target was a decoy|obvious target was bait|attack was really aimed at something else)\b/i, cat: "decoyTarget" },
  { rx: /\b(changed depending on who watched|observer changed the outcome|events differed for different witnesses)\b/i, cat: "observerEffect" },
  { rx: /\b(prophecy was fabricated|fake prophecy|someone wrote the prophecy to make it come true)\b/i, cat: "falseProphecy" },
  { rx: /\b(bargain made by (?:their|his|her) ancestors|inherited bargain|old family deal bound)\b/i, cat: "inheritedBargain" },
  { rx: /\b(chosen by accident|chosen one was a substitution|role went to the wrong person by mistake)\b/i, cat: "chosenByAccident" },
  { rx: /\b(destiny transferred|fate meant for .{0,20} attached to|inherited someone else\'s fate)\b/i, cat: "destinyTransfer" },
  { rx: /\b(kept (?:his|her|their) hands clean by|outsourced the dirty work|respectable front while others did the crimes)\b/i, cat: "cleanHands" },
  { rx: /\b(criminal was protected by|institution shielded .{0,20} from consequences|protected asset despite the crimes)\b/i, cat: "protectedCriminal" },
  { rx: /\b(selling secrets to both sides|evidence broker|traded information between rivals)\b/i, cat: "evidenceBroker" },
  { rx: /\b(mentor had a hidden agenda|teacher had been steering .{0,20} for private reasons|compromised mentor)\b/i, cat: "compromisedMentor" },
  { rx: /\b(transformation had already begun|change was being suppressed|dormant transformation)\b/i, cat: "dormantTransformation" },
  { rx: /\b(enemy was learning from every encounter|adapted to every tactic|studying each fight to evolve)\b/i, cat: "adaptiveEnemy" },
  { rx: /\b(healing had a hidden cost|wounds were transferred elsewhere|every cure moved the damage)\b/i, cat: "healingCost" },
  { rx: /\b(body was on a countdown|biological countdown|transformation deadline inside (?:him|her|them))\b/i, cat: "bodyClock" },
  { rx: /\b(secret intimate relationship|intimate history they kept hidden|were lovers in secret)\b/i, cat: "secretIntimacy" },
  { rx: /\b(one[- ]night history|hooked up once|one[- ]time intimate past)\b/i, cat: "pastHookup" },
  { rx: /\b(friends with benefits|more than friends in private|private arrangement between the two adults)\b/i, cat: "friendsWithBenefits" },
  { rx: /\b(open relationship|consensually non[- ]monogamous|their relationship was open in private)\b/i, cat: "openRelationshipSecret" },
  { rx: /\b(polyamorous relationship|secret polyamory|all three were partners)\b/i, cat: "polyamorySecret" },
  { rx: /\b(private kink|consensual intimate preference|private fetish)\b/i, cat: "privateKink" },
  { rx: /\b(hiding (?:a |the )?pregnancy|secretly pregnant|pregnancy had been concealed)\b/i, cat: "hiddenPregnancy" },
  { rx: /\b(paternity was uncertain|not the biological parent everyone assumed|child\'s parentage was a secret)\b/i, cat: "disputedParentage" },
  { rx: /\b(secret child|never acknowledged (?:his|her|their) child|hidden son|hidden daughter)\b/i, cat: "secretParenthood" },
  { rx: /\b(marriage of convenience|married for political reasons|married for money rather than love)\b/i, cat: "marriageOfConvenience" },
  { rx: /\b(secretly engaged|private engagement|promised to marry in secret)\b/i, cat: "secretEngagement" },
  { rx: /\b(secretly divorced|already separated but hiding it|divorce was kept quiet)\b/i, cat: "secretDivorce" },
  { rx: /\b(secret spouse|hidden husband|hidden wife|partner in another life)\b/i, cat: "doubleLifePartner" },
  { rx: /\b(secret office romance|coworkers were secretly dating|concealed workplace relationship)\b/i, cat: "workplaceRomance" },
  { rx: /\b(ex[- ]husband returned|ex[- ]wife returned|former spouse came back)\b/i, cat: "exSpouseReturns" },
  { rx: /\b(hidden debt from (?:his|her|their) partner|secret bank account|financial infidelity|concealed spending)\b/i, cat: "financialInfidelity" },
  { rx: /\b(gambling debt|owed money from betting|betting losses were hidden)\b/i, cat: "gamblingDebt" },
  { rx: /\b(secretly relapsed|relapse was being hidden|using again after getting clean)\b/i, cat: "substanceRelapse" },
  { rx: /\b(adults[- ]only club|adult venue|private adult club|hidden connection to the club)\b/i, cat: "adultVenueConnection" },
  { rx: /\b(past in sex work|worked as an escort|sex[- ]work history|former sex worker)\b/i, cat: "hiddenSexWorkPast" },
  { rx: /\b(secret surrogacy|surrogate pregnancy was hidden|private surrogacy arrangement)\b/i, cat: "secretSurrogacy" },
  { rx: /\b(fertility treatment was hidden|secret reproductive decision|concealed fertility issue)\b/i, cat: "fertilitySecret" },
  { rx: /\b(prenup had a hidden clause|marriage contract was a trap|prenuptial agreement concealed)\b/i, cat: "prenupTrap" },
  { rx: /\b(lover was an informant|romantic partner was feeding information|partner reported to another side)\b/i, cat: "loverIsInformant" },
  { rx: /\b(romance began as revenge|relationship started as a scheme|dated .{0,20} to get close for revenge)\b/i, cat: "revengeRomance" },
];

var CP_SCENARIO_HINT_PATTERNS = [
  { rx: /\b(infected|contagion|plague|parasite|spreading sickness)\b/i, cat: "theInfection" },
  { rx: /\b(not fully human|part[- ]?(?:demon|beast|machine)|hybrid (?:nature|origin))\b/i, cat: "notFullyHuman" },
  { rx: /\b(vessel for|host (?:body|to)|possessed by|carries something not (?:its|his|her|their) own)\b/i, cat: "theVessel" },
  { rx: /\b(hereditary curse|runs in the (?:family|bloodline)|passed down through blood)\b/i, cat: "inheritedTrait" },
  { rx: /\b(secretly|in truth|unbeknownst to|hidden agenda)\b/i, cat: "ulteriorMotive" },
  { rx: /\b(true identity|disguised as|masquerading as|not what (he|she|they) seem)\b/i, cat: "hiddenIdentity" },
  { rx: /\b(exiled|banished|forbidden|sealed away)\b/i, cat: "buriedPast" },
  { rx: /\b(cursed|prophecy (foretells|speaks of)|rumored to)\b/i, cat: "theWarningWasReal" },
  { rx: /\b(believed to be dead|vanished decades ago|long-lost)\b/i, cat: "fakedDefeat" },
  { rx: /\b(sworn enemy|betrayed by|harbors? a grudge|seeks revenge)\b/i, cat: "trustedFlip" },
  { rx: /\b(double life|spy for|loyal only to|clandestine|conspiracy)\b/i, cat: "doubleAgent" },
  { rx: /\b(usurper|illegitimate heir)\b/i, cat: "notTheOriginal" },
  { rx: /\b(bound by an oath|debt (is |was )?owed)\b/i, cat: "secretDebt" },
  { rx: /\bcursed bloodline\b/i, cat: "familyCurse" },
  { rx: /\b(true nature|concealed power|hidden power)\b/i, cat: "hiddenNature" },
  { rx: /\b(sleeper agent|planted (long ago|years ago)|awaiting (the |a )?signal)\b/i, cat: "sleeperAgent" },
  { rx: /\b(forbidden knowledge|knowledge forbidden to)\b/i, cat: "forbiddenKnowledge" },
  { rx: /\b(secret society|hidden order|shadow (council|organization))\b/i, cat: "hiddenFaction" },
  { rx: /\b(chosen (at|from) birth|destined from birth|groomed since (birth|childhood))\b/i, cat: "bornForThis" },
  { rx: /\b(illegitimate (heir|child)|unacknowledged (heir|child))\b/i, cat: "secretParentage" },
  { rx: /\b(arranged (marriage|betrothal)|betrothed since (birth|childhood))\b/i, cat: "arrangedFate" },
  { rx: /\b(usurped the throne|seized power (illegitimately|by force))\b/i, cat: "coupInMotion" },
  { rx: /\b(ancient relic|artifact of great power|relic of (great )?power)\b/i, cat: "theRelic" },

  { rx: /\b(secret affair|forbidden romance|scandalous relationship)\b/i, cat: "hiddenAffair" },
  { rx: /\b(being blackmailed|held (something|a secret) over|extorted by)\b/i, cat: "theBlackmail" },
  { rx: /\b(secret addiction|hidden vice|struggles? with (a |an )?(addiction|dependency))\b/i, cat: "secretDependency" },
  { rx: /\b(criminal underworld|ties to organized crime|debt to a crime (boss|lord|syndicate))\b/i, cat: "criminalTies" },
  { rx: /\b(cover[- ]?up|corrupt official|bribed into silence)\b/i, cat: "theCoverUp" },

  // Earlier builds had a substantial direct-detection gap: many twist
  // categories could only enter through random selection. v1.2 completes
  // direct pattern coverage for the entire category pool, while the sorted
  // specificity matcher below prevents broad phrases from stealing a more
  // precise match in the same sentence.
  { rx: /\b(had been working against (?:him|her|them) the whole time|betrayed (?:his|her|their) trust from the start)\b/i, cat: "falseAlly" },
  { rx: /\b(were related and neither (?:knew|had known)|shared blood (?:they|neither) (?:had )?ever knew about)\b/i, cat: "secretRelation" },
  { rx: /\b(wasn't in (?:his|her|their) own body|consciousness had been swapped)\b/i, cat: "bodySwap" },
  { rx: /\b((?:his|her|their) memory of that night didn't match|remembered it differently than everyone else)\b/i, cat: "unreliableMemory" },
  { rx: /\b(had been (?:the enemy|working against them) since before it (?:all )?began|hiding in plain sight the whole time)\b/i, cat: "disguisedEnemy" },
  { rx: /\b(the legend was real after all|thought to be (?:a myth|dead) (?:and )?stood before them)\b/i, cat: "livingLegend" },

  { rx: /\b(had a (?:brother|sister|sibling) (?:nobody|no one) knew about)\b/i, cat: "secretSibling" },
  { rx: /\b(stood to inherit .{0,30} nobody knew|secretly (?:next|first) in line to inherit)\b/i, cat: "theInheritance" },
  { rx: /\b(was cut off from (?:his|her|their) family, though (?:no one|nobody) would say why|disowned .{0,20} for reasons no one (?:explained|understood))\b/i, cat: "disownedHeir" },
  { rx: /\b(were already (?:married|wed) in secret|a vow (?:no one|nobody) else knew about)\b/i, cat: "secretMarriage" },
  { rx: /\b(the rivalry wasn't as friendly as it looked|an old grudge behind the friendly rivalry)\b/i, cat: "theRival" },

  { rx: /\b(was (?:just|only) a figurehead|took orders from someone else entirely)\b/i, cat: "theFigurehead" },
  { rx: /\b(the (?:title|rank) turned out to be fake|had no real claim to the (?:title|position))\b/i, cat: "falseAuthority" },
  { rx: /\b(had been pulling the strings (?:unseen|from the shadows)|shaped events without anyone noticing)\b/i, cat: "theKingmaker" },
  { rx: /\b(the exile had (?:quietly|secretly) returned|banished .{0,20} years ago, now back)\b/i, cat: "theExile" },
  { rx: /\b((?:his|her|their) own (?:people|guards|men) were plotting against (?:him|her|them))\b/i, cat: "rebellionWithin" },

  { rx: /\b((?:had|has) known all along and (?:covered|hushed) it up|actively covered up what (?:it|they) already knew)\b/i, cat: "suppressedTruth" },
  { rx: /\b(had been trying to (?:say|tell|admit) something and kept getting (?:interrupted|cut off)|almost confessed before)\b/i, cat: "theConfession" },
  { rx: /\b(a journal revealed what (?:he|she|they) (?:really|actually) believed|diary entries told a different story)\b/i, cat: "hiddenJournal" },
  { rx: /\b(a message hidden in plain sight the whole time|hidden inside what looked like nothing)\b/i, cat: "codedMessage" },

  { rx: /\b(a hidden (?:passage|door|route) had been there the whole time|a passage no map showed)\b/i, cat: "secretPassage" },
  { rx: /\b(was a forgery, and (?:he|she|they) already knew it|the document was fake all along)\b/i, cat: "theForgery" },
  { rx: /\b(the gift came with a price (?:no one|nobody) mentioned|a generous gift carried a hidden cost)\b/i, cat: "cursedGift" },
  { rx: /\b(the proof had been (?:buried|hidden) nearby the whole time|evidence sat hidden, waiting to be found)\b/i, cat: "buriedEvidence" },
  { rx: /\b(a hidden cache (?:sat|waited) unnoticed nearby|a stash no one had found yet)\b/i, cat: "theVault" },

  { rx: /\b(had orchestrated (?:his|her|their) own suffering|played the victim to hide (?:his|her|their) own hand in it)\b/i, cat: "falseVictim" },
  { rx: /\b(wasn't cruelty, it was mercy|meant to spare (?:him|her|them) something worse)\b/i, cat: "mercyKilling" },
  { rx: /\b(had been quietly stoking the conflict|fanned the flames for (?:his|her|their) own reasons)\b/i, cat: "theProvocateur" },
  { rx: /\b(the rescue wasn't as selfless as it looked|had (?:his|her|their) own reasons for the rescue)\b/i, cat: "selfishRescue" },

  { rx: /\b(had happened before, and (?:no one|nobody) remembered|this had all happened once already)\b/i, cat: "alreadyHappened" },
  { rx: /\b(was finally catching up after all this time|a debt from long ago come due)\b/i, cat: "delayedConsequence" },
  { rx: /\b(the pattern was repeating itself|history was repeating, exactly as before)\b/i, cat: "theRecurrence" },
  { rx: /\b(the prophecy had already come true, quietly|the sign had already come to pass unnoticed)\b/i, cat: "theOmen" },

  { rx: /\b((?:the order|the institution) had already been compromised from within|infiltrated long before anyone noticed)\b/i, cat: "infiltratedOrder" },
  { rx: /\b(the group's true purpose was (?:nothing|far) like what it claimed|a front for something else entirely)\b/i, cat: "theCult" },
  { rx: /\b(the order was secretly split into (?:two|opposing) camps|loyalties inside the group weren't what they seemed)\b/i, cat: "dividedLoyalties" },
  { rx: /\b(had broken away and operated (?:independently|in secret)|a splinter faction no one outside knew existed)\b/i, cat: "splinterGroup" },

  { rx: /\b(what (?:he|she|they) (?:were|was) perceiving wasn't (?:physically )?real|none of it had been physically real)\b/i, cat: "theIllusion" },
  { rx: /\b(two people had been mistaken for one the whole time|there had always been two of them, not one)\b/i, cat: "theDouble" },
  { rx: /\b(everyone had been led to believe the same false thing|the whole group shared the same false belief)\b/i, cat: "sharedDelusion" },
  { rx: /\b(the real (?:enemy|villain) had been operating unnoticed|someone else entirely was behind it all along)\b/i, cat: "wrongVillain" },

  { rx: /\b(a deal struck long ago had terms coming due|an old bargain with a price only now demanded)\b/i, cat: "theBargain" },
  { rx: /\b(the feud (?:was|had been) inherited, not started fresh|a conflict passed down from a previous generation)\b/i, cat: "inheritedEnemy" },
  { rx: /\b(had always intended to (?:give up|sacrifice) (?:himself|herself|themselves) when the time came)\b/i, cat: "theSacrificePlanned" },
  { rx: /\b(history (?:was|is) completing a circle generations in the making|mirrored something from generations back)\b/i, cat: "circleComplete" },

  { rx: /\b(a bond (?:no one|nobody) would (?:accept|understand)|a connection everyone around them would reject)\b/i, cat: "forbiddenBond" },
  { rx: /\b(something had moved from one body to another, and it wasn't supposed to|a consciousness transferred into someone else entirely)\b/i, cat: "theTransferal" },
  { rx: /\b(had been quietly changing to survive something no one else (?:had )?noticed|adapting to a threat still invisible to everyone else)\b/i, cat: "theAdaptation" }
];

var CP_ALL_THREAD_PATTERNS = CP_LOOSE_THREAD_PATTERNS
  .concat(CP_SCENARIO_HINT_PATTERNS)
  .slice()
  .sort(function(a, b) {
    function score(p) {
      const src = String((p && p.rx && p.rx.source) || "");
      let n = src.length;
      n -= (src.match(/\.\*/g) || []).length * 24;
      n -= (src.match(/\.\+/g) || []).length * 16;
      if (p && CP_MATURE_KEYS.has(p.cat)) n += 6;
      return n;
    }
    return score(b) - score(a);
  });

var CP_TIER_MINOR = "minor";
var CP_TIER_MODERATE = "moderate";
var CP_TIER_MAJOR = "major";
var CP_TIER_CATACLYSMIC = "cataclysmic";

var CP_TIER_LABELS = {
  minor: "minor",
  moderate: "moderate",
  major: "major",
  cataclysmic: "story-altering"
};
var CP_TIER_ORDER_FULL = [CP_TIER_MINOR, CP_TIER_MODERATE, CP_TIER_MAJOR, CP_TIER_CATACLYSMIC];

var CP_COMPOUND_CHANCE = 0.4;

var CP_WILDCARD_CHANCE = 0.35;

// Shared by both systems' capitalized-word filtering (this file's own
// CP_STOPWORDS just below, and UNSAID's CODEX_STOPWORDS further down) —
// general-purpose closed-class words, contractions, and narration/
// dialogue-attribution verbs that show up capitalized in ordinary prose
// constantly (sentence starts, inverted dialogue tags) and were never real
// name candidates. This list was built out extensively on the Codex side
// over many rounds after real transcripts kept surfacing gaps ("Talking",
// "Muttered", "Your", "Turn," etc. each getting mistaken for a name) — but
// TWISTS AND TURNS' own entity detection (findEntityInSentence) still used
// a small, much older list and never received the same hardening, meaning
// a plain word like "Muttered" or "Turn" could become a tracked twist
// entity and later get written directly into the AI-visible "Established
// Facts" card, keys and all, as if it were a real character or place name
// — confirmed directly via sandbox: "Muttered something under his breath,
// wouldn't meet their eyes..." created a thread on "Muttered" that
// resolved into an Established Facts card entry reading "Muttered: Someone
// in the story isn't who they appear to be... Treat all of this as settled
// fact going forward," with "Muttered" as a match key — meaning that card
// would then spuriously fire on any future ordinary use of the word. One
// shared base list means a future gap only needs finding and fixing once,
// the same reasoning already applied to NAME_ALPHANUM above.
var COMMON_CAPITALIZED_STOPWORDS = [
  "I", "The", "A", "An", "You", "He", "She", "They", "It", "We", "But",
  "And", "So", "Then", "If", "When", "As", "At", "In", "On", "With",
  "This", "That", "There", "Here", "What", "Who", "Why", "How", "Yes",
  "No", "Okay", "Oh", "Well", "Suddenly", "Meanwhile", "Finally",
  "Perhaps", "Maybe", "However", "Still", "Yet", "Now", "Later",
  "Before", "After", "Once", "Just", "Even", "Also", "Instead",
  "Indeed", "Certainly", "Clearly", "Obviously", "Surely",
  "Sometimes", "Always", "Never", "Really", "Actually", "Honestly",
  "Wait", "Look", "Listen", "Right", "Alright", "Hey", "Hi", "Hello", "Huh", "Hmm", "Ah", "Heh",
  "Easy", "Careful", "Steady", "Quiet", "Patience", "Hush", "Stop",
  "Freeze", "Move", "Run", "Go", "Come", "Stay", "Help", "Please",
  "Sorry", "Thanks", "Fine", "Sure", "Great", "Good", "Bad", "Nice", "Bold",
  "Your", "My", "His", "Her", "Its", "Our", "Their", "These", "Those",
  "Some", "Any", "All", "Each", "Every", "Nothing", "Something", "Anything", "Someone", "Everyone",
  "Which", "People", "Outside", "Got", "Like", "Yeah", "To", "Very",
  "Inside", "Others", "Sounds", "Absolutely", "Especially", "Downstairs",
  "Bodies", "Honesty", "Accepted",
  // Ordinary descriptive adjectives with essentially zero plausibility as
  // an actual character/place name on their own (unlike "Red" or
  // "Ancient," left alone elsewhere for having real nickname/epithet
  // plausibility) — confirmed a real, reachable instance of exactly the
  // "words becoming cards" failure class via a full sandbox scenario
  // replay: a dialogue line opening with "Old instincts keep
  // resurfacing..." made "Old" the sentence's only capitalized word,
  // which then became `lastEntity` and silently attached itself to a
  // *later*, unrelated sentence that matched a real twist pattern but had
  // no capitalized word of its own — attributing someone else's twist to
  // a plain adjective, twice, across two different categories.
  "Old", "New", "Young", "Small", "Large", "Long", "Short", "Certain",
  "Sure", "True", "Real", "Whole", "Empty", "Full", "Simple",
  // Found via a fresh round of stopword-hunting across sentence-initial
  // dialogue openers, narration/scene-setting adverbs, and interjections
  // — the same systematic approach that found "Old" last round, applied
  // more broadly this time. A few of these (Apparently, Eventually,
  // Recently) were already excluded from twist-entity detection via
  // CP_STOPWORDS' own twist-specific extras below, but never made it into
  // this shared base — meaning they were still valid Codex candidates,
  // able to waste retry attempts the exact same way "L"/"S"/"To" did in
  // real captured evidence, despite being correctly blocked on the twist
  // side the whole time. Adding them here instead closes the gap for
  // both systems at once and removes the risk of it splitting again.
  "Frankly", "Naturally", "Apparently", "Supposedly", "Technically",
  "Ultimately", "Eventually", "Regardless", "Nearby", "Ahead", "Overhead",
  "Underneath", "Nope", "Yep", "Ugh", "Wow", "Oof", "Argh", "Phew",
  "Terrific", "Excellent", "Understood", "Agreed", "Precisely", "Exactly",
  "Presumably", "Curiously", "Strangely", "Interestingly", "Unfortunately",
  "Fortunately", "Surprisingly", "Predictably", "Understandably",
  "Admittedly", "Reportedly", "Allegedly", "According",
  "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "One", "Turn", "Chapter", "Part", "Scene", "Day", "Night", "Morning",
  "Evening", "Afternoon", "Time", "Silence", "Darkness", "Light",
  "Fate", "Death", "Life", "Space", "Everything", "Damn", "Greetings", "Traffic",

  "Rain", "Snow", "Fog", "Mist", "Frost", "Thunder", "Lightning", "Wind",
  "Storm", "Dawn", "Dusk", "Twilight", "Midnight", "Noon", "Sunrise", "Sunset",
  "Not", "Nor", "Only", "Too", "Off", "Out", "Up", "Down", "Away", "Of", "From",
  "Above", "Below", "Under", "Over", "Between", "Among", "Within",
  "Without", "Behind", "Beside", "Beyond", "Around", "About", "Against",
  "Toward", "Towards", "Upon", "Onto", "Into", "Along", "Across",
  "Through", "Throughout", "During", "Both", "Either", "Neither",
  "Most", "More", "Less", "Much", "Many", "Few", "Little", "Own",
  "Such", "Same", "Other", "Another", "Next", "Last", "First",
  "Second", "Third", "Twice", "Whether", "Although", "Though",
  "Because", "Unless", "Until", "Since", "While", "Where", "Whatever",
  "Whoever", "Whenever", "Wherever", "Whichever", "Almost", "Enough",
  "Rather", "Quite", "Somehow", "Somewhat", "Anyway", "Anywhere",
  "Nowhere", "Somewhere", "Nobody", "Somebody", "Anybody", "Everybody",
  "Nevertheless", "Nonetheless", "Otherwise", "Therefore", "Thus",
  "For", "Or", "Can", "Could", "Should", "Would", "Must", "Shall", "Might",
  "Do", "Does", "Did", "Is", "Was", "Are", "Were", "Am", "Be", "Been", "Being",
  "Have", "Has", "Had", "Let", "Given", "Despite", "Regarding", "Considering",
  "Except", "Besides", "Unlike",
  "North", "South", "East", "West", "Northeast", "Northwest",
  "Southeast", "Southwest",
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
  "Saturday",
  "January", "February", "March", "April", "June", "July", "August",
  "September", "October", "November", "December",

  // Contractions now get captured as one token by the apostrophe-aware name
  // regex (needed for real names like O'Brien) — without these, common
  // dialogue contractions get tracked as if they were name candidates.
  "Don't", "Won't", "Can't", "Isn't", "Wasn't", "Wouldn't", "Couldn't",
  "Shouldn't", "Didn't", "Doesn't", "Aren't", "Weren't", "Hasn't",
  "Haven't", "Hadn't", "I'm", "I'll", "I've", "I'd", "You're", "You'll",
  "You've", "You'd", "He's", "He'll", "He'd", "She's", "She'll", "She'd",
  "It's", "It'll", "That's", "That'll", "There's", "There'll", "Here's",
  "What's", "What'll", "Let's", "We're", "We'll", "We've", "We'd",
  "They're", "They'll", "They've", "They'd", "Who's", "Who'll",

  // A dialogue line's first word (or an inverted dialogue tag's opening
  // verb) gets capitalized by ordinary sentence rules regardless of what
  // the word is, and prose is full of narration/attribution verbs that
  // show up this way constantly — a real transcript surfaced "Talking",
  // "Seen", "Forget", "Call", "Fitting" this way in a single short
  // exchange, and this project's own sandbox testing surfaced "Muttered,"
  // "Whispered," "Sighed," and "Frowning" doing the exact same thing to
  // the twist engine. None of these are enumerable in advance the way a
  // closed word class is — this covers the common recurring ones rather
  // than only the specific ones observed, since the underlying pattern is
  // general, not particular to any one story.
  "Talking", "Seen", "Forget", "Forgot", "Forgotten", "Call", "Called",
  "Calling", "Fitting", "Asked", "Asking", "Told", "Telling", "Replied",
  "Replying", "Answered", "Answering", "Muttered", "Muttering",
  "Whispered", "Whispering", "Shouted", "Shouting", "Cried", "Crying",
  "Gasped", "Gasping", "Sighed", "Sighing", "Laughed", "Laughing",
  "Smiled", "Smiling", "Nodded", "Nodding", "Shook", "Shaking",
  "Frowned", "Frowning", "Grinned", "Grinning", "Blinked", "Blinking",
  "Paused", "Pausing", "Continued", "Continuing", "Added", "Adding",
  "Admitted", "Admitting", "Explained", "Explaining", "Insisted",
  "Insisting", "Murmured", "Murmuring", "Snapped", "Snapping",
  "Growled", "Growling", "Breathed", "Breathing", "Watched", "Watching",
  "Stared", "Staring", "Glanced", "Glancing", "Shrugged", "Shrugging",

  // Prompt/template labels and ordinary sentence-openers that should never
  // become autonomous Story Card candidates.
  "AI", "Instruction", "Instructions", "World", "Lore", "Recent", "Story",
  "Stories", "Character", "Characters", "Card", "Cards", "Codex", "Unsaid",
  "Hint", "Profile", "Profiles", "Rule", "Rules", "Field", "Fields",
  "Name", "Race", "Strength", "Level", "Background", "Personality",
  "Appearance", "Ability", "Abilities", "Weakness", "Weaknesses",
  "Relationship", "Relationships", "Type", "Description", "Significance",
  "Properties", "Origin", "Location", "Locations", "Historical", "Events",
  "Action", "Actions", "Input", "Output", "Context", "System", "Assistant",
  "User", "Player", "Dungeon", "Master", "Template", "Task", "Mandatory",
  "Visible", "Hidden", "Text", "Note", "Notes",

  // Present-tense narration/dialogue words and scene-setting adverbs. The
  // past/gerund forms were already covered above.
  "Say", "Says", "Ask", "Asks", "Reply", "Replies", "Answer", "Answers",
  "Look", "Looks", "Step", "Steps", "Walk", "Walks", "Reach", "Reaches",
  "Turn", "Turns", "Follow", "Follows", "Stare", "Stares", "Glance", "Glances",
  "Smile", "Smiles", "Nod", "Nods", "Frown", "Frowns", "Shrug", "Shrugs",
  "Whisper", "Whispers", "Murmur", "Murmurs", "Shout", "Shouts", "Laugh",
  "Laughs", "Sigh", "Sighs", "Pause", "Pauses", "Continue", "Continues",
  "Slowly", "Quickly", "Softly", "Quietly", "Gently", "Carefully",
  "Immediately", "Abruptly", "Briefly", "Slightly", "Barely", "Nearly",
  "Simply", "Moment", "Voice", "Eyes", "Hand", "Hands", "Face", "Head",

  // More high-frequency sentence openers, temporal words, stage directions,
  // and generic actions. These are useful prose but terrible autonomous
  // entity candidates, especially at the beginning of generated sentences.
  "Suddenly", "Finally", "Meanwhile", "Later", "Earlier", "Soon", "Still",
  "Even", "Perhaps", "Maybe", "Actually", "Instead", "Together", "Apart",
  "Nearby", "Ahead", "Behind", "Inside", "Outside", "Upstairs", "Downstairs",
  "Today", "Tonight", "Tomorrow", "Yesterday", "Morning", "Afternoon",
  "Evening", "Night", "Day", "Dawn", "Dusk", "Midnight", "Noon",
  "Yes", "No", "Okay", "Alright", "Fine", "Sure", "Well", "Right",
  "Someone", "Somebody", "Something", "Anyone", "Anybody", "Anything",
  "Everyone", "Everybody", "Everything", "Nobody", "Nothing",
  "Grab", "Grabs", "Grabbed", "Take", "Takes", "Took", "Taking",
  "Place", "Places", "Placed", "Move", "Moves", "Moved", "Moving",
  "Run", "Runs", "Ran", "Running", "Raise", "Raises", "Raised", "Raising",
  "Lower", "Lowers", "Lowered", "Open", "Opens", "Opened", "Opening",
  "Close", "Closes", "Closed", "Closing", "Hold", "Holds", "Held",
  "Keep", "Keeps", "Kept", "Feel", "Feels", "Felt", "Feeling",
  "Seem", "Seems", "Seemed", "Appear", "Appears", "Appeared",
  "Remain", "Remains", "Remained", "Begin", "Begins", "Began",
  "Start", "Starts", "Started", "Stop", "Stops", "Stopped",
  "Leave", "Leaves", "Left", "Return", "Returns", "Returned",
  "Enter", "Enters", "Entered", "Arrive", "Arrives", "Arrived",
  "Come", "Comes", "Came", "Go", "Goes", "Went", "Sit", "Sits", "Sat",
  "Stand", "Stands", "Stood", "Lean", "Leans", "Leaned",
  "Pull", "Pulls", "Pulled", "Push", "Pushes", "Pushed",
  "Swallow", "Swallows", "Swallowed", "Tilt", "Tilts", "Tilted",
  "Shift", "Shifts", "Shifted", "Wince", "Winces", "Winced",
  "Flinch", "Flinches", "Flinched", "Exhale", "Exhales", "Exhaled",
  "Inhale", "Inhales", "Inhaled",
  "Narrator", "Narration", "Response", "Continue", "Continuation", "Dialogue",
  "Conversation", "Setting", "Summary", "Memory", "Plot", "Essentials",
  "Author", "Authors", "Scenario", "Adventure", "Quest", "Chapter", "Section",
  "Current", "Previous", "Following", "Opening", "Ending", "Example", "Examples",
  "Important", "Note", "Reminder", "Format", "Formatting", "Marker", "Markers",
  "Required", "Optional", "Default", "Defaults", "Config", "Configuration",
  "Enabled", "Disabled", "True", "False", "None", "Unknown", "TBD",
  "Said", "Spoke", "Speaking", "Tell", "Tells", "Think", "Thinks", "Thought",
  "Wonder", "Wonders", "Notice", "Notices", "Hear", "Hears", "Saw", "Seeing",
  "Watch", "Watches", "Approach", "Approaches", "Approached", "Cross",
  "Crosses", "Crossed", "Pass", "Passes", "Passed", "Waits", "Waited",
  "Sudden", "Soft", "Low", "High", "Deep", "Faint", "Brief", "Slow", "Fast" ,

  // Additional script/config scaffolding words filtered in v1.2.
  "Prompt", "History", "Key", "Faction", "Twist", "Twists", "Category", "Categories", "Cluster", "Clusters", "Catalog", "Mature", "Adult", "Adults", "Private", "Core", "Truth", "Evidence", "Entity", "Entities", "Theme", "Themes", "Model", "Models", "Script", "Scripts", "Hook", "Hooks", "Cache", "Optimized", "Status", "Command", "Commands", "Enable", "Allow", "Minimum", "Maximum", "Chance", "Cooldown", "Reset", "Detected", "Tracking", "Tracked", "Eligible", "Pending", "Retry", "Retries", "Attempts", "TurnCount", "Version", "Warning", "Backup", "Delivery", "FrontMemory", "StoryCard", "StoryCards", "Established", "Facts", "Brewing", "Resolved", "Ready", "Payoff", "Foreshadow", "Wildcard", "Compound", "Strict", "Logic",
  "Genre", "Genres", "Tone", "Tones", "Era", "Eras", "Adapt", "Adaptive", "Adaptation",
  "Override", "Overrides", "Grounded", "Speculative", "Intimate", "Local", "Scale", "Scales",
  "Canon", "Canonical", "Instructional", "Diagnostic", "Diagnostics", "Automatic", "Automatically"
];




// TWISTS AND TURNS' own additions on top of the shared base — narrative-
// hedging/rumor vocabulary that matters specifically for how loose-thread
// and scenario-hint scanning phrase things ("rumored to," "legend has
// it..."), not really Codex-specific.
var CP_STOPWORDS = new Set([
  ...COMMON_CAPITALIZED_STOPWORDS,
  "Rumored", "Legend", "Legends", "According", "Reportedly", "Allegedly",
  "Apparently", "Eventually", "Recently", "Long"
].map(w => w.toLowerCase()));

// Managed front-memory segments. Each subsystem owns only its own marked
// line, so enabling/disabling one feature can never wipe user-authored front
// memory or the other subsystem's hint.
var FRONT_MEMORY_MARKER = "[UNSAID hint]";
var TWIST_FRONT_MEMORY_MARKER = "[TWISTS hint]";

function setManagedFrontMemorySegment(marker, body) {
  if (typeof state === "undefined") return;
  if (!state.memory || typeof state.memory !== "object") state.memory = {};

  const current = typeof state.memory.frontMemory === "string"
    ? state.memory.frontMemory
    : "";
  const kept = current
    .split("\n")
    .filter(line => line.trim().indexOf(marker) !== 0)
    .join("\n")
    .replace(/^\n+|\n+$/g, "");

  const compactBody = body == null ? "" : String(body).replace(/\s+/g, " ").trim();
  const segment = compactBody ? `${marker} ${compactBody}` : "";
  state.memory.frontMemory = kept && segment
    ? `${kept}\n\n${segment}`
    : (kept || segment);
}

function syncTwistFrontMemoryHint(hint) {
  setManagedFrontMemorySegment(TWIST_FRONT_MEMORY_MARKER, hint || "");
}

var Library = (() => {
  function initState() {
    if (!state.contingency) {
      state.contingency = {
        turn: 0,
        threads: [],
        twistLog: [],
        lastPayoffTurn: -999,
        lastPayoffAttemptTurn: -999,
        pendingPayoffId: null,
        pendingSeedId: null,
        forceEntity: null,
        forcePlant: null,
        importedCardSignatures: {},
        lastContextSignature: null,
        lastAuthorsNoteSignature: null,
        pendingPayoffId2: null,
        scriptTurnCount: 0,
        lastHookActionCount: null,
        lastHookSignature: null,
        lastMatureEnabled: null,
        scenarioProfile: null,

        multiplayerNames: []
      };
    }
    if (typeof state.contingency.turn !== "number") state.contingency.turn = 0;
    if (!Array.isArray(state.contingency.threads)) state.contingency.threads = [];
    if (!Array.isArray(state.contingency.twistLog)) state.contingency.twistLog = [];
    // Repair/migrate persisted thread state defensively. Old adventures can
    // survive many script versions, and a missing id/category/number should
    // not poison every later hook through one swallowed exception.
    state.contingency.threads = state.contingency.threads.filter(t =>
      t && typeof t === "object" && t.entity && CP_CATEGORIES[t.category]
    );
    let maxThreadSeq = 0;
    state.contingency.threads.forEach(t => {
      const idMatch = String(t.id || "").match(/^t(\d+)$/);
      if (idMatch) maxThreadSeq = Math.max(maxThreadSeq, parseInt(idMatch[1], 10) || 0);
      if (typeof t.seedTouches !== "number" || !isFinite(t.seedTouches)) t.seedTouches = 1;
      t.seedTouches = Math.max(1, Math.floor(t.seedTouches));
      if (!["brewing", "ready", "resolved"].includes(t.status)) t.status = "brewing";
      if (!CP_TIER_ORDER_FULL.includes(t.tier)) t.tier = tierFor(t.seedTouches);
      if (typeof t.originTurn !== "number" || !isFinite(t.originTurn)) t.originTurn = state.contingency.turn;
      if (typeof t.lastSeedTurn !== "number" || !isFinite(t.lastSeedTurn)) t.lastSeedTurn = t.originTurn;
      if (typeof t.confirmMisses !== "number") t.confirmMisses = 0;
      if (typeof t.seedConfirmMisses !== "number") t.seedConfirmMisses = 0;
      if (typeof t.psychologyLinked !== "boolean") t.psychologyLinked = false;
      if (typeof t.psychologyTouches !== "number") t.psychologyTouches = 0;
      if (typeof t.lastPsychologyTurn !== "number") t.lastPsychologyTurn = -999;
      if (typeof t.storyEvidenceTouches !== "number" || !isFinite(t.storyEvidenceTouches)) {
        // Best-effort migration for old saves. Ordinary scanned threads had
        // objective story evidence; wildcard/manual-only threads did not.
        t.storyEvidenceTouches = t.wildcard ? 0 : Math.min(1, t.seedTouches || 0);
      }
      t.storyEvidenceTouches = Math.max(0, Math.floor(t.storyEvidenceTouches));
      if (typeof t.codexLinked !== "boolean") t.codexLinked = false;
      t.mature = isMatureCategory(t.category);
      if (t.mature && typeof t.adultConfirmed !== "boolean") {
        t.adultConfirmed = isEntityConfirmedAdult(t.entity, "");
      }
      if (!t.mature) t.adultConfirmed = false;
    });
    const seenThreadIds = new Set();
    state.contingency.threads.forEach(t => {
      const id = String(t.id || "");
      if (!/^t\d+$/.test(id) || seenThreadIds.has(id)) {
        maxThreadSeq += 1;
        t.id = "t" + maxThreadSeq;
      }
      seenThreadIds.add(t.id);
    });
    if (typeof state.contingency._seq !== "number" || !isFinite(state.contingency._seq)) state.contingency._seq = 0;
    state.contingency._seq = Math.max(state.contingency._seq, maxThreadSeq);
    if (typeof state.contingency.lastPayoffTurn !== "number") state.contingency.lastPayoffTurn = -999;
    if (typeof state.contingency.lastPayoffAttemptTurn !== "number") state.contingency.lastPayoffAttemptTurn = -999;
    if (typeof state.contingency.pendingPayoffId === "undefined") state.contingency.pendingPayoffId = null;
    if (typeof state.contingency.pendingSeedId === "undefined") state.contingency.pendingSeedId = null;
    if (typeof state.contingency.forceEntity === "undefined") state.contingency.forceEntity = null;
    if (typeof state.contingency.forcePlant === "undefined") state.contingency.forcePlant = null;
    if (!state.contingency.importedCardSignatures || typeof state.contingency.importedCardSignatures !== "object") state.contingency.importedCardSignatures = {};
    if (typeof state.contingency.lastContextSignature === "undefined") state.contingency.lastContextSignature = null;
    if (typeof state.contingency.lastAuthorsNoteSignature === "undefined") state.contingency.lastAuthorsNoteSignature = null;
    if (typeof state.contingency.pendingPayoffId2 === "undefined") state.contingency.pendingPayoffId2 = null;
    if (state.contingency.pendingPayoffId && !state.contingency.threads.some(t => t.id === state.contingency.pendingPayoffId)) state.contingency.pendingPayoffId = null;
    if (state.contingency.pendingPayoffId2 && !state.contingency.threads.some(t => t.id === state.contingency.pendingPayoffId2)) state.contingency.pendingPayoffId2 = null;
    if (state.contingency.pendingSeedId && !state.contingency.threads.some(t => t.id === state.contingency.pendingSeedId)) state.contingency.pendingSeedId = null;
    if (typeof state.contingency.scriptTurnCount !== "number") state.contingency.scriptTurnCount = 0;
    if (typeof state.contingency.lastHookActionCount !== "number") state.contingency.lastHookActionCount = null;
    if (typeof state.contingency.lastHookSignature !== "string") state.contingency.lastHookSignature = null;
    if (typeof state.contingency.lastMatureEnabled !== "boolean") state.contingency.lastMatureEnabled = null;
    if (!state.contingency.scenarioProfile || typeof state.contingency.scenarioProfile !== "object") state.contingency.scenarioProfile = null;
    if (!Array.isArray(state.contingency.multiplayerNames)) state.contingency.multiplayerNames = [];
    if (!state.contingencyConfig) {
      state.contingencyConfig = Object.assign({}, CP_DEFAULTS);
    } else {
      for (const k in CP_DEFAULTS) {
        if (!(k in state.contingencyConfig)) state.contingencyConfig[k] = CP_DEFAULTS[k];
      }
    }
    return { c: state.contingency, cfg: state.contingencyConfig };
  }

  function getConfig() { return state.contingencyConfig; }

  function pacingFor(cfg) {
    return CP_INTENSITY_PACING[cfg.intensity] || CP_INTENSITY_PACING.medium;
  }

  function effectivePacing(cfg, c) {
    let pacing = pacingFor(cfg);
    const brewingCount = c.threads.filter(t => t.status === "brewing").length;
    if (brewingCount >= 3) pacing = pacing - 2;
    if (c.scriptTurnCount <= 4) pacing = pacing + 2;
    return Math.max(2, pacing);
  }

  function textSignature(s) {
    s = s || "";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h + ":" + s.length;
  }

  function beginContextTurn(c, rawText) {
    if (!c) return true;

    if (typeof info !== "undefined" && info && Number.isInteger(info.actionCount)) {
      const current = Math.abs(info.actionCount);
      const isNew = c.lastHookActionCount !== current;
      c.turn = current;
      if (isNew) {
        c.lastHookActionCount = current;
        c.scriptTurnCount += 1;
      }
      return isNew;
    }

    // Fallback for runtimes that do not expose actionCount. A stable suffix
    // signature prevents retries/regenerations of the same context from aging
    // every thread or triggering pacing a second time.
    const source = typeof rawText === "string" ? rawText.slice(-6000) : "";
    const historyStamp = (typeof history !== "undefined" && Array.isArray(history)) ? history.length : 0;
    const sig = textSignature(source + "|h:" + historyStamp);
    if (c.lastHookSignature === sig) return false;
    c.lastHookSignature = sig;
    c.turn += 1;
    c.scriptTurnCount += 1;
    return true;
  }

  function extractCommand(raw) {
    if (!raw) return null;
    let t = ("" + raw).trim();
    const sayMatch = t.match(/^You say,?\s*["“”‘’']([\s\S]*)["“”‘’']\s*[.!]?\s*$/i);
    if (sayMatch) t = sayMatch[1].trim();
    t = t.replace(/^You\s+/i, "").trim();
    if (t.startsWith("/")) return t;
    return null;
  }

  function nextId(c) {
    c._seq = (c._seq || 0) + 1;
    return "t" + c._seq;
  }

  function isPlayerEntity(c, entity) {
    if (!entity) return false;
    const lower = entity.toLowerCase();
    if (lower === "you") return true;
    if (c && c.multiplayerNames && c.multiplayerNames.length) {
      return c.multiplayerNames.some(n => n && n.toLowerCase() === lower);
    }
    return false;
  }

  function safeLog(msg) {
    try {
      if (typeof log === "function") log(msg);
      else if (typeof console !== "undefined" && console.log) console.log(msg);
    } catch (e) {}
  }

  function scenarioSourceText(liveText) {
    const parts = [];
    if (typeof liveText === "string" && liveText.trim()) parts.push(liveText.slice(-12000));
    try {
      if (state && state.memory) {
        if (typeof state.memory.context === "string") parts.push(state.memory.context.slice(-5000));
        if (typeof state.memory.authorsNote === "string") parts.push(state.memory.authorsNote.slice(-3000));
      }
    } catch (e) {}
    try {
      if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) {
        let used = 0;
        for (let i = storyCards.length - 1; i >= 0 && used < 12; i--) {
          const card = storyCards[i];
          if (!card || !card.title || isOwnCard(card.title)) continue;
          parts.push([card.title, card.entry, card.description].filter(Boolean).join(" ").slice(0, 900));
          used++;
        }
      }
    } catch (e) {}
    return parts.join("\n").slice(-24000);
  }

  function detectScenarioProfile(liveText, cfg) {
    const safeCfg = cfg || CP_DEFAULTS;
    if (!safeCfg.scenarioAdaptation) {
      return {
        enabled: false,
        tags: ["general"],
        era: "unspecified",
        reality: "unspecified",
        scale: "flexible",
        override: "",
        scores: {}
      };
    }

    const source = scenarioSourceText(liveText);
    const scores = {};
    CP_SCENARIO_SIGNALS.forEach(rule => {
      const matches = source.match(rule.rx);
      if (matches && matches.length) scores[rule.tag] = Math.min(16, matches.length) * rule.weight;
    });

    const override = String(safeCfg.scenarioOverride || "").trim().slice(0, 180);
    let noMagic = false;
    let noSupernatural = false;
    let noAdvancedTech = false;
    if (override) {
      CP_SCENARIO_SIGNALS.forEach(rule => {
        const matches = override.match(rule.rx);
        if (matches && matches.length) scores[rule.tag] = (scores[rule.tag] || 0) + 25;
      });
      const ov = override.toLowerCase();
      noMagic = /\b(?:no|without)\s+(?:magic|magical powers?|spellcasting)\b|\bnon[- ]?magical\b/.test(ov);
      noSupernatural = /\b(?:no|without)\s+(?:supernatural|paranormal)\b/.test(ov);
      noAdvancedTech = /\b(?:no|without)\s+(?:advanced|future|futuristic)\s+tech(?:nology)?\b/.test(ov);
      if (noMagic) scores.fantasy = 0;
      if (noSupernatural && !/\b(?:fantasy|magic|sci[- ]?fi|science fiction)\b/.test(ov)) scores.fantasy = 0;
      if (noAdvancedTech && !/\b(?:sci[- ]?fi|science fiction|cyberpunk)\b/.test(ov)) {
        scores["sci-fi"] = 0;
        scores.cyberpunk = 0;
      }
    }

    const ranked = Object.keys(scores)
      .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))
      .filter(tag => scores[tag] > 0);
    const tags = ranked.slice(0, 4);
    if (!tags.length) tags.push("general");

    const speculativeTags = new Set(["fantasy","sci-fi","cyberpunk","superhero","post-apocalyptic"]);
    const speculativeScore = tags.reduce((n, tag) => n + (speculativeTags.has(tag) ? (scores[tag] || 0) : 0), 0);
    const groundedScore = ["contemporary","historical","slice-of-life","crime/noir","medical","legal","sports","school/campus"]
      .reduce((n, tag) => n + (scores[tag] || 0), 0);
    const reality = speculativeScore >= Math.max(4, groundedScore)
      ? "speculative"
      : (groundedScore >= 3 ? "grounded" : "unspecified");

    let era = "unspecified";
    const futureScore = (scores["sci-fi"] || 0) + (scores["cyberpunk"] || 0) + (scores["post-apocalyptic"] || 0);
    if ((scores.historical || 0) >= Math.max(3, futureScore, scores.contemporary || 0)) era = "historical";
    else if (futureScore >= Math.max(4, scores.contemporary || 0)) era = "futuristic/speculative";
    else if ((scores.contemporary || 0) >= 2) era = "contemporary";

    const intimateScore = (scores.romance || 0) + (scores["slice-of-life"] || 0) +
      (scores["school/campus"] || 0) + (scores.medical || 0) + (scores.sports || 0);
    const largeScaleScore = (scores["military/war"] || 0) + (scores["post-apocalyptic"] || 0) +
      (scores.superhero || 0) + (scores["political/intrigue"] || 0);
    const scale = intimateScore > largeScaleScore + 3 ? "intimate/local"
      : (largeScaleScore > intimateScore + 3 ? "large-scale" : "flexible");

    return { enabled: true, tags, era, reality, scale, override, scores, noMagic, noSupernatural, noAdvancedTech };
  }

  function updateScenarioProfile(c, cfg, liveText) {
    if (!c) return detectScenarioProfile(liveText, cfg);
    const profile = detectScenarioProfile(liveText, cfg);
    profile.updatedTurn = typeof c.turn === "number" ? c.turn : 0;
    c.scenarioProfile = profile;
    return profile;
  }

  function currentScenarioProfile(liveText, cfg) {
    try {
      const c = state && state.contingency;
      if (c && c.scenarioProfile) return c.scenarioProfile;
    } catch (e) {}
    return detectScenarioProfile(liveText, cfg || CP_DEFAULTS);
  }

  function scenarioGuidance(liveText, cfg) {
    const profile = currentScenarioProfile(liveText, cfg);
    if (!profile || !profile.enabled) return "";
    const tagText = profile.tags && profile.tags.length ? profile.tags.join(", ") : "general";
    const overrideText = profile.override ? ` User scenario guidance: "${profile.override}".` : "";
    return " Match the established scenario instead of importing a default genre: " +
      tagText + "; era " + profile.era + "; " + profile.reality + "; stakes " + profile.scale + "." +
      overrideText +
      " Preserve the world's existing technology, magic/supernatural rules, institutions, species, social norms, tone, and power scale. " +
      "Do not add genre mechanics merely because they are common elsewhere. Treat twist severity relative to this story: a top-tier revelation in an intimate scenario can be life-changing without being world-ending.";
  }

  function categoryFitsScenario(category, profile) {
    if (!category || !CP_CATEGORIES[category]) return false;
    if (!profile || !profile.enabled) return true;
    if ((profile.noMagic || profile.noSupernatural) && CP_MAGIC_SUPERNATURAL_KEYS.has(category)) return false;
    if (profile.reality === "grounded" && CP_SPECULATIVE_ONLY_KEYS.has(category)) return false;
    return true;
  }

  function isMatureCategory(category) {
    return !!category && CP_MATURE_KEYS.has(category);
  }

  function ageSignals(text) {
    const s = String(text || "");
    const ages = [];
    const patterns = [
      /\b(?:age|aged)\s*[:\-]?\s*(\d{1,3})\b/gi,
      /\b(\d{1,3})\s*[- ]?years?\s*[- ]?old\b/gi,
      /\b(\d{1,3})\s*[- ]year[- ]old\b/gi
    ];
    patterns.forEach(rx => {
      let m;
      while ((m = rx.exec(s))) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > 0 && n < 130) ages.push(n);
      }
    });
    return ages;
  }

  function isExplicitMinorText(text) {
    const s = String(text || "");
    const ages = ageSignals(s);
    if (ages.some(n => n < 18)) return true;
    return /\b(minor|underage|child|kid|preteen|teenager|teen|schoolboy|schoolgirl|boy|girl|toddler|infant)\b/i.test(s);
  }

  function isExplicitAdultText(text) {
    const s = String(text || "");
    const ages = ageSignals(s);
    if (ages.some(n => n >= 18)) return true;
    if (isExplicitMinorText(s)) return false;
    // Relationship status alone is not proof of adulthood: teenagers can
    // have boyfriends/girlfriends, and even "parent" is not a safe age gate.
    // Keep the 18+ system conservative unless age/adult wording or an
    // unambiguously adult person noun is present.
    return /\b(adult|grown[- ]?(?:man|woman|person)|woman|man|wife|husband|spouse|widow|widower)\b/i.test(s);
  }

  function entityCardText(entity, directOnly) {
    if (!entity || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return "";
    for (let i = 0; i < storyCards.length; i++) {
      const card = storyCards[i];
      if (!card || !card.title) continue;
      let same = false;
      try {
        same = typeof isSameCardEntity === "function"
          ? isSameCardEntity(card.title, entity)
          : String(card.title).toLowerCase() === String(entity).toLowerCase();
      } catch (e) {}
      if (!same) continue;
      const type = String(card.type || "").trim().toLowerCase();
      const entryText = String(card.entry || "");
      const characterFieldSignals = (entryText.match(/^\s*(?:Race|Species|Nature|Strength Level|Personality|Background|Appearance|Abilities|Weaknesses|Relationships)\s*[:=]/gim) || []).length;
      const explicitCharacterType = /^(?:character|npc|person|companion|ally|rival|protagonist|antagonist|crewmate|crew member)$/i.test(type);
      const explicitNonCharacterType = /^(?:location|place|item|object|vehicle|weapon|faction|organization|organisation|business|restaurant|building|city|country|planet|world|class|event|lore)$/i.test(type);
      if (explicitNonCharacterType && characterFieldSignals < 2) return "";
      if (type && !explicitCharacterType && characterFieldSignals < 2) return "";

      if (!directOnly) {
        return [card.title, card.entry, card.description].filter(Boolean).join(" ");
      }

      // For age-gating, use fields that describe the character directly.
      // Background/Relationships can contain somebody else's age ("his
      // eight-year-old daughter") and must not make a forty-year-old target
      // look like a minor.
      const directLines = String(card.entry || "")
        .split(/\r?\n/)
        .filter(line => /^\s*(?:Age|Appearance|Description|Race|Type|Strength Level)\s*[:=]/i.test(line))
        .join(" ");
      return [card.title, directLines, String(card.description || "").slice(0, 320)]
        .filter(Boolean)
        .join(" ");
    }
    return "";
  }

  function isEntityConfirmedAdult(entity, evidenceText) {
    const directCard = entityCardText(entity, true);
    const liveEvidence = String(evidenceText || "");
    const combined = [directCard, liveEvidence].filter(Boolean).join(" ");
    if (!combined) return false;

    const ages = ageSignals(combined);
    // Direct evidence of a minor always wins. Otherwise an explicit adult
    // age is the strongest signal available.
    if (ages.some(n => n < 18)) return false;
    if (ages.some(n => n >= 18)) return true;
    if (isExplicitMinorText(combined)) return false;
    return isExplicitAdultText(combined);
  }

  function isCategoryAllowed(category, entity, cfg, evidenceText) {
    if (!category || !CP_CATEGORIES[category]) return false;
    if (!isMatureCategory(category)) return true;
    if (!cfg || !cfg.allowMatureTwists) return false;
    return isEntityConfirmedAdult(entity, evidenceText);
  }

  function isThreadAllowed(thread, cfg) {
    if (!thread || !thread.category) return false;
    if (!isMatureCategory(thread.category)) return true;
    if (!cfg || !cfg.allowMatureTwists) return false;
    return !!thread.adultConfirmed || isEntityConfirmedAdult(thread.entity, "");
  }



  function findEntityInSentence(sentence) {
    // Reuse Codex's richer proper-name grammar when available so TWISTS AND
    // TURNS does not truncate longer names such as "Jean Luc Picard",
    // "New Avalon Station", or "Order of the Silver Hand" to two tokens.
    try {
      if (typeof CODEX_TITLE_ABBREV_REGEX !== "undefined" &&
          typeof normalizeCodexCandidate === "function") {
        const richRx = new RegExp(CODEX_TITLE_ABBREV_REGEX.source, "g");
        const richMatches = Array.from(String(sentence || "").matchAll(richRx));
        if (richMatches.length) {
          const ordered = richMatches.length > 1
            ? richMatches.slice(1).concat(richMatches.slice(0, 1))
            : richMatches;
          for (const m of ordered) {
            const normalized = normalizeCodexCandidate(m[0], sentence);
            if (!normalized) continue;
            const firstWord = normalized.split(/\s+/)[0].toLowerCase();
            if (CP_STOPWORDS.has(firstWord) && normalized.indexOf(" ") === -1) continue;
            return normalized;
          }
        }
      }
    } catch (e) {}

    const matches = Array.from(sentence.matchAll(new RegExp(`\\b[A-Z][${NAME_ALPHANUM}'-]*\\b`, "g")));
    if (!matches.length) return null;

    const bridge = (i) => {
      const w = stripPossessive(matches[i][0]);
      if (i + 1 < matches.length) {
        const next = stripPossessive(matches[i + 1][0]);
        const gap = sentence.slice(matches[i].index + matches[i][0].length, matches[i + 1].index);
        if (!CP_STOPWORDS.has(next.toLowerCase()) && next.length > 1 && /^\s?$/.test(gap)) {
          return w + " " + next;
        }
      }
      if (i - 1 >= 0) {
        const prev = stripPossessive(matches[i - 1][0]);
        const gap = sentence.slice(matches[i - 1].index + matches[i - 1][0].length, matches[i].index);
        if (!CP_STOPWORDS.has(prev.toLowerCase()) && prev.length > 1 && /^\s?$/.test(gap)) {
          return prev + " " + w;
        }
        if (typeof SENTENCE_ABBREVIATIONS !== "undefined" && SENTENCE_ABBREVIATIONS.has(prev) && /^\.\s?$/.test(gap)) {
          return prev + ". " + w;
        }
      }
      return w;
    };

    const tryFrom = (startIndex) => {
      for (let i = startIndex; i < matches.length; i++) {
        const w = stripPossessive(matches[i][0]);
        if (CP_STOPWORDS.has(w.toLowerCase()) || w.length <= 1) continue;
        let result = bridge(i);
        if (result.indexOf(" ") === -1 && typeof CODEX_TITLE_WORDS !== "undefined" && CODEX_TITLE_WORDS.has(result.toLowerCase())) continue;
        try {
          if (typeof normalizeCodexCandidate === "function") {
            const normalized = normalizeCodexCandidate(result, sentence);
            if (!normalized) continue;
            result = normalized;
          }
        } catch (e) {}
        return result;
      }
      return null;
    };

    if (matches.length > 1) {
      const nonInitial = tryFrom(1);
      if (nonInitial) return nonInitial;
    }
    return tryFrom(0);
  }

  function eligibleCardTitles() {
    if (typeof storyCards === "undefined" || !storyCards) return [];
    const out = [];
    for (let i = 0; i < storyCards.length; i++) {
      const title = storyCards[i] && storyCards[i].title;
      if (title && !isOwnCard(title)) out.push(title);
    }
    // Longest-first is the lookup priority. Sort once here instead of once
    // per sentence inside findKnownEntityInSentence().
    out.sort((a, b) => String(b).length - String(a).length);
    return out;
  }

  function knownEntityLiteralAppears(title, source, sourceLower) {
    const needle = String(title || "").toLowerCase();
    if (!needle) return false;
    const hay = sourceLower || String(source || "").toLowerCase();
    let from = 0;
    while (from <= hay.length - needle.length) {
      const at = hay.indexOf(needle, from);
      if (at < 0) return false;
      const before = at > 0 ? hay.charAt(at - 1) : "";
      const afterAt = at + needle.length;
      const after = afterAt < hay.length ? hay.charAt(afterAt) : "";
      const beforeOk = !before || !/[a-z0-9]/i.test(before);
      const afterOk = !after || !/[a-z0-9]/i.test(after);
      if (beforeOk && afterOk) return true;
      from = at + 1;
    }
    return false;
  }

  function findKnownEntityInSentence(sentence, titles) {
    try {
      const list = titles || eligibleCardTitles();
      const source = String(sentence || "");
      const sourceLower = source.toLowerCase();
      for (let i = 0; i < list.length; i++) {
        const title = list[i];
        if (title && knownEntityLiteralAppears(title, source, sourceLower)) return title;
      }
    } catch (e) {}
    return null;
  }

  function splitSentences(text) {
    if (!text) return [];
    const source = String(text).replace(/\r\n?/g, "\n");
    // Portable sentence splitting: avoids lookbehind so the script also works
    // in JavaScript runtimes that lag behind current desktop browsers.
    const rawSentences = (source.match(/[^.!?\n]+(?:[.!?]+(?:["”’')\]]+)?|$)/g) || [])
      .map(s => s.trim())
      .filter(Boolean);
    if (typeof SENTENCE_ABBREVIATIONS === "undefined") return rawSentences;
    const sentences = [];
    for (let i = 0; i < rawSentences.length; i++) {
      const s = rawSentences[i];
      const words = s.trim().split(/\s+/);
      const lastWord = (words[words.length - 1] || "")
        .replace(/["”’')\]]+$/g, "")
        .replace(/\.$/, "");
      if (SENTENCE_ABBREVIATIONS.has(lastWord) && i + 1 < rawSentences.length) {
        rawSentences[i + 1] = s + " " + rawSentences[i + 1];
        continue;
      }
      sentences.push(s);
    }
    return sentences;
  }

  function findThread(c, entity, category) {
    return c.threads.find(t => t.entity === entity && t.category === category);
  }

  // Fuzzy variant for player-typed input (the /plant command) — matches on
  // name similarity across any category, same reasoning as /twist above,
  // so "/plant Sera" recognizes an existing "Sera Walker" thread instead of
  // planting a confusing duplicate just because the typed name is shorter.
  function findThreadFuzzy(c, entity) {
    return c.threads.find(t => isSameCardEntity(t.entity, entity));
  }

  function priorTwistCountFor(c, entity) {
    return c.twistLog.filter(t => t.entity === entity).length;
  }

  function createThread(c, entity, category, originTurn, cfg, evidenceText) {
    if (!c || !entity) return null;
    const safeCfg = cfg || CP_DEFAULTS;
    let cat = category && CP_CATEGORIES[category] ? category : null;

    if (cat && !isCategoryAllowed(cat, entity, safeCfg, evidenceText || "")) return null;

    const activeForEntity = c.threads.filter(t =>
      t && t.status !== "resolved" &&
      String(t.entity || "").toLowerCase() === String(entity || "").toLowerCase()
    );

    if (cat) {
      const same = activeForEntity.find(t => t.category === cat);
      if (same) return same;
    }

    const maxForEntity = Math.max(1, Math.min(12, Number(safeCfg.maxThreadsPerEntity) || CP_DEFAULTS.maxThreadsPerEntity));
    if (activeForEntity.length >= maxForEntity) return null;

    if (!cat) {
      const activeCategories = new Set(activeForEntity.map(t => t.category));
      const profile = currentScenarioProfile(evidenceText || "", safeCfg);
      let pool = CP_CATEGORY_KEYS.filter(k =>
        !alreadyResolvedCombo(c, entity, k) &&
        !activeCategories.has(k) &&
        isCategoryAllowed(k, entity, safeCfg, evidenceText || "") &&
        categoryFitsScenario(k, profile)
      );

      if (pool.length === 0) {
        pool = CP_CATEGORY_KEYS.filter(k =>
          !activeCategories.has(k) &&
          isCategoryAllowed(k, entity, safeCfg, evidenceText || "") &&
          categoryFitsScenario(k, profile)
        );
      }
      if (pool.length === 0) return null;

      // Prefer a different theme from this entity's already-active threads.
      const activeClusters = new Set(activeForEntity.map(t => CP_CATEGORY_TO_CLUSTER[t.category]).filter(Boolean));
      const freshClusterPool = pool.filter(k => !activeClusters.has(CP_CATEGORY_TO_CLUSTER[k]));
      if (freshClusterPool.length > 0) pool = freshClusterPool;

      // A theme bias is a preference, never a reason to pick a disallowed
      // or already-overused category.
      if (safeCfg.categoryBias) {
        const biasClusters = safeCfg.categoryBias.split(",").map(s => s.trim()).filter(Boolean);
        const biased = pool.filter(k => biasClusters.indexOf(CP_CATEGORY_TO_CLUSTER[k]) !== -1);
        if (biased.length > 0) pool = biased;
      }

      // Avoid repeating the same category globally if there are alternatives.
      const recentCategories = new Set((c.twistLog || []).slice(-12).map(t => t && t.category).filter(Boolean));
      const fresh = pool.filter(k => !recentCategories.has(k));
      if (fresh.length > 0) pool = fresh;

      cat = pool[Math.floor(Math.random() * pool.length)];
    }

    if (!cat || !isCategoryAllowed(cat, entity, safeCfg, evidenceText || "")) return null;

    const thread = {
      id: nextId(c),
      entity: entity,
      category: cat,
      originTurn: originTurn,
      seedTouches: 1,
      status: "brewing",
      tier: CP_TIER_MINOR,
      lastSeedTurn: typeof c.turn === "number" ? c.turn : originTurn,
      confirmMisses: 0,
      seedConfirmMisses: 0,
      psychologyLinked: false,
      psychologyTouches: 0,
      lastPsychologyTurn: -999,
      // Visible/established evidence is tracked separately from private
      // psychology so UNSAID can influence *which* thread gets attention
      // without secretly manufacturing factual setup.
      storyEvidenceTouches: evidenceText && String(evidenceText).trim() ? 1 : 0,
      codexLinked: false,
      mature: isMatureCategory(cat),
      adultConfirmed: isMatureCategory(cat) ? isEntityConfirmedAdult(entity, evidenceText || "") : false,
      priorTwistCount: priorTwistCountFor(c, entity)
    };
    c.threads.push(thread);

    if (c.threads.length > MAX_ACTIVE_TWIST_THREADS) {
      c.threads.sort((a, b) => {
        const ar = a.status === "ready" ? 1 : 0;
        const br = b.status === "ready" ? 1 : 0;
        return br - ar || b.originTurn - a.originTurn;
      });
      c.threads = c.threads.slice(0, MAX_ACTIVE_TWIST_THREADS);
    }
    return thread;
  }

  function tierFor(seedTouches) {
    if (seedTouches >= 10) return CP_TIER_CATACLYSMIC;
    if (seedTouches >= 6) return CP_TIER_MAJOR;
    if (seedTouches >= 3) return CP_TIER_MODERATE;
    return CP_TIER_MINOR;
  }


  // Shared bridge between the two original systems. It is intentionally
  // evidence-conservative: an UNSAID suspicion may reinforce a thread that
  // already exists, but cannot create an objective betrayal/secret by itself.
  function mindKeyForEntity(entity) {
    try {
      if (!entity || !state || !state.unsaid || !state.unsaid.minds) return null;
      const keys = Object.keys(state.unsaid.minds);
      const exact = keys.find(k => k.toLowerCase() === String(entity).toLowerCase());
      if (exact) return exact;
      if (typeof isSameCardEntity === "function") {
        const fuzzy = keys.find(k => isSameCardEntity(k, entity));
        if (fuzzy) return fuzzy;
      }
    } catch (e) {}
    return null;
  }

  function mindForEntity(entity) {
    const key = mindKeyForEntity(entity);
    return key && state.unsaid && state.unsaid.minds ? state.unsaid.minds[key] : null;
  }

  function bridgeClip(value, maxLen) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen || 150);
  }

  function psychologyContextForTwist(entity) {
    try {
      const cfg = state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS;
      if (!cfg.crossSystemSynergy) return "";
      const mind = mindForEntity(entity);
      if (!mind) return "";
      const bits = [];
      if (mind.core) bits.push(`core belief: "${bridgeClip(mind.core, 120)}"`);
      if (mind.feeling) bits.push(`current feeling: ${bridgeClip(mind.feeling, 32)}`);
      if (mind.want) bits.push(`private want: "${bridgeClip(mind.want, 120)}"`);
      if (mind.relationOrder && mind.relationOrder.length && mind.relations) {
        const other = mind.relationOrder[mind.relationOrder.length - 1];
        if (other && mind.relations[other]) bits.push(`toward ${bridgeClip(other, 45)}: ${bridgeClip(mind.relations[other], 32)}`);
      }
      if (!bits.length) return "";
      return " Private continuity for " + entity + ": " + bits.slice(0, 3).join("; ") +
        ". Use this only for motive/emotional continuity. Do not quote private notes in visible prose, and never make a fear or suspicion objectively true unless visible story evidence supports it.";
    } catch (e) { return ""; }
  }

  function twistPressureForMind(entity) {
    try {
      const cfg = state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS;
      if (!cfg.crossSystemSynergy || !state || !state.contingency) return "";
      const active = (state.contingency.threads || []).filter(t =>
        t && t.status !== "resolved" &&
        (t.storyEvidenceTouches || 0) > 0 &&
        (String(t.entity || "").toLowerCase() === String(entity || "").toLowerCase() ||
         (typeof isSameCardEntity === "function" && isSameCardEntity(t.entity, entity)))
      );
      const mind = mindForEntity(entity);
      const impacts = mind && Array.isArray(mind.recentTwistImpacts) ? mind.recentTwistImpacts : [];
      const latest = impacts.length ? impacts[impacts.length - 1] : null;
      const notes = [];
      if (active.length) {
        const ready = active.filter(t => t.status === "ready").length;
        const linked = active.filter(t => t.psychologyLinked).length;
        notes.push(`${active.length} unresolved plot pressure${active.length === 1 ? "" : "s"}${ready ? ` (${ready} close to surfacing)` : ""}${linked ? `, ${linked} linked to their psychology` : ""}`);
      }
      if (latest && typeof latest.turn === "number" && state.unsaid) {
        const age = Math.max(0, state.unsaid.turn - latest.turn);
        if (age <= 4) notes.push(`a ${latest.tier || "significant"} confirmed twist affected them ${age === 0 ? "just now" : age + " turn" + (age === 1 ? "" : "s") + " ago"}`);
      }
      if (!notes.length) return "";
      return " Live plot pressure: " + notes.join("; ") +
        ". Let the private reaction respond only to what this character could know. Do not reveal a tracked twist early or turn suspicion into certainty.";
    } catch (e) { return ""; }
  }

  function mindPriorityForThread(thread) {
    try {
      const cfg = state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS;
      if (!cfg.crossSystemSynergy || !thread) return 0;
      const mind = mindForEntity(thread.entity);
      if (!mind) return thread.psychologyLinked ? 1 : 0;
      const tension = Math.max(0, Math.min(6, Number(mind.tensionLevel) || 0));
      const fresh = typeof mind.lastTurn === "number" && state.unsaid
        ? Math.max(0, 3 - Math.min(3, state.unsaid.turn - mind.lastTurn)) : 0;
      return tension + fresh + (thread.psychologyLinked ? 2 : 0);
    } catch (e) { return 0; }
  }

  function reinforceThreadFromPsychology(thread, c, cfg, sourceTag) {
    if (!thread || !c || thread.status !== "brewing") return false;
    if (thread.lastPsychologyTurn === c.turn) return false;
    thread.lastPsychologyTurn = c.turn;
    thread.psychologyLinked = true;
    thread.psychologyTouches = Math.min(12, (thread.psychologyTouches || 0) + 1);
    // Private thoughts affect priority and emotional fit, not objective proof.
    // A fear, suspicion, wish, or core belief must never make a twist "ready"
    // by itself. Readiness still comes from visible/established story seeds.
    if (!thread.psychologySource) thread.psychologySource = sourceTag || "unsaid";
    return true;
  }

  function absorbUnsaidSignal(c, cfg, entity, mind, thought, about) {
    try {
      if (!c || !cfg || !cfg.enabled || !cfg.crossSystemSynergy || !entity || !mind) return false;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) return false;
      const active = (c.threads || []).filter(t =>
        t && t.status === "brewing" &&
        (String(t.entity || "").toLowerCase() === String(entity).toLowerCase() ||
         (typeof isSameCardEntity === "function" && isSameCardEntity(t.entity, entity)))
      );
      if (!active.length) return false;
      const signal = [thought, mind.feeling, mind.want, about].filter(Boolean).join(" ");
      const matchedCategory = matchScenarioCategory(signal, entity, cfg);
      let target = matchedCategory ? active.find(t => t.category === matchedCategory) : null;
      if (!target && /\b(secret|hide|hidden|afraid|fear|terrified|guilt|guilty|regret|betray|betrayed|owe|debt|doubt|distrust|suspect|suspicious|lie|lying|jealous|obsess|escape|protect|revenge|confess|ashamed|desperate|blackmail|threat|trapped)\b/i.test(signal)) {
        target = active.slice().sort((a,b) => b.seedTouches - a.seedTouches || a.originTurn - b.originTurn)[0];
      }
      return target ? reinforceThreadFromPsychology(target, c, cfg, "unsaid") : false;
    } catch (e) { return false; }
  }

  function applyTwistImpactToMind(entity, category, tier, partnerName) {
    try {
      const cfg = state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS;
      if (!cfg.crossSystemSynergy || !entity) return false;
      const key = mindKeyForEntity(entity);
      if (!key) return false;
      const mind = state.unsaid.minds[key];
      const pressure = ({minor:1, moderate:1, major:2, cataclysmic:3})[tier] || 1;
      const cap = typeof TENSION_THRESHOLD === "number" ? TENSION_THRESHOLD * 2 : 6;
      mind.tensionLevel = Math.min(cap, Math.max(0, Number(mind.tensionLevel) || 0) + pressure);
      if (!Array.isArray(mind.recentTwistImpacts)) mind.recentTwistImpacts = [];
      mind.recentTwistImpacts.push({
        turn: state.unsaid ? state.unsaid.turn : (state.contingency ? state.contingency.turn : 0),
        category: category, tier: tier, partner: partnerName || null
      });
      if (mind.recentTwistImpacts.length > 4) mind.recentTwistImpacts = mind.recentTwistImpacts.slice(-4);
      return true;
    } catch (e) { return false; }
  }

  function bridgeCodexEvidenceToTwists(c, cfg, entity, type, evidenceText) {
    try {
      if (!c || !cfg || !cfg.enabled || !cfg.crossSystemSynergy || !entity || !evidenceText) return null;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) return null;
      const category = matchScenarioCategory(evidenceText, entity, cfg);
      if (!category) return null;
      let thread = findThread(c, entity, category);
      if (thread) {
        if (thread.status === "brewing" && thread.lastSeedTurn !== c.turn) {
          thread.seedTouches += 1;
          thread.storyEvidenceTouches = (thread.storyEvidenceTouches || 0) + 1;
          thread.lastSeedTurn = c.turn;
          thread.tier = tierFor(thread.seedTouches);
          thread.codexLinked = true;
          if (isEligible(thread, c, cfg)) thread.status = "ready";
        }
        return thread;
      }
      thread = createThread(c, entity, category, c.turn, cfg, evidenceText);
      if (thread) { thread.source = "codex"; thread.codexLinked = true; }
      return thread;
    } catch (e) { return null; }
  }

  function reinforceFromCoreShift(c, cfg, entity) {
    // A genuine core shift is excellent motive/priority material, but it is
    // still private psychology. It may strengthen the connection to an
    // already-existing thread; it must not invent an objective twist from
    // nothing or count as factual foreshadowing.
    if (!c || !cfg || !entity || !cfg.crossSystemSynergy) return;
    if (isPlayerEntity(c, entity) && !cfg.involvePlayer) return;
    const existing = c.threads
      .filter(t => t && t.status === "brewing" &&
        (String(t.entity || "").toLowerCase() === String(entity).toLowerCase() ||
         (typeof isSameCardEntity === "function" && isSameCardEntity(t.entity, entity))))
      .sort((a, b) => b.seedTouches - a.seedTouches || a.originTurn - b.originTurn)[0];
    if (!existing) return;
    if (reinforceThreadFromPsychology(existing, c, cfg, "core-shift")) {
      existing.psychologyTouches = Math.min(12, (existing.psychologyTouches || 0) + 1);
    }
  }

  function isEligible(thread, c, cfg) {
    return thread.status === "brewing" &&
      thread.seedTouches >= cfg.minSeedsForPayoff &&
      (c.turn - thread.originTurn) >= cfg.minTurnsForPayoff;
  }

  // Checks a sentence against both pattern lists — loose-thread patterns
  // first, falling through to scenario-hint patterns — the exact same
  // priority order matchScenarioCategory already uses. Extracted as its
  // own helper because scanForLooseThreads previously only ever checked
  // CP_LOOSE_THREAD_PATTERNS directly, meaning every scenario-hint
  // pattern (all of the original ~28, plus a further 45 added in one
  // batch to close a real, substantial detection-coverage gap) was only
  // ever reachable through scenario-adaptation scanning — a hand-authored
  // Story Card, Plot Essentials, or Author's Note — and never through
  // ordinary per-turn narrative during actual play, where the exact same
  // phrasing is at least as likely to show up. Confirmed directly:
  // "his own guards were plotting against him" correctly triggered
  // rebellionWithin when read from Plot Essentials but did nothing at all
  // when the identical sentence appeared in ordinary story text one turn
  // later, purely because the two scanners drew from different pattern
  // pools for what should be the same underlying check.
  function matchAnyThreadPattern(sentence, entity, cfg) {
    const safeCfg = cfg || CP_DEFAULTS;
    for (const p of CP_ALL_THREAD_PATTERNS) {
      if (!p.rx.test(sentence)) continue;
      if (!isCategoryAllowed(p.cat, entity, safeCfg, sentence)) continue;
      return p.cat;
    }
    return null;
  }

  function scanForLooseThreads(text, c, cfg, cardTitles) {
    if (!text) return;
    const sentences = splitSentences(text);

    let lastEntity = null;
    let carryRemaining = 0;
    for (const s of sentences) {
      const sentenceEntity = findKnownEntityInSentence(s, cardTitles) || findEntityInSentence(s);
      let entity = sentenceEntity;
      if (sentenceEntity) {
        lastEntity = sentenceEntity;
        carryRemaining = 1; // allow one immediately-following pronoun-only sentence
      } else if (lastEntity && carryRemaining > 0) {
        entity = lastEntity;
        carryRemaining -= 1;
      } else {
        lastEntity = null;
        carryRemaining = 0;
      }
      if (!entity) continue;

      const cat = matchAnyThreadPattern(s, entity, cfg);
      if (!cat) continue;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;
      if (alreadyResolvedCombo(c, entity, cat)) continue;

      const existing = findThread(c, entity, cat);
      if (existing) {
        if (existing.status === "brewing" && existing.lastSeedTurn !== c.turn) {
          existing.seedTouches += 1;
          existing.storyEvidenceTouches = (existing.storyEvidenceTouches || 0) + 1;
          existing.lastSeedTurn = c.turn;
          existing.tier = tierFor(existing.seedTouches);
          if (isEligible(existing, c, cfg)) existing.status = "ready";
        }
      } else {
        createThread(c, entity, cat, c.turn, cfg, s);
      }
    }
  }

  function matchScenarioCategory(text, entity, cfg) {
    if (!text) return null;
    const safeCfg = cfg || CP_DEFAULTS;
    for (const p of CP_ALL_THREAD_PATTERNS) {
      if (!p.rx.test(text)) continue;
      if (!isCategoryAllowed(p.cat, entity, safeCfg, text)) continue;
      return p.cat;
    }
    return null;
  }

  function alreadyResolvedCombo(c, entity, category) {
    return c.twistLog.some(t => t.entity === entity && t.category === category);
  }

  function creditPartialThread(c, entity, category, cfg, source, evidenceText) {
    const originTurn = c.turn - Math.floor(cfg.minTurnsForPayoff / 2);
    const thread = createThread(c, entity, category, originTurn, cfg, evidenceText || "");
    if (!thread) return null;
    thread.seedTouches = Math.max(1, Math.ceil(cfg.minSeedsForPayoff / 2));
    thread.tier = tierFor(thread.seedTouches);
    thread.source = source;
    if (isEligible(thread, c, cfg)) thread.status = "ready";
    return thread;
  }

  function scanStoryCardsForScenarioThreads(c, cfg, preferredTitles) {
    if (typeof storyCards === "undefined" || !Array.isArray(storyCards) || !storyCards.length) return;

    // Story Card lore can be enormous in mature adventures. Scanning every
    // card against every twist pattern in a single modifier pass caused the
    // worst first-turn spikes. Current-scene cards are processed immediately;
    // background lore is inspected through a small rotating slice.
    const processCard = card => {
      if (!card || !card.title || isOwnCard(card.title)) return false;
      const descriptionWithoutPrivateThoughts = typeof MIND_NOTES_MARKER !== "undefined"
        ? (card.description || "").split(MIND_NOTES_MARKER)[0]
        : (card.description || "");
      const haystack = ((card.entry || "") + " " + descriptionWithoutPrivateThoughts).slice(0, 3200);
      const sig = textSignature(haystack);
      if (c.importedCardSignatures[card.title] === sig) return true;
      c.importedCardSignatures[card.title] = sig;

      const entity = ("" + card.title).trim();
      if (!entity || entity.length < 2) return true;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) return true;

      const category = matchScenarioCategory(haystack, entity, cfg);
      if (!category) return true;
      if (alreadyResolvedCombo(c, entity, category)) return true;
      if (findThread(c, entity, category)) return true;
      creditPartialThread(c, entity, category, cfg, "scenario", haystack);
      return true;
    };

    const preferred = Array.isArray(preferredTitles) ? preferredTitles.slice(0, 8) : [];
    if (preferred.length) {
      preferred.forEach(title => {
        const card = storyCards.find(ca => ca && ca.title === title);
        if (card) processCard(card);
      });
    }

    const total = storyCards.length;
    const batchSize = Math.min(total, 8);
    const start = Math.max(0, Math.floor(c.storyCardScenarioScanCursor || 0)) % total;
    let visited = 0;
    let consumed = 0;
    for (let offset = 0; offset < total && visited < batchSize; offset++) {
      consumed = offset + 1;
      const index = (start + offset) % total;
      const card = storyCards[index];
      if (!card || !card.title || isOwnCard(card.title)) continue;
      visited++;
      processCard(card);
    }
    c.storyCardScenarioScanCursor = (start + Math.max(1, consumed)) % total;
  }

  function scanMemoryFieldForThreads(c, cfg, text, sigStateKey, sourceTag, cardTitles) {
    if (!text) return;
    const sig = textSignature(text);
    if (c[sigStateKey] === sig) return;
    c[sigStateKey] = sig;

    const sentences = splitSentences(text);
    let lastEntity = null;
    let carryRemaining = 0;
    for (const s of sentences) {
      const sentenceEntity = findKnownEntityInSentence(s, cardTitles) || findEntityInSentence(s);
      let entity = sentenceEntity;
      if (sentenceEntity) {
        lastEntity = sentenceEntity;
        carryRemaining = 1;
      } else if (lastEntity && carryRemaining > 0) {
        // Only carry an entity into the immediately-following sentence.
        // Older builds could attach a later Author's Note / Plot Essentials
        // twist to the last capitalized name seen many sentences earlier.
        entity = lastEntity;
        carryRemaining -= 1;
      } else {
        lastEntity = null;
        carryRemaining = 0;
      }
      if (!entity) continue;

      const category = matchScenarioCategory(s, entity, cfg);
      if (!category) continue;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;
      if (alreadyResolvedCombo(c, entity, category)) continue;
      if (findThread(c, entity, category)) continue;

      creditPartialThread(c, entity, category, cfg, sourceTag, s);
    }
  }

  function scanPlotEssentialsForThreads(c, cfg, cardTitles) {
    if (!state.memory) return;
    scanMemoryFieldForThreads(c, cfg, state.memory.context, "lastContextSignature", "context", cardTitles);
  }

  function scanAuthorsNoteForThreads(c, cfg, cardTitles) {
    if (!state.memory) return;
    scanMemoryFieldForThreads(c, cfg, state.memory.authorsNote, "lastAuthorsNoteSignature", "authorsnote", cardTitles);
  }

  function pickWildcardEntity(text, c, cfg) {
    const sentences = splitSentences(text);

    const activeEntities = new Set(c.threads.map(t => t.entity));
    for (const s of sentences) {
      const e = findEntityInSentence(s);
      if (!e || activeEntities.has(e)) continue;
      if (isPlayerEntity(c, e) && !cfg.involvePlayer) continue;
      return e;
    }
    return null;
  }

  // Missing the same !cfg.involvePlayer filter its three sibling pickers
  // (pickMostBuiltUpBrewingThread, pickPayoffThread, pickCompoundPayoffThreads)
  // all already have — reachable in practice: every thread-creation site
  // already guards against planting a NEW player-entity thread while
  // involvePlayer is off, but that guard is only checked at creation time.
  // If a player-entity thread was created earlier while involvePlayer was
  // on, then the player later turns it off mid-story, this function (used
  // every pacing turn to pick what gets the next foreshadow nudge) would
  // still happily keep seeding that same pre-existing thread — confirmed
  // directly via sandbox. Filtering here too closes that gap the same way
  // the other three pickers already do.
  function pickForeshadowThread(c, cfg) {
    let brewing = c.threads.filter(t => t.status === "brewing" && isThreadAllowed(t, cfg));
    if (cfg && !cfg.involvePlayer) brewing = brewing.filter(t => !isPlayerEntity(c, t.entity));
    if (brewing.length === 0) return null;
    brewing.sort((a, b) =>
      mindPriorityForThread(b) - mindPriorityForThread(a) ||
      a.seedTouches - b.seedTouches ||
      a.originTurn - b.originTurn ||
      String(a.entity).localeCompare(String(b.entity))
    );
    return brewing[0];
  }

  function pickMostBuiltUpBrewingThread(c, cfg) {
    let brewing = c.threads.filter(t => t.status === "brewing" && isThreadAllowed(t, cfg));
    if (!cfg.involvePlayer) brewing = brewing.filter(t => !isPlayerEntity(c, t.entity));
    if (brewing.length === 0) return null;
    brewing.sort((a, b) =>
      b.seedTouches - a.seedTouches ||
      a.originTurn - b.originTurn ||
      String(a.entity).localeCompare(String(b.entity))
    );
    return brewing[0];
  }

  function pickPayoffThread(c, cfg) {
    let ready = c.threads.filter(t => t.status === "ready" && isThreadAllowed(t, cfg));
    if (!cfg.involvePlayer) ready = ready.filter(t => !isPlayerEntity(c, t.entity));
    if (ready.length === 0) return null;

    // Oldest ready threads still win, but stronger build-up and fewer
    // failed confirmation attempts break ties so one stubborn thread does
    // not starve everything behind it forever.
    ready.sort((a, b) =>
      a.originTurn - b.originTurn ||
      mindPriorityForThread(b) - mindPriorityForThread(a) ||
      (a.confirmMisses || 0) - (b.confirmMisses || 0) ||
      b.seedTouches - a.seedTouches ||
      String(a.entity).localeCompare(String(b.entity))
    );
    return ready[0];
  }

  function pickCompoundPayoffThreads(c, cfg) {
    let ready = c.threads.filter(t => t.status === "ready" && isThreadAllowed(t, cfg));
    if (!cfg.involvePlayer) ready = ready.filter(t => !isPlayerEntity(c, t.entity));
    if (ready.length < 2) return null;
    ready.sort((a, b) =>
      a.originTurn - b.originTurn ||
      (a.confirmMisses || 0) - (b.confirmMisses || 0) ||
      b.seedTouches - a.seedTouches
    );
    for (let i = 0; i < ready.length; i++) {
      for (let j = i + 1; j < ready.length; j++) {
        if (ready[i].entity !== ready[j].entity) return [ready[i], ready[j]];
      }
    }
    return null;
  }

  function memoryNote(thread) {
    if (!thread.priorTwistCount) return "";
    return " " + thread.entity + " has had " + thread.priorTwistCount +
      (thread.priorTwistCount === 1 ? " prior revelation" : " prior revelations") +
      " in this story — stay consistent with what's already come out about them.";
  }

  function foreshadowHint(thread) {
    const desc = CP_CATEGORIES[thread.category];
    const sourceNote = (thread.source === "scenario" || thread.source === "context" || thread.source === "authorsnote")
      ? " (this ties to something already true about them in this world, not something new)"
      : "";
    const adapt = scenarioGuidance("", state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS);
    const psyche = psychologyContextForTwist(thread.entity);
    return "[Subtle texture only, never explained or drawn attention to: plant one small, " +
      "easy-to-overlook detail connected to " + thread.entity + sourceNote + " that would make sense in " +
      "hindsight if it turned out that " + desc + ". Do not resolve or hint at this being " +
      "important. It should read as ordinary for this scenario right now." + memoryNote(thread) + psyche + adapt +
      " If you actually include that setup detail in this response, append the exact hidden marker " +
      "【UT-SEED:" + thread.id + "】 at the very end. Do not mention or explain the marker.]";
  }

  function payoffHint(thread) {
    const desc = CP_CATEGORIES[thread.category];
    const marker = "【UT-TWIST:" + thread.id + "】";
    const adapt = scenarioGuidance("", state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS);
    const psyche = psychologyContextForTwist(thread.entity);
    if (thread.wildcard) {
      return "[A sudden but coherent twist involving " + thread.entity + " happens now: " + desc +
        ". This one doesn't need prior setup, but it still must fit the current scenario. Invent a believable, specific reason it's true, " +
        "consistent with everything already established about " + thread.entity +
        "." + memoryNote(thread) + psyche + adapt + " Let the story react to it honestly. Only if the twist actually lands " +
        "in this response, append the exact hidden marker " + marker +
        " at the very end. Do not mention or explain the marker.]";
    }
    const sourceNote = (thread.source === "scenario" || thread.source === "context" || thread.source === "authorsnote")
      ? " Draw on this world's own established background for " + thread.entity + ", not just recent scenes."
      : "";
    return "[A twist involving " + thread.entity + " is due now: " + desc + ". Let it emerge " +
      "as a logical consequence of details already established about " + thread.entity +
      " in this story — not a random event, not out of nowhere." + sourceNote +
      " Scale it as a " + CP_TIER_LABELS[thread.tier] + " revelation relative to this scenario's normal stakes." +
      memoryNote(thread) + psyche + adapt +
      " Let the story react to it honestly. Only if the twist actually lands in this response, append the exact " +
      "hidden marker " + marker + " at the very end. Do not mention or explain the marker.]";
  }

  function compoundPayoffHint(threadA, threadB) {
    const descA = CP_CATEGORIES[threadA.category];
    const descB = CP_CATEGORIES[threadB.category];
    const scaleTier = (tierRank(threadA.tier) >= tierRank(threadB.tier)) ? threadA.tier : threadB.tier;
    const adapt = scenarioGuidance("", state && state.contingencyConfig ? state.contingencyConfig : CP_DEFAULTS);
    const psycheA = psychologyContextForTwist(threadA.entity);
    const psycheB = psychologyContextForTwist(threadB.entity);
    return "[Two threads resolve together right now, as one connected twist: " +
      threadA.entity + " — " + descA + " — turns out to be tied to " + threadB.entity +
      " — " + descB + ". Invent a specific, logical connection between them built on what's " +
      "already established about each, so the two revelations land as a single discovery, not " +
      "two coincidences. Scale it as a " + CP_TIER_LABELS[scaleTier] + " revelation relative to this scenario's normal stakes." +
      memoryNote(threadA) + memoryNote(threadB) + psycheA + psycheB + adapt +
      " Let the story react honestly. Only if both parts actually land in this response, append the exact " +
      "hidden markers 【UT-TWIST:" + threadA.id + "】 and 【UT-TWIST:" + threadB.id +
      "】 at the very end. Do not mention or explain the markers.]";
  }

  function tierRank(tier) {
    return CP_TIER_ORDER_FULL.indexOf(tier);
  }

  function safeSetCard(title, type, entry, notes, keys) {
    try {
      let card = null;
      for (let i = 0; i < storyCards.length; i++) {
        if (storyCards[i].title === title) { card = storyCards[i]; break; }
      }
      if (!card) {
        // addStoryCard returns the new card's index, or false if a card
        // with these exact keys already exists — use that directly instead
        // of guessing from array length, which silently found nothing when
        // a same-keys card existed under a different title.
        const cardKeys = title.toLowerCase();
        const idx = addStoryCard(cardKeys, entry, type);
        card = (typeof idx === "number" && storyCards[idx])
          ? storyCards[idx]
          : storyCards.find(c => c.keys === cardKeys) || null;
      }
      if (card) {
        card.title = title;
        card.type = type;
        card.entry = entry;
        card.description = notes;
        if (keys) card.keys = keys;
      }
    } catch (e) {}
  }

  function removeCardByTitle(title) {
    try {
      for (let i = 0; i < storyCards.length; i++) {
        if (storyCards[i] && storyCards[i].title === title) { removeStoryCard(i); return; }
      }
    } catch (e) {}
  }

  function updateCacheEfficiencyWarning(cacheEfficient) {
    const title = "Twists and Turns — Optimized Context Notice";
    if (!cacheEfficient) { removeCardByTitle(title); return; }
    const notes =
      "OPTIMIZED CONTEXT DETECTED\n\n" +
      "Twist nudges are normally invisible, delivered through frontMemory. This model or setting can " +
      "disable that, so nudges are also being written to a second card (\"Twists and Turns — Nudge\") " +
      "that updates every turn as a backup delivery path.\n\n" +
      "This notice clears itself automatically if you switch away from a model or setting where it applies.";
    safeSetCard(title, "class", " ", notes);
  }

  const CP_ALWAYS_MATCH_KEYS = "the, a, and, you, said, was";

  function updateNudgeCard(cacheEfficient, hint, entities) {
    const title = "Twists and Turns — Nudge";
    if (!cacheEfficient) { removeCardByTitle(title); return; }
    const entry = hint || " ";
    const concernNote = (entities && entities.length) ? ("\nConcerns: " + entities.join(", ")) : "";
    const notes = "BACKUP NUDGE DELIVERY\n\n" +
      "Active only because Optimized Context was detected this turn — see the Notice card. Carries " +
      "the same hint frontMemory would normally deliver." + concernNote;
    safeSetCard(title, "class", entry, notes, CP_ALWAYS_MATCH_KEYS);
  }

  function createTwistStoryCard(c, cfg, thread, compoundWithEntity) {
    try {
      const title = "Twists and Turns — Established Facts";
      const cap = (cfg && cfg.establishedFactsCap) || CP_DEFAULTS.establishedFactsCap;
      const recent = c.twistLog.slice(-cap);

      const factLine = (t) => {
        const d = CP_CATEGORIES[t.category] || "a previously resolved revelation remains true";
        const entity = String(t.entity || "Unknown").trim() || "Unknown";
        return entity + ": " + d.charAt(0).toUpperCase() + d.slice(1) + " (turn " + t.resolvedTurn + ").";
      };
      const entry = recent.map(factLine).join(" ") + " Treat all of this as settled fact going forward.";

      const keys = Array.from(new Set(recent.map(t => String(t.entity || "").trim()).filter(Boolean))).join(", ");

      const notes = "ESTABLISHED FACTS\n\n" +
        "Carries the " + recent.length + " most recent resolved twists into the model's context, " +
        "kept short on purpose (currently capped at " + cap + " — change with establishedFactsCap on " +
        "the config card). Full history (every twist, ever) is on the Twist Log card instead — that " +
        "one costs nothing to keep long, since only Notes fields do.";

      safeSetCard(title, CP_TWIST_CARD_TYPE, entry, notes, keys);
    } catch (e) {}
  }

  function applyEntryConfig(cfg) {
    const card = ensureSharedConfigCard();
    if (!card) return;
    const section = extractConfigSection(card.entry, CONFIG_SECTION_TWIST);
    if (!section) return;
    applyTwistConfigText(cfg, section);
  }

  function updateConfigCard(cfg, c) {
    const card = ensureSharedConfigCard();
    if (!card) return;
    card.entry = spliceConfigSection(card.entry, CONFIG_SECTION_TWIST, renderTwistSection(cfg));
    card.description = spliceConfigSection(card.description, CONFIG_SECTION_TWIST, renderTwistNotes(cfg, c));
  }

  function updateThreadsOverview(c) {
    const active = c.threads;

    const brewing = active.filter(t => t.status === "brewing").length;
    const ready = active.filter(t => t.status === "ready").length;

    const clusterCounts = {};
    active.forEach(t => {
      const cluster = CP_CATEGORY_TO_CLUSTER[t.category] || "Other";
      clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
    });
    const clusterLines = Object.keys(clusterCounts).sort().map(k => k + ": " + clusterCounts[k]);

    const notes = "BREWING OVERVIEW — spoiler-safe\n\n" +
      "No names, no specific twists — just a sense of what's building.\n\n" +
      brewing + " brewing, " + ready + " about to surface.\n\n" +
      (clusterLines.length ? "By theme:\n" + clusterLines.join("\n") : "Nothing brewing yet.") +
      "\n\nRun /threads again anytime to refresh.";

    safeSetCard("Twists and Turns — Brewing Overview", "class", " ", notes);
  }

  function updateCategoryCatalog(cfg) {
    const lines = [];
    lines.push("TWIST CATEGORY CATALOG — no active-thread spoilers");
    lines.push("");
    lines.push(CP_CATEGORY_KEYS.length + " concepts across " + CP_CLUSTER_NAMES.length + " themes.");
    lines.push("Use a category key with /plant <name> <categoryKey>.");
    lines.push("");
    CP_CLUSTER_NAMES.forEach(cluster => {
      const keys = CP_CATEGORY_CLUSTERS[cluster] || [];
      const mature = cluster === "Mature & Adult (18+)";
      lines.push(cluster + " (" + keys.length + ")" + (mature ? " — opt-in, confirmed adults only" : ""));
      lines.push(keys.map(k => (CP_CATEGORY_LABELS[k] || k) + " [" + k + "]").join(", "));
      lines.push("");
    });
    if (!cfg || !cfg.allowMatureTwists) {
      lines.push("Mature (18+) twists are currently OFF. Use /mature on or edit the config card to enable them.");
    } else {
      lines.push("Mature (18+) twists are ON, but automatic use still requires clear adult evidence for the target.");
    }
    safeSetCard("Twists and Turns — Twist Catalog", "class", " ", lines.join("\n").slice(0, 12000));
  }


  function updateTwistLogCard(c, cfg) {
    let notes;
    if (!cfg.showTwistLog) {
      notes = "TWIST LOG — hidden\n\n" +
        "Enable with /twistlog to see resolved twists here.\n" +
        "Brewing or upcoming threads are never shown, even then — that would spoil them.";
    } else if (c.twistLog.length === 0) {
      notes = "TWIST LOG\n\nNo twists resolved yet.";
    } else {
      const lines = c.twistLog.slice(-25).map(t => {
        const tags = [CP_TIER_LABELS[t.tier] || t.tier];
        if (t.wildcard) tags.push("wildcard");
        if (t.mature || isMatureCategory(t.category)) tags.push("18+");
        if (t.compoundWith) tags.push("with " + t.compoundWith);
        if (t.source === "scenario" || t.source === "context" || t.source === "authorsnote") tags.push("from scenario");
        return "Turn " + t.resolvedTurn + " — " + t.entity + ": " + (CP_CATEGORIES[t.category] || "resolved twist") + " (" + tags.join(", ") + ")";
      });
      notes = "TWIST LOG — most recent " + lines.length + "\n\n" + lines.join("\n");
    }
    safeSetCard("Twists and Turns — Twist Log", "class", " ", notes);
  }

  return {
    CP_VERSION, CP_DEFAULTS, CP_CATEGORIES, CP_CATEGORY_KEYS, CP_TIER_MINOR, CP_TIER_MODERATE, CP_TIER_MAJOR, CP_TIER_CATACLYSMIC,
    CP_COMPOUND_CHANCE, CP_WILDCARD_CHANCE, CP_CLUSTER_NAMES, CP_CATEGORY_CLUSTERS, CP_CATEGORY_TO_CLUSTER, CP_MATURE_KEYS,
    initState, getConfig, pacingFor, effectivePacing, beginContextTurn, extractCommand, nextId, findEntityInSentence, findKnownEntityInSentence, eligibleCardTitles,
    splitSentences, findThread, findThreadFuzzy, createThread, tierFor, isEligible, priorTwistCountFor, scanForLooseThreads, scanStoryCardsForScenarioThreads,
    scanPlotEssentialsForThreads, scanAuthorsNoteForThreads, pickForeshadowThread, pickMostBuiltUpBrewingThread, pickPayoffThread, pickCompoundPayoffThreads, pickWildcardEntity,
    foreshadowHint, payoffHint, compoundPayoffHint, safeSetCard, createTwistStoryCard, safeLog, applyEntryConfig,
    updateCacheEfficiencyWarning, updateNudgeCard, updateConfigCard, updateTwistLogCard, updateThreadsOverview, updateCategoryCatalog, reinforceFromCoreShift,
    psychologyContextForTwist, twistPressureForMind, absorbUnsaidSignal, applyTwistImpactToMind, bridgeCodexEvidenceToTwists, mindPriorityForThread,
    isMatureCategory, isCategoryAllowed, isEntityConfirmedAdult, isThreadAllowed,
    detectScenarioProfile, updateScenarioProfile, currentScenarioProfile, scenarioGuidance, categoryFitsScenario,
    CP_ALWAYS_MATCH_KEYS
  };
})();

var UNSAID_DEFAULTS = {
  enabled: true,
  codexEnabled: true,
  showThoughtsInStory: false,
  subtleHints: true,
  jsonNotes: false,
  allowCoreShift: true,
  chance: 0.3,
  cooldown: 3,
  reduceDuringActions: true,
  recentTurnsWindow: 3,
  mentionThreshold: 3,
  codexCooldown: 5,
  codexMaxAttempts: 8,
  // Automatic character cards wait for actual story evidence instead of
  // canonizing guesses immediately after a name appears.
  codexCharacterMinTurns: 3,
  codexCharacterMinAppearances: 2,
  codexCharacterDeadline: 5,
  // Existing Codex-made cards can refresh from later story evidence.
  // Refreshes are deliberately slow, evidence-gated, and hand-edit safe.
  codexAutoRefresh: true,
  codexRefreshInterval: 20,
  codexRefreshMinEvidence: 3,
  codexProtectManualEdits: true,
  // Hybrid fixed + adaptive mind model. The fixed fields preserve reliable
  // core/feeling/relationship behavior while the bounded private thought bank
  // learns goals, plans, fears, beliefs, secrets and recurring concerns.
  adaptiveMindEnabled: true,
  adaptiveMindSlots: 12,
  adaptiveReflectionInterval: 4,
  // Even on turns where no private thought is generated, active NPCs can
  // quietly act on established goals/plans/relationships. This is injected
  // as narrator-only continuity, never as knowledge other characters gain.
  behavioralContinuity: true,
  behavioralContinuityCharacters: 2,
  playerName: ""
};

var CONTEXT_SAFETY_MARGIN = 20;
// AI Dungeon's Story Card entry editor is capped at roughly 1000
// characters. Leave a small safety margin so scripted cards do not depend on
// UI-side truncation.
var MAX_CARD_ENTRY_LENGTH = 980;
// Generous enough that no normal game ever notices it, low enough to
// bound the per-turn cost of scanning the cast list for who's currently
// "active" — see readUnsaidConfig for the full reasoning.
var MAX_CAST_SIZE = 60;

var FEELING_HISTORY_LIMIT = 3;
var RELATION_HISTORY_LIMIT = 2;
var MAX_RELATIONS_PER_CHARACTER = 6;
var ADAPTIVE_MIND_TEXT_LIMIT = 220;
var ADAPTIVE_MIND_MIN_SLOTS = 4;
var ADAPTIVE_MIND_MAX_SLOTS = 24;
var THOUGHT_HISTORY_LIMIT = 4;
var UNSAID_ALIAS_LIMIT_PER_CHARACTER = 12;
var UNSAID_CONTINUITY_MAX_CHARS = 760;
var MENTION_TRACKING_CAP = 150;
// Hard performance guardrails for AI Dungeon's isolated VM. Semantic entity
// typing is intentionally evidence-rich, but it must never rescan an entire
// long context hundreds of times in one Context Modifier pass.
var CODEX_SEMANTIC_SCAN_CHAR_LIMIT = 4200;
var CODEX_CONTEXT_MIGRATION_BATCH = 4;
var CODEX_CONTEXT_PRUNE_BATCH = 12;
var CODEX_IO_PRUNE_BATCH = 18;
var MENTION_TRACKING_HARD_CAP = 180;

var TENSION_THRESHOLD = 3;
var DRASTIC_TENSION_MULTIPLIER = 2;
var REVEALS_BEFORE_SHIFT_ELIGIBLE = 2;

var MIND_NOTES_MARKER = "💭 Inner Life — private, not visible to other characters";
var CAST_LIST_MARKER = "===";
var CODEX_MAX_ATTEMPTS = 5;
var CODEX_MAX_CANDIDATES_PER_TURN = 3;
// Once a name is confidently identified as a character, failed card
// generations retry on the next real story turn instead of waiting for the
// global Codex cooldown. This is what lets a newly introduced character
// actually finish inside the configured deadline rather than merely getting
// its first attempt near that deadline.
var CODEX_CHARACTER_RETRY_INTERVAL = 1;
var CODEX_EVIDENCE_PER_NAME = 6;
var CODEX_EVIDENCE_SNIPPET_LENGTH = 260;
var CODEX_CARD_UPDATE_EVIDENCE_LIMIT = 10;
var CODEX_CARD_META_LIMIT = 300;
var CODEX_CARD_UPDATE_SCAN_LIMIT = 120;
var CODEX_CARD_UPDATE_SNIPPET_LENGTH = 300;
var MAX_ACTIVE_TWIST_THREADS = 120;

// Built from the same COMMON_CAPITALIZED_STOPWORDS base TWISTS AND TURNS'
// CP_STOPWORDS uses (defined near the top of this file, alongside
// NAME_ALPHANUM) plus Codex-specific extras — this used to be an entirely
// separate, independently-maintained literal list, which is exactly how it
// drifted out of sync with the twist side's own filtering for so long.
// Large Codex-only lexical filter. Keep this separate from the shared Twist
// stop-word set: card generation benefits from very aggressive precision,
// while the twist scanner should remain able to track unusual entities whose
// names happen to also be ordinary English words.
var CODEX_EXTRA_STOPWORDS = [
  "aboard", "about", "above", "across", "after", "against", "along", "alongside", "although", "amid", "amidst", "among",
  "amongst", "around", "as", "at", "because", "before", "behind", "below", "beneath", "beside", "besides", "between",
  "beyond", "both", "but", "by", "concerning", "considering", "despite", "down", "during", "either", "except", "excluding",
  "following", "for", "from", "given", "if", "in", "including", "inside", "into", "like", "near", "neither",
  "nor", "of", "off", "on", "onto", "opposite", "or", "outside", "over", "past", "regarding", "round",
  "since", "than", "though", "through", "throughout", "till", "to", "toward", "towards", "under", "underneath", "unlike",
  "until", "unto", "up", "upon", "versus", "via", "when", "whenever", "where", "whereas", "wherever", "whether",
  "while", "whilst", "with", "within", "without", "yet", "all", "another", "any", "anybody", "anyone", "anything",
  "each", "enough", "everybody", "everyone", "everything", "few", "fewer", "he", "her", "hers", "herself", "him",
  "himself", "his", "I", "it", "its", "itself", "many", "me", "mine", "more", "most", "much",
  "my", "myself", "no", "nobody", "none", "noone", "nothing", "one", "other", "others", "our", "ours",
  "ourselves", "several", "she", "some", "somebody", "someone", "something", "such", "that", "their", "theirs", "them",
  "themselves", "these", "they", "this", "those", "us", "we", "what", "whatever", "which", "whichever", "who",
  "whoever", "whom", "whomever", "whose", "you", "your", "yours", "yourself", "yourselves", "am", "are", "aren't",
  "be", "became", "become", "becomes", "becoming", "been", "being", "can", "cannot", "can't", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "done", "don't", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "is", "isn't", "might", "must", "mustn't", "need", "needs", "needed", "needing",
  "ought", "shall", "should", "shouldn't", "was", "wasn't", "were", "weren't", "won't", "would", "wouldn't", "zero",
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety", "hundred", "thousand", "million", "billion", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
  "nineteenth", "twentieth", "next", "previous", "last", "former", "latter", "single", "double", "triple", "numerous", "countless",
  "multiple", "half", "quarter", "whole", "total", "entire", "partial", "absolutely", "accordingly", "additionally", "admittedly", "afterwards",
  "again", "almost", "already", "also", "altogether", "apparently", "approximately", "arguably", "aside", "away", "basically", "certainly",
  "consequently", "conversely", "currently", "definitely", "directly", "else", "elsewhere", "especially", "essentially", "eventually", "evidently", "exactly",
  "finally", "frankly", "frequently", "generally", "genuinely", "gradually", "hence", "honestly", "hopefully", "however", "immediately", "increasingly",
  "indeed", "initially", "instead", "interestingly", "largely", "literally", "meanwhile", "merely", "mostly", "naturally", "nearly", "nevertheless",
  "nonetheless", "normally", "notably", "obviously", "occasionally", "oddly", "often", "otherwise", "overall", "particularly", "perhaps", "possibly",
  "practically", "presumably", "probably", "promptly", "quite", "rarely", "rather", "really", "recently", "regardless", "relatively", "reportedly",
  "roughly", "seriously", "simply", "slightly", "slowly", "somehow", "sometimes", "soon", "specifically", "still", "strangely", "suddenly",
  "supposedly", "surely", "technically", "then", "therefore", "thereby", "thus", "together", "too", "typically", "ultimately", "unfortunately",
  "usually", "very", "virtually", "well", "wholly", "widely", "accept", "accepts", "accepted", "accepting", "acknowledge", "acknowledges",
  "acknowledged", "acknowledging", "add", "adds", "added", "adding", "admit", "admits", "admitted", "admitting", "agree", "agrees",
  "agreed", "agreeing", "announce", "announces", "announced", "announcing", "answer", "answers", "answered", "answering", "argue", "argues",
  "argued", "arguing", "ask", "asks", "asked", "asking", "bark", "barks", "barked", "barking", "beg", "begs",
  "begged", "begging", "blurt", "blurts", "blurted", "blurting", "breathe", "breathes", "breathed", "breathing", "call", "calls",
  "called", "calling", "chuckle", "chuckles", "chuckled", "chuckling", "confess", "confesses", "confessed", "confessing", "continue", "continues",
  "continued", "continuing", "cry", "cries", "cried", "crying", "declare", "declares", "declared", "declaring", "demand", "demands",
  "demanded", "demanding", "exclaim", "exclaims", "exclaimed", "exclaiming", "explain", "explains", "explained", "explaining", "gasp", "gasps",
  "gasped", "gasping", "giggle", "giggles", "giggled", "giggling", "grin", "grins", "grinned", "grinning", "growl", "growls",
  "growled", "growling", "hiss", "hisses", "hissed", "hissing", "insist", "insists", "insisted", "insisting", "laugh", "laughs",
  "laughed", "laughing", "mention", "mentions", "mentioned", "mentioning", "mumble", "mumbles", "mumbled", "mumbling", "murmur", "murmurs",
  "murmured", "murmuring", "mutter", "mutters", "muttered", "muttering", "nod", "nods", "nodded", "nodding", "note", "notes",
  "noted", "noting", "observe", "observes", "observed", "observing", "point", "points", "pointed", "pointing", "protest", "protests",
  "protested", "protesting", "question", "questions", "questioned", "questioning", "remark", "remarks", "remarked", "remarking", "repeat", "repeats",
  "repeated", "repeating", "reply", "replies", "replied", "replying", "respond", "responds", "responded", "responding", "say", "says",
  "said", "saying", "shout", "shouts", "shouted", "shouting", "sigh", "sighs", "sighed", "sighing", "smile", "smiles",
  "smiled", "smiling", "snap", "snaps", "snapped", "snapping", "speak", "speaks", "spoke", "spoken", "speaking", "stammer",
  "stammers", "stammered", "stammering", "state", "states", "stated", "stating", "tell", "tells", "told", "telling", "whisper",
  "whispers", "whispered", "whispering", "yell", "yells", "yelled", "yelling", "approach", "approaches", "approached", "approaching", "arrive",
  "arrives", "arrived", "arriving", "back", "backs", "backed", "backing", "begin", "begins", "began", "begun", "beginning",
  "bend", "bends", "bent", "bending", "blink", "blinks", "blinked", "blinking", "bow", "bows", "bowed", "bowing",
  "break", "breaks", "broke", "broken", "breaking", "bring", "brings", "brought", "bringing", "brush", "brushes", "brushed",
  "brushing", "carry", "carries", "carried", "carrying", "catch", "catches", "caught", "catching", "circle", "circles", "circled",
  "circling", "climb", "climbs", "climbed", "climbing", "close", "closes", "closed", "closing", "come", "comes", "came",
  "coming", "crouch", "crouches", "crouched", "crouching", "cross", "crosses", "crossed", "crossing", "descend", "descends", "descended",
  "descending", "draw", "draws", "drew", "drawn", "drawing", "drop", "drops", "dropped", "dropping", "enter", "enters",
  "entered", "entering", "escape", "escapes", "escaped", "escaping", "exhale", "exhales", "exhaled", "exhaling", "fall", "falls",
  "fell", "fallen", "falling", "flinch", "flinches", "flinched", "flinching", "follow", "follows", "followed", "freeze", "freezes",
  "froze", "frozen", "freezing", "gesture", "gestures", "gestured", "gesturing", "grab", "grabs", "grabbed", "grabbing", "halt",
  "halts", "halted", "halting", "head", "heads", "headed", "heading", "hold", "holds", "held", "holding", "inhale",
  "inhales", "inhaled", "inhaling", "jump", "jumps", "jumped", "jumping", "keep", "keeps", "kept", "keeping", "kneel",
  "kneels", "knelt", "kneeling", "lean", "leans", "leaned", "leaning", "leave", "leaves", "left", "leaving", "lift",
  "lifts", "lifted", "lifting", "look", "looks", "looked", "looking", "lower", "lowers", "lowered", "lowering", "move",
  "moves", "moved", "moving", "open", "opens", "opened", "opening", "pace", "paces", "paced", "pacing", "pass",
  "passes", "passed", "passing", "pause", "pauses", "paused", "pausing", "peer", "peers", "peered", "peering", "pick",
  "picks", "picked", "picking", "pivot", "pivots", "pivoted", "pivoting", "place", "places", "placed", "placing", "pull",
  "pulls", "pulled", "pulling", "push", "pushes", "pushed", "pushing", "raise", "raises", "raised", "raising", "reach",
  "reaches", "reached", "reaching", "recoil", "recoils", "recoiled", "recoiling", "remain", "remains", "remained", "remaining", "return",
  "returns", "returned", "returning", "rise", "rises", "risen", "rising", "run", "runs", "ran", "running", "settle",
  "settles", "settled", "settling", "shake", "shakes", "shook", "shaken", "shaking", "shift", "shifts", "shifted", "shifting",
  "sit", "sits", "sat", "sitting", "spin", "spins", "spun", "spinning", "stand", "stands", "stood", "standing",
  "start", "starts", "started", "starting", "step", "steps", "stepped", "stepping", "stop", "stops", "stopped", "stopping",
  "stumble", "stumbles", "stumbled", "stumbling", "swallow", "swallows", "swallowed", "swallowing", "take", "takes", "took", "taken",
  "taking", "tilt", "tilts", "tilted", "tilting", "tremble", "trembles", "trembled", "trembling", "turn", "turns", "turned",
  "turning", "walk", "walks", "walked", "walking", "watch", "watches", "watched", "watching", "wave", "waves", "waved",
  "waving", "wince", "winces", "winced", "wincing", "believe", "believes", "believed", "believing", "care", "cares", "cared",
  "caring", "consider", "considers", "considered", "decide", "decides", "decided", "deciding", "expect", "expects", "expected", "expecting",
  "fear", "fears", "feared", "fearing", "feel", "feels", "felt", "feeling", "forget", "forgets", "forgot", "forgotten",
  "forgetting", "guess", "guesses", "guessed", "guessing", "hate", "hates", "hated", "hating", "hear", "hears", "heard",
  "hearing", "hopes", "hoped", "hoping", "imagine", "imagines", "imagined", "imagining", "know", "knows", "knew", "known",
  "knowing", "likes", "liked", "liking", "love", "loves", "loved", "loving", "mean", "means", "meant", "meaning",
  "mind", "minds", "minded", "minding", "notice", "notices", "noticed", "noticing", "prefer", "prefers", "preferred", "preferring",
  "realize", "realizes", "realized", "realizing", "recall", "recalls", "recalled", "recalling", "recognize", "recognizes", "recognized", "recognizing",
  "remember", "remembers", "remembered", "remembering", "sense", "senses", "sensed", "sensing", "suppose", "supposes", "supposed", "supposing",
  "think", "thinks", "thought", "thinking", "understand", "understands", "understood", "understanding", "want", "wants", "wanted", "wanting",
  "wonder", "wonders", "wondered", "wondering", "wish", "wishes", "wished", "wishing", "air", "area", "body", "bodies",
  "bottom", "ceiling", "center", "centre", "corner", "corridor", "darkness", "distance", "door", "doorway", "edge", "end",
  "entrance", "exit", "face", "faces", "floor", "front", "ground", "hall", "hallway", "hand", "hands", "home",
  "interior", "light", "middle", "moment", "moments", "room", "rooms", "side", "silence", "space", "stairs", "staircase",
  "street", "surface", "table", "tables", "top", "wall", "walls", "window", "windows", "voice", "voices", "eye",
  "eyes", "gaze", "expression", "expressions", "breath", "breaths", "shoulder", "shoulders", "arm", "arms", "finger", "fingers",
  "foot", "feet", "footsteps", "hair", "lips", "mouth", "jaw", "chest", "heart", "posture", "stance", "shadow",
  "shadows", "sound", "sounds", "noise", "noises", "smell", "scent", "temperature", "weather", "action", "actions", "adventure",
  "adventures", "author", "authors", "card", "cards", "chapter", "chapters", "character", "characters", "choice", "choices", "config",
  "configuration", "context", "continuation", "conversation", "description", "detail", "details", "dialogue", "ending", "entry", "entries", "event",
  "events", "example", "examples", "fact", "facts", "field", "fields", "format", "formatting", "game", "games", "genre",
  "genres", "history", "input", "instruction", "instructions", "lore", "memory", "model", "models", "name", "names", "narration",
  "narrative", "narrator", "output", "paragraph", "paragraphs", "part", "parts", "player", "players", "plot", "profile", "profiles",
  "prompt", "prompts", "response", "responses", "rule", "rules", "scenario", "scenarios", "scene", "scenes", "script", "scripts",
  "section", "sections", "setting", "settings", "status", "story", "stories", "summary", "summaries", "system", "systems", "task",
  "tasks", "text", "texts", "theme", "themes", "version", "world", "worlds", "able", "afraid", "alive", "alone",
  "angry", "anxious", "awake", "aware", "bad", "bare", "basic", "beautiful", "better", "big", "bitter", "black",
  "blank", "bright", "broad", "calm", "careful", "certain", "clear", "cold", "common", "complete", "concerned", "confused",
  "dark", "dead", "deep", "different", "difficult", "distant", "dry", "early", "easy", "empty", "exact", "familiar",
  "far", "fast", "final", "fine", "flat", "free", "fresh", "full", "general", "gentle", "good", "great",
  "hard", "heavy", "high", "hollow", "hot", "huge", "important", "impossible", "large", "late", "little", "local",
  "long", "loud", "low", "main", "major", "minor", "narrow", "new", "normal", "obvious", "old", "ordinary",
  "pale", "personal", "possible", "quiet", "quick", "ready", "real", "recent", "right", "rough", "safe", "same",
  "serious", "sharp", "short", "silent", "simple", "slow", "small", "soft", "solid", "strange", "strong", "sudden",
  "sure", "tall", "thin", "tired", "true", "unclear", "unusual", "warm", "weak", "wide", "wrong", "young",
  "afternoon", "ago", "daytime", "dusk", "evening", "forever", "later", "midnight", "morning", "night", "noon", "nowadays",
  "once", "overnight", "present", "presently", "shortly", "someday", "sometime", "sunrise", "sunset", "today", "tomorrow", "tonight",
  "twice", "yesterday", "ai", "assistant", "automatic", "automatically", "backup", "cache", "canon", "canonical", "category", "categories",
  "codex", "command", "commands", "compound", "core", "current", "deadline", "detected", "diagnostic", "diagnostics", "disabled", "enable",
  "enabled", "entity", "entities", "evidence", "forced", "frontmemory", "hint", "hook", "hooks", "mandatory", "marker", "markers",
  "mature", "minimum", "maximum", "optimized", "optional", "override", "pending", "payoff", "private", "required", "reset", "resolved",
  "retry", "retries", "seed", "seeds", "strict", "subtle", "template", "templates", "thread", "threads", "tracking", "tracked",
  "twist", "twists", "unsaid", "warning", "wildcard", "s", "bury", "burying", "buries", "buried", "fitting", "talking",
  "seen", "honesty", "traffic", "according", "alleged", "allegedly", "apparent", "reported", "rumored", "rumoured"
];

var CODEX_STOPWORDS = new Set([
  ...COMMON_CAPITALIZED_STOPWORDS,
  ...CODEX_EXTRA_STOPWORDS
].map(w => w.toLowerCase()));


// Automatic Codex discovery should prefer durable *named* entities over
// ordinary scene nouns. A capitalized common noun at the start of a sentence
// ("Food", "Dinner", "Coffee", "Table") can otherwise look exactly like a
// one-word proper name to the tokenizer, and ordinary narration verbs such as
// "takes" or "moves" can then accidentally promote it to a character.
//
// Keep this separate from CODEX_STOPWORDS: words such as "Chicken", "Cafe",
// "Library", "King", or "Spoon" can legitimately occur inside a real proper
// name ("Dragon's Breath Fried Chicken", "Moonlight Cafe", "The Golden
// Spoon"). The generic-noun guard rejects them only when the whole candidate
// is still just an ordinary concept, while explicit naming/business cues can
// rescue a genuinely named entity.
var CODEX_GENERIC_FOOD_WORDS = new Set([
  "food","foods","meal","meals","breakfast","brunch","lunch","dinner","supper","snack","snacks",
  "appetizer","appetizers","starter","starters","entree","entrees","entrée","entrées","main","course","courses",
  "dessert","desserts","dish","dishes","plate","plates","bowl","bowls","serving","servings","portion","portions",
  "recipe","recipes","ingredient","ingredients","menu","menus","special","specials","buffet","feast","banquet",
  "drink","drinks","beverage","beverages","water","coffee","tea","juice","soda","pop","cola","lemonade",
  "milk","milkshake","shake","smoothie","smoothies","cocoa","chocolate","beer","ale","lager","wine","cider",
  "cocktail","cocktails","mocktail","mocktails","liquor","spirits","whiskey","whisky","vodka","gin","rum",
  "tequila","champagne","espresso","latte","cappuccino","mocha",
  "bread","toast","roll","rolls","bun","buns","bagel","bagels","croissant","croissants","muffin","muffins",
  "cereal","oatmeal","porridge","pancake","pancakes","waffle","waffles","egg","eggs","omelet","omelette",
  "bacon","sausage","sausages","ham","chicken","turkey","beef","pork","lamb","mutton","duck","goose",
  "steak","steaks","meat","meats","fish","seafood","salmon","tuna","shrimp","prawn","prawns","crab","lobster",
  "burger","burgers","hamburger","hamburgers","sandwich","sandwiches","wrap","wraps","pizza","pizzas",
  "pasta","spaghetti","lasagna","lasagne","macaroni","noodle","noodles","ramen","rice","risotto",
  "soup","soups","stew","stews","chili","curry","curries","salad","salads","fries","chips","crisps",
  "potato","potatoes","vegetable","vegetables","veggie","veggies","fruit","fruits","apple","apples",
  "banana","bananas","orange","oranges","berry","berries","grape","grapes","melon","peach","peaches",
  "pear","pears","pineapple","mango","mangoes","lemon","lemons","lime","limes","tomato","tomatoes",
  "onion","onions","garlic","pepper","peppers","carrot","carrots","corn","bean","beans","peas","mushroom","mushrooms",
  "cheese","butter","cream","yogurt","yoghurt","sauce","sauces","gravy","dressing","dip","dips","jam","jelly",
  "salt","sugar","flour","oil","vinegar","spice","spices","herb","herbs","seasoning","seasonings",
  "cake","cakes","pie","pies","cookie","cookies","biscuit","biscuits","brownie","brownies","donut","donuts",
  "doughnut","doughnuts","pastry","pastries","candy","candies","sweet","sweets","icecream","ice","gelato",
  "pudding","custard","cheesecake","cupcake","cupcakes","tart","tarts",
  "fried","grilled","roasted","baked","boiled","steamed","smoked","toasted","spicy","sweet","savory","savoury",
  "sour","salty","fresh","frozen","hot","cold","warm","raw","cooked","crispy","creamy","cheesy","garlicky"
].map(w => w.toLowerCase()));

var CODEX_GENERIC_SCENE_NOUNS = new Set([
  "thing","things","stuff","object","objects","item","items","belonging","belongings","possession","possessions",
  "place","places","area","areas","spot","spots","location","locations","site","sites","scene","scenes",
  "room","rooms","bedroom","bedrooms","bathroom","bathrooms","kitchen","kitchens","hallway","hallways",
  "corridor","corridors","livingroom","basement","attic","garage","garden","yard","porch","balcony",
  "door","doors","window","windows","wall","walls","floor","floors","ceiling","ceilings","roof","roofs",
  "table","tables","chair","chairs","desk","desks","bed","beds","couch","couches","sofa","sofas","shelf","shelves",
  "cabinet","cabinets","drawer","drawers","counter","counters","lamp","lamps","light","lights","mirror","mirrors",
  "box","boxes","bag","bags","bottle","bottles","cup","cups","glass","glasses","mug","mugs","fork","forks",
  "knife","knives","spoon","spoons","napkin","napkins","towel","towels","blanket","blankets","pillow","pillows",
  "clothes","clothing","shirt","shirts","pants","trousers","dress","dresses","jacket","jackets","coat","coats",
  "shoe","shoes","boot","boots","hat","hats","glove","gloves","scarf","scarves",
  "phone","phones","computer","computers","laptop","laptops","tablet","tablets","screen","screens","television","tv",
  "book","books","paper","papers","page","pages","letter","letters","note","notes","photo","photos","picture","pictures",
  "car","cars","truck","trucks","vehicle","vehicles","bike","bikes","bicycle","bicycles","bus","buses","train","trains",
  "road","roads","street","streets","path","paths","trail","trails","bridge","bridges","building","buildings",
  "store","stores","shop","shops","market","markets","school","schools","hospital","hospitals","office","offices",
  "park","parks","library","libraries","restaurant","restaurants","cafe","cafes","diner","diners","bar","bars",
  "tree","trees","forest","forests","river","rivers","lake","lakes","mountain","mountains","hill","hills","field","fields",
  "sky","cloud","clouds","rain","snow","wind","weather","sun","moon","star","stars",
  "hand","hands","arm","arms","leg","legs","foot","feet","head","face","eyes","eye","hair","mouth","lips","voice",
  "body","bodies","heart","hearts","blood","breath","breathing","smile","smiles","gaze","expression","expressions",
  "sound","sounds","noise","noises","music","song","songs","silence","air","smell","scent","taste","feeling","feelings",
  "time","times","moment","moments","minute","minutes","hour","hours","day","days","week","weeks","month","months",
  "year","years","morning","afternoon","evening","night","today","tomorrow","yesterday",
  "dawn","sunrise","noon","midday","dusk","sunset","midnight","weekend","weekday",
  "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
  "january","february","march","april","may","june","july","august","september","october","november","december",
  "spring","summer","autumn","fall","winter","season","seasons",
  "north","south","east","west","northeast","northwest","southeast","southwest",
  "upstairs","downstairs","indoors","outdoors","inside","outside","left","right","center","centre","front","back","side",
  "beginning","start","ending","end","finish",
  "work","job","jobs","money","cash","home","family","friend","friends","people","person","someone","somebody",
  "problem","problems","question","questions","answer","answers","idea","ideas","plan","plans","choice","choices",
  "conversation","conversations","message","messages","text","texts","call","calls","story","stories","memory","memories",
  "dream","dreams","thought","thoughts","secret","secrets","truth","truths","lie","lies","news","information"
].map(w => w.toLowerCase()));

var CODEX_GENERIC_DESCRIPTORS = new Set([
  "big","small","little","large","tiny","huge","old","new","young","ancient","modern","good","bad","best","worst",
  "first","last","next","other","another","same","different","normal","ordinary","simple","plain","special",
  "red","blue","green","yellow","black","white","brown","gray","grey","gold","golden","silver","dark","light",
  "bright","pale","deep","soft","hard","rough","smooth","clean","dirty","wet","dry","heavy","lightweight",
  "hot","cold","warm","cool","fast","slow","quick","quiet","loud","sweet","bitter","sour","salty","spicy",
  "fresh","stale","fried","grilled","roasted","baked","boiled","steamed","smoked","raw","cooked","crispy","creamy"
].map(w => w.toLowerCase()));

var CODEX_GENERIC_COMMON_NOUNS = new Set([
  ...CODEX_GENERIC_FOOD_WORDS,
  ...CODEX_GENERIC_SCENE_NOUNS
]);

function codexGenericWords(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/[^a-z0-9' -]+/g, " ")
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, "").replace(/'s$/i, ""))
    .filter(Boolean);
}

function hasStrongCodexBusinessOrNamedContext(name, text) {
  const source = typeof text === "string" ? text : "";
  const cleanName = String(name || "").trim();
  if (!source || !cleanName) return false;
  const n = escapeForRegex(cleanName);
  const businessKinds = "restaurant|diner|bistro|caf[eé]|coffee\\s+shop|bakery|pizzeria|steakhouse|deli|bar|pub|bookstore|bookshop|book\\s+shop|store|shop|market|supermarket|grocery|pharmacy|salon|boutique|company|corporation|brand|hotel|inn|tavern";
  const patterns = [
    new RegExp(`\\b(?:${businessKinds})\\s+(?:called|named|known\\s+as)\\s+["“”'‘’]?${n}\\b`, "i"),
    new RegExp(`\\b${n}\\b\\s+(?:${businessKinds})\\b`, "i"),
    new RegExp(`\\b(?:ordered\\s+from|ate\\s+at|dined\\s+at|works?\\s+at|worked\\s+at|employed\\s+by|shops?\\s+at)\\s+["“”'‘’]?${n}\\b`, "i")
  ];
  return patterns.some(re => re.test(source));
}

function isGenericCodexCommonNounCandidate(name, source) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return true;

  // Explicit identity language always wins. This keeps intentionally unusual
  // names valid: "I'm Coffee", "the dish called Moonfire Stew", "the
  // restaurant named The Golden Spoon", etc.
  if (hasStrongExplicitCodexNamingCue(cleanName, source) ||
      hasStrongCodexBusinessOrNamedContext(cleanName, source)) {
    return false;
  }

  const words = codexGenericWords(cleanName);
  if (!words.length) return true;

  const content = words.filter(w => !["the","a","an","of","and","or","with","in","on","at","for","from","to"].includes(w));
  if (!content.length) return true;

  // Food and drink are especially noisy in normal prose. Do not auto-card a
  // meal/ingredient/dish just because it was capitalized or repeated. A
  // genuinely *named* dish/brand/business can still pass through the explicit
  // naming/context exceptions above.
  if (content.some(w => CODEX_GENERIC_FOOD_WORDS.has(w))) {
    return true;
  }

  const genericCount = content.filter(w =>
    CODEX_GENERIC_COMMON_NOUNS.has(w) ||
    CODEX_GENERIC_DESCRIPTORS.has(w) ||
    CODEX_STOPWORDS.has(w) ||
    CODEX_TITLE_WORDS.has(w)
  ).length;

  if (content.length === 1 && genericCount === 1) return true;
  if (genericCount === content.length) return true;
  if (content.length >= 2 && genericCount / content.length >= 0.75) return true;

  return false;
}

var CODEX_LOCATION_HINTS = /\b(city|state|street|road|lane|avenue|boulevard|canyon|terminal|park|garden|grove|orchard|meadow|plaza|square|site|venue|location|place|building|tower|island|country|nation|kingdom|realm|district|region|planet|world|base|facility|academy|university|school|campus|bridge|river|mountain|forest|desert|battleground|warzone|hall|tavern|inn|hotel|motel|castle|fortress|temple|church|mosque|shrine|level|sector|wing|chamber|vault|bay|deck|outpost|colony|settlement|village|town|hamlet|station|harbor|harbour|wharf|apartment|house|home|office|warehouse|factory|farm|ranch|arena|stadium|courtroom|courthouse|prison|jail|laboratory|lab|theater|theatre|cinema|museum|library|mall|market|bookstore|bookshop|supermarket|grocery|pharmacy|gym|beach|cave|mine|ruins?|cemetery|graveyard|neighborhood|neighbourhood|suburb|block)\b/i;
var CODEX_LOCATION_SUFFIX_HINTS = /(tower|keep|hold|spire|haven|hollow|reach|scraper)/i;

// "Faction" doubles as the best fit for any organization — guild-and-empire
// fantasy terms, but also modern businesses, restaurants, and services,
// none of which fit "location" or "item" well. A real game's Story Cards
// (custom-typed "Business", "Restaurant", "Social Media") showed this gap
// directly: none of the fantasy-only terms below matched "Thorne
// Industries" or "Dragon's Breath Fried Chicken", so both silently fell
// back to being guessed as a character.
var CODEX_FACTION_HINTS = /\b(order|guild|alliance|empire|faction|clan|brotherhood|council|syndicate|coalition|army|legion|cult|society|corporation|company|companies|initiative|division|agency|federation|dynasty|tribe|vanguard|battalion|regiment|squad|squadron|fleet|crew|cabal|circle|sect|resistance|movement|militia|garrison|industries|industry|enterprises|incorporated|holdings|conglomerate|group|partners|associates|firm|labs?|laboratory|laboratories|studio|studios|productions|pharmaceuticals|restaurant|diner|bistro|caf[eé]|eatery|grill|kitchen|bakery|brewery|pizzeria|steakhouse|deli|hospital|clinic|salon|boutique|store|shop|franchise|chain|brand|app|platform|network|streaming|team|club|league|union|association|foundation|charity|church|ministry|department|bureau|office|committee|party|campaign|band|orchestra|label|school|college|university|house|family|court|government|police|fire department)\b/i;

// Sci-fi vessel/mech/robot vocabulary was missing here entirely — the
// modern-vehicle words (car/truck/van/vehicle) already reflect an earlier
// real gap being closed the same way, but nothing parallel ever got added
// for the sci-fi equivalent, meaning a starship, mech, or robot with a
// name that happens to include one of these words (e.g. "the Mothership,"
// "Unit-9 the Android") had no name-level signal at all and fell entirely
// on the correction-note-plus-scoring fallback — the same accepted,
// unavoidable limitation as a wholly invented name like "Starhopper" with
// no recognizable component in it at all.
var CODEX_ITEM_HINTS = /\b(sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|armou?r|shield|artifact|device|weapon|tool|key|book|tome|potion|elixir|gem|crystal|relic|suit|mask|cloak|helmet|gauntlet|hammer|axe|bow|orb|blaster|scroll|spear|dagger|lance|trident|chalice|sigil|banner|car|truck|motorcycle|motorbike|van|jeep|convertible|sedan|coupe|vehicle|automobile|ship|starship|spaceship|spacecraft|shuttle|cruiser|frigate|freighter|corvette|mech|mecha|robot|android|cyborg|rover|submarine|tank|helicopter|aircraft|airship|mothership|jacket|dress|gown|coat|shirt|blouse|jeans|skirt|boots|shoes|sneakers|scarf|gloves|necklace|bracelet|earrings|sunglasses|phone|smartphone|laptop|tablet|computer|console|headset|drone|camera|backpack|purse|wallet|suitcase|bicycle|bike|bus|train|tram|boat|yacht|guitar|violin|piano|instrument|microphone|recording|photograph|photo|letter|document|file|contract|map|badge|medicine|medication|serum|vial|inhaler|watch|radio|communicator)\b/i;

var CODEX_TITLE_WORDS = new Set([
  "Emperor", "Empress", "King", "Queen", "Prince", "Princess", "Duke",
  "Duchess", "Lord", "Lady", "Sir", "Dame", "Baron", "Baroness", "Count",
  "Countess", "President", "General", "Admiral", "Captain", "Colonel",
  "Major", "Sergeant", "Lieutenant", "Commander", "Chief", "Director",
  "Minister", "Governor", "Senator", "Ambassador", "Doctor", "Professor",
  "Master", "Mistress", "Reverend", "Bishop", "Cardinal", "Judge",
  "Justice", "Mayor", "Chancellor", "Agent", "Officer", "Detective",
  "Sheriff", "Marshal", "Warden", "Overlord", "Warlord", "Elder",
  "Guardian", "Knight", "Priest", "Priestess",
  // Everyday courtesy titles — a distinct flavor (address form rather
  // than rank/office) but the exact same problem: "Mr. Carver" and
  // "Ms. Ogena" burning their own separate Codex retry budgets instead
  // of being recognized as "Carver" and "Jessica Ogena" (confirmed via a
  // real player's status report a few rounds back) turned out to be only
  // half of this same bug — this list already existed specifically to
  // keep a bare title word from becoming its own candidate, but was never
  // used to *strip* a leading title from a longer candidate the way the
  // stopword list below is, and the courtesy-title fix only patched
  // isSameCardEntity's comparison, never mention-tracking's own counting.
  // Confirmed directly: "Commander Reyes" and bare "Reyes" were tracked
  // as two entirely separate candidates because the leading rank word
  // was never stripped at the point mentions actually get counted, and
  // in one sandbox run this went further — one candidate's card fields
  // ended up written under the *other* candidate's bare-surname title
  // entirely, a genuine cross-assignment, not just wasted budget. One
  // shared set, used for both jobs everywhere, closes both at once.
  "Mr", "Mrs", "Ms", "Miss", "Dr", "Madam", "Mx",
  "Prof", "Capt", "Gen", "Col", "Lt", "Sgt", "Cmdr", "Maj", "Adm", "Rev",
  "Hon", "Gov", "Sen", "Rep", "Det", "Insp"
].map(w => w.toLowerCase()));

var SENTENCE_ABBREVIATIONS = new Set([
  "Dr", "Mr", "Mrs", "Ms", "Prof", "St", "Jr", "Sr", "Capt", "Gen",
  "Col", "Lt", "Sgt", "Rev", "Hon", "Fr", "Rep", "Sen", "Gov", "Adm",
  "Cmdr", "Maj", "Mt", "vs", "etc"
]);
// A name "word" is a capitalized token that may contain internal
// apostrophes, hyphens, or digits (O'Brien, Ba'al, Draconic-Ballgown,
// Agent47) — built from the shared NAME_ALPHANUM class at the top of this
// file so this and TWISTS AND TURNS' own equivalent (findEntityInSentence)
// can no longer drift out of sync the way they already have three times.
var CODEX_NAME_TOKEN = `[A-Z][${NAME_ALPHANUM}]*(?:['\u2019-][${NAME_ALPHANUM}]+)*`;
var CODEX_TITLE_ABBREV_REGEX = new RegExp(
  `\\b(?:(?:${[...SENTENCE_ABBREVIATIONS].filter(w => w.length > 1).join("|")})\\.\\s+)?${CODEX_NAME_TOKEN}(?:\\s+of\\s+${CODEX_NAME_TOKEN}|\\s+${CODEX_NAME_TOKEN}){0,3}\\b`,
  "g"
);


// Automatic Codex discovery intentionally uses a much stricter standard than
// a manual `/card <name>` command. Capitalization alone is not entity evidence:
// every generated sentence starts with a capital letter, which is how words
// such as "Which", "Already", "Six", "Burying", and "To" can otherwise age
// into completely bogus Story Cards.
//
// `hasExplicitCodexNamingCue` is the escape hatch for unusual *real* names.
// A character genuinely named Six, Which, Summer, etc. is still allowed when
// the story explicitly names them ("I'm Six", "a woman named Six", "codename
// Six"). Generic narration such as "Which comes..." is never enough.
function codexStopKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9'.-]+$/gi, "")
    .replace(/\.$/, "")
    .replace(/'s$/i, "")
    .trim();
}

function hasStrongExplicitCodexNamingCue(name, text) {
  const source = typeof text === "string" ? text : "";
  const cleanName = String(name || "").trim();
  if (!source || !cleanName) return false;

  const n = escapeForRegex(cleanName);
  const quote = `["“”'‘’]?`;
  const personKind = [
    "person", "woman", "man", "girl", "boy", "lady", "gentleman", "teenager",
    "teen", "adult", "child", "youth", "stranger", "traveler", "traveller",
    "guard", "soldier", "knight", "mage", "wizard", "witch", "priest",
    "priestess", "captain", "doctor", "nurse", "merchant", "officer",
    "detective", "pilot", "engineer", "teacher", "professor", "student",
    "lawyer", "attorney", "judge", "athlete", "coach", "musician", "singer",
    "actor", "artist", "scientist", "researcher", "agent", "server", "waiter",
    "waitress", "barista", "cashier", "clerk", "receptionist", "chef", "cook",
    "mechanic", "driver", "courier", "medic", "therapist", "counselor",
    "counsellor", "neighbor", "neighbour", "roommate", "coworker", "colleague",
    "manager", "boss", "assistant", "owner", "parent", "mother", "father",
    "sister", "brother", "wife", "husband", "partner", "friend", "android", "robot",
    "synthetic", "ai", "alien", "creature", "spirit", "ghost", "vampire",
    "werewolf", "superhero", "hero", "villain", "elf", "dwarf", "orc", "fae",
    "demon", "angel", "dragon", "deity", "god", "goddess", "dog", "cat",
    "horse", "animal", "companion", "npc"
  ].join("|");
  const entityKind = [
    personKind,
    "city", "town", "village", "kingdom", "realm", "district", "region",
    "planet", "world", "station", "base", "facility", "school", "academy",
    "college", "university", "hospital", "hotel", "tavern", "inn", "house",
    "building", "street", "road", "river", "mountain", "forest", "island",
    "company", "corporation", "agency", "organization", "organisation", "group",
    "guild", "order", "clan", "faction", "team", "club", "band", "crew",
    "restaurant", "diner", "bistro", "cafe", "café", "bakery", "pizzeria",
    "steakhouse", "deli", "bar", "pub", "store", "shop", "brand",
    "dish", "meal", "food", "drink", "beverage", "cocktail", "dessert", "recipe", "menu item",
    "ship", "starship", "vehicle", "car", "train", "boat", "weapon", "sword",
    "gun", "device", "artifact", "relic", "book", "document", "app", "network"
  ].join("|");

  // These cues carry actual identity semantics. They are allowed to override
  // the aggressive common-noun filter so unusual real names such as Coffee,
  // Summer, Six, or a dish called "Dinner" can still exist deliberately.
  const cues = [
    new RegExp(`\\b(?:I\\s*(?:am|'m|’m)|my\\s+name\\s+(?:is|'s|’s)|call\\s+me|people\\s+call\\s+me|they\\s+call\\s+me|I\\s+go\\s+by|meet)\\s+${quote}${n}\\b`, "i"),
    new RegExp(`\\b(?:introduces?|introduced)\\s+(?:himself|herself|themself|themselves|itself)\\s+as\\s+${quote}${n}\\b`, "i"),
    new RegExp(`\\b(?:${entityKind})\\s+(?:named|called|known\\s+as|dubbed|codenamed|designated)\\s+${quote}${n}\\b`, "i"),
    new RegExp(`\\b(?:named|called|known\\s+as|dubbed|codenamed|designated)\\s+${quote}${n}\\b`, "i"),
    new RegExp(`\\b(?:codename|code\\s+name|callsign|call\\s+sign|designation|nickname|alias)\\s*(?::|=|is\\s+)?\\s*${quote}${n}\\b`, "i"),
    new RegExp(`\\b${n}\\b\\s+(?:is|was)\\s+(?:my|his|her|their|its|the)\\s+(?:name|nickname|codename|callsign|designation)\\b`, "i"),
    // "This is Rose, my sister" is a genuine introduction; bare "This is
    // Dinner" is only a weak deictic construction and must not override the
    // common-noun filter.
    new RegExp(`\\bthis\\s+is\\s+${quote}${n}\\s*[,—-]\\s*(?:my|our|his|her|their|the)\\s+(?:${personKind})\\b`, "i")
  ];
  return cues.some(re => re.test(source));
}

function hasExplicitCodexNamingCue(name, text) {
  if (hasStrongExplicitCodexNamingCue(name, text)) return true;
  const source = typeof text === "string" ? text : "";
  const cleanName = String(name || "").trim();
  if (!source || !cleanName) return false;

  // Bare "this is X" remains useful weak evidence for normal proper names,
  // but it is intentionally NOT strong enough to rescue generic nouns such
  // as Dinner, Food, Water, Table, etc.
  const n = escapeForRegex(cleanName);
  return new RegExp(`\\bthis\\s+is\\s+["“”'‘’]?${n}\\b`, "i").test(source);
}

function codexLooksLikeSentenceStarterMorphology(name, source) {
  const clean = String(name || "").trim();
  if (!clean || /\s/.test(clean)) return false;
  // Restrict this heuristic to very characteristic prose-form suffixes.
  // Plain -ed/-ly are deliberately not used because real names such as Reed,
  // Jared, Ashley and Kelly would be collateral damage.
  if (!/(?:ing|ingly|edly|ously|ively)$/i.test(clean)) return false;
  const s = typeof source === "string" ? source : "";
  if (!s) return true;
  const n = escapeForRegex(clean);
  return new RegExp(`(?:^|[.!?]["'”’)]*\\s+|\\n+\\s*|["“]\\s*)${n}\\b`, "i").test(s);
}

function codexHasLowercaseCommonUsage(name, source) {
  const clean = String(name || "").trim();
  if (!clean || /\s/.test(clean) || !source) return false;
  if (!/^[A-Za-z][A-Za-z0-9'’.-]*$/.test(clean)) return false;
  const lower = clean.toLowerCase();
  if (clean === lower) return false;
  const s = String(source);
  const rx = new RegExp(`\\b${escapeForRegex(lower)}\\b`, "g");
  let m;
  let lowercaseHits = 0;
  while ((m = rx.exec(s))) {
    // Regex is intentionally case-sensitive: only genuinely lowercase uses
    // count as common-word evidence.
    lowercaseHits += 1;
    const before = s.slice(Math.max(0, m.index - 14), m.index);
    if (/\b(?:a|an|the|some|any|this|that|my|your|his|her|their|our)\s+$/i.test(before)) return true;
    if (lowercaseHits >= 2) return true;
    if (rx.lastIndex === m.index) rx.lastIndex++;
  }
  return false;
}

function normalizeCodexCandidate(raw, source) {
  let name = stripPossessive(String(raw || "")
    .replace(/^[\s"'“”‘’([{<]+|[\s"'“”‘’)\]}>.,:;!?—–-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim());
  if (!name || name.length > 80 || !/[A-Za-z]/.test(name)) return null;

  const originalExplicit = hasExplicitCodexNamingCue(name, source);
  const originalStrongExplicit = hasStrongExplicitCodexNamingCue(name, source);
  let words = name.split(/\s+/).filter(Boolean);

  // Sentence-openers and titles can be captured together with the real
  // proper noun ("Which Harlan", "Captain Reyes"). Strip them only when
  // the complete phrase was not explicitly named as an entity.
  if (!originalExplicit) {
    while (words.length > 1 &&
      (CODEX_STOPWORDS.has(codexStopKey(words[0])) || CODEX_TITLE_WORDS.has(codexStopKey(words[0])))) {
      words.shift();
    }
    while (words.length > 1 &&
      (CODEX_STOPWORDS.has(codexStopKey(words[words.length - 1])) ||
       CODEX_TITLE_WORDS.has(codexStopKey(words[words.length - 1])))) {
      words.pop();
    }
    name = words.join(" ").trim();
  }

  if (!name || !words.length) return null;
  const explicit = originalExplicit || hasExplicitCodexNamingCue(name, source);
  const strongExplicit = originalStrongExplicit || hasStrongExplicitCodexNamingCue(name, source);
  const keys = words.map(codexStopKey).filter(Boolean);

  if (!keys.length) return null;

  // Reject ordinary common nouns before movement/dialogue heuristics get a
  // chance to reinterpret them as people. This is the main protection
  // against cards for Food, Dinner, Coffee, Table, etc.
  if (!strongExplicit && isGenericCodexCommonNounCandidate(name, source)) {
    return null;
  }

  if (!strongExplicit) {
    // If a single capitalized token is also used as an ordinary lowercase
    // noun in the same context, treat the lowercase usage as strong evidence
    // that the sentence-start capitalization is grammatical rather than a
    // proper name. Explicit naming still overrides this for characters like
    // Summer, Coffee, Rose, etc.
    if (keys.length === 1 && codexHasLowercaseCommonUsage(name, source)) {
      return null;
    }
    if (keys.length === 1 &&
        (CODEX_STOPWORDS.has(keys[0]) || CODEX_TITLE_WORDS.has(keys[0]))) {
      return null;
    }

    // A phrase made mostly from generic/function words is prose, not a
    // durable named entity. "of" and similar connectors are tolerated only
    // when there is enough actual proper-noun material around them.
    const genericCount = keys.filter(k =>
      CODEX_STOPWORDS.has(k) || CODEX_TITLE_WORDS.has(k)
    ).length;
    if (genericCount === keys.length) return null;
    if (keys.length > 1 && genericCount >= Math.ceil(keys.length * 0.67)) return null;

    if (keys.length === 1 && codexLooksLikeSentenceStarterMorphology(name, source)) {
      return null;
    }
  }

  if (keys.length === 1) {
    if (name.length <= 1 && !strongExplicit) return null;
    if (/^(?:[ivxlcdm]+)$/i.test(name) && name.length <= 8 && !strongExplicit) return null;
    if (/^\d+(?:st|nd|rd|th)?$/i.test(name) && !strongExplicit) return null;

    // Short all-caps words are usually acronyms/headings. Explicit naming is
    // required, which still permits characters such as ARIA, VEX, Q, etc.
    if (name.length <= 5 && name === name.toUpperCase() &&
        /[A-Z]{2,}/.test(name) && !strongExplicit) {
      return null;
    }
  }

  return name;
}

function codexEvidenceTextFor(name) {
  try {
    const evidence = state && state.unsaid && state.unsaid.codex &&
      state.unsaid.codex.evidence && state.unsaid.codex.evidence[name];
    if (!Array.isArray(evidence)) return "";
    return evidence
      .map(item => item && typeof item.text === "string" ? item.text : "")
      .filter(Boolean)
      .join(" ");
  } catch (e) {
    return "";
  }
}



function isEstablishedExplicitCodexCharacter(name) {
  try {
    const codex = state && state.unsaid && state.unsaid.codex;
    if (!codex || !codex.likelyCharacters || !codex.likelyCharacters[name]) return false;
    return hasExplicitCodexNamingCue(name, codexEvidenceTextFor(name));
  } catch (e) {
    return false;
  }
}

function isClearlyJunkCodexName(name) {
  const raw = String(name || "").trim();
  if (!raw) return true;
  try {
    if (state && state.unsaid && state.unsaid.codex && state.unsaid.codex.trustedEntities &&
        state.unsaid.codex.trustedEntities[raw]) return false;
  } catch (e) {}
  const evidenceText = codexEvidenceTextFor(raw);
  if (hasStrongExplicitCodexNamingCue(raw, evidenceText)) return false;

  if (isGenericCodexCommonNounCandidate(raw, evidenceText)) return true;

  const words = raw.split(/\s+/).filter(Boolean);
  const keys = words.map(codexStopKey).filter(Boolean);
  if (!keys.length) return true;
  if (raw.length <= 1) return true;

  if (keys.length === 1) {
    if (CODEX_STOPWORDS.has(keys[0]) || CODEX_TITLE_WORDS.has(keys[0])) return true;
    if (codexLooksLikeSentenceStarterMorphology(raw, "")) return true;
    if (/^\d+(?:st|nd|rd|th)?$/i.test(raw)) return true;
    if (/^(?:[ivxlcdm]+)$/i.test(raw) && raw.length <= 8) return true;
    return false;
  }

  const genericCount = keys.filter(k =>
    CODEX_STOPWORDS.has(k) || CODEX_TITLE_WORDS.has(k)
  ).length;
  return genericCount === keys.length ||
    genericCount >= Math.ceil(keys.length * 0.67);
}

function isSafeTrackedCodexName(name) {
  // Evidence is important for intentionally unusual names that are otherwise
  // stop words. "I'm Six" remains valid; an old persisted candidate called
  // "Six" with no naming evidence is discarded automatically.
  const evidenceText = codexEvidenceTextFor(name);
  return !!normalizeCodexCandidate(name, evidenceText);
}

var CHARACTER_CARD_FIELDS = ["Name", "Race", "Strength Level", "Background", "Personality", "Appearance", "Abilities", "Weaknesses", "Relationships"];
var LOCATION_CARD_FIELDS = ["Name", "Location", "Description", "Key Locations", "Historical Events", "Significance"];
var ITEM_CARD_FIELDS = ["Name", "Type", "Description", "Properties", "Origin", "Significance"];
var FACTION_CARD_FIELDS = ["Name", "Type", "Description", "Significance"];

var CARD_TEMPLATES = {
  character: CHARACTER_CARD_FIELDS,
  location: LOCATION_CARD_FIELDS,
  item: ITEM_CARD_FIELDS,
  faction: FACTION_CARD_FIELDS
};

// TWISTS AND TURNS already solved this exact problem for its own hint
// delivery (see updateNudgeCard inside the Library object above) — this is
// the same fix, applied to UNSAID, which never got it. Confirmed directly
// against AI Dungeon's own scripting documentation: on a cache-efficient
// model, the Context hook still runs and can *read* the context, but
// whatever text it *returns* is silently discarded — the model never sees
// it. That means every one of UNSAID's own instructions (Codex card
// requests, private-thought reveal requests, core-shift checks), which are
// delivered purely by appending to the returned context text, were being
// built correctly and then thrown away before the model ever saw them, on
// any such model — a total, silent failure completely independent of
// instruction wording or which name was requested. This matches real
// captured evidence closely (clean, legitimate names exhausting every
// retry with zero cards created; reveal requests producing nothing
// usable), though the specific evidence gathered didn't show the existing
// cache-efficient warning card active at the time, so this closes a real
// platform-limitation gap without being a confirmed fix for that specific
// report — the markdown-formatting fix already made is the one directly
// confirmed against that evidence. A Story Card's entry, unlike the hook's
// returned text, does still reach the model on these models, so the same
// near-universal-match-keys trick carries whichever instruction would
// otherwise have been silently lost.
function updateUnsaidBackupCard(cacheEfficient, instructionText) {
  const title = "UNSAID — Backup Delivery";
  if (!cacheEfficient) { removeStoryCardByTitle(title); return; }
  const entry = instructionText || " ";
  const notes = "BACKUP INSTRUCTION DELIVERY\n\n" +
    "Active only because Optimized Context was detected this turn — see the \"UNSAID — Important, " +
    "Read This ⚠️\" card. Carries whichever Codex card request or private-thought request would " +
    "otherwise be delivered by appending directly to the model context, which doesn't reach the " +
    "model on this kind of model.";
  let card = storyCards.find(c => c.title === title);
  if (!card) {
    card = createOrFindCard(Library.CP_ALWAYS_MATCH_KEYS, entry, "Class");
    if (card) { card.title = title; }
  }
  if (card) {
    card.keys = Library.CP_ALWAYS_MATCH_KEYS;
    card.type = "Class";
    card.entry = entry;
    card.description = notes;
  }
}

function checkCacheEfficientWarning() {
  const title = "UNSAID — Important, Read This ⚠️";
  const card = storyCards.find(c => c.title === title);
  const isCacheEfficient = typeof info !== "undefined" && info && !!info.useCacheEfficient;

  if (!isCacheEfficient) {
    if (card && card.entry && card.entry.indexOf("no longer detected") === -1) {
      const resolvedText =
        "This warning is no longer detected as of your most recent turn " +
        "— your current model doesn't appear to be running in " +
        "cache-efficient mode anymore, so UNSAID should be able to work " +
        "normally. Safe to delete this card.";
      card.entry = resolvedText;
      card.description = resolvedText;
    }
    return false;
  }

  const warningText =
    "Your current model is running in cache-efficient mode. AI Dungeon's " +
    "own documentation states that on these models, the Context hook " +
    "still runs but its result is never sent to the AI — meaning UNSAID's " +
    "private thoughts and auto-generated Story Cards can't be delivered " +
    "the normal way. As a backup, the same request is now also written to " +
    "a \"UNSAID — Backup Delivery\" card, which the AI does still see, the " +
    "same way TWISTS AND TURNS already backs up its own hints — so things " +
    "should mostly keep working, just less precisely-timed than normal. " +
    "For the most reliable results, switch to a model without cache " +
    "efficiency enabled, or disable cache efficiency for this model if " +
    "your plan allows it.";
  if (!card) {
    const newCard = createOrFindCard("unsaid warning", warningText, "Class");
    if (newCard) {
      newCard.title = title;
      newCard.description = warningText;
    }
  } else if (card.entry !== warningText) {
    card.entry = warningText;
    card.description = warningText;
  }
  return true;
}

function initUnsaid() {
  if (!state.unsaid) {
    state.unsaid = {
      minds: {},
      turn: 0,
      pending: null,
      forcedPeek: null,
      forcedPeekCore: null,
      forcedCodex: null,
      consecutiveRevealMisses: 0,
      // Manual aliases supplement Story Card triggers. They are deliberately
      // stored outside the cards so creators can add nicknames without
      // rewriting lore entries, and are bounded per character.
      aliases: {},
      scenePresence: {},
      castRegistry: [],
      lastActiveCast: [],
      lastActionCount: -1,
      lastStorySignature: null,
      pendingCoreShiftAllowed: false,
      pendingCoreCheck: false,
      codex: {
        mentionCounts: {},
        attempts: {},
        firstSeenTurn: {},
        introducedTurn: {},
        likelyCharacters: {},
        observedTypes: {},
        appearanceTurns: {},
        evidence: {},
        lastMentionTurn: {},
        lastAttemptTurn: {},
        candidateScores: {},
        typeVotes: {},
        trustedEntities: {},
        lastConfidenceTurn: {},
        lastTypeVoteTurn: {},
        cardMeta: {},
        cardUpdateEvidence: {},
        cardUpdateLastSeenTurn: {},
        pendingNames: [],
        pendingTypes: {},
        pendingForced: false,
        pendingRefreshNames: [],
        consecutiveFailedNames: [],
        lastTriggerTurn: 0,
        lastRefreshTriggerTurn: 0
      }
    };
  }
  // Backfill every field below individually, not just on first creation —
  // if state.unsaid already exists (e.g. continuing an adventure across
  // script versions) but is missing one of these, code that indexes
  // straight into it (state.unsaid.codex.attempts[name] = ...) throws,
  // which the caller's try/catch swallows silently, killing UNSAID for
  // that whole turn. Same failure class as the contingency-state hardening.
  if (!state.unsaid.minds || typeof state.unsaid.minds !== "object") state.unsaid.minds = {};
  if (typeof state.unsaid.turn !== "number") state.unsaid.turn = 0;
  if (typeof state.unsaid.forcedPeekCore === "undefined") state.unsaid.forcedPeekCore = null;
  if (typeof state.unsaid.forcedCodex === "undefined") state.unsaid.forcedCodex = null;
  if (typeof state.unsaid.consecutiveRevealMisses !== "number") state.unsaid.consecutiveRevealMisses = 0;
  if (!state.unsaid.aliases || typeof state.unsaid.aliases !== "object" || Array.isArray(state.unsaid.aliases)) state.unsaid.aliases = {};
  if (!state.unsaid.scenePresence || typeof state.unsaid.scenePresence !== "object" || Array.isArray(state.unsaid.scenePresence)) state.unsaid.scenePresence = {};
  if (!Array.isArray(state.unsaid.castRegistry)) state.unsaid.castRegistry = [];
  if (!Array.isArray(state.unsaid.lastActiveCast)) state.unsaid.lastActiveCast = [];
  if (typeof state.unsaid.lastStorySignature !== "string") state.unsaid.lastStorySignature = null;
  if (typeof state.unsaid.pendingCoreShiftAllowed !== "boolean") state.unsaid.pendingCoreShiftAllowed = false;
  if (typeof state.unsaid.pendingCoreCheck !== "boolean") state.unsaid.pendingCoreCheck = false;
  if (!state.unsaid.codex || typeof state.unsaid.codex !== "object") {
    state.unsaid.codex = {
      mentionCounts: {},
      attempts: {},
      firstSeenTurn: {},
      introducedTurn: {},
      likelyCharacters: {},
      observedTypes: {},
      appearanceTurns: {},
      evidence: {},
      lastMentionTurn: {},
      lastAttemptTurn: {},
      candidateScores: {},
      typeVotes: {},
      trustedEntities: {},
      lastConfidenceTurn: {},
      lastTypeVoteTurn: {},
      cardMeta: {},
      cardUpdateEvidence: {},
      cardUpdateLastSeenTurn: {},
      pendingNames: [],
      pendingTypes: {},
      pendingForced: false,
      pendingRefreshNames: [],
      consecutiveFailedNames: [],
      lastTriggerTurn: 0,
      lastRefreshTriggerTurn: 0
    };
  }
  if (!state.unsaid.codex.mentionCounts || typeof state.unsaid.codex.mentionCounts !== "object") state.unsaid.codex.mentionCounts = {};
  if (!state.unsaid.codex.attempts || typeof state.unsaid.codex.attempts !== "object") state.unsaid.codex.attempts = {};
  if (!state.unsaid.codex.firstSeenTurn || typeof state.unsaid.codex.firstSeenTurn !== "object") state.unsaid.codex.firstSeenTurn = {};
  if (!state.unsaid.codex.introducedTurn || typeof state.unsaid.codex.introducedTurn !== "object") state.unsaid.codex.introducedTurn = {};
  if (!state.unsaid.codex.likelyCharacters || typeof state.unsaid.codex.likelyCharacters !== "object") state.unsaid.codex.likelyCharacters = {};
  if (!state.unsaid.codex.observedTypes || typeof state.unsaid.codex.observedTypes !== "object") state.unsaid.codex.observedTypes = {};
  if (!state.unsaid.codex.appearanceTurns || typeof state.unsaid.codex.appearanceTurns !== "object") state.unsaid.codex.appearanceTurns = {};
  if (!state.unsaid.codex.evidence || typeof state.unsaid.codex.evidence !== "object") state.unsaid.codex.evidence = {};
  if (!state.unsaid.codex.lastMentionTurn || typeof state.unsaid.codex.lastMentionTurn !== "object") state.unsaid.codex.lastMentionTurn = {};
  if (!state.unsaid.codex.lastAttemptTurn || typeof state.unsaid.codex.lastAttemptTurn !== "object") state.unsaid.codex.lastAttemptTurn = {};
  if (!state.unsaid.codex.candidateScores || typeof state.unsaid.codex.candidateScores !== "object") state.unsaid.codex.candidateScores = {};
  if (!state.unsaid.codex.typeVotes || typeof state.unsaid.codex.typeVotes !== "object") state.unsaid.codex.typeVotes = {};
  if (!state.unsaid.codex.trustedEntities || typeof state.unsaid.codex.trustedEntities !== "object") state.unsaid.codex.trustedEntities = {};
  if (!state.unsaid.codex.lastConfidenceTurn || typeof state.unsaid.codex.lastConfidenceTurn !== "object") state.unsaid.codex.lastConfidenceTurn = {};
  if (!state.unsaid.codex.lastTypeVoteTurn || typeof state.unsaid.codex.lastTypeVoteTurn !== "object") state.unsaid.codex.lastTypeVoteTurn = {};
  if (!state.unsaid.codex.cardMeta || typeof state.unsaid.codex.cardMeta !== "object") state.unsaid.codex.cardMeta = {};
  if (!state.unsaid.codex.cardUpdateEvidence || typeof state.unsaid.codex.cardUpdateEvidence !== "object") state.unsaid.codex.cardUpdateEvidence = {};
  if (!state.unsaid.codex.cardUpdateLastSeenTurn || typeof state.unsaid.codex.cardUpdateLastSeenTurn !== "object") state.unsaid.codex.cardUpdateLastSeenTurn = {};
  if (!Array.isArray(state.unsaid.codex.pendingNames)) state.unsaid.codex.pendingNames = [];
  if (!state.unsaid.codex.pendingTypes || typeof state.unsaid.codex.pendingTypes !== "object") state.unsaid.codex.pendingTypes = {};
  if (typeof state.unsaid.codex.pendingForced !== "boolean") state.unsaid.codex.pendingForced = false;
  if (!Array.isArray(state.unsaid.codex.pendingRefreshNames)) state.unsaid.codex.pendingRefreshNames = [];
  if (!Array.isArray(state.unsaid.codex.consecutiveFailedNames)) state.unsaid.codex.consecutiveFailedNames = [];
  if (typeof state.unsaid.codex.lastTriggerTurn !== "number") state.unsaid.codex.lastTriggerTurn = 0;
  if (typeof state.unsaid.codex.lastRefreshTriggerTurn !== "number") state.unsaid.codex.lastRefreshTriggerTurn = 0;
  if (typeof state.unsaid.lastActionCount !== "number") state.unsaid.lastActionCount = -1;
  ensureSharedConfigCard();
}

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Shared by both systems' entity/name detection: strips a trailing
// possessive or contraction ("Ba'al's" -> "Ba'al", "O'Brien's" -> "O'Brien")
// without touching a genuine internal apostrophe. Handles both the straight
// (') and curly (\u2019) apostrophe, since models sometimes generate either.
function stripPossessive(w) {
  return w.replace(/['\u2019](s|re|ve|ll|d|m)$/i, "").replace(/['\u2019]$/, "");
}

// Shared by both systems: identifies any of our own admin/status cards
// (from either half) so neither system mistakes the other's scaffolding
// for a real story entity or auto-adopts it as a character.
// Canonical set of this script's own admin/system Story Card title
// prefixes — checked here (to keep admin cards out of scenario-scanning
// and Codex's eligible-title lists) and again, separately, inside
// isSameCardEntity further down (to keep admin cards from ever being
// treated as a Codex candidate's "existing card"). These used to be two
// independently-maintained copies and drifted: this one got updated when
// the merged config card was renamed to "UNSPOKEN TURNS — Config," but
// isSameCardEntity's own copy never was — confirmed directly via sandbox
// testing that a character named "Unspoken" (a very plausible dark-fantasy
// epithet) would match the live config card through isSameCardEntity's
// word-subset comparison and, via "/card Unspoken," actually get spliced
// into the real shared settings card's cast list and Notes. One shared
// list here means it can't drift apart a second time.
var OWN_CARD_TITLE_PREFIXES = ["Twists and Turns", "Twist — ", "UNSAID", "UNSPOKEN TURNS"];

function isOwnCard(title) {
  return !!title && OWN_CARD_TITLE_PREFIXES.some(p => title.indexOf(p) === 0);
}

function pushMessage(msg) {
  if (!msg) return;
  state.message = state.message ? state.message + " " + msg : msg;
}

function nameAppears(name, text) {
  if (!name || !text) return false;
  const raw = String(name).trim();
  let pattern = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" || ch === "\u2019" || ch === "\u2018") {
      pattern += "['\\u2019\\u2018]";
    } else if (ch === "-" || ch === "\u2010" || ch === "\u2011" || ch === "\u2013" || ch === "\u2014") {
      pattern += "[-\\u2010\\u2011\\u2013\\u2014]";
    } else if (/\s/.test(ch)) {
      pattern += "\\s+";
      while (i + 1 < raw.length && /\s/.test(raw[i + 1])) i++;
    } else {
      pattern += escapeForRegex(ch);
    }
  }
  return new RegExp(`(?:^|[^A-Za-z0-9])${pattern}(?=$|[^A-Za-z0-9])`, "i").test(String(text));
}


// ---- Alias-aware character identity -------------------------------------------------
// Story Card triggers are excellent alias data, but older scripts only looked at the
// card title. Build one lightweight index per modifier execution (Library globals are
// recreated for each isolated hook) so "Dr. Voss", "Harlan", "Voss", callsigns and
// creator-authored nicknames can all wake the SAME mind without O(cast × cards) scans.
var UNSAID_ALIAS_INDEX = null;

function normalizeUnsaidIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storyCardAliasValues(card) {
  if (!card) return [];
  const out = [];
  const push = value => {
    const clean = String(value || "").replace(/^[@#]+/, "").replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 2 || clean.length > 80) return;
    if (!out.some(v => normalizeUnsaidIdentity(v) === normalizeUnsaidIdentity(clean))) out.push(clean);
  };
  push(card.title);
  String(card.keys || "").split(/[,;|\n]+/).forEach(push);
  return out.slice(0, UNSAID_ALIAS_LIMIT_PER_CHARACTER + 1);
}

function buildUnsaidAliasIndex() {
  if (UNSAID_ALIAS_INDEX) return UNSAID_ALIAS_INDEX;
  const byTitle = {};
  const aliasToTitles = {};
  const aliasToCards = {};
  const addAlias = (title, alias, card) => {
    const titleKey = normalizeUnsaidIdentity(title);
    const aliasKey = normalizeUnsaidIdentity(alias);
    if (!titleKey || !aliasKey) return;
    if (!byTitle[titleKey]) byTitle[titleKey] = { title, aliases: [], card: card || null };
    if (!byTitle[titleKey].card && card) byTitle[titleKey].card = card;
    if (!byTitle[titleKey].aliases.some(v => normalizeUnsaidIdentity(v) === aliasKey)) {
      byTitle[titleKey].aliases.push(alias);
    }
    if (!aliasToTitles[aliasKey]) aliasToTitles[aliasKey] = [];
    if (!aliasToTitles[aliasKey].includes(title)) aliasToTitles[aliasKey].push(title);
    if (card) {
      if (!aliasToCards[aliasKey]) aliasToCards[aliasKey] = [];
      if (!aliasToCards[aliasKey].includes(card)) aliasToCards[aliasKey].push(card);
    }
  };

  try {
    if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) {
      storyCards.forEach(card => {
        if (!card || !card.title || isOwnCard(card.title)) return;
        storyCardAliasValues(card).forEach(alias => addAlias(card.title, alias, card));
      });
    }
  } catch (e) {}

  try {
    const manual = state && state.unsaid && state.unsaid.aliases;
    if (manual && typeof manual === "object") {
      Object.keys(manual).forEach(title => {
        const aliases = Array.isArray(manual[title]) ? manual[title] : [];
        addAlias(title, title, null);
        aliases.slice(-UNSAID_ALIAS_LIMIT_PER_CHARACTER).forEach(alias => addAlias(title, alias, null));
      });
    }
  } catch (e) {}

  UNSAID_ALIAS_INDEX = { byTitle, aliasToTitles, aliasToCards };
  return UNSAID_ALIAS_INDEX;
}

function invalidateUnsaidAliasIndex() {
  UNSAID_ALIAS_INDEX = null;
}

function aliasesForUnsaidCharacter(name) {
  const raw = String(name || "").trim();
  if (!raw) return [];
  const index = buildUnsaidAliasIndex();
  const key = normalizeUnsaidIdentity(raw);
  let title = raw;
  let record = index.byTitle[key] || null;
  if (!record) {
    const owners = index.aliasToTitles[key] || [];
    if (owners.length === 1) {
      title = owners[0];
      record = index.byTitle[normalizeUnsaidIdentity(title)] || null;
    }
  }
  let values = record ? record.aliases.slice() : [raw];
  // Shared triggers such as a family surname must not wake two minds at once.
  // Keep the canonical title itself, but ignore any alias claimed by multiple
  // distinct Story Card titles until the creator disambiguates it.
  values = values.filter(v => {
    const aliasKey = normalizeUnsaidIdentity(v);
    if (aliasKey === key) return true;
    const owners = index.aliasToTitles[aliasKey] || [];
    return owners.length <= 1;
  });
  if (!values.some(v => normalizeUnsaidIdentity(v) === key)) values.unshift(raw);
  return values.slice(0, UNSAID_ALIAS_LIMIT_PER_CHARACTER + 1);
}

function nameOrAliasAppears(name, text) {
  if (!name || !text) return false;
  const aliases = aliasesForUnsaidCharacter(name);
  for (let i = 0; i < aliases.length; i++) {
    if (nameAppears(aliases[i], text)) return true;
  }
  return false;
}

function resolveUnsaidCanonicalName(rawName) {
  const raw = String(rawName || "").replace(/^[@#]+/, "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const index = buildUnsaidAliasIndex();
  const key = normalizeUnsaidIdentity(raw);
  const owners = index.aliasToTitles[key] || [];
  if (owners.length === 1) return owners[0];

  // Fall back to title matching for courtesy titles / first-name-to-full-name
  // cases, but only accept one unambiguous match.
  const fuzzy = [];
  try {
    if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) {
      for (let i = 0; i < storyCards.length; i++) {
        const card = storyCards[i];
        if (!card || !card.title || isOwnCard(card.title)) continue;
        if (isSameCardEntity(card.title, raw)) fuzzy.push(card.title);
        if (fuzzy.length > 1) break;
      }
    }
  } catch (e) {}
  return fuzzy.length === 1 ? fuzzy[0] : raw;
}

function registerUnsaidAlias(canonicalName, alias) {
  initUnsaid();
  const canonical = resolveUnsaidCanonicalName(canonicalName) || String(canonicalName || "").trim();
  const cleanAlias = String(alias || "").replace(/^[@#]+/, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!canonical || !cleanAlias) return null;
  if (normalizeUnsaidIdentity(canonical) === normalizeUnsaidIdentity(cleanAlias)) return canonical;
  const aliasKey = normalizeUnsaidIdentity(cleanAlias);
  const existingOwners = (buildUnsaidAliasIndex().aliasToTitles[aliasKey] || []);
  if (existingOwners.some(owner => !isSameCardEntity(owner, canonical))) return null;
  if (!Array.isArray(state.unsaid.aliases[canonical])) state.unsaid.aliases[canonical] = [];
  const list = state.unsaid.aliases[canonical];
  if (!list.some(v => normalizeUnsaidIdentity(v) === normalizeUnsaidIdentity(cleanAlias))) list.push(cleanAlias);
  if (list.length > UNSAID_ALIAS_LIMIT_PER_CHARACTER) state.unsaid.aliases[canonical] = list.slice(-UNSAID_ALIAS_LIMIT_PER_CHARACTER);
  invalidateUnsaidAliasIndex();
  return canonical;
}

function removeUnsaidAlias(canonicalName, alias) {
  initUnsaid();
  const canonical = resolveUnsaidCanonicalName(canonicalName) || String(canonicalName || "").trim();
  const cleanAlias = normalizeUnsaidIdentity(alias);
  const list = state.unsaid.aliases && state.unsaid.aliases[canonical];
  if (!canonical || !cleanAlias || !Array.isArray(list)) return false;
  const next = list.filter(v => normalizeUnsaidIdentity(v) !== cleanAlias);
  const changed = next.length !== list.length;
  if (next.length) state.unsaid.aliases[canonical] = next;
  else delete state.unsaid.aliases[canonical];
  if (changed) invalidateUnsaidAliasIndex();
  return changed;
}

function explicitUnsaidExitCue(name, latestText) {
  if (!name || !latestText) return false;
  const source = String(latestText);
  const aliases = aliasesForUnsaidCharacter(name);
  let lastExit = -1;
  let lastEntry = -1;
  for (let i = 0; i < aliases.length; i++) {
    const a = escapeForRegex(aliases[i]);
    const eventRx = new RegExp(`\\b${a}\\b[^\\n.!?]{0,55}\\b(leaves?|left|exits?|exited|departs?|departed|walks? away|walked away|drives? away|drove away|hangs? up|hung up|disappears?|disappeared|heads? home|went home|returns?|returned|re-?enters?|re-?entered|enters?|entered|arrives?|arrived|comes? back|came back)\\b`, "ig");
    let match;
    while ((match = eventRx.exec(source)) !== null) {
      const verb = String(match[1] || "").toLowerCase();
      if (/^(?:returns?|returned|re-?enters?|re-?entered|enters?|entered|arrives?|arrived|comes? back|came back)$/i.test(verb)) {
        lastEntry = Math.max(lastEntry, match.index);
      } else {
        lastExit = Math.max(lastExit, match.index);
      }
      if (eventRx.lastIndex === match.index) eventRx.lastIndex += 1;
    }
  }
  return lastExit >= 0 && lastExit > lastEntry;
}

function activeUnsaidCharacters(cast, recentText, latestText) {
  const names = Array.isArray(cast) ? cast : [];
  const active = [];
  names.forEach(name => {
    if (!nameOrAliasAppears(name, recentText)) return;
    if (explicitUnsaidExitCue(name, latestText)) return;
    active.push(name);
    const p = state.unsaid.scenePresence[name] || {};
    p.lastSeenTurn = state.unsaid.turn;
    p.lastSeenAction = (typeof info !== "undefined" && info && Number.isInteger(info.actionCount)) ? info.actionCount : state.unsaid.turn;
    state.unsaid.scenePresence[name] = p;
  });
  state.unsaid.lastActiveCast = active.slice(0, MAX_CAST_SIZE);
  return active;
}

function createOrFindCard(keys, initialEntry, type) {
  try {
    const idx = addStoryCard(keys, initialEntry, type);
    if (typeof idx === "number" && storyCards[idx]) {
      if (typeof invalidateUnsaidAliasIndex === "function") invalidateUnsaidAliasIndex();
      return storyCards[idx];
    }
    return storyCards.find(c => c.keys === keys) || null;
  } catch (e) {
    return storyCards.find(c => c.keys === keys) || null;
  }
}

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}

function findConfigCardTolerant(title, maxDistance) {
  if (typeof storyCards === "undefined" || !storyCards) return null;
  for (let i = 0; i < storyCards.length; i++) {
    if (storyCards[i] && storyCards[i].title === title) return storyCards[i];
  }
  const target = title.toLowerCase().replace(/[^a-z]/g, "");
  const limit = typeof maxDistance === "number" ? maxDistance : 2;
  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (!card || typeof card.title !== "string") continue;
    const candidate = card.title.toLowerCase().replace(/[^a-z]/g, "");
    if (Math.abs(candidate.length - target.length) > limit) continue;
    if (levenshteinDistance(candidate, target) <= limit) return card;
  }
  return null;
}

// ---- Combined config card: shared by both systems ----
// One Story Card holds both systems' settings, each in its own clearly
// marked section. Every read/write is scoped to just one section via
// extractConfigSection/spliceConfigSection, so neither system's settings
// can ever be clobbered by the other's — even though they share one card.
var CONFIG_CARD_TITLE = "UNSPOKEN TURNS — Config";
var CONFIG_SECTION_TWIST = "== TWISTS AND TURNS ==";
var CONFIG_SECTION_UNSAID = "== UNSAID ==";

function extractConfigSection(fullText, marker) {
  const clean = fullText || "";
  const otherMarker = marker === CONFIG_SECTION_TWIST ? CONFIG_SECTION_UNSAID : CONFIG_SECTION_TWIST;
  const idx = clean.indexOf(marker);
  if (idx === -1) return "";
  const otherIdx = clean.indexOf(otherMarker, idx + marker.length);
  return otherIdx === -1 ? clean.slice(idx) : clean.slice(idx, otherIdx);
}

function spliceConfigSection(fullText, marker, newSectionText) {
  const otherMarker = marker === CONFIG_SECTION_TWIST ? CONFIG_SECTION_UNSAID : CONFIG_SECTION_TWIST;
  const trimmedSection = newSectionText.replace(/\s+$/, "") + "\n";
  const clean = (fullText || "").trim() ? fullText : "";
  const idx = clean ? clean.indexOf(marker) : -1;
  if (idx === -1) {
    const base = clean ? clean.replace(/\s+$/, "") + "\n\n" : "";
    return base + trimmedSection;
  }
  const otherIdx = clean.indexOf(otherMarker, idx + marker.length);
  const before = clean.slice(0, idx);
  const after = otherIdx === -1 ? "" : clean.slice(otherIdx);
  return before + trimmedSection + (after ? "\n" + after : "");
}

// Compact key=value config parsing. The renderer intentionally keeps the
// entire shared config well below AI Dungeon's Story Card limit, while the
// legacyRegex fallback means existing adventures upgrade without losing any
// settings from the older verbose card format.
function configValue(section, key, legacyRegex) {
  const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compact = String(section || "").match(new RegExp("^[ \t]*" + escaped + "[ \t]*=[ \t]*(.*?)[ \t]*$", "im"));
  if (compact) return compact[1].trim();
  const legacy = legacyRegex ? String(section || "").match(legacyRegex) : null;
  return legacy ? String(legacy[1] || "").trim() : null;
}

function configBool(section, key, legacyRegex) {
  const raw = configValue(section, key, legacyRegex);
  if (raw == null || !/^(true|false)$/i.test(raw)) return null;
  return raw.toLowerCase() === "true";
}


// Parse TWISTS AND TURNS settings from either the current compact key=value
// format or the older verbose config format. Keeping this parser separate
// from ensureSharedConfigCard lets old standalone config cards be migrated
// without recursively creating/reading the new combined card.
function applyTwistConfigText(cfg, section) {
  if (!cfg || !section) return cfg;
  let v;
  v = configBool(section, "enabled", /Enable Twists and Turns:\s*(true|false)/i); if (v !== null) cfg.enabled = v;
  v = configValue(section, "intensity", /Intensity[^:]*:\s*(low|medium|high)/i); if (v && /^(low|medium|high)$/i.test(v)) cfg.intensity = v.toLowerCase();
  v = configBool(section, "strictLogic", /Strict logic only[^:]*:\s*(true|false)/i); if (v !== null) cfg.strictLogic = v;
  v = configBool(section, "wildcard", /Allow wildcard twists:\s*(true|false)/i); if (v !== null) cfg.allowWildcard = v;
  v = configBool(section, "compound", /Allow compound twists:\s*(true|false)/i); if (v !== null) cfg.allowCompoundTwists = v;
  v = configBool(section, "mature", /Allow mature \(18\+\) twists for confirmed adults:\s*(true|false)/i); if (v !== null) cfg.allowMatureTwists = v;
  v = configBool(section, "involvePlayer", /Involve the player character in twists:\s*(true|false)/i); if (v !== null) cfg.involvePlayer = v;
  v = configBool(section, "twistLog", /Show resolved twists in the Twist Log:\s*(true|false)/i); if (v !== null) cfg.showTwistLog = v;

  v = parseInt(configValue(section, "minSeeds", /Minimum seed touches before a twist can pay off:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 200) cfg.minSeedsForPayoff = v;
  v = parseInt(configValue(section, "minTurns", /Minimum turns before a twist can pay off:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 200) cfg.minTurnsForPayoff = v;
  v = parseInt(configValue(section, "payoffCD", /Turns to wait between twist payoffs:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 200) cfg.payoffCooldown = v;
  v = parseInt(configValue(section, "retryCD", /Turns before retrying an unconfirmed twist payoff:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 20) cfg.twistRetryCooldown = v;
  v = parseInt(configValue(section, "threadsPerEntity", /Maximum active twist threads per entity:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 12) cfg.maxThreadsPerEntity = v;

  v = configBool(section, "scenarioAdapt", /Automatically adapt twists\/cards to the current scenario:\s*(true|false)/i); if (v !== null) cfg.scenarioAdaptation = v;
  v = configValue(section, "scenarioOverride", /Scenario override, blank for automatic detection:[ \t]*(.*)/i); if (v !== null) cfg.scenarioOverride = v.slice(0, 180);
  v = configBool(section, "synergy", /Link UNSAID psychology with twist threads:\s*(true|false)/i); if (v !== null) cfg.crossSystemSynergy = v;
  v = configBool(section, "perfGuard", /Adaptive performance guard:\s*(true|false)/i); if (v !== null) cfg.adaptivePerformance = v;
  v = parseInt(configValue(section, "budgetMs", /Context work budget in milliseconds:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.performanceBudgetMs = Math.min(1500, Math.max(400, v));
  v = parseInt(configValue(section, "factsCap", /How many resolved twists Established Facts keeps:\s*(\d+)/i), 10);
  if (!isNaN(v) && v >= 1 && v <= 30) cfg.establishedFactsCap = v;

  const rawBias = configValue(section, "themeBias", /Theme bias[^:]*:[ \t]*(.*)/i);
  if (rawBias !== null) {
    if (!rawBias || /^(off|none)$/i.test(rawBias)) {
      cfg.categoryBias = "";
    } else {
      const requested = rawBias.split(",").map(x => x.trim()).filter(Boolean);
      const matched = requested
        .map(r => CP_CLUSTER_NAMES.find(clusterName => clusterName.toLowerCase() === r.toLowerCase()))
        .filter(Boolean);
      cfg.categoryBias = matched.length > 0 ? [...new Set(matched)].join(", ") : "";
    }
  }
  return cfg;
}

function removeStoryCardByTitle(title) {
  try {
    for (let i = 0; i < storyCards.length; i++) {
      if (storyCards[i] && storyCards[i].title === title) { removeStoryCard(i); return true; }
    }
  } catch (e) {}
  return false;
}

function renderTwistSection(cfg) {
  return CONFIG_SECTION_TWIST + "\n" +
    `enabled=${cfg.enabled}\n` +
    `intensity=${cfg.intensity}\n` +
    `strictLogic=${cfg.strictLogic}\n` +
    `wildcard=${cfg.allowWildcard}\n` +
    `compound=${cfg.allowCompoundTwists}\n` +
    `mature=${cfg.allowMatureTwists}\n` +
    `involvePlayer=${cfg.involvePlayer}\n` +
    `twistLog=${cfg.showTwistLog}\n` +
    `minSeeds=${cfg.minSeedsForPayoff}\n` +
    `minTurns=${cfg.minTurnsForPayoff}\n` +
    `payoffCD=${cfg.payoffCooldown}\n` +
    `retryCD=${cfg.twistRetryCooldown}\n` +
    `threadsPerEntity=${cfg.maxThreadsPerEntity}\n` +
    `scenarioAdapt=${cfg.scenarioAdaptation}\n` +
    `scenarioOverride=${cfg.scenarioOverride || ""}\n` +
    `synergy=${cfg.crossSystemSynergy}\n` +
    `perfGuard=${cfg.adaptivePerformance}\n` +
    `budgetMs=${cfg.performanceBudgetMs}\n` +
    `factsCap=${cfg.establishedFactsCap}\n` +
    `themeBias=${cfg.categoryBias || ""}\n`;
}

function renderUnsaidSection(cfg) {
  return CONFIG_SECTION_UNSAID + "\n" +
    `enabled=${cfg.enabled}\n` +
    `codex=${cfg.codexEnabled}\n` +
    `thoughtChance=${cfg.chance}\n` +
    `thoughtCD=${cfg.cooldown}\n` +
    `reduceOnActions=${cfg.reduceDuringActions}\n` +
    `activeWindow=${cfg.recentTurnsWindow}\n` +
    `showThoughts=${cfg.showThoughtsInStory}\n` +
    `subtleHints=${cfg.subtleHints}\n` +
    `jsonNotes=${cfg.jsonNotes}\n` +
    `adaptiveMind=${cfg.adaptiveMindEnabled}\n` +
    `mindSlots=${cfg.adaptiveMindSlots}\n` +
    `reflectEvery=${cfg.adaptiveReflectionInterval}\n` +
    `behaviorContinuity=${cfg.behavioralContinuity}\n` +
    `continuityMinds=${cfg.behavioralContinuityCharacters}\n` +
    `coreShift=${cfg.allowCoreShift}\n` +
    `mentions=${cfg.mentionThreshold}\n` +
    `codexCD=${cfg.codexCooldown}\n` +
    `codexRetries=${cfg.codexMaxAttempts}\n` +
    `charObserve=${cfg.codexCharacterMinTurns}\n` +
    `charAppear=${cfg.codexCharacterMinAppearances}\n` +
    `charDeadline=${cfg.codexCharacterDeadline}\n` +
    `autoRefresh=${cfg.codexAutoRefresh}\n` +
    `refreshCD=${cfg.codexRefreshInterval}\n` +
    `refreshEvidence=${cfg.codexRefreshMinEvidence}\n` +
    `protectManual=${cfg.codexProtectManualEdits}\n` +
    `resetCodex=false\n` +
    `player=${cfg.playerName || ""}\n`;
}

function renderTwistNotes(cfg, c) {
  const brewing = c ? c.threads.filter(t => t.status === "brewing").length : 0;
  const ready = c ? c.threads.filter(t => t.status === "ready").length : 0;
  const resolved = c ? c.twistLog.length : 0;
  return [
    CONFIG_SECTION_TWIST,
    "UNSPOKEN TURNS — TWISTS AND TURNS CONFIG GUIDE",
    "",
    "Edit the SETTINGS ENTRY on this Story Card, not these Notes. Keep the key names exactly as written and only change the value after '='. Boolean settings accept true or false. Invalid/out-of-range values are ignored or safely clamped. These Notes are documentation and are not sent to the AI.",
    "",
    `LIVE STATUS: ${brewing} brewing thread${brewing === 1 ? "" : "s"} · ${ready} ready · ${resolved} resolved`,
    "",
    "━━━━━━━━━━ CORE ━━━━━━━━━━",
    "enabled  [true/false]  Default: true",
    "Master switch for TWISTS AND TURNS. false stops automatic seeding/payoffs while preserving existing thread state.",
    "",
    "intensity  [low | medium | high]  Default: medium",
    "Controls how often the system looks for a foreshadowing beat. Low is slow-burn, medium is balanced, high is more active. It does not bypass logic/evidence gates.",
    "",
    "strictLogic  [true/false]  Default: true",
    "When true, twists must be supported by established story/lore evidence. Recommended for grounded continuity and fewer random-feeling surprises.",
    "",
    "wildcard  [true/false]  Default: false",
    "Allows occasional unseeded surprise twists only when strictLogic=false. Keep false for tightly foreshadowed stories.",
    "",
    "compound  [true/false]  Default: true",
    "Allows two compatible ready threads to pay off together as one connected reveal instead of always resolving separately.",
    "",
    "mature  [true/false]  Default: false",
    "Opt-in for mature 18+ twist categories. Mature categories are only considered for characters with clear adult evidence. Turning this off keeps existing mature threads dormant rather than deleting them.",
    "",
    "involvePlayer  [true/false]  Default: true",
    "If true, the player character may be involved in eligible twist threads. false keeps automatic twist targeting focused on NPCs/world entities.",
    "",
    "twistLog  [true/false]  Default: false",
    "Controls whether resolved twists are written visibly to the Twists and Turns — Twist Log Story Card.",
    "",
    "━━━━━━━━━━ PAYOFF PACING ━━━━━━━━━━",
    "minSeeds  [1–200]  Default: 2",
    "Minimum number of meaningful foreshadowing/evidence touches a thread needs before normal payoff eligibility.",
    "",
    "minTurns  [1–200]  Default: 8",
    "Minimum age of a thread in turns before normal payoff eligibility. Higher values create longer setups.",
    "",
    "payoffCD  [1–200]  Default: 10",
    "Minimum turns between successful twist payoffs. Increase to prevent reveals from crowding each other.",
    "",
    "retryCD  [1–20]  Default: 2",
    "Turns to wait before retrying a payoff that was requested but not confirmed by the model/output parser.",
    "",
    "threadsPerEntity  [1–12]  Default: 5",
    "Maximum unresolved twist threads stored for one character/entity. Lower values reduce complexity; higher values allow denser long-form plotting.",
    "",
    "━━━━━━━━━━ SCENARIO ADAPTATION ━━━━━━━━━━",
    "scenarioAdapt  [true/false]  Default: true",
    "Automatically reads the live scenario/lore for genre, era, reality level and stakes so selected twist families fit the story.",
    "",
    "scenarioOverride  [text, up to 180 chars]  Default: blank",
    "Optional manual guidance such as 'grounded detective noir' or 'cosmic superhero drama'. Blank means automatic detection only. It guides selection; it does not override established canon.",
    "",
    "themeBias  [comma-separated theme names]  Default: blank",
    "Biases new threads toward chosen twist families while still respecting evidence and scenario logic. Use exact theme names. Blank/off/none disables the bias.",
    "Valid themes: " + CP_CLUSTER_NAMES.join(", "),
    "",
    "━━━━━━━━━━ CROSS-SYSTEM / PERFORMANCE ━━━━━━━━━━",
    "synergy  [true/false]  Default: true",
    "Links UNSAID psychology with twist threads. Character fears/goals can reinforce compatible threads, and confirmed twists can feed emotional consequences back into character minds.",
    "",
    "perfGuard  [true/false]  Default: true",
    "Adaptive runtime governor. When enabled, low-priority maintenance yields before AI Dungeon's script timeout instead of risking the whole hook. Strongly recommended.",
    "",
    "budgetMs  [400–1500]  Default: 900",
    "Internal per-hook work target used by perfGuard. This is deliberately below AI Dungeon's hard hook timeout. 700–1000 is a sensible range; raising it can increase background work but reduces safety margin.",
    "",
    "factsCap  [1–30]  Default: 8",
    "How many recent resolved twist facts are retained in the Established Facts helper card. Higher values remember more canon but use more context when that card is relevant.",
    "",
    "━━━━━━━━━━ TWIST COMMANDS ━━━━━━━━━━",
    "/twist [name] — force the next eligible payoff, optionally around one entity.",
    "/plant <name> [categoryKey] — manually start a thread.",
    "/threads — write the spoiler-safe brewing overview card.",
    "/twistlog — toggle the visible resolved-twist log.",
    "/twisttypes — write the twist-category catalog.",
    "/mature on|off — toggle mature categories.",
    "/scenario [status|auto|off|custom text] — inspect/control scenario adaptation.",
    "/synergy on|off — toggle UNSAID ↔ TWISTS linkage.",
    "/intensity low|medium|high — change pacing.",
    "/rescan — force lore/scenario sources to be rescanned.",
    "/twists — refresh this config/help card.",
    "",
    "QUICK PRESETS",
    "• Grounded / mystery: strictLogic=true, wildcard=false, intensity=low|medium.",
    "• Cinematic: strictLogic=true, compound=true, intensity=medium|high.",
    "• Chaotic surprise: strictLogic=false, wildcard=true, intensity=high.",
    "• Huge Story Card libraries: keep perfGuard=true and budgetMs around 700–900."
  ].join("\n");
}

function renderUnsaidNotes() {
  return [
    CONFIG_SECTION_UNSAID,
    "UNSPOKEN TURNS — UNSAID CONFIG GUIDE",
    "",
    "Edit the SETTINGS ENTRY on this Story Card, not these Notes. Keep the key names exactly as written and only change the value after '='. Boolean settings accept true or false. Numeric values are validated/clamped to safe ranges. These Notes are documentation and are not sent to the AI.",
    "",
    "━━━━━━━━━━ MASTER / CODEX ━━━━━━━━━━",
    "enabled  [true/false]  Default: true",
    "Master switch for UNSAID. false disables private-thought/psychology behavior and automatic Codex work without deleting saved minds or cards.",
    "",
    "codex  [true/false]  Default: true",
    "Enables automatic Story Card detection/creation and evidence tracking for characters, locations, items and factions. Manual /card still belongs to UNSAID's workflow.",
    "",
    "player  [name or blank]  Default: blank",
    "Player-character name. UNSAID skips this identity when auto-Codexing/choosing NPC minds. If blank, the script tries to infer a player name from suitable Character Creator placeholders.",
    "",
    "━━━━━━━━━━ PRIVATE THOUGHTS ━━━━━━━━━━",
    "thoughtChance  [0.0–1.0]  Default: 0.3",
    "Base chance that an eligible active NPC gets a private-thought request on a turn. 0 disables random thoughts; 1 requests one whenever eligibility/cooldowns allow.",
    "",
    "thoughtCD  [0–500]  Default: 3",
    "Turns before the same character can be selected for another private thought. 0 allows consecutive turns.",
    "",
    "reduceOnActions  [true/false]  Default: true",
    "When true, the thought chance is reduced on the player's Do/Say actions so private processing does not overwhelm active player moments.",
    "",
    "activeWindow  [1–20]  Default: 3",
    "How many recent story turns are considered when deciding which characters are currently active/present enough to think.",
    "",
    "showThoughts  [true/false]  Default: false",
    "false keeps generated private thoughts hidden from normal story prose while still storing their psychological effect. true leaves the thought reveal visible in the story.",
    "",
    "subtleHints  [true/false]  Default: true",
    "Lets established feelings, tensions and motives subtly influence visible NPC behavior without exposing the literal hidden thought.",
    "",
    "jsonNotes  [true/false]  Default: false",
    "Controls how UNSAID-owned psychological data is stored in Character Story Card Notes. false uses readable prose; true uses structured JSON for easier machine parsing/debugging.",
    "",
    "━━━━━━━━━━ ADAPTIVE CHARACTER MIND ━━━━━━━━━━",
    "adaptiveMind  [true/false]  Default: true",
    "Enables the bounded private memory bank that learns recurring goals, plans, fears, secrets, beliefs, commitments and relationship-specific concerns.",
    "",
    "mindSlots  [4–24]  Default: 12",
    "Maximum adaptive private-memory slots kept per character. More slots preserve more simultaneous concerns but increase state/card processing.",
    "",
    "reflectEvery  [2–20]  Default: 4",
    "Every N private moments, the prompt asks for a deeper reflection that can connect older motives/memories instead of only reacting to the immediate scene.",
    "",
    "behaviorContinuity  [true/false]  Default: true",
    "Lets established goals/plans/relationships shape NPC behavior even on turns where no private thought is revealed.",
    "",
    "continuityMinds  [1–4]  Default: 2",
    "Maximum number of active NPC minds injected into a single behavioral-continuity instruction. Lower is lighter/focused; higher supports busier ensemble scenes.",
    "",
    "coreShift  [true/false]  Default: true",
    "Allows major, well-supported events to update a character's deep core truth/belief. false keeps the core truth stable while surface feelings/memories can still evolve.",
    "",
    "━━━━━━━━━━ CODEX CREATION GATES ━━━━━━━━━━",
    "mentions  [1–50]  Default: 3",
    "General mention threshold before an uncertain entity becomes eligible for automatic Codex creation. Strong explicit character/location/item/faction evidence can use specialized confidence logic.",
    "",
    "codexCD  [0–500]  Default: 5",
    "Minimum turns between automatic new Codex card requests. 0 removes the global creation cooldown, which is not recommended in very busy stories.",
    "",
    "codexRetries  [1–50]  Default: 8",
    "Maximum automatic generation attempts for a candidate before it is temporarily abandoned/treated as repeatedly failed.",
    "",
    "charObserve  [0–100]  Default: 3",
    "Minimum story age in turns for a newly introduced character before normal automatic character carding. 0 allows immediate evidence-based carding.",
    "",
    "charAppear  [1–20]  Default: 2",
    "Minimum distinct on-screen appearances normally required for a new character card. Helps prevent one-line names from being canonized too quickly.",
    "",
    "charDeadline  [1–200; never below charObserve]  Default: 5",
    "Maximum observation age before a strongly tracked new character can be forced through the character-card pipeline even if normal appearance pacing is slow.",
    "",
    "━━━━━━━━━━ CODEX REFRESH ━━━━━━━━━━",
    "autoRefresh  [true/false]  Default: true",
    "Allows Story Cards originally created by Codex to be refreshed when enough later evidence changes/adds useful facts.",
    "",
    "refreshCD  [1–500]  Default: 20",
    "Minimum turns between automatic refreshes of the same Codex-owned Story Card.",
    "",
    "refreshEvidence  [1–10]  Default: 3",
    "Number of new evidence mentions required before an automatic refresh becomes eligible. Higher values make updates more conservative.",
    "",
    "protectManual  [true/false]  Default: true",
    "Protects hand-edited Story Card entries from automatic Codex refresh. Strongly recommended if you manually curate cards.",
    "",
    "resetCodex  [true/false one-shot]  Default: false",
    "Set to true to clear Codex tracking queues/counters on the next read. Existing Story Cards are NOT deleted. The script automatically rewrites this back to false after consuming it.",
    "",
    "━━━━━━━━━━ UNSAID COMMANDS ━━━━━━━━━━",
    "/peek <name> — force a private-thought look at a character.",
    "/peek <name> core — force a core-truth check for that character.",
    "/card <name> — force a Codex Story Card request.",
    "/alias <character> = <alias> — add a manual alias, nickname or callsign.",
    "/unalias <character> = <alias> — remove a manual alias.",
    "/unsaid status — write a private status/character-state diagnostic card.",
    "/unsaid health — write runtime timings, deferred work and caught-error diagnostics.",
    "/unsaid resetcodex — reset Codex tracking without deleting Story Cards.",
    "/unsaid help — show the command reminder.",
    "",
    "TUNING IDEAS",
    "• More inner life: thoughtChance=0.45–0.6, thoughtCD=2, mindSlots=14–18.",
    "• Subtle/novel-like: showThoughts=false, subtleHints=true, thoughtChance=0.2–0.35.",
    "• Fast Codex: mentions=2, codexCD=2–3, charObserve=1–2.",
    "• Conservative Codex: mentions=4–6, codexCD=6–10, charObserve=4–6, protectManual=true.",
    "",
    "OPTIONAL CAST IMPORT",
    "You normally do not need to maintain a cast list: the script discovers/adopts characters automatically. If you want to seed NPC names manually, put one NPC name per line AFTER the === marker below. On the next turn the names are moved into bounded internal state and removed from these Notes.",
    CAST_LIST_MARKER
  ].join("\n");
}

var CONFIG_DEFAULT_UNSAID_NOTES_SECTION = renderUnsaidNotes();

function ensureSharedConfigCard() {
  let card = findConfigCardTolerant(CONFIG_CARD_TITLE);
  if (card && card.title !== CONFIG_CARD_TITLE) card.title = CONFIG_CARD_TITLE;

  if (!card) {
    const oldTwistCard = findConfigCardTolerant("Twists and Turns Config");
    const oldUnsaidCard = findConfigCardTolerant("UNSAID Config");
    const migrating = !!(oldTwistCard || oldUnsaidCard);

    // Twists and Turns' settings already persist independently in state, so
    // they carry over automatically regardless of what any card ever said.
    // UNSAID's settings live only on its own card, so if this adventure
    // still has the old separate "UNSAID Config" card from before the
    // merge, carry its current entry/notes over rather than resetting to
    // defaults on upgrade.
    const twistCfg = Object.assign({}, (typeof CP_DEFAULTS !== "undefined" ? CP_DEFAULTS : {}), (typeof state !== "undefined" && state.contingencyConfig) || {});
    if (oldTwistCard && oldTwistCard.entry) applyTwistConfigText(twistCfg, oldTwistCard.entry);
    if (typeof state !== "undefined" && state) state.contingencyConfig = Object.assign({}, twistCfg);
    const twistSection = renderTwistSection(twistCfg);

    const unsaidEntrySection = (oldUnsaidCard && oldUnsaidCard.entry && oldUnsaidCard.entry.trim())
      ? CONFIG_SECTION_UNSAID + "\n" + oldUnsaidCard.entry.trim() + "\n"
      : renderUnsaidSection(UNSAID_DEFAULTS);
    const unsaidNotesSection = (oldUnsaidCard && oldUnsaidCard.description && oldUnsaidCard.description.trim())
      ? CONFIG_SECTION_UNSAID + "\n" + oldUnsaidCard.description.trim()
      : CONFIG_DEFAULT_UNSAID_NOTES_SECTION;
    const twistNotesSection = renderTwistNotes(
      twistCfg,
      (typeof state !== "undefined" && state && state.contingency) ? state.contingency : null
    );

    const initialEntry = twistSection.replace(/\s+$/, "") + "\n\n" + unsaidEntrySection;
    const initialDescription = twistNotesSection.replace(/\s+$/, "") + "\n\n" + unsaidNotesSection;
    const cardKeys = CONFIG_CARD_TITLE.toLowerCase();
    try {
      const idx = addStoryCard(cardKeys, initialEntry, "Class");
      card = (typeof idx === "number" && storyCards[idx]) ? storyCards[idx] : null;
    } catch (e) {}
    if (!card) card = storyCards.find(sc => sc.keys === cardKeys) || null;
    if (!card) {
      for (let i = 0; i < storyCards.length; i++) {
        if (storyCards[i] && storyCards[i].title === CONFIG_CARD_TITLE) { card = storyCards[i]; break; }
      }
    }
    if (card) {
      card.title = CONFIG_CARD_TITLE;
      card.type = "Class";
      if (!card.entry || !card.entry.trim()) card.entry = initialEntry;
      if (!card.description || !card.description.trim()) card.description = initialDescription;
      // fold in complete — the two old separate cards are now redundant
      removeStoryCardByTitle("Twists and Turns Config");
      removeStoryCardByTitle("UNSAID Config");
      if (migrating && typeof pushMessage === "function") {
        pushMessage(`⚙️ Your Twists and Turns and UNSAID config cards have been combined into one — check "${CONFIG_CARD_TITLE}". All your existing settings carried over.`);
      }
    }
  }

  if (card) {
    if (card.entry.indexOf(CONFIG_SECTION_TWIST) === -1) {
      card.entry = spliceConfigSection(card.entry, CONFIG_SECTION_TWIST, renderTwistSection(Object.assign({}, CP_DEFAULTS, (state.contingencyConfig || {}))));
    }
    if (card.entry.indexOf(CONFIG_SECTION_UNSAID) === -1) {
      card.entry = spliceConfigSection(card.entry, CONFIG_SECTION_UNSAID, renderUnsaidSection(UNSAID_DEFAULTS));
    }
    if (card.description.indexOf(CONFIG_SECTION_TWIST) === -1) {
      card.description = spliceConfigSection(
        card.description,
        CONFIG_SECTION_TWIST,
        renderTwistNotes(
          Object.assign({}, CP_DEFAULTS, (state.contingencyConfig || {})),
          state.contingency || null
        )
      );
    }
    if (card.description.indexOf(CONFIG_SECTION_UNSAID) === -1) {
      card.description = spliceConfigSection(card.description, CONFIG_SECTION_UNSAID, CONFIG_DEFAULT_UNSAID_NOTES_SECTION);
    }
  }
  return card;
}

function resetCodexTrackingState() {
  if (!state.unsaid || !state.unsaid.codex) return;
  const codex = state.unsaid.codex;
  codex.attempts = {};
  codex.mentionCounts = {};
  codex.firstSeenTurn = {};
  codex.introducedTurn = {};
  codex.likelyCharacters = {};
  codex.observedTypes = {};
  codex.lastAttemptTurn = {};
  codex.appearanceTurns = {};
  codex.evidence = {};
  codex.lastMentionTurn = {};
  codex.candidateScores = {};
  codex.typeVotes = {};
  codex.trustedEntities = {};
  codex.lastConfidenceTurn = {};
  codex.lastTypeVoteTurn = {};
  codex.cardUpdateEvidence = {};
  codex.cardUpdateLastSeenTurn = {};
  codex.pendingNames = [];
  codex.pendingTypes = {};
  codex.pendingRefreshNames = [];
  codex.consecutiveFailedNames = [];
  codex.lastTriggerTurn = 0;
  codex.lastRefreshTriggerTurn = 0;
}

function readUnsaidConfig() {
  const card = ensureSharedConfigCard();
  if (!card) return { ...UNSAID_DEFAULTS, cast: [] };

  initUnsaid();

  // Consume any legacy/manual cast list into persistent state, then restore the
  // clean built-in Config Notes guide. Auto-discovered characters live in this
  // bounded registry instead of being appended to the documentation forever.
  const legacyNotes = extractConfigSection(card.description, CONFIG_SECTION_UNSAID) || CONFIG_DEFAULT_UNSAID_NOTES_SECTION;
  const legacyMarkerIdx = legacyNotes.lastIndexOf(CAST_LIST_MARKER);
  const importedCast = (legacyMarkerIdx >= 0 ? legacyNotes.slice(legacyMarkerIdx + CAST_LIST_MARKER.length) : "")
    .split("\n")
    .map(line => line.trim().replace(/^[-•*]\s*/, "").slice(0, 80))
    .filter(Boolean);
  importedCast.forEach(name => {
    if (!state.unsaid.castRegistry.some(existing => isSameCardEntity(existing, name))) state.unsaid.castRegistry.push(name);
  });
  if (state.unsaid.castRegistry.length > MAX_CAST_SIZE) {
    state.unsaid.castRegistry = state.unsaid.castRegistry.slice(-MAX_CAST_SIZE);
  }

  const cfg = { ...UNSAID_DEFAULTS };
  const entrySection = extractConfigSection(card.entry, CONFIG_SECTION_UNSAID);
  let v;

  v = configBool(entrySection, "enabled", /Enable UNSAID:\s*(true|false)/i); if (v !== null) cfg.enabled = v;
  v = configBool(entrySection, "codex", /Enable Codex:\s*(true|false)/i); if (v !== null) cfg.codexEnabled = v;
  v = configBool(entrySection, "showThoughts", /Show private thoughts in the story text:\s*(true|false)/i); if (v !== null) cfg.showThoughtsInStory = v;
  v = configBool(entrySection, "subtleHints", /subtly color actions:\s*(true|false)/i); if (v !== null) cfg.subtleHints = v;
  v = configBool(entrySection, "jsonNotes", /Store card notes as JSON:\s*(true|false)/i); if (v !== null) cfg.jsonNotes = v;
  v = configBool(entrySection, "adaptiveMind", /Enable adaptive private memory:\s*(true|false)/i); if (v !== null) cfg.adaptiveMindEnabled = v;
  v = configBool(entrySection, "behaviorContinuity", /Let active NPC goals\/plans shape behavior between thought reveals:\s*(true|false)/i); if (v !== null) cfg.behavioralContinuity = v;
  v = configBool(entrySection, "coreShift", /rewrite a core truth:\s*(true|false)/i); if (v !== null) cfg.allowCoreShift = v;
  v = configBool(entrySection, "reduceOnActions", /Ease off during your own Do\/Say actions:\s*(true|false)/i); if (v !== null) cfg.reduceDuringActions = v;
  v = configBool(entrySection, "autoRefresh", /Automatically refresh Codex-made cards:\s*(true|false)/i); if (v !== null) cfg.codexAutoRefresh = v;
  v = configBool(entrySection, "protectManual", /Protect hand-edited Story Card entries from automatic refresh:\s*(true|false)/i); if (v !== null) cfg.codexProtectManualEdits = v;

  v = parseFloat(configValue(entrySection, "thoughtChance", /thought per turn[^:]*:\s*([\d.]+)/i));
  if (!isNaN(v)) cfg.chance = Math.min(1, Math.max(0, v));
  v = parseInt(configValue(entrySection, "thoughtCD", /think again:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.cooldown = Math.min(500, Math.max(0, v));
  v = parseInt(configValue(entrySection, "activeWindow", /Recent turns counted as "active":\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.recentTurnsWindow = Math.min(20, Math.max(1, v));
  v = parseInt(configValue(entrySection, "mindSlots", /Adaptive private memory slots per character:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.adaptiveMindSlots = Math.min(ADAPTIVE_MIND_MAX_SLOTS, Math.max(ADAPTIVE_MIND_MIN_SLOTS, v));
  v = parseInt(configValue(entrySection, "reflectEvery", /Deep reflection every N private moments:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.adaptiveReflectionInterval = Math.min(20, Math.max(2, v));
  v = parseInt(configValue(entrySection, "continuityMinds", /Maximum active NPC minds used for behavioral continuity:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.behavioralContinuityCharacters = Math.min(4, Math.max(1, v));
  v = parseInt(configValue(entrySection, "mentions", /Mentions needed before Codex creates a card:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.mentionThreshold = Math.min(50, Math.max(1, v));
  v = parseInt(configValue(entrySection, "codexCD", /Minimum turns between Codex cards:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexCooldown = Math.min(500, Math.max(0, v));
  v = parseInt(configValue(entrySection, "codexRetries", /Codex retries before giving up on a name:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexMaxAttempts = Math.min(50, Math.max(1, v));
  v = parseInt(configValue(entrySection, "charObserve", /Minimum story turns to observe a newly introduced character before carding:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexCharacterMinTurns = Math.min(100, Math.max(0, v));
  v = parseInt(configValue(entrySection, "charAppear", /Minimum on-screen appearances before normal character carding:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexCharacterMinAppearances = Math.max(1, Math.min(20, v));
  v = parseInt(configValue(entrySection, "charDeadline", /Maximum turns before a newly introduced character card is forced:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexCharacterDeadline = Math.min(200, Math.max(1, v));
  cfg.codexCharacterDeadline = Math.max(cfg.codexCharacterMinTurns, cfg.codexCharacterDeadline);
  v = parseInt(configValue(entrySection, "refreshCD", /Minimum turns between automatic refreshes of the same card:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexRefreshInterval = Math.min(500, Math.max(1, v));
  v = parseInt(configValue(entrySection, "refreshEvidence", /New evidence mentions needed before automatic refresh:\s*(\d+)/i), 10);
  if (!isNaN(v)) cfg.codexRefreshMinEvidence = Math.min(CODEX_CARD_UPDATE_EVIDENCE_LIMIT, Math.max(1, v));

  const resetValue = configBool(entrySection, "resetCodex", /Reset Codex tracking now:\s*(true|false)/i);
  if (resetValue === true) resetCodexTrackingState();

  v = configValue(entrySection, "player", /Player character \(skip when Codexing\):[ \t]*(.*)/i);
  if (v !== null) cfg.playerName = v.slice(0, 80);

  // If nothing was typed into the config card, fall back to a name-like
  // scenario placeholder answer (e.g. a Character Creator's "What is your
  // character's name?" prompt) — saves a manual setup step, and a value
  // typed into the config card always overrides this.
  if (!cfg.playerName && typeof state !== "undefined" && Array.isArray(state.placeholders)) {
    const nameAnswer = state.placeholders.find(p => {
      if (!p || typeof p.question !== "string" || typeof p.answer !== "string" || !p.answer.trim()) return false;
      const q = p.question;
      if (!/\bname\b/i.test(q)) return false;
      // Avoid treating world-building prompts such as "What is your
      // kingdom's name?" as the player's identity.
      if (/\b(?:kingdom|realm|city|town|village|country|nation|planet|world|ship|starship|faction|guild|clan|company|organization|organisation|pet|companion|weapon|item)\b/i.test(q)) return false;
      return /\b(?:your|character|player|protagonist|hero)\b/i.test(q);
    });
    if (nameAnswer) cfg.playerName = nameAnswer.answer.trim();
  }

  const excludedCastNames = excludedNames(cfg);
  const dedupedRegistry = [];
  state.unsaid.castRegistry.forEach(name => {
    if (!name || dedupedRegistry.some(existing => isSameCardEntity(existing, name))) return;
    if (excludedCastNames.some(ex => isSameCardEntity(ex, name))) return;
    const cardForName = findStoryCardForEntity(name);
    if (cardForName && (codexKindFromExistingCard(cardForName, name) !== "character" || !isCharacterLikeCard(name))) return;
    dedupedRegistry.push(name);
  });
  cfg.cast = dedupedRegistry.slice(-MAX_CAST_SIZE);
  state.unsaid.castRegistry = cfg.cast.slice();

  let adoptedThisPass = 0;
  // Character-card adoption is relevance-first and bounded: inspect cards
  // mentioned in recent history immediately, then a few newest cards, then
  // continue a rotating background sweep. This avoids both full-library
  // rescans and the opposite problem where a currently active hand-made NPC
  // buried deep in a huge card library waits dozens of turns to join UNSAID.
  const adoptionCards = (typeof storyCards !== "undefined" && Array.isArray(storyCards)) ? storyCards : [];
  const tryAdoptCard = c => {
    if (!c || !c.title || adoptedThisPass >= 20) return false;
    if (isOwnCard(c.title)) return false;
    if (excludedCastNames.some(ex => isSameCardEntity(c.title, ex))) return false;
    if (cfg.cast.some(existing => isSameCardEntity(c.title, existing))) return false;
    if (!isCharacterLikeCard(c.title, c)) return false;
    if (codexKindFromExistingCard(c, c.title) !== "character") return false;
    cfg.cast.push(c.title);
    if (!state.unsaid.castRegistry.some(existing => isSameCardEntity(existing, c.title))) state.unsaid.castRegistry.push(c.title);
    adoptedThisPass++;
    return true;
  };

  let adoptionHotText = "";
  try {
    if (typeof history !== "undefined" && Array.isArray(history)) {
      adoptionHotText = history.slice(-6)
        .map(h => h && typeof h.text === "string" ? h.text : "")
        .join(" ")
        .toLowerCase()
        .slice(-7000);
    }
  } catch (e) {}
  if (adoptionHotText) {
    let hotInspected = 0;
    for (let i = 0; i < adoptionCards.length && hotInspected < 8 && adoptedThisPass < 20; i++) {
      const c = adoptionCards[i];
      if (!c || !c.title) continue;
      if (adoptionHotText.indexOf(String(c.title).toLowerCase()) === -1) continue;
      hotInspected++;
      tryAdoptCard(c);
    }
  }

  // Newly created/manual cards are commonly near the end of the collection.
  for (let i = adoptionCards.length - 1, checked = 0; i >= 0 && checked < 4 && adoptedThisPass < 20; i--, checked++) {
    tryAdoptCard(adoptionCards[i]);
  }

  const adoptionScanLimit = Math.min(adoptionCards.length, 8);
  const adoptionStart = adoptionCards.length > 0
    ? Math.max(0, Math.floor(state.unsaid.cardAdoptionCursor || 0)) % adoptionCards.length
    : 0;
  for (let scanIndex = 0; scanIndex < adoptionScanLimit && adoptedThisPass < 20; scanIndex++) {
    tryAdoptCard(adoptionCards[(adoptionStart + scanIndex) % adoptionCards.length]);
  }
  if (adoptionCards.length > 0) {
    state.unsaid.cardAdoptionCursor = (adoptionStart + adoptionScanLimit) % adoptionCards.length;
  } else {
    state.unsaid.cardAdoptionCursor = 0;
  }
  if (cfg.playerName) {
    cfg.cast = cfg.cast.filter(n => !isSameCardEntity(n, cfg.playerName));
    state.unsaid.castRegistry = state.unsaid.castRegistry.filter(n => !isSameCardEntity(n, cfg.playerName));
  }

  // Nothing previously capped how large this list could grow — over a
  // genuinely long game with hundreds of Codex-carded characters, this
  // both bloats the config card itself and, more importantly, means
  // `active = cfg.cast.filter(name => nameAppears(name, recent))` below
  // runs one regex test per cast member on every single turn, which
  // starts to matter against the platform's 2-second-per-hook execution
  // limit. Reading Auto-Cards' source directly for this round surfaced
  // exactly this discipline throughout their own code — they cap every
  // growing collection (candidate titles, memory banks, pending queues)
  // rather than letting any of them grow unboundedly, for the same
  // reason. Trimming the oldest-adopted names first (the ones least
  // likely to still be narratively active) is the same tradeoff the
  // Codex log already makes at its own cap.
  if (MAX_CAST_SIZE < cfg.cast.length) cfg.cast = cfg.cast.slice(cfg.cast.length - MAX_CAST_SIZE);
  state.unsaid.castRegistry = cfg.cast.slice();

  // Always rewrite the UNSAID help section from the built-in documentation. Imported/manual cast names
  // have already been consumed into state, so the Notes stay clean and never accumulate stale cast data.
  card.description = spliceConfigSection(card.description, CONFIG_SECTION_UNSAID, renderUnsaidNotes());
  card.entry = spliceConfigSection(card.entry, CONFIG_SECTION_UNSAID, renderUnsaidSection(cfg));

  return cfg;
}

function stripConfigNoise(text) {
  let cleaned = text;
  storyCards
    .filter(c => isCardOfKind(c, "class") && isOwnCard(c.title))
    .forEach(card => {
      // Guard against stripping on trivially short content — several of our
      // own cards deliberately use a single-space entry (e.g. the Twist Log,
      // kept out of AI context on purpose). Splitting on " " itself would
      // strip every space out of the whole text, which is exactly what was
      // happening here. Only strip substantial, genuinely-our-own content.
      if (card.entry && card.entry.trim().length > 10) cleaned = cleaned.split(card.entry).join("");
      if (card.description && card.description.trim().length > 10) cleaned = cleaned.split(card.description).join("");
    });
  return cleaned;
}

function fitInstructionToBudget(baseText, instruction) {
  const hasBudget = typeof info !== "undefined" && info && typeof info.maxChars === "number";
  if (!hasBudget) return instruction;

  const budget = Math.max(0, info.maxChars - CONTEXT_SAFETY_MARGIN);
  const baseLength = typeof baseText === "string" ? baseText.length : 0;
  if ((baseLength + instruction.length) <= budget) return instruction;

  const room = budget - baseLength;
  if (room <= 40) return null;

  // Never chop a structured request through its closing marker. A truncated
  // CARD or private-thought template is worse than waiting a turn because it
  // virtually guarantees an unusable response and burns retry budget.
  const structured = /【CARD】|【\/CARD】|《|》/.test(instruction);
  if (structured) return null;

  return instruction.slice(0, Math.max(0, room - 4)).replace(/\s+$/, "") + "...]\n";
}


// Codex used to treat every capitalized entity the same and wait for a raw
// mention threshold. That makes a real character introduction unnecessarily
// slow, while the global card cooldown can make a failed first attempt take
// many more turns. These cues are deliberately person-shaped: self
// introductions, speech/action attribution, a person noun attached to the
// name, or a possessive body/voice cue. Locations/items/factions still use
// the normal mention-threshold path.

var CODEX_NONCHAR_MIN_CONFIDENCE = 7;
var CODEX_NONCHAR_MIN_TYPE_VOTES = 4;

function codexTypedEntityCue(name, source, type) {
  const n = escapeForRegex(String(name || "").trim());
  if (!n || !source) return false;
  const types = {
    location: "city|town|village|kingdom|realm|district|region|planet|world|station|base|facility|school|academy|college|university|hospital|hotel|tavern|inn|house|building|street|road|river|mountain|forest|island|courtroom|courthouse|office|farm|ranch|arena|stadium|prison|laboratory|museum|library|beach|cave|mine|cemetery",
    item: "item|object|artifact|relic|weapon|sword|blade|gun|device|tool|book|document|letter|contract|map|vehicle|car|ship|starship|phone|computer|medicine|dish|meal|drink|cocktail|dessert|recipe",
    faction: "faction|organization|organisation|group|guild|order|clan|company|corporation|agency|team|club|league|union|association|department|bureau|committee|party|band|crew|government|police|restaurant|store|shop|brand|network"
  };
  const words = types[type];
  if (!words) return false;
  return new RegExp(
    `\\b(?:${words})\\s+(?:called|named|known\\s+as|dubbed)\\s+["“”'‘’]?${n}\\b|` +
    `\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:${words})\\b`,
    "i"
  ).test(source);
}

function codexEvidenceStrength(name, source, type, isPresence) {
  if (!name || !source) return 0;
  if (hasExplicitCodexNamingCue(name, source)) return 6;
  if (isPresence) return 6;
  if (codexTypedEntityCue(name, source, type)) return 5;

  try {
    if (typeof storyCards !== "undefined" && storyCards.some(c =>
      c && c.title && isSameCardEntity(c.title, name))) return 6;
  } catch (e) {}

  const n = escapeForRegex(name);
  const occurrences = (String(source).match(new RegExp(`(?:^|[^A-Za-z0-9])${n}(?=$|[^A-Za-z0-9])`, "gi")) || []).length;
  const wordCount = String(name).trim().split(/\s+/).length;
  if (wordCount >= 2 && occurrences >= 2) return 3;
  if (wordCount >= 2) return 2;
  return 1;
}

function recordCodexConfidence(name, type, strength, actionEpoch) {
  const codex = state.unsaid.codex;
  if (!name || !type || !strength) return;

  if (codex.lastConfidenceTurn[name] !== actionEpoch) {
    codex.candidateScores[name] = Math.min(30, (codex.candidateScores[name] || 0) + strength);
    codex.lastConfidenceTurn[name] = actionEpoch;
  }

  if (!codex.typeVotes[name] || typeof codex.typeVotes[name] !== "object") {
    codex.typeVotes[name] = { character: 0, location: 0, item: 0, faction: 0 };
  }
  if (codex.lastTypeVoteTurn[name] !== actionEpoch && strength >= 2) {
    codex.typeVotes[name][type] = (codex.typeVotes[name][type] || 0) + strength;
    codex.lastTypeVoteTurn[name] = actionEpoch;
  }
}

function dominantCodexType(name) {
  const votes = state.unsaid.codex.typeVotes && state.unsaid.codex.typeVotes[name];
  if (!votes || typeof votes !== "object") return state.unsaid.codex.observedTypes[name] || "character";
  const types = ["character", "location", "item", "faction"];
  return types.slice().sort((a,b) => (votes[b] || 0) - (votes[a] || 0))[0];
}

function codexTypeVoteScore(name, type) {
  const votes = state.unsaid.codex.typeVotes && state.unsaid.codex.typeVotes[name];
  return votes && typeof votes === "object" ? (votes[type] || 0) : 0;
}


// Strong entity typing sits between raw capitalization and full Codex
// classification. It deliberately asks "what is this thing?" before a broad
// movement/dialogue cue is allowed to call it a person. This is especially
// important for place names such as Thornhaven: "Thornhaven's a quiet place"
// is much stronger evidence than the fact that the same capitalized token
// happens to occur at the start of a sentence.
//
// PERFORMANCE NOTE: AI Dungeon's Context Modifier runs inside a time-limited
// isolated VM. Older builds repeatedly ran every dynamic entity regex against
// the full context for every tracked name, which could mean thousands of
// full-context scans in one pass. The timeout screenshot that pointed at the
// locationExplicit.some(...) line was one symptom of that accumulated work.
// Keep the evidence-rich rules, but bound the text each rule is allowed to scan.
function boundedCodexSemanticText(text) {
  let source = typeof text === "string" ? text : String(text || "");
  const cap = Math.max(2000, CODEX_SEMANTIC_SCAN_CHAR_LIMIT || 7000);
  if (source.length <= cap) return source;

  // Stored Codex evidence is normally prepended while live/recent story text is
  // appended. Preserving both ends keeps historical identity evidence AND the
  // newest scene while discarding the low-value middle of a huge context.
  const head = Math.min(1800, Math.floor(cap * 0.28));
  const tail = Math.max(1, cap - head - 5);
  return source.slice(0, head) + "\n…\n" + source.slice(-tail);
}

function explicitCodexCharacterCue(name, text) {
  const source = boundedCodexSemanticText(text);
  if (!source || !name) return false;
  const n = escapeForRegex(name);
  const personKinds =
    "(?:girl|boy|woman|man|person|lady|gentleman|teenager|teen|child|youth|" +
    "guard|soldier|knight|mage|wizard|witch|priest|priestess|captain|doctor|" +
    "merchant|stranger|traveler|traveller|officer|detective|pilot|engineer|" +
    "nurse|bartender|server|waiter|waitress|barista|cashier|clerk|receptionist|" +
    "chef|cook|mechanic|driver|courier|medic|therapist|counselor|counsellor|" +
    "neighbor|neighbour|roommate|coworker|colleague|manager|boss|assistant|" +
    "owner|parent|mother|father|sister|brother|wife|husband|partner|friend|" +
    "teacher|professor|student|lawyer|attorney|judge|athlete|coach|musician|" +
    "singer|actor|artist|scientist|researcher|agent|android|robot|synthetic|" +
    "AI|alien|creature|spirit|ghost|vampire|werewolf|superhero|hero|villain|" +
    "elf|dwarf|orc|fae|demon|angel|dragon|deity|god|goddess|dog|cat|horse|" +
    "animal|companion)";

  const cues = [
    new RegExp(`\\b(?:I\\s*(?:am|'m|’m)|my\\s+name\\s+is|name\\s*(?:is|'s|’s)|call\\s+me|this\\s+is|meet|known\\s+as|go\\s+by)\\s+["“”'‘’]?${n}\\b`, "i"),
    new RegExp(`\\b(?:a|an|the)\\s+(?:young\\s+|old\\s+|elderly\\s+)?${personKinds}\\s+(?:named|called)\\s+["“”'‘’]?${n}\\b`, "i"),
    new RegExp(`\\b${n}\\b\\s+(?:is|was)\\s+(?:a|an|the)\\s+(?:young\\s+|old\\s+|elderly\\s+)?${personKinds}\\b`, "i"),
    new RegExp(`\\b${n}(?:'s|’s)\\s+(?:eyes?|voice|hands?|face|expression|smile|gaze|shoulders?|breath|hair|fingers?|arms?|feet|cheeks?|lips?|posture|jaw|stance|grip|footsteps?)\\b`, "i"),
    new RegExp(`\\b${n}\\b\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?|shouts?|adds?|admits?|explains?|insists?|snaps?|growls?|mutters?)\\b`, "i")
  ];
  return cues.some(re => re.test(source));
}

function codexLocalEvidenceForName(name, text) {
  const source = boundedCodexSemanticText(text);
  const rawName = String(name || "").trim();
  if (!source || !rawName) return "";

  // The semantic classifier used to run a large family of dynamic regexes over
  // the whole 7k evidence buffer for every candidate. On large/old adventures
  // that accumulated enough work to hit AI Dungeon's hard isolated-VM timeout.
  // Classification only needs the prose immediately surrounding the entity, so
  // collect a few small literal windows and run the expensive rules there.
  const hay = source.toLowerCase().replace(/[’‘]/g, "\'").replace(/[‐‑–—]/g, "-");
  const needle = rawName.toLowerCase().replace(/[’‘]/g, "\'").replace(/[‐‑–—]/g, "-");
  const radius = 190;
  const pieces = [];
  let from = 0;
  let seen = 0;

  while (needle && from <= hay.length - needle.length && seen < 5) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    const before = at > 0 ? hay.charAt(at - 1) : "";
    const afterAt = at + needle.length;
    const after = afterAt < hay.length ? hay.charAt(afterAt) : "";
    const beforeOk = !before || !/[a-z0-9]/i.test(before);
    const afterOk = !after || !/[a-z0-9]/i.test(after);
    if (beforeOk && afterOk) {
      pieces.push(source.slice(Math.max(0, at - radius), Math.min(source.length, afterAt + radius)));
      seen += 1;
    }
    from = at + Math.max(1, needle.length);
  }

  // No literal occurrence means the relationship regexes cannot prove anything
  // about this name anyway. Returning empty avoids burning time on unrelated prose;
  // cheap name-shape hints still run in the caller.
  if (!pieces.length) return "";
  return pieces.join("\n…\n").slice(0, 2200);
}

var CODEX_STRONG_NONCHAR_CACHE = Object.create(null);
var CODEX_STRONG_NONCHAR_CACHE_KEYS = [];

function codexStrongNonCharacterCacheKey(name, source) {
  const s = String(source || "");
  // Hook globals are recreated by AI Dungeon, so a small per-hook cache is
  // enough. A compact signature avoids hashing/scanning the entire evidence.
  return normalizeUnsaidIdentity(name) + "|" + s.length + "|" + s.slice(0, 56) + "|" + s.slice(-56);
}

function cacheStrongNonCharacterResult(key, value) {
  if (!key) return value;
  if (!Object.prototype.hasOwnProperty.call(CODEX_STRONG_NONCHAR_CACHE, key)) {
    CODEX_STRONG_NONCHAR_CACHE_KEYS.push(key);
    if (CODEX_STRONG_NONCHAR_CACHE_KEYS.length > 256) {
      const old = CODEX_STRONG_NONCHAR_CACHE_KEYS.shift();
      delete CODEX_STRONG_NONCHAR_CACHE[old];
    }
  }
  CODEX_STRONG_NONCHAR_CACHE[key] = value || false;
  return value;
}

function strongCodexNonCharacterEvidence(name, text) {
  const rawSource = boundedCodexSemanticText(text);
  if (!rawSource || !name) return null;

  const cacheKey = codexStrongNonCharacterCacheKey(name, rawSource);
  if (Object.prototype.hasOwnProperty.call(CODEX_STRONG_NONCHAR_CACHE, cacheKey)) {
    return CODEX_STRONG_NONCHAR_CACHE[cacheKey] || null;
  }

  // Never let automatic semantic typing be the task that consumes the last
  // slice of a hook's runtime budget. Name-shape hints below remain available;
  // the richer prose scan can happen on a later turn.
  const budgetLow = typeof utHasRuntimeBudget === "function" && !utHasRuntimeBudget(180);
  const source = budgetLow ? "" : codexLocalEvidenceForName(name, rawSource);
  if (budgetLow && typeof utSkipRuntimeTask === "function") utSkipRuntimeTask("codex-semantic-typing");

  const n = escapeForRegex(name);

  const locationKinds =
    "(?:location|place|site|venue|garden|grove|park|plaza|square|city|town|" +
    "village|hamlet|settlement|kingdom|realm|country|nation|district|region|" +
    "province|port|harbou?r|forest|woods|woodland|mountain|valley|island|" +
    "station|outpost|colony|tavern|inn|hotel|motel|castle|fortress|temple|" +
    "shrine|academy|school|college|university|campus|facility|base|office|" +
    "apartment|house|home|warehouse|factory|farm|ranch|arena|stadium|" +
    "courtroom|courthouse|prison|jail|theater|theatre|museum|library|mall|" +
    "market|bookstore|bookshop|book\\s+shop|supermarket|grocery|pharmacy|gym|" +
    "beach|cave|mine|ruins?|cemetery|graveyard|neighbou?rhood|suburb|" +
    "street|road|lane|avenue|boulevard|bridge|river|lake|sea|ocean|desert|" +
    "swamp|marsh|moor|barrow|barrow-mounds?|building|tower|hall|room|chamber)";

  const venueKinds =
    "(?:bookstore|bookshop|book\\s+shop|restaurant|diner|bistro|caf[eé]|" +
    "coffee\\s+shop|bakery|pizzeria|steakhouse|deli|bar|pub|tavern|store|" +
    "shop|market|supermarket|grocery|pharmacy|salon|boutique|hotel|inn|motel|" +
    "cinema|theater|theatre|museum|library|mall|clinic|hospital|gym|studio)";

  const itemKinds =
    "(?:item|object|artifact|relic|device|weapon|tool|sword|blade|gun|rifle|" +
    "pistol|staff|wand|amulet|ring|key|book|tome|ship|starship|vehicle|car|" +
    "truck|motorcycle|train|boat|robot|android|mech|phone|computer|laptop|" +
    "camera|instrument|guitar|document|letter|contract|map|medicine|medication|" +
    "serum|dish|meal|drink|beverage|cocktail|dessert|recipe|special)";

  const factionKinds =
    "(?:order|guild|alliance|faction|clan|brotherhood|council|syndicate|" +
    "coalition|company|corporation|agency|organization|organisation|group|" +
    "gang|cult|society|restaurant|store|shop|brand|network|team|club|league|" +
    "union|association|foundation|charity|department|bureau|committee|party|" +
    "campaign|band|orchestra|label|school|college|university|crew|fleet|" +
    "police|government|family|house|business|firm|studio|hospital|clinic|" +
    "chain|franchise|conglomerate|enterprise|enterprises|industries)";

  const scores = { location: 0, item: 0, faction: 0 };

  // These cheap name-shape hints are safe even when the richer scan yielded.
  if (CODEX_LOCATION_HINTS.test(name)) scores.location += 2;
  if (CODEX_LOCATION_SUFFIX_HINTS.test(name)) scores.location += 2;
  if (CODEX_ITEM_HINTS.test(name)) scores.item += 2;
  if (CODEX_FACTION_HINTS.test(name)) scores.faction += 2;

  if (source) {
    const locationExplicit = [
      new RegExp(`\\b${locationKinds}\\s+(?:of\\s+|called\\s+|named\\s+|known\\s+as\\s+)?["“”'‘’]?${n}\\b`, "i"),
      new RegExp(`\\b${n}\\b\\s+(?:is|was|are|were)\\s+(?:a|an|the)\\s+(?:[a-z-]+\\s+){0,3}${locationKinds}\\b`, "i"),
      new RegExp(`\\b${n}(?:'s|’s)\\s+(?:a|an|the)\\s+(?:[a-z-]+\\s+){0,3}${locationKinds}\\b`, "i")
    ];
    if (locationExplicit.some(re => re.test(source))) scores.location += 6;

    const venueExplicit = [
      new RegExp(`\\b${n}\\b\\s*(?:,|—|-)\\s*(?:(?:the|a|an)\\s+)?(?:[a-z-]+\\s+){0,3}${venueKinds}\\b`, "i"),
      new RegExp(`\\b${n}\\b\\s+(?:is|was|are|were)\\s+(?:a|an|the)\\s+(?:[a-z-]+\\s+){0,3}${venueKinds}\\b`, "i")
    ];
    if (venueExplicit.some(re => re.test(source))) scores.location += 5;
    if (new RegExp(`\\b(?:enters?|entered|visits?|visited|walks?\\s+into|walked\\s+into|steps?\\s+into|stepped\\s+into|arrives?\\s+at|arrived\\s+at|goes?\\s+to|went\\s+to|heads?\\s+to|headed\\s+to|leaves?|left)\\s+(?:the\\s+)?${n}\\b`, "i").test(source)) scores.location += 5;
    if (new RegExp(`\\b(?:in|inside|outside|into|through|near|around|toward|towards|from|within|across|beneath|above|at)\\s+(?:the\\s+)?${n}\\b`, "i").test(source)) scores.location += 1;
    if (new RegExp(`\\b${n}\\b\\s+(?:lies?|sits?|stands?|is\\s+located|is\\s+situated|can\\s+be\\s+found)\\s+(?:in|near|on|beside|within|outside|north|south|east|west)\\b`, "i").test(source)) scores.location += 3;

    const itemExplicit = [
      new RegExp(`\\b${itemKinds}\\s+(?:called|named|known\\s+as|dubbed)\\s+["“”'‘’]?${n}\\b`, "i"),
      new RegExp(`\\b${n}\\b\\s+(?:is|was)\\s+(?:a|an|the)\\s+(?:[a-z-]+\\s+){0,2}${itemKinds}\\b`, "i")
    ];
    if (itemExplicit.some(re => re.test(source))) scores.item += 8;
    if (new RegExp(`\\b(?:wields?|holds?|wears?|uses?|draws?|grips?|picks?\\s+up|carries?|opens?|reads?|drives?|pilots?|boards?)\\s+(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+)?${n}\\b`, "i").test(source)) scores.item += 1;

    const nameHasFoodWord = codexGenericWords(name).some(w => CODEX_GENERIC_FOOD_WORDS.has(w));
    const directConsumption = new RegExp(
      `\\b(?:eats?|ate|drinks?|drank|sips?|sipped|tastes?|tasted|devours?|devoured|` +
      `samples?|sampled|tries?|tried)\\s+(?:the\\s+|a\\s+|an\\s+|some\\s+)?${n}\\b`, "i"
    );
    const orderedConsumable = new RegExp(
      `\\b(?:orders?|ordered)\\s+(?:the\\s+|a\\s+|an\\s+|some\\s+)?${n}\\b` +
      `(?=\\s+(?:from\\s+(?:the\\s+)?(?:restaurant|diner|bistro|caf[eé]|coffee\\s+shop|bakery|bar|pub|kitchen|menu)|with\\b|for\\s+(?:breakfast|lunch|dinner|dessert)|to\\s+(?:eat|drink)|[,.;!?]|$))`, "i"
    );
    const menuConsumable = new RegExp(
      `\\b${n}\\b[^\\n.!?]{0,48}\\b(?:dish|meal|curry|stew|soup|sandwich|pizza|burger|` +
      `dessert|cocktail|mocktail|beverage|drink|plate|bowl|serving|recipe|menu\\s+item|special)\\b`, "i"
    );
    if (directConsumption.test(source) || orderedConsumable.test(source)) scores.item += 5;
    if (nameHasFoodWord && menuConsumable.test(source)) scores.item += 4;

    if (new RegExp(`\\b${n}(?:'s|’s)\\s+(?:engine|motor|dashboard|dash|steering\\s+wheel|wheel|wheels|tires?|tyres?|windshield|windscreen|headlights?|taillights?|doors?|trunk|boot|hood|bonnet|chassis|transmission|gearbox|exhaust|cockpit|hull|thrusters?|reactor|controls?)\\b`, "i").test(source)) scores.item += 5;
    if (new RegExp(`\\b(?:drives?|drove|driving|parks?|parked|pilots?|piloted|boards?|boarded|rides?|rode|climbs?|climbed|gets?|got|hops?|hopped)\\s+(?:into\\s+|onto\\s+|aboard\\s+)?(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+)?${n}\\b`, "i").test(source)) scores.item += 3;

    const factionExplicit = [
      new RegExp(`\\b${factionKinds}\\s+(?:called|named|known\\s+as)\\s+["“”'‘’]?${n}\\b`, "i"),
      new RegExp(`\\b${n}\\b\\s+(?:is|was|are|were)\\s+(?:a|an|the)\\s+(?:[a-z-]+\\s+){0,2}${factionKinds}\\b`, "i"),
      new RegExp(`\\b${n}\\s+${factionKinds}\\b`, "i")
    ];
    if (factionExplicit.some(re => re.test(source))) scores.faction += 6;
    if (new RegExp(`\\b${n}\\b[^\\n.!?]{0,48}\\b(?:chain|franchise|corporation|company|business|brand|conglomerate|organization|organisation|network|enterprise|enterprises|industries)\\b`, "i").test(source)) scores.faction += 4;
    if (new RegExp(`\\b(?:works?|worked|employed|member|members|joined|joins|leads?|founded|owns?)\\s+(?:at|for|by|of)?\\s*(?:the\\s+)?${n}\\b`, "i").test(source)) scores.faction += 1;
    if (new RegExp(`\\b(?:members?|agents?|employees?|officers?|soldiers?|students?|staff)\\s+of\\s+(?:the\\s+)?${n}\\b|\\b${n}\\s+(?:members?|agents?|employees?|officers?|staff)\\b`, "i").test(source)) scores.faction += 2;
  }

  const order = ["location", "faction", "item"];
  const best = order.reduce((a, b) => scores[b] > scores[a] ? b : a);
  const bestScore = scores[best];
  const second = order.filter(t => t !== best).reduce((m, t) => Math.max(m, scores[t]), 0);

  if (bestScore < 3) return cacheStrongNonCharacterResult(cacheKey, null);
  return cacheStrongNonCharacterResult(cacheKey, { type: best, score: bestScore, margin: bestScore - second, scores });
}

// Direct scene-presence cues only. This intentionally does NOT call the
// expensive semantic typing helpers itself; callers that already did those
// checks can reuse this without doubling the regex workload.
function hasDirectCodexCharacterPresenceCue(name, text) {
  const source = boundedCodexSemanticText(text);
  if (!source || !name) return false;
  const n = escapeForRegex(name);
  const directCues = [
    new RegExp(`\\b(?:I\\s*(?:am|'m|’m)|my\\s+name\\s+is|name\\s*(?:is|'s|’s)|call\\s+me|this\\s+is|meet|known\\s+as|go\\s+by)\\s+["“”'‘’]?${n}\\b`, "i"),
    new RegExp(`\\b(?:you|he|she|they|we)\\s+(?:see|spot|notice|meet|find|face|approach|watch|hear)\\s+(?:the\\s+|a\\s+|an\\s+)?${n}\\b`, "i"),
    new RegExp(`\\b${n}(?:'s|’s)\\s+(?:eyes?|voice|hands?|face|expression|smile|gaze|shoulders?|breath|hair|fingers?|arms?|feet|heart|cheeks?|lips?|posture|jaw|stance|grip|step|footsteps?)\\b`, "i"),
    new RegExp(`\\b${n}\\b[^\\n.!?]{0,64}\\b(?:steps?|stepped|walks?|walked|approaches?|approached|enters?|entered|arrives?|arrived|comes?|came|sits?|sat|stands?|stood|leans?|leaned|reaches?|reached|turns?|turned|looks?|looked|glances?|glanced|stares?|stared|smiles?|smiled|frowns?|frowned|nods?|nodded|shrugs?|shrugged|runs?|ran|follows?|followed|kneels?|knelt|rises?|rose|flinches?|flinched|grabs?|grabbed|takes?|took|places?|placed|pushes?|pushed|pulls?|pulled|moves?|moved|laughs?|laughed|sighs?|sighed|winces?|winced|swallows?|swallowed|gestures?|gestured|speaks?|spoke)\\b`, "i"),
    new RegExp(`\\b(?:a|an|the)\\s+(?:young\\s+|old\\s+|elderly\\s+)?(?:girl|boy|woman|man|person|lady|gentleman|teenager|teen|child|youth|guard|soldier|knight|mage|wizard|witch|priest|priestess|captain|doctor|merchant|stranger|traveler|traveller|officer|detective|pilot|engineer|nurse|bartender|server|waiter|waitress|barista|cashier|clerk|receptionist|chef|cook|mechanic|driver|courier|medic|therapist|counselor|counsellor|neighbor|neighbour|roommate|coworker|colleague|manager|boss|assistant|owner|parent|mother|father|sister|brother|wife|husband|partner|friend|teacher|professor|student|lawyer|attorney|judge|athlete|coach|musician|singer|actor|artist|scientist|researcher|agent|android|robot|synthetic|AI|alien|creature|spirit|ghost|vampire|werewolf|superhero|hero|villain|elf|dwarf|orc|fae|demon|angel|dragon|deity|god|goddess|dog|cat|horse|animal|companion)\\s+(?:named|called)\\s+${n}\\b`, "i"),
    new RegExp(`\\b${n}\\b\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?|shouts?|calls?|adds?|admits?|explains?|insists?|snaps?|growls?|mutters?|laughs?|sighs?)\\s*[,.:!?-]?\\s*["“]`, "i"),
    new RegExp(`["”][^\\n]{0,40}\\b${n}\\b\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?|shouts?|adds?|admits?|explains?|insists?|snaps?|growls?|mutters?)\\b`, "i")
  ];
  return directCues.some(re => re.test(source));
}

function resolveCodexEntityType(name, text) {
  const live = boundedCodexSemanticText(text);
  const evidence = boundedCodexSemanticText(
    [codexEvidenceTextFor(name), live].filter(Boolean).join(" ")
  );
  const explicitCharacter = explicitCodexCharacterCue(name, evidence);
  const strongNonCharacter = strongCodexNonCharacterEvidence(name, evidence);

  // An explicit person introduction is the strongest signal. This preserves
  // intentionally unusual names such as River, Castle, Angel, or Coffee.
  if (explicitCharacter) return "character";
  if (strongNonCharacter) return strongNonCharacter.type;

  try {
    const codex = state && state.unsaid && state.unsaid.codex;
    if (codex) {
      if (codex.trustedEntities && codex.trustedEntities[name]) {
        return codex.trustedEntities[name];
      }
      if (codex.likelyCharacters && codex.likelyCharacters[name]) {
        return "character";
      }
      const dominant = dominantCodexType(name);
      if (dominant && dominant !== "character" && codexTypeVoteScore(name, dominant) >= 2) {
        return dominant;
      }
    }
  } catch (e) {}

  return classifyCodexEntryAfterSemanticChecks(name, evidence);
}

function reconcileCodexEntityType(name, text) {
  try {
    const codex = state && state.unsaid && state.unsaid.codex;
    if (!codex || !name) return null;
    const evidence = boundedCodexSemanticText(
      [codexEvidenceTextFor(name), typeof text === "string" ? text : ""]
        .filter(Boolean).join(" ")
    );
    const explicitCharacter = explicitCodexCharacterCue(name, evidence);
    const strongNonCharacter = strongCodexNonCharacterEvidence(name, evidence);

    if (explicitCharacter) {
      // A real on-screen identity cue is allowed to recover an unusual
      // character name that previously looked like a place/item word.
      if (codex.trustedEntities && codex.trustedEntities[name]) {
        delete codex.trustedEntities[name];
      }
      return "character";
    }

    if (strongNonCharacter) {
      codex.trustedEntities[name] = strongNonCharacter.type;
      codex.observedTypes[name] = strongNonCharacter.type;

      // Self-heal old false character flags. These were sticky in previous
      // builds and could make a place such as Thornhaven permanently use the
      // Character template even after the story explicitly called it a place.
      if (codex.likelyCharacters[name]) delete codex.likelyCharacters[name];
      if (typeof codex.introducedTurn[name] !== "undefined") delete codex.introducedTurn[name];
      if (typeof codex.appearanceTurns[name] !== "undefined") delete codex.appearanceTurns[name];
      return strongNonCharacter.type;
    }

    // Do not call resolveCodexEntityType() here: it would run the same strong
    // semantic regexes again. Reuse the already-clean evidence and continue
    // from the cheap persistent-state / fallback stage instead.
    if (codex.trustedEntities && codex.trustedEntities[name]) {
      return codex.trustedEntities[name];
    }
    if (codex.likelyCharacters && codex.likelyCharacters[name]) {
      return "character";
    }
    const dominant = dominantCodexType(name);
    if (dominant && dominant !== "character" && codexTypeVoteScore(name, dominant) >= 2) {
      return dominant;
    }
    return classifyCodexEntryAfterSemanticChecks(name, evidence);
  } catch (e) {
    return null;
  }
}

function isLikelyCharacterIntroduction(name, text) {
  const source = boundedCodexSemanticText(text);
  if (!source || !name) return false;

  // Strong identity cues beat noun-shaped names ("I'm River"), while strong
  // location/item/faction evidence beats generic action verbs ("Thornhaven's
  // a quiet place", "Coffee sits on the table"). This keeps broad presence
  // heuristics from turning places and objects into people.
  if (explicitCodexCharacterCue(name, source)) return true;
  const strongNonCharacter = strongCodexNonCharacterEvidence(name, source);
  if (strongNonCharacter && strongNonCharacter.score >= 3) return false;

  // Do not let generic movement/dialogue cues promote an ordinary sentence
  // starter into a person. A stop-word-like name must first be explicitly
  // named ("I'm Six", "a woman named Six", etc.).
  if (!normalizeCodexCandidate(name, source) &&
      !isEstablishedExplicitCodexCharacter(name)) return false;

  return hasDirectCodexCharacterPresenceCue(name, source);
}

function codexEvidenceSentences(name, source) {
  if (!name || !source) return [];
  const chunks = String(source).match(/[^.!?\n]+(?:[.!?]+|$)/g) || [String(source)];
  const results = [];
  for (const raw of chunks) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || !nameAppears(name, line)) continue;
    const clipped = line.length > CODEX_EVIDENCE_SNIPPET_LENGTH
      ? line.slice(0, CODEX_EVIDENCE_SNIPPET_LENGTH - 1).trimEnd() + "…"
      : line;
    if (!results.includes(clipped)) results.push(clipped);
    if (results.length >= 2) break;
  }
  return results;
}

function recordCodexEvidence(name, source, countsAsAppearance) {
  const codex = state.unsaid.codex;
  if (!codex.evidence[name]) codex.evidence[name] = [];
  const snippets = codexEvidenceSentences(name, source);
  snippets.forEach(snippet => {
    const duplicate = codex.evidence[name].some(item =>
      item && typeof item.text === "string" && item.text.toLowerCase() === snippet.toLowerCase()
    );
    if (!duplicate) codex.evidence[name].push({ turn: state.unsaid.turn, text: snippet });
  });
  if (codex.evidence[name].length > CODEX_EVIDENCE_PER_NAME) {
    codex.evidence[name] = codex.evidence[name].slice(-CODEX_EVIDENCE_PER_NAME);
  }

  if (countsAsAppearance) {
    if (!Array.isArray(codex.appearanceTurns[name])) codex.appearanceTurns[name] = [];
    if (!codex.appearanceTurns[name].includes(state.unsaid.turn)) {
      codex.appearanceTurns[name].push(state.unsaid.turn);
      if (codex.appearanceTurns[name].length > 30) {
        codex.appearanceTurns[name] = codex.appearanceTurns[name].slice(-30);
      }
    }
  }
}

function codexAppearanceCount(name) {
  const turns = state.unsaid.codex.appearanceTurns && state.unsaid.codex.appearanceTurns[name];
  return Array.isArray(turns) ? turns.length : 0;
}

function resolveCodexTrackingKey(name, source) {
  const codex = state && state.unsaid && state.unsaid.codex;
  if (!codex || !name) return name;
  const keys = Object.keys(codex.mentionCounts || {});
  const exact = keys.find(k => k.toLowerCase() === String(name).toLowerCase());
  if (exact) return exact;

  const matches = keys.filter(k => isSameCardEntity(k, name));
  if (matches.length !== 1) return name;

  const existing = matches[0];
  const newWords = String(name).trim().split(/\s+/).filter(Boolean).length;
  const oldWords = String(existing).trim().split(/\s+/).filter(Boolean).length;
  const oldType = (codex.likelyCharacters && codex.likelyCharacters[existing])
    ? "character"
    : ((codex.observedTypes && codex.observedTypes[existing]) || null);
  const newType = classifyCodexEntry(name, source || "");

  // A longer name that changes entity kind is usually a distinct entity,
  // not an alias: Rose (character) vs Rose Garden (location), Phoenix
  // (character) vs Phoenix Project (faction), etc.
  if (newWords > oldWords && oldType && newType && oldType !== newType) return name;

  return existing;
}

function trackMentions(text, observeIntroductions) {
  if (!state.unsaid || !state.unsaid.codex) return;
  const source = typeof text === "string" ? text : "";
  if (!source) return;

  const canConfirmIntroductions = observeIntroductions !== false;
  const matches = source.match(CODEX_TITLE_ABBREV_REGEX) || [];
  const seenThisPass = new Set();
  const actionEpoch = (typeof info !== "undefined" && info && Number.isInteger(info.actionCount))
    ? info.actionCount
    : state.unsaid.turn;

  matches.forEach(raw => {
    let name = normalizeCodexCandidate(raw, source);

    // Once an unusual stop-word-like character was explicitly introduced,
    // keep recognizing that established name on later turns. The original
    // explicit naming evidence remains the trust anchor; this does not
    // resurrect old junk candidates that lack such evidence.
    if (!name) {
      const rawName = stripPossessive(String(raw || "").trim());
      const establishedCharacter = Object.keys(state.unsaid.codex.likelyCharacters || {})
        .find(k => isEstablishedExplicitCodexCharacter(k) && isSameCardEntity(k, rawName));
      const establishedEntity = Object.keys(state.unsaid.codex.trustedEntities || {})
        .find(k => isSameCardEntity(k, rawName));
      if (establishedCharacter) name = establishedCharacter;
      else if (establishedEntity) name = establishedEntity;
    }
    if (!name) return;

    const key = resolveCodexTrackingKey(name, source) || name;
    if (seenThisPass.has(key)) return;
    seenThisPass.add(key);

    // If this resolves unambiguously to an existing Codex-managed card,
    // preserve the exact sentence as future refresh evidence. This also
    // catches safe aliases such as "Harlan" -> "Harlan Voss", which a
    // full-title-only scan would otherwise miss.
    if (canConfirmIntroductions) {
      const existingCard = findStoryCardForEntity(name) || findStoryCardForEntity(key);
      if (existingCard &&
          (state.unsaid.codex.cardMeta[existingCard.title] || codexLogHasEntity(existingCard.title))) {
        const aliasSnippets = codexEvidenceSentences(name, source);
        aliasSnippets.forEach(snippet =>
          recordCodexCardUpdateEvidence(existingCard.title, existingCard, snippet, actionEpoch)
        );
      }
    }

    // Count at most once per action epoch. Repeating a name five times in one
    // paragraph should not make it look five turns more established.
    if (state.unsaid.codex.lastMentionTurn[key] !== actionEpoch) {
      state.unsaid.codex.mentionCounts[key] = (state.unsaid.codex.mentionCounts[key] || 0) + 1;
      state.unsaid.codex.lastMentionTurn[key] = actionEpoch;
    }
    if (typeof state.unsaid.codex.firstSeenTurn[key] !== "number") {
      state.unsaid.codex.firstSeenTurn[key] = state.unsaid.turn;
    }

    // Reconcile persistent type state before deciding whether this is an
    // on-screen character appearance. Previous builds made likelyCharacters
    // sticky, so a place incorrectly promoted once could stay a character
    // forever. Strong semantic evidence is now allowed to repair that state.
    const reconciledType = reconcileCodexEntityType(key, source);
    const presence = canConfirmIntroductions &&
      reconciledType !== "location" &&
      reconciledType !== "item" &&
      reconciledType !== "faction" &&
      isLikelyCharacterIntroduction(key, source);
    const trustedType = state.unsaid.codex.trustedEntities[key] || null;
    const observedType = presence
      ? "character"
      : (trustedType || reconciledType || classifyCodexEntry(key, source));
    const evidenceStrength = codexEvidenceStrength(key, source, observedType, presence);
    if (!presence && hasExplicitCodexNamingCue(key, source) && observedType !== "character") {
      state.unsaid.codex.trustedEntities[key] = observedType;
    }
    recordCodexConfidence(key, observedType, evidenceStrength, actionEpoch);

    if (presence) {
      state.unsaid.codex.observedTypes[key] = "character";
    } else if (state.unsaid.codex.trustedEntities[key]) {
      state.unsaid.codex.observedTypes[key] = state.unsaid.codex.trustedEntities[key];
    } else if (state.unsaid.codex.likelyCharacters[key]) {
      state.unsaid.codex.observedTypes[key] = "character";
    } else {
      state.unsaid.codex.observedTypes[key] = dominantCodexType(key);
    }

    if (presence) {
      if (!state.unsaid.codex.likelyCharacters[key]) {
        state.unsaid.codex.likelyCharacters[key] = true;
        state.unsaid.codex.introducedTurn[key] = state.unsaid.turn;
      }
      state.unsaid.codex.observedTypes[key] = "character";
      recordCodexEvidence(key, source, true);
    } else if (canConfirmIntroductions && state.unsaid.codex.likelyCharacters[key]) {
      // Once a person has genuinely appeared, later references are still
      // useful evidence even if this specific sentence is off-screen.
      recordCodexEvidence(key, source, false);
    } else if (canConfirmIntroductions && state.unsaid.codex.observedTypes[key] !== "character" && evidenceStrength >= 2) {
      // Keep non-character evidence only when the sentence provides more
      // than capitalization alone. This prevents repeated common prose from
      // becoming a durable item/location/faction candidate.
      recordCodexEvidence(key, source, false);
    }
  });

  // Existing Codex-made cards keep collecting a small, separate evidence
  // bank so they can refresh later without re-entering "new card" tracking.
  // Only Output/story passes confirm this evidence; raw commands/input do not.
  if (canConfirmIntroductions) {
    trackCodexCardUpdateEvidence(source, actionEpoch);
  }

  pruneMentionCounts(CODEX_IO_PRUNE_BATCH);
}


function pruneMentionCounts(maxChecks) {
  const codex = state.unsaid.codex;
  const counts = codex.mentionCounts;
  if (!counts || typeof counts !== "object") return;

  let keys = Object.keys(counts);

  // Emergency trim FIRST, before doing any fuzzy Story Card matching. Old
  // saves from buggy builds can contain hundreds or thousands of stale names;
  // trying to semantically validate all of them in a single isolated-VM pass
  // is exactly the kind of work that can time out before cleanup finishes.
  if (keys.length > MENTION_TRACKING_HARD_CAP) {
    keys
      .sort((a, b) => {
        const aProtected = codex.likelyCharacters[a] ? 1 : 0;
        const bProtected = codex.likelyCharacters[b] ? 1 : 0;
        if (aProtected !== bProtected) return bProtected - aProtected;
        const countDiff = (counts[b] || 0) - (counts[a] || 0);
        if (countDiff !== 0) return countDiff;
        return (codex.firstSeenTurn[b] || 0) - (codex.firstSeenTurn[a] || 0);
      })
      .slice(MENTION_TRACKING_HARD_CAP)
      .forEach(forgetMentionTracking);
    keys = Object.keys(counts);
  }

  // Every hook uses a small rotating maintenance batch. Full-state cleanup in
  // one pass becomes O(candidates × Story Cards) and can exceed the platform
  // timeout on large scenarios; rotation self-heals the same state over a few
  // turns without sacrificing the current generation.
  let inspect = keys;
  const limit = (typeof maxChecks === "number" && isFinite(maxChecks) && maxChecks > 0)
    ? Math.max(1, Math.floor(maxChecks))
    : 0;
  if (limit && keys.length > limit) {
    const cursor = Math.max(0, Math.floor(codex.pruneCursor || 0)) % keys.length;
    inspect = [];
    for (let i = 0; i < limit; i++) inspect.push(keys[(cursor + i) % keys.length]);
    codex.pruneCursor = (cursor + limit) % keys.length;
  } else {
    codex.pruneCursor = 0;
  }

  inspect.forEach(name => {
    if (!(name in counts)) return;
    const existingMatches = typeof storyCardMatchesForEntity === "function"
      ? storyCardMatchesForEntity(name)
      : [];
    if (existingMatches.length > 0 || !!findStoryCardForEntity(name)) {
      forgetMentionTracking(name);
      return;
    }

    // Clean up stale garbage left in persistent state by older builds.
    if (!isSafeTrackedCodexName(name)) {
      forgetMentionTracking(name);
    }
  });

  keys = Object.keys(counts);
  if (keys.length > MENTION_TRACKING_CAP) {
    keys
      .sort((a, b) => {
        const aProtected = codex.likelyCharacters[a] ? 1 : 0;
        const bProtected = codex.likelyCharacters[b] ? 1 : 0;
        if (aProtected !== bProtected) return aProtected - bProtected;
        const countDiff = (counts[a] || 0) - (counts[b] || 0);
        if (countDiff !== 0) return countDiff;
        return (codex.firstSeenTurn[a] || 0) - (codex.firstSeenTurn[b] || 0);
      })
      .slice(0, keys.length - MENTION_TRACKING_CAP)
      .forEach(forgetMentionTracking);
  }

  const attempts = codex.attempts;
  Object.keys(attempts).forEach(name => {
    if (!(name in counts)) delete attempts[name];
  });
}

function classifyCodexEntry(name, text) {
  const source = boundedCodexSemanticText(text);
  if (!name) return "character";

  // Perform expensive semantic checks exactly once. Older builds called
  // isLikelyCharacterIntroduction() here, which repeated both of these
  // full regex suites before doing the actual presence test.
  if (explicitCodexCharacterCue(name, source)) return "character";
  const strongNonCharacter = strongCodexNonCharacterEvidence(name, source);
  if (strongNonCharacter) return strongNonCharacter.type;

  return classifyCodexEntryAfterSemanticChecks(name, source);
}

function classifyCodexEntryAfterSemanticChecks(name, text) {
  const source = boundedCodexSemanticText(text);
  if (!name) return "character";

  if (hasDirectCodexCharacterPresenceCue(name, source)) return "character";

  if (CODEX_LOCATION_HINTS.test(name)) return "location";
  if (CODEX_LOCATION_SUFFIX_HINTS.test(name)) return "location";
  if (CODEX_FACTION_HINTS.test(name)) return "faction";
  if (CODEX_ITEM_HINTS.test(name)) return "item";

  const n = escapeForRegex(name);
  const nearLocation = new RegExp(`(in|inside|outside|through|into)\\s+(?:the\\s+)?${n}\\b`, "i");
  const describedAsLocation = new RegExp(`\\b(?:location|place|site|venue|garden|grove|park|plaza|square|city|town|village|hamlet|kingdom|realm|district|region|port|harbor|harbour|forest|woods|mountain|valley|island|station|outpost|colony|settlement|tavern|inn|hotel|motel|castle|fortress|temple|academy|school|college|university|campus|facility|base|office|apartment|house|home|warehouse|factory|farm|ranch|arena|stadium|courtroom|courthouse|prison|jail|theater|theatre|museum|library|mall|market|beach|cave|mine|ruins?|cemetery|graveyard|neighbou?rhood|suburb)\\s+(?:of|called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:location|place|site|venue|garden|grove|park|plaza|square|city|town|village|hamlet|kingdom|realm|district|region|port|harbor|harbour|forest|station|outpost|colony|settlement|tavern|inn|hotel|motel|castle|fortress|temple|academy|school|college|university|campus|facility|base|office|apartment|house|home|warehouse|factory|farm|ranch|arena|stadium|courtroom|courthouse|prison|jail|theater|theatre|museum|library|mall|market|beach|cave|mine|ruins?|cemetery|graveyard|neighbou?rhood|suburb)\\b`, "i");
  if (nearLocation.test(source) || describedAsLocation.test(source)) return "location";

  const nearItem = new RegExp(`(wields?|holds?|wearing|wears|wore|donned|dressed\\s+in|put\\s+on|slipped\\s+into|using|uses|draws?|grips?|picks?\\s+up|holsters?|drove|drives|driving|parked|rode|riding|climbs?\\s+into|climbed\\s+into|gets?\\s+into|got\\s+into|hops?\\s+into|hopped\\s+into|flew|flying|piloted|piloting|boarded|boarding|launched|launching|docked|docking)\\s+(the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+)?${n}\\b`, "i");
  const describedAsItem = new RegExp(`\\b(?:sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|artifact|device|weapon|tool|key|book|tome|relic|ship|starship|vehicle|car|truck|motorcycle|bicycle|train|boat|robot|android|mech|phone|computer|laptop|camera|instrument|guitar|document|letter|contract|map|medicine|medication|serum)\\s+(?:called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|artifact|device|weapon|tool|key|book|tome|relic|ship|starship|vehicle|car|truck|motorcycle|bicycle|train|boat|robot|android|mech|phone|computer|laptop|camera|instrument|guitar|document|letter|contract|map|medicine|medication|serum)\\b`, "i");
  if (nearItem.test(source) || describedAsItem.test(source)) return "item";

  // Ordinary food words are filtered from automatic discovery, but a
  // deliberately named/signature consumable can still be a legitimate item
  // card when the story explicitly presents it as one.
  const describedAsConsumable = new RegExp(
    `\\b(?:dish|meal|food|drink|beverage|cocktail|mocktail|dessert|recipe|menu\\s+item|special)\\s+` +
    `(?:called|named|known\\s+as|dubbed)\\s+["“”'‘’]?${n}\\b|` +
    `\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?` +
    `(?:dish|meal|food|drink|beverage|cocktail|mocktail|dessert|recipe|menu\\s+item|special)\\b`,
    "i"
  );
  if (describedAsConsumable.test(source)) return "item";

  // A name with no recognizable keyword in itself ("Dragon's Breath Fried
  // Chicken" contains no obvious business word) can still be caught from
  // how the story actually refers to it — ordering food from it, working
  // at it, being a customer of it all point at an organization/venue.
  // Deliberately specific phrases only — a bare "at"/"from" would also
  // match ordinary location references ("stood at the harbor") and
  // misclassify those instead.
  const nearBusiness = new RegExp(`(ordered\\s+from|ate\\s+at|dined\\s+at|grabbed\\s+(food\\s+)?from|work(?:s|ed)?\\s+(at|for)|employed\\s+(at|by)|shops?\\s+at|shopping\\s+at)\\s+${escapeForRegex(name)}\\b`, "i");
  if (nearBusiness.test(source)) return "faction";

  // A generic name ("Silver Hand", "VyrMusic") is often immediately
  // followed by the word that actually classifies it ("Silver Hand
  // guild", "VyrMusic app") — the hint checks above only look inside the
  // name itself, so this catches the same signal sitting just outside it.
  const followedByFactionWord = new RegExp(`${n}\\s+(order|guild|alliance|empire|faction|clan|brotherhood|council|syndicate|coalition|army|legion|cult|society|corporation|compan(?:y|ies)|division|agency|federation|dynasty|tribe|app|platform|website|network|restaurant|diner|caf[eé]|bakery|store|shop|team|club|league|union|association|foundation|charity|department|bureau|committee|party|campaign|band|orchestra|label|school|college|university|crew|fleet|police|government)\\b`, "i");
  const describedAsFaction = new RegExp(`\\b(?:order|guild|alliance|faction|clan|brotherhood|council|syndicate|coalition|company|corporation|agency|organization|organisation|group|gang|cult|society|restaurant|store|shop|brand|network|team|club|league|union|association|foundation|charity|department|bureau|committee|party|campaign|band|orchestra|label|school|college|university|crew|fleet|police|government)\\s+(?:called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:order|guild|alliance|faction|clan|brotherhood|council|syndicate|coalition|company|corporation|agency|organization|organisation|group|gang|cult|society|restaurant|store|shop|brand|network|team|club|league|union|association|foundation|charity|department|bureau|committee|party|campaign|band|orchestra|label|school|college|university|crew|fleet|police|government)\\b`, "i");
  if (followedByFactionWord.test(source) || describedAsFaction.test(source)) return "faction";

  return "character";
}

// A courtesy title alone doesn't identify anyone — "Mr. Carver" and
// "Ms. Ogena" refer to the same people as "Carver"/"Carver Graywolf" and
// "Jessica Ogena," but the word-subset check below couldn't see that
// whenever the title word added an extra word beyond what the full name
// already had, since neither side was then a subset of the other.
// Confirmed directly from a real player's status report: "Mr. Carver,"
// "Mr. Graywolf," "Ms. Ogena," and "Miss Ogena" were all separately
// burning their own 5-attempt Codex retry budget as if each were a
// distinct, never-before-seen person, alongside "Carver," "Carver
// Graywolf," and "Jessica Ogena" already being tracked under their own
// names — pure waste on names that were never actually new. Stripping a
// leading courtesy title before comparing closes that gap the same way
// for every matching/dedup use of this function at once.
var COURTESY_TITLE_WORDS = new Set(["mr", "mrs", "ms", "miss", "dr", "sir", "lady", "lord", "madam", "mx"]);
function stripCourtesyTitle(words) {
  if (words.length > 1 && COURTESY_TITLE_WORDS.has(words[0].replace(/\.$/, ""))) {
    return words.slice(1);
  }
  return words;
}

function isSameCardEntity(cardTitle, candidateName) {
  if (!cardTitle || !candidateName || isOwnCard(cardTitle)) return false;

  const normalizeWords = (value) => {
    const cleaned = String(value)
      .toLowerCase()
      .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripCourtesyTitle(cleaned.split(" ").filter(Boolean));
  };

  const titleWords = normalizeWords(cardTitle);
  const nameWords = normalizeWords(candidateName);
  if (!titleWords.length || !nameWords.length) return false;
  if (titleWords.join(" ") === nameWords.join(" ")) return true;

  const shorter = titleWords.length <= nameWords.length ? titleWords : nameWords;
  const longer = titleWords.length <= nameWords.length ? nameWords : titleWords;

  // Require the shorter alias to appear contiguously. This keeps useful
  // "Harlan" <-> "Harlan Voss" matching while avoiding arbitrary word-set
  // matches such as reversed or interleaved names.
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    let allMatch = true;
    for (let j = 0; j < shorter.length; j++) {
      if (longer[i + j] !== shorter[j]) { allMatch = false; break; }
    }
    if (allMatch) return shorter.length > 1 || shorter[0].length >= 3;
  }
  return false;
}

var CARD_TYPE_DISPLAY = { character: "Character", location: "Location", item: "Item", faction: "Faction" };
var UNSAID_AMBIGUITY_LOGGED = Object.create(null);
function storyCardMatchesForEntity(name) {
  if (!name || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return [];

  const clean = (value) => String(value || "")
    .toLowerCase()
    .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Exact card titles always outrank trigger aliases. A common scenario has
  // one canonical card titled "Silvermane" plus several other cards that use
  // Silvermane as a relationship/activation key. Older builds merged all of
  // those into one 5-card "ambiguity" and then refused to update the real card.
  const aliasKey = clean(name);
  const exactTitleMatches = [];
  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && card.title && !isOwnCard(card.title) && clean(card.title) === aliasKey) exactTitleMatches.push(card);
  }
  if (exactTitleMatches.length) return exactTitleMatches;

  // Creator-authored trigger aliases use the same per-hook identity index.
  if (typeof buildUnsaidAliasIndex === "function") {
    const index = buildUnsaidAliasIndex();
    const direct = index && index.aliasToCards && index.aliasToCards[aliasKey];
    if (direct && direct.length) return direct.slice();
  }

  const wantedWordCount = clean(name).split(" ").filter(Boolean).length;
  return storyCards.filter(card => {
    if (!card || !card.title || !isSameCardEntity(card.title, name)) return false;
    // Direction matters for lookup. "Harlan" may intentionally refer to an
    // existing "Harlan Voss" card, but a longer new entity such as "Rose
    // Garden" must not collapse onto an existing one-word "Rose" card.
    const cardWordCount = clean(card.title).split(" ").filter(Boolean).length;
    return cardWordCount >= wantedWordCount;
  });
}

function findStoryCardForEntity(name) {
  const matches = storyCardMatchesForEntity(name);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    try {
      const ambiguityKey = normalizeUnsaidIdentity(name) + "|" + matches.length;
      if (!UNSAID_AMBIGUITY_LOGGED[ambiguityKey] && typeof Library !== "undefined" && Library.safeLog) {
        UNSAID_AMBIGUITY_LOGGED[ambiguityKey] = true;
        Library.safeLog(`[UNSPOKEN TURNS] Ambiguous Story Card match for "${name}" (${matches.length} cards) — automatic writes skipped until the ambiguity is resolved.`);
      }
    } catch (e) {}
  }
  return null;
}

function platformType(kind) {
  return CARD_TYPE_DISPLAY[kind] || kind;
}
function isCardOfKind(card, kind) {
  return !!card && typeof card.type === "string" && card.type.toLowerCase() === kind.toLowerCase();
}

function excludedNames(cfg) {
  const names = [];
  if (cfg.playerName) names.push(cfg.playerName);
  if (typeof info !== "undefined" && info) {
    if (Array.isArray(info.characters)) {
      info.characters.forEach(c => {
        if (typeof c === "string") names.push(c);
        else if (c && c.name) names.push(c.name);
      });
    }
    if (Array.isArray(info.characterNames)) {
      info.characterNames.forEach(n => { if (typeof n === "string") names.push(n); });
    }
  }
  return names;
}


function normalizeCodexGeneratedEntry(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function codexLoggedEntityNameSet() {
  const names = new Set();
  if (typeof storyCards === "undefined" || !Array.isArray(storyCards)) return names;
  storyCards.forEach(card => {
    if (!card || typeof card.title !== "string" || card.title.indexOf("UNSAID Codex Log — ") !== 0) return;
    String(card.description || "").split("\n").forEach(line => {
      const loggedName = line.split(" — ")[0].trim().toLowerCase();
      if (loggedName) names.add(loggedName);
    });
  });
  return names;
}

function codexLogHasEntity(name) {
  if (!name || typeof storyCards === "undefined" || !Array.isArray(storyCards)) return false;
  const wanted = String(name).toLowerCase().trim();
  return storyCards.some(card => {
    if (!card || typeof card.title !== "string" || card.title.indexOf("UNSAID Codex Log — ") !== 0) return false;
    return String(card.description || "")
      .split("\n")
      .map(line => line.split(" — ")[0].trim().toLowerCase())
      .some(entryName => entryName === wanted);
  });
}

function codexKindFromExistingCard(card, name) {
  if (!card) return "character";
  const raw = String(card.type || "").trim().toLowerCase();
  const rawCharacter = raw === "character";
  if (raw === "location") return "location";
  if (raw === "item") return "item";
  if (raw === "faction") return "faction";

  const entry = String(card.entry || "");
  const semanticNonCharacter = strongCodexNonCharacterEvidence(name || card.title, entry);
  if (semanticNonCharacter && semanticNonCharacter.type) return semanticNonCharacter.type;

  // Repair the common "place generated with Character labels" failure even
  // when the entity name itself is ambiguous. The content is decisive here:
  // Race: Human settlement / Background: A remote village are not person
  // traits, regardless of the platform type currently stored on the card.
  const placeAsCharacterSignal =
    /^\s*(?:Race|Species|Nature)\s*[:=]\s*[^\n]*(?:settlement|village|town|city|hamlet|kingdom|realm|district|region|colony|outpost|tavern|inn|hotel|castle|fortress|temple|school|campus|station|port|harbou?r|forest|woods|island|mountain|valley|building|neighbou?rhood|suburb|farm|ranch|arena|stadium|hospital|clinic)\b/im.test(entry) ||
    /^\s*(?:Background|Appearance|Description)\s*[:=]\s*(?:an?\s+|the\s+)?(?:remote\s+|small\s+|large\s+|ancient\s+|old\s+|modern\s+|isolated\s+|coastal\s+|rural\s+|urban\s+|walled\s+|hidden\s+|quiet\s+|grim\s+|ruined\s+|abandoned\s+|sprawling\s+)*(?:settlement|village|town|city|hamlet|district|region|kingdom|realm|colony|outpost|tavern|inn|forest|woods|island|station|port|building)\b/im.test(entry);
  if (placeAsCharacterSignal) return "location";

  const locationFields = (entry.match(/^\s*(?:Location|Key Locations|Historical Events)\s*[:=]/gim) || []).length;
  const itemFields = (entry.match(/^\s*(?:Properties|Origin)\s*[:=]/gim) || []).length;
  const characterFields = (entry.match(/^\s*(?:Race|Species|Nature|Strength Level|Personality|Background|Appearance|Abilities|Weaknesses|Relationships)\s*[:=]/gim) || []).length;
  if (locationFields >= 2) return "location";
  if (itemFields >= 2) return "item";
  if (characterFields >= 2 || rawCharacter) return "character";

  const inferred = reconcileCodexEntityType(name || card.title, entry) ||
    resolveCodexEntityType(name || card.title, entry);
  return inferred || "faction";
}


function codexManagedCardKey(name, card) {
  if (!state.unsaid || !state.unsaid.codex) return String((card && card.title) || name || "").trim();
  const codex = state.unsaid.codex;
  const preferred = String((card && card.title) || name || "").trim();
  if (!preferred) return preferred;

  const stores = [
    codex.cardMeta,
    codex.cardUpdateEvidence,
    codex.cardUpdateLastSeenTurn
  ].filter(store => store && typeof store === "object");
  const keys = new Set();
  stores.forEach(store => Object.keys(store).forEach(k => keys.add(k)));
  const existing = [...keys].find(k => k.toLowerCase() === preferred.toLowerCase());
  if (!existing || existing === preferred) return preferred;

  // Migrate case-only key drift to the live Story Card title. Older builds
  // could store metadata under whichever capitalization happened to be seen
  // first, while later evidence used card.title, splitting one card's state
  // across two keys.
  stores.forEach(store => {
    if (!Object.prototype.hasOwnProperty.call(store, existing)) return;
    if (!Object.prototype.hasOwnProperty.call(store, preferred)) {
      store[preferred] = store[existing];
    } else if (store === codex.cardUpdateEvidence &&
               Array.isArray(store[preferred]) && Array.isArray(store[existing])) {
      const merged = store[preferred].concat(store[existing]);
      const seen = new Set();
      store[preferred] = merged.filter(item => {
        const key = item && (item.normalized || item.text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(-CODEX_CARD_UPDATE_EVIDENCE_LIMIT);
    }
    delete store[existing];
  });
  return preferred;
}

function ensureCodexCardMeta(name, card, type) {
  if (!state.unsaid || !state.unsaid.codex || !name || !card) return null;
  const codex = state.unsaid.codex;
  if (!codex.cardMeta || typeof codex.cardMeta !== "object") codex.cardMeta = {};
  if (!codex.cardUpdateEvidence || typeof codex.cardUpdateEvidence !== "object") codex.cardUpdateEvidence = {};
  if (!codex.cardUpdateLastSeenTurn || typeof codex.cardUpdateLastSeenTurn !== "object") codex.cardUpdateLastSeenTurn = {};

  const key = codexManagedCardKey(name, card);

  if (!codex.cardMeta[key]) {
    // Only adopt an old card into automatic refresh tracking when the Codex
    // log says this script created it. Hand-authored Story Cards are never
    // silently enrolled into overwrite behavior.
    if (!codexLogHasEntity(name) && !codexLogHasEntity(card.title)) return null;
    codex.cardMeta[key] = {
      type: type || codexKindFromExistingCard(card, name),
      lastGeneratedEntry: String(card.entry || ""),
      lastGeneratedCardType: String(card.type || ""),
      lastGeneratedTurn: state.unsaid.turn,
      lastRefreshTurn: state.unsaid.turn,
      updateCount: 0,
      refreshFailures: 0,
      lastRefreshAttemptTurn: -999999,
      manualEditProtected: false,
      adoptedBaseline: true
    };
  }

  const meta = codex.cardMeta[key];
  if (!meta.type) meta.type = type || codexKindFromExistingCard(card, name);
  if (typeof meta.lastGeneratedEntry !== "string") meta.lastGeneratedEntry = String(card.entry || "");
  if (typeof meta.lastGeneratedCardType !== "string") meta.lastGeneratedCardType = String(card.type || "");
  if (typeof meta.lastGeneratedTurn !== "number") meta.lastGeneratedTurn = state.unsaid.turn;
  if (typeof meta.lastRefreshTurn !== "number") meta.lastRefreshTurn = meta.lastGeneratedTurn;
  if (typeof meta.updateCount !== "number") meta.updateCount = 0;
  if (typeof meta.refreshFailures !== "number" || meta.refreshFailures < 0) meta.refreshFailures = 0;
  if (typeof meta.lastRefreshAttemptTurn !== "number") meta.lastRefreshAttemptTurn = -999999;
  if (typeof meta.manualEditProtected !== "boolean") meta.manualEditProtected = false;
  return meta;
}

function codexCardHasManualEdit(name, card, cfg) {
  const meta = ensureCodexCardMeta(name, card);
  if (!meta) return false;
  if (!cfg || !cfg.codexProtectManualEdits) return false;

  const current = normalizeCodexGeneratedEntry(card.entry);
  const generated = normalizeCodexGeneratedEntry(meta.lastGeneratedEntry);
  const currentType = String(card.type || "").trim().toLowerCase();
  const generatedType = String(meta.lastGeneratedCardType || "").trim().toLowerCase();
  const entryChanged = !!generated && current !== generated;
  const typeChanged = !!generatedType && currentType !== generatedType;
  if (entryChanged || typeChanged) {
    meta.manualEditProtected = true;
    return true;
  }

  // If a player restores both the script-generated entry and type exactly,
  // automatic refresh can safely resume without requiring a reset command.
  if (meta.manualEditProtected && current === generated && currentType === generatedType) {
    meta.manualEditProtected = false;
  }
  return !!meta.manualEditProtected;
}

function codexRefreshEvidenceWeight(text, type) {
  const source = String(text || "");
  const kind = String(type || "").toLowerCase();
  let weight = 1;

  // Strong changes that alter durable canon for almost any entity. Routine
  // movement ("arrives", "returns", "opens the door") is intentionally not
  // here; older weighting treated those as meaningful updates and made busy
  // characters refresh far too often.
  if (/\b(?:no longer|turns? out|actually|formerly|becomes?|became|changes?|changed|renamed|destroyed|rebuilt|restored|lost|loses?|gains?|gained|acquires?|acquired|inherits?|inherited|promoted|demoted|betrays?|betrayed|allies?|allied|breaks?\s+up|married|divorced|engaged|pregnant|injured|wounded|scarred|healed|dies?|died|killed|missing|captured|freed|rescued|arrested|released|exiled|crowned|elected|appointed|fired|hired|quits?|retired|disbanded|dissolved|merged|split)\b/i.test(source)) {
    weight += 2;
  }

  // Knowledge/revelation changes are durable only when the sentence signals
  // an actual discovery/admission rather than ordinary dialogue.
  if (/\b(?:reveals?|revealed|discovers?|discovered|learns?|learned|admits?|admitted|confesses?|confessed|remembers?|remembered|forgets?|forgot|identity|true name|real name|secret is|was actually)\b/i.test(source)) {
    weight += 1;
  }

  if (kind === "character") {
    if (/\b(?:joins?|joined|leaves?|left)\s+(?:the\s+)?(?:team|group|guild|order|crew|company|agency|faction|party|school|unit|family)\b/i.test(source)) weight += 2;
    if (/\b(?:relationship|friend|ally|enemy|partner|spouse|husband|wife|sibling|parent|child|mentor|rival|boss|employee|leader|member)\b/i.test(source)) weight += 1;
    if (/\b(?:trusts?|distrusts?|loves?|hates?|resents?|forgives?)\b/i.test(source)) weight += 1;
  } else if (kind === "location") {
    if (/\b(?:population|owner|controlled|occupied|abandoned|ruined|rebuilt|district|landmark|burned|flooded|siege|battle|renovated|evacuated|quarantined|annexed|liberated|opened|closed)\b/i.test(source)) weight += 1;
    if (/\b(?:opens?|opened|closes?|closed)\s+(?:to|for)\s+(?:the\s+)?public\b/i.test(source)) weight += 1;
  } else if (kind === "item") {
    if (/\b(?:broken|repaired|upgraded|enchanted|activated|deactivated|stolen|recovered|owner|belongs|property|function|ability|power|damaged|destroyed|transformed|unlocked|decoded)\b/i.test(source)) weight += 1;
  } else if (kind === "faction") {
    if (/\b(?:leader|leadership|member|members|alliance|enemy|war|merger|split|revolt|coup|founded|dissolved|recruits?|expels?|promotes?|policy|goal|renamed|reorganized|reorganised|bankrupt|acquired)\b/i.test(source)) weight += 1;
  }

  return Math.min(5, weight);
}

function recordCodexCardUpdateEvidence(name, card, snippet, actionEpoch, forcedWeight) {
  if (!state.unsaid || !state.unsaid.codex || !name || !card || !snippet) return false;
  const codex = state.unsaid.codex;
  const meta = ensureCodexCardMeta(name, card);
  if (!meta) return false;
  const key = codexManagedCardKey(name, card);

  if (!codex.cardUpdateEvidence[key]) codex.cardUpdateEvidence[key] = [];
  const list = codex.cardUpdateEvidence[key];
  const clean = String(snippet).replace(/\s+/g, " ").trim().slice(0, CODEX_CARD_UPDATE_SNIPPET_LENGTH);
  if (!clean) return false;

  const normalized = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (list.some(item => item && item.normalized === normalized)) return false;

  const storyTurn = state.unsaid.turn;
  const epoch = typeof actionEpoch === "number" ? actionEpoch : storyTurn;
  // Never count the same response that created/refreshed the card as "new"
  // evidence for its next refresh. Keep story-turn age separate from the
  // platform actionCount used only for duplicate-call protection.
  if (typeof meta.lastRefreshTurn === "number" && storyTurn <= meta.lastRefreshTurn) return false;
  if (codex.cardUpdateLastSeenTurn[key] === epoch && list.some(item => item && item.epoch === epoch)) return false;

  list.push({
    turn: storyTurn,
    epoch: epoch,
    text: clean,
    normalized: normalized,
    weight: Math.max(
      codexRefreshEvidenceWeight(clean, meta.type || codexKindFromExistingCard(card, key)),
      typeof forcedWeight === "number" ? forcedWeight : 0
    )
  });
  if (list.length > CODEX_CARD_UPDATE_EVIDENCE_LIMIT) {
    list.splice(0, list.length - CODEX_CARD_UPDATE_EVIDENCE_LIMIT);
  }
  codex.cardUpdateLastSeenTurn[key] = epoch;
  return true;
}

function codexCardTitleContainedIn(longerTitle, shorterTitle) {
  const normalize = value => String(value || "")
    .toLowerCase()
    .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const longer = normalize(longerTitle);
  const shorter = normalize(shorterTitle);
  if (!longer || !shorter || longer === shorter) return false;
  return (` ${longer} `).indexOf(` ${shorter} `) !== -1;
}

function trackCodexCardUpdateEvidence(source, actionEpoch) {
  if (!state.unsaid || !state.unsaid.codex || !source ||
      typeof storyCards === "undefined" || !Array.isArray(storyCards)) return;

  const loggedNames = codexLoggedEntityNameSet();
  const candidates = storyCards
    .filter(card => card && card.title && !isOwnCard(card.title))
    .filter(card =>
      state.unsaid.codex.cardMeta[card.title] ||
      loggedNames.has(String(card.title).toLowerCase().trim())
    )
    .sort((a, b) => String(b.title).length - String(a.title).length)
    .slice(0, CODEX_CARD_UPDATE_SCAN_LIMIT);

  if (candidates.length === 0) return;
  const sentences = (typeof Library !== "undefined" && Library.splitSentences)
    ? Library.splitSentences(String(source))
    : String(source).replace(/([.!?])\s+/g, "$1\n").split("\n");

  sentences.forEach(sentence => {
    const matched = candidates.filter(card => nameAppears(card.title, sentence));
    if (matched.length === 0) return;

    // If both "Rose" and "Rose Garden" exist and the sentence only refers to
    // the longer entity, do not give the shorter card update evidence too.
    const accepted = matched.filter(card =>
      !matched.some(other =>
        other !== card &&
        String(other.title).length > String(card.title).length &&
        codexCardTitleContainedIn(other.title, card.title) &&
        nameAppears(other.title, sentence)
      )
    );

    accepted.forEach(card => {
      const type = codexKindFromExistingCard(card, card.title);
      ensureCodexCardMeta(card.title, card, type);
      recordCodexCardUpdateEvidence(card.title, card, sentence, actionEpoch);
    });
  });
}

function codexUpdateEvidenceTextFor(name, compact) {
  const card = findStoryCardForEntity(name);
  const key = (typeof codexManagedCardKey === "function")
    ? codexManagedCardKey(name, card)
    : name;
  const list = (state.unsaid && state.unsaid.codex &&
    state.unsaid.codex.cardUpdateEvidence &&
    state.unsaid.codex.cardUpdateEvidence[key]) || [];
  const take = compact ? 2 : 5;
  const clip = compact ? 140 : 220;
  return list.slice(-take)
    .map(item => item && item.text ? item.text.replace(/\s+/g, " ").trim().slice(0, clip) : "")
    .filter(Boolean)
    .join(" | ");
}

function pickCodexRefreshCandidate(cfg) {
  if (!cfg || !cfg.codexEnabled || !cfg.codexAutoRefresh ||
      !state.unsaid || !state.unsaid.codex) return null;

  const codex = state.unsaid.codex;
  const interval = Math.max(1, cfg.codexRefreshInterval || 20);
  const minEvidence = Math.max(1, cfg.codexRefreshMinEvidence || 3);
  const candidates = [];

  Object.keys(codex.cardMeta || {}).forEach(storedName => {
    const card = findStoryCardForEntity(storedName);
    if (!card || isOwnCard(card.title)) {
      delete codex.cardMeta[storedName];
      delete codex.cardUpdateEvidence[storedName];
      delete codex.cardUpdateLastSeenTurn[storedName];
      return;
    }

    const key = codexManagedCardKey(storedName, card);
    const meta = ensureCodexCardMeta(key, card);
    if (!meta) return;
    if (codexCardHasManualEdit(key, card, cfg)) return;

    const since = state.unsaid.turn - (meta.lastRefreshTurn || meta.lastGeneratedTurn || 0);
    if (since < interval) return;

    // A malformed/ignored refresh should not hammer the model every Codex
    // cooldown forever. Back off per-card, while still keeping accumulated
    // evidence so the card can recover automatically later.
    const failures = Math.max(0, meta.refreshFailures || 0);
    if (failures > 0) {
      const retryDelay = Math.min(
        interval,
        Math.max(cfg.codexCooldown || 1, Math.pow(2, Math.min(5, failures)))
      );
      const sinceAttempt = state.unsaid.turn - (meta.lastRefreshAttemptTurn || -999999);
      if (sinceAttempt < retryDelay) return;
    }

    const evidence = (codex.cardUpdateEvidence && codex.cardUpdateEvidence[key]) || [];
    const meaningful = evidence.filter(item => item && (item.weight || 1) >= 2).length;
    const totalWeight = evidence.reduce((sum, item) => sum + ((item && item.weight) || 1), 0);

    // Three useful pieces with at least one real change cue are enough.
    // Otherwise require twice the configured evidence count so a frequently
    // mentioned but unchanged entity does not waste model/context budget.
    if (evidence.length < minEvidence) return;
    if (meaningful === 0 && evidence.length < Math.min(CODEX_CARD_UPDATE_EVIDENCE_LIMIT, minEvidence * 2)) return;

    candidates.push({
      name: key,
      since,
      meaningful,
      totalWeight,
      failures,
      type: meta.type || codexKindFromExistingCard(card, key)
    });
  });

  candidates.sort((a, b) =>
    (b.meaningful - a.meaningful) ||
    (b.totalWeight - a.totalWeight) ||
    (b.since - a.since) ||
    (a.failures - b.failures)
  );
  return candidates.length ? candidates[0] : null;
}

function markCodexCardGenerated(name, type, entry, refreshed) {
  if (!state.unsaid || !state.unsaid.codex || !name) return;
  const codex = state.unsaid.codex;
  if (!codex.cardMeta || typeof codex.cardMeta !== "object") codex.cardMeta = {};
  if (!codex.cardUpdateEvidence || typeof codex.cardUpdateEvidence !== "object") codex.cardUpdateEvidence = {};
  if (!codex.cardUpdateLastSeenTurn || typeof codex.cardUpdateLastSeenTurn !== "object") codex.cardUpdateLastSeenTurn = {};

  const card = findStoryCardForEntity(name);
  const key = codexManagedCardKey(name, card);
  const previous = codex.cardMeta[key] || {};
  codex.cardMeta[key] = {
    type: type || previous.type || "character",
    lastGeneratedEntry: String(entry || ""),
    lastGeneratedCardType: platformType(type || previous.type || "character"),
    lastGeneratedTurn: typeof previous.lastGeneratedTurn === "number"
      ? previous.lastGeneratedTurn
      : state.unsaid.turn,
    lastRefreshTurn: state.unsaid.turn,
    updateCount: (previous.updateCount || 0) + (refreshed ? 1 : 0),
    refreshFailures: 0,
    lastRefreshAttemptTurn: state.unsaid.turn,
    manualEditProtected: false,
    adoptedBaseline: false
  };
  codex.cardUpdateEvidence[key] = [];
  codex.cardUpdateLastSeenTurn[key] = state.unsaid.turn;

  // Keep long-running adventures bounded. Old managed cards can be safely
  // re-adopted later from the Codex log if they become relevant again.
  const metaKeys = Object.keys(codex.cardMeta);
  if (metaKeys.length > CODEX_CARD_META_LIMIT) {
    metaKeys
      .sort((a, b) => {
        const am = codex.cardMeta[a] || {};
        const bm = codex.cardMeta[b] || {};
        return (am.lastRefreshTurn || am.lastGeneratedTurn || 0) -
          (bm.lastRefreshTurn || bm.lastGeneratedTurn || 0);
      })
      .slice(0, metaKeys.length - CODEX_CARD_META_LIMIT)
      .forEach(oldName => {
        delete codex.cardMeta[oldName];
        delete codex.cardUpdateEvidence[oldName];
        delete codex.cardUpdateLastSeenTurn[oldName];
      });
  }
}

function findCodexCandidates(threshold, excludeNames, maxAttempts, maxCount) {
  const exclude = excludeNames || [];
  const cap = typeof maxAttempts === "number" ? maxAttempts : CODEX_MAX_ATTEMPTS;
  const limit = typeof maxCount === "number" ? maxCount : CODEX_MAX_CANDIDATES_PER_TURN;
  const counts = state.unsaid.codex.mentionCounts;

  // Build Story Card aliases once per scheduling pass. The old path called
  // storyCardMatchesForEntity() (and then findStoryCardForEntity(), which
  // repeated the same scan) for every tracked candidate. With hundreds of
  // candidates and hundreds of cards that became O(candidates × cards) and
  // could consume most of the Context hook by itself.
  const existingCardAliases = new Set();
  try {
    if (typeof storyCards !== "undefined" && Array.isArray(storyCards)) {
      storyCards.forEach(card => {
        if (!card || !card.title || isOwnCard(card.title)) return;
        const simple = String(card.title)
          .toLowerCase()
          .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!simple) return;
        existingCardAliases.add(simple);
        let words = simple.split(" ").filter(Boolean);
        if (typeof stripCourtesyTitle === "function") words = stripCourtesyTitle(words);
        for (let len = 1; len <= words.length; len++) {
          for (let start = 0; start + len <= words.length; start++) {
            const alias = words.slice(start, start + len).join(" ");
            if (len > 1 || alias.length >= 3) existingCardAliases.add(alias);
          }
        }
      });
    }
  } catch (e) {}

  const existingCardForCandidate = name => {
    const simple = String(name || "")
      .toLowerCase()
      .replace(/[“”"'‘’.,:;!?()[\]{}\-‐‑–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!simple) return false;
    if (existingCardAliases.has(simple)) return true;
    let words = simple.split(" ").filter(Boolean);
    if (typeof stripCourtesyTitle === "function") words = stripCourtesyTitle(words);
    return existingCardAliases.has(words.join(" "));
  };
  const likelyCharacters = state.unsaid.codex.likelyCharacters || {};
  const introducedTurn = state.unsaid.codex.introducedTurn || {};
  const observedTypes = state.unsaid.codex.observedTypes || {};
  const eligible = [];

  for (const name in counts) {
    const introducedCharacter = !!likelyCharacters[name];

    // Revalidate at scheduling time as a second line of defense. This also
    // protects against old persisted state that reaches Context before the
    // normal scanner has had a chance to touch it.
    if (!isSafeTrackedCodexName(name)) {
      forgetMentionTracking(name);
      continue;
    }

    if (!introducedCharacter && counts[name] < threshold) continue;

    if (!introducedCharacter) {
      const stableType = dominantCodexType(name);
      const confidence = (state.unsaid.codex.candidateScores && state.unsaid.codex.candidateScores[name]) || 0;
      const typeScore = codexTypeVoteScore(name, stableType);
      const explicit = hasExplicitCodexNamingCue(name, codexEvidenceTextFor(name));
      if (!explicit && (confidence < CODEX_NONCHAR_MIN_CONFIDENCE || typeScore < CODEX_NONCHAR_MIN_TYPE_VOTES)) continue;
      if (stableType === "character") continue;
      state.unsaid.codex.observedTypes[name] = stableType;
    }

    if (exclude.some(ex => isSameCardEntity(ex, name))) continue;
    if (existingCardForCandidate(name)) continue;

    // Character-shaped names are NOT auto-carded from hearsay/backstory
    // mentions alone. They join automatic Codex only after Output has seen
    // a direct on-screen introduction. This prevents "Mirelle said..."
    // from producing a profile before Mirelle ever appears.
    if (!introducedCharacter && (observedTypes[name] || "character") === "character") continue;

    // Introduced characters are never permanently exhausted; other entity
    // types still respect the configurable retry cap.
    if (!introducedCharacter && (state.unsaid.codex.attempts[name] || 0) >= cap) continue;

    eligible.push({
      name,
      count: counts[name],
      fastTrack: introducedCharacter,
      introduced: typeof introducedTurn[name] === "number"
        ? introducedTurn[name]
        : Number.MAX_SAFE_INTEGER
    });
  }

  eligible.sort((a, b) => {
    if (a.fastTrack !== b.fastTrack) return a.fastTrack ? -1 : 1;
    if (a.fastTrack && a.introduced !== b.introduced) return a.introduced - b.introduced;
    return b.count - a.count;
  });

  const picked = [];
  for (const candidate of eligible) {
    if (picked.length >= limit) break;
    if (picked.some(p => isSameCardEntity(p.name, candidate.name))) continue;
    picked.push(candidate);
  }
  return picked.map(p => p.name);
}


function buildCodexInstruction(names, text, forced, priorFailures, hardDeadline, compact, refreshMode) {
  const failures = typeof priorFailures === "number" ? priorFailures : 0;
  const scenarioNote = Library.scenarioGuidance(text);

  const blocks = names.map((name, i) => {
    const reconciledType = reconcileCodexEntityType(name, text);
    const trackedType = state.unsaid.codex.trustedEntities[name] ||
      reconciledType ||
      (state.unsaid.codex.likelyCharacters[name]
        ? "character"
        : (state.unsaid.codex.observedTypes[name] || null));
    const type = trackedType || classifyCodexEntry(name, text);
    const fields = CARD_TEMPLATES[type] || CHARACTER_CARD_FIELDS;
    const body = fields.map(f => `${f}: ${f === "Name" ? name : "..."}`).join("\n");
    const mind = type === "character" ? state.unsaid.minds[name] : null;
    const knownNote = mind && mind.core
      ? ` Already-established private truth: "${mind.core}". Personality and Background must agree with it.`
      : "";
    const correctionNote = type === "character"
      ? ` If "${name}" is genuinely a location, item, or faction instead, switch to that matching template rather than pretending it is a person.`
      : ` Treat "${name}" as a ${type}. Do not use the Character template just because the prose gives the place/object/group human-like adjectives or because its name looks like a person's name.`;

    const introTurn = state.unsaid.codex.introducedTurn && state.unsaid.codex.introducedTurn[name];
    const observedTurns = type === "character" && typeof introTurn === "number"
      ? Math.max(0, state.unsaid.turn - introTurn)
      : null;
    const appearances = type === "character" ? codexAppearanceCount(name) : 0;
    const observationNote = observedTurns !== null
      ? ` Observed for ${observedTurns} full story turn${observedTurns === 1 ? "" : "s"} across ${appearances} on-screen appearance${appearances === 1 ? "" : "s"}.`
      : "";

    const evidenceItems = refreshMode
      ? ((state.unsaid.codex.cardUpdateEvidence && state.unsaid.codex.cardUpdateEvidence[name]) || [])
      : ((state.unsaid.codex.evidence && state.unsaid.codex.evidence[name]) || []);
    const evidenceLimit = compact ? (refreshMode ? 2 : 1) : (refreshMode ? 5 : 3);
    const evidenceClip = compact ? 140 : (refreshMode ? 220 : 190);
    const evidenceText = evidenceItems.slice(-evidenceLimit)
      .map(item => item && item.text ? item.text.replace(/\s+/g, " ").trim().slice(0, evidenceClip) : "")
      .filter(Boolean)
      .join(" | ");
    const evidenceNote = evidenceText
      ? (refreshMode
          ? ` New story evidence since the current card was written: ${evidenceText}`
          : ` Story evidence to weigh before inferring anything: ${evidenceText}`)
      : "";

    let refreshNote = "";
    if (refreshMode) {
      const existingCard = findStoryCardForEntity(name);
      const existingEntry = existingCard && existingCard.entry
        ? String(existingCard.entry).replace(/\s+/g, " ").trim().slice(0, compact ? 700 : 1400)
        : "";
      refreshNote =
        ` This is an UPDATE of an existing Story Card, not a new profile. Preserve established facts that are still true; revise only details that later story evidence changed, clarified, or made more specific. ` +
        `Current card snapshot: ${existingEntry || "(empty)"}.`;
    }

    return `Profile ${i + 1} — "${name}":${refreshNote}${knownNote}${correctionNote}${observationNote}${evidenceNote}\nIdentity lock: this block is ONLY for "${name}". Do not substitute a nearby person, food, object, place, brand, or similarly named entity. The Name field must stay "${name}".\n【CARD】\n${body}\n【/CARD】`;
  }).join("\n\n");

  let priorityLine;
  if (refreshMode) {
    priorityLine =
      `This is a low-priority periodic Story Card refresh. Continue the visible story normally FIRST, then append the hidden refreshed profile block at the very end. ` +
      `Do not interrupt, summarize, or shorten the story just to perform the refresh.`;
  } else if (forced) {
    priorityLine =
      `The player explicitly requested ${names.length > 1 ? "these cards" : "this card"}. ` +
      `Write the hidden profile block${names.length > 1 ? "s" : ""} now. This is a control-command turn, so visible story prose is optional.`;
  } else if (hardDeadline) {
    priorityLine =
      `HARD DEADLINE for the profile, but DO NOT sacrifice the story response. Continue the visible story FIRST, then append the hidden profile block${names.length > 1 ? "s" : ""} at the very end. ` +
      `Both parts are mandatory; if space is tight, make the card fields shorter rather than omitting the visible continuation.`;
  } else if (failures > 0) {
    priorityLine =
      `A previous automatic attempt did not produce a usable card. Continue the visible story FIRST, then append the hidden profile block${names.length > 1 ? "s" : ""} at the very end. ` +
      `The retry is mandatory, but it must never replace the normal story continuation.`;
  } else {
    priorityLine =
      `Continue the visible story normally FIRST. After the story prose, append the hidden profile block${names.length > 1 ? "s" : ""} at the very end. ` +
      `The script removes ${names.length > 1 ? "these blocks" : "this block"} before the player sees the response, so the hidden task must never replace or interrupt the visible continuation.`;
  }

  const rules = compact
    ? `Rules: keep the CARD markers exactly; one short concrete line per field; no blanks, "...", Unknown, N/A or TBD. The Name field must stay the exact requested entity; never substitute a nearby food/object/person/place/business. ${refreshMode ? "This is a refresh: keep every established fact that is still true, change only what new evidence genuinely updates, and do not reset a developed character/place/item/faction to a generic description. " : ""}Use established evidence first and infer missing details conservatively without contradicting the story. Fit every field to the actual scenario: Race means species/nature/kind; Strength Level means relevant capability, not automatically combat; Abilities may be skills/expertise/powers/resources; Relationships must be evidence-based. Do not mention this task outside the hidden block.${forced ? " Visible story prose is optional on this manual command turn." : " OUTPUT ORDER: visible story prose first, hidden CARD block last. Never return only the CARD block."}`
    : `Rules:
- Keep the 【CARD】 and 【/CARD】 markers exactly.
- Output exactly one short line per listed field.
- Replace every "..." with a concrete, specific value. Never leave "...", "unknown", "N/A", "TBD", or a blank field.
- The Name field must identify exactly the requested entity. Never substitute a nearby food, object, person, place, business, or similarly named thing.
${refreshMode ? "- This is a REFRESH. Preserve facts that remain true, update only facts that later evidence changed/clarified, keep durable history/background intact, and never flatten a developed card back into a generic first-impression profile.\n- Prefer current-state wording for fields like Relationships, Personality, Abilities, Weaknesses, ownership/control, status, significance, or condition when the story has changed them." : ""}
- Analyze all supplied story evidence before filling fields. Repeated behavior and explicit facts outrank first impressions.
- Use established facts first. Infer only what is still missing, and keep those inferences conservative, specific, and compatible with the story.
- Do not turn hearsay into an on-screen event, invent a relationship that contradicts the text, or overstate abilities that have not been demonstrated.
- For Background/Personality/Relationships, connect details to what the character has actually said, done, feared, wanted, or been described as.
- Interpret fields in a scenario-neutral way. "Race" means species/nature/kind (Human for an ordinary human, the actual nature for an AI/robot/construct/nonhuman). "Strength Level" means relevant capability/status in THIS setting, not automatically combat power. "Abilities" can be practical skills, expertise, social/professional strengths, powers, resources, or special traits. "Weaknesses" means actual limitations/vulnerabilities, not forced combat flaws.
- Never invent magic, futuristic technology, superpowers, criminal ties, aristocratic titles, romance, military rank, or other genre-specific facts unless the scenario supports them.
- Preserve established pronouns, culture, era, technology level, social norms, power scale, and tone.
- Do not explain the profile or mention this task outside the hidden card block.
${forced ? "- This is a manual /card command turn, so visible story prose is optional." : "- OUTPUT ORDER IS REQUIRED: continue the visible story first, then append the hidden CARD block at the end. Never return only the CARD block and never let the hidden task replace the story response."}`;

  return `\n[UNSAID CODEX — mandatory script task. ${priorityLine}${scenarioNote ? "\nScenario adaptation:" + scenarioNote : ""}
${blocks}
${rules}]
`;
}

function buildAndFitCodexInstruction(names, baseText, forced, priorFailures, hardDeadline, refreshMode) {
  const full = buildCodexInstruction(names, baseText, forced, priorFailures, hardDeadline, false, !!refreshMode);
  return fitInstructionToBudget(baseText, full) ||
    fitInstructionToBudget(
      baseText,
      buildCodexInstruction(names, baseText, forced, priorFailures, hardDeadline, true, !!refreshMode)
    );
}

function codexLogTitle(type) {
  const heading = type.charAt(0).toUpperCase() + type.slice(1) + "s";
  return `UNSAID Codex Log — ${heading}`;
}

function buildStatusReport(cfg) {
  const lines = [];
  lines.push(`UNSAID: ${cfg.enabled ? "enabled" : "DISABLED"}  |  Codex: ${cfg.codexEnabled ? "enabled" : "disabled"}  |  Turn: ${state.unsaid.turn}`);
  lines.push(`Behavioral continuity: ${cfg.behavioralContinuity ? "enabled" : "off"}  |  active-mind cap: ${cfg.behavioralContinuityCharacters}`);
  const aliasCount = Object.keys(state.unsaid.aliases || {}).reduce((sum, name) => sum + (Array.isArray(state.unsaid.aliases[name]) ? state.unsaid.aliases[name].length : 0), 0);
  lines.push(`Aliases: ${aliasCount} manual alias${aliasCount === 1 ? "" : "es"}; Story Card triggers are also identity aliases`);
  if (state.unsaid.lastActiveCast && state.unsaid.lastActiveCast.length) {
    lines.push(`Last active cast: ${state.unsaid.lastActiveCast.join(", ")}`);
  }

  try {
    const twistCfg = state.contingencyConfig || Library.CP_DEFAULTS;
    const profile = Library.currentScenarioProfile("", twistCfg);
    lines.push(`Scenario adaptation: ${twistCfg.scenarioAdaptation ? "enabled" : "off"}  |  ${profile.tags.join(", ")}  |  era: ${profile.era}  |  reality: ${profile.reality}  |  stakes: ${profile.scale}${twistCfg.scenarioOverride ? `  |  override: ${twistCfg.scenarioOverride}` : ""}`);
    lines.push(`UNSAID ↔ Twists link: ${twistCfg.crossSystemSynergy ? "enabled" : "off"}`);
  } catch (e) {}

  const cacheCard = storyCards.find(c => c.title === "UNSAID — Important, Read This ⚠️");
  if (cacheCard && cacheCard.entry && cacheCard.entry.indexOf("no longer detected") === -1) {
    lines.push(`⚠️ Cache-efficient mode is currently detected — private thoughts and Codex cannot function normally right now; see the warning card.`);
  }

  const mindNames = Object.keys(state.unsaid.minds);
  lines.push(`\nTracked minds (${mindNames.length}):`);
  if (mindNames.length === 0) {
    lines.push("  none yet");
  } else {
    mindNames.forEach(name => {
      const m = state.unsaid.minds[name] || {};
      const coreNote = m.core ? "has a core truth" : "no standalone thought yet";
      const lastActiveNote = typeof m.lastTurn === "number" ? `last active turn ${m.lastTurn}` : "not yet revealed under tracking";
      const adaptiveSlots = m.thoughtOrder && Array.isArray(m.thoughtOrder) ? m.thoughtOrder.length : 0;
      lines.push(`  ${name} — ${coreNote}, feeling: ${m.feeling || "none yet"}, ${m.revealCount || 0} reveal(s), adaptive memory: ${adaptiveSlots} slot(s), ${lastActiveNote}`);
    });
  }

  const codex = state.unsaid.codex;
  const counts = codex.mentionCounts || {};
  const attempts = codex.attempts || {};
  const tracked = Object.keys(counts);
  const likelyCharacters = codex.likelyCharacters || {};
  const introducedTurn = codex.introducedTurn || {};
  const observedTypes = codex.observedTypes || {};
  const alreadyCarded = tracked.filter(n =>
    (typeof storyCardMatchesForEntity === "function" && storyCardMatchesForEntity(n).length > 0) ||
    !!findStoryCardForEntity(n)
  );
  const minObserve = Math.max(0, cfg.codexCharacterMinTurns || 0);
  const minAppearances = Math.max(1, cfg.codexCharacterMinAppearances || 1);
  const deadline = Math.max(minObserve, cfg.codexCharacterDeadline || 5);

  const introduced = tracked.filter(n =>
    likelyCharacters[n] &&
    !alreadyCarded.includes(n) &&
    typeof introducedTurn[n] === "number"
  );
  const readyCharacters = introduced.filter(n => {
    const age = state.unsaid.turn - introducedTurn[n];
    return age >= deadline || (age >= minObserve && codexAppearanceCount(n) >= minAppearances);
  });
  const waitingCharacters = introduced.filter(n => !readyCharacters.includes(n));
  const hearsayCharacters = tracked.filter(n =>
    !likelyCharacters[n] &&
    !alreadyCarded.includes(n) &&
    (observedTypes[n] || "character") === "character"
  );
  const nonCharacterEligible = tracked.filter(n => {
    const stableType = dominantCodexType(n);
    const confidence = (codex.candidateScores && codex.candidateScores[n]) || 0;
    const typeScore = codexTypeVoteScore(n, stableType);
    const explicit = hasExplicitCodexNamingCue(n, codexEvidenceTextFor(n));
    return !likelyCharacters[n] &&
      !alreadyCarded.includes(n) &&
      stableType && stableType !== "character" &&
      counts[n] >= cfg.mentionThreshold &&
      (explicit || (confidence >= CODEX_NONCHAR_MIN_CONFIDENCE && typeScore >= CODEX_NONCHAR_MIN_TYPE_VOTES)) &&
      (attempts[n] || 0) < cfg.codexMaxAttempts;
  });
  const exhausted = tracked.filter(n =>
    observedTypes[n] && observedTypes[n] !== "character" &&
    (attempts[n] || 0) >= cfg.codexMaxAttempts
  );

  lines.push(`\nCodex tracking: ${tracked.length} name(s)`);
  if (waitingCharacters.length > 0) {
    lines.push(`  observing on-screen characters: ${waitingCharacters.slice(0, 10).map(n => {
      const age = Math.max(0, state.unsaid.turn - introducedTurn[n]);
      const appearances = codexAppearanceCount(n);
      return `${n} (${age}/${minObserve} turns, ${appearances}/${minAppearances} appearances, ${counts[n]} mention(s))`;
    }).join(", ")}${waitingCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (readyCharacters.length > 0) {
    lines.push(`  ready for a character card: ${readyCharacters.slice(0, 10).map(n => {
      const age = Math.max(0, state.unsaid.turn - introducedTurn[n]);
      return `${n} (${age} turns, ${codexAppearanceCount(n)} appearance(s))`;
    }).join(", ")}${readyCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (hearsayCharacters.length > 0) {
    lines.push(`  referenced but not introduced on-screen: ${hearsayCharacters.slice(0, 10).map(n => `${n} (${counts[n]} mention(s))`).join(", ")}${hearsayCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (nonCharacterEligible.length > 0) {
    lines.push(`  eligible non-character entities: ${nonCharacterEligible.slice(0, 10).map(n => {
      const stableType = dominantCodexType(n);
      const score = (codex.candidateScores && codex.candidateScores[n]) || 0;
      return `${n} (${stableType}, ${counts[n]} mention(s), evidence ${score})`;
    }).join(", ")}${nonCharacterEligible.length > 10 ? ", ..." : ""}`);
  }
  if (introduced.length > 0) {
    lines.push(`  character gate: ${minObserve} full turn(s) + ${minAppearances} on-screen appearance(s); hard deadline ${deadline} turn(s)`);
  }
  if (alreadyCarded.length > 0) {
    lines.push(`  already carded and skipped: ${alreadyCarded.slice(0, 10).join(", ")}${alreadyCarded.length > 10 ? ", ..." : ""}`);
  }
  if (exhausted.length > 0) {
    lines.push(`  non-character candidates paused after ${cfg.codexMaxAttempts} failed attempts: ${exhausted.join(", ")} — "/card <name>" still works directly`);
  }

  const turnsSinceCodex = state.unsaid.turn - (codex.lastTriggerTurn || 0);
  lines.push(`  Codex cooldown: ${turnsSinceCodex}/${cfg.codexCooldown} turns`);

  const managedCards = Object.keys(codex.cardMeta || {}).filter(name => !!findStoryCardForEntity(name));
  const protectedCards = [];
  const evidenceWaiting = [];
  managedCards.forEach(name => {
    const card = findStoryCardForEntity(name);
    const meta = card ? ensureCodexCardMeta(name, card) : null;
    if (!meta) return;
    if (card && codexCardHasManualEdit(name, card, cfg)) protectedCards.push(name);
    const key = codexManagedCardKey(name, card);
    const ev = (codex.cardUpdateEvidence && codex.cardUpdateEvidence[key]) || [];
    if (ev.length > 0) evidenceWaiting.push(`${key} (${ev.length})`);
  });
  lines.push(`  periodic card refresh: ${cfg.codexAutoRefresh ? "enabled" : "off"}; ${managedCards.length} managed card(s); interval ${cfg.codexRefreshInterval} turn(s); evidence gate ${cfg.codexRefreshMinEvidence}`);
  if (evidenceWaiting.length > 0) {
    lines.push(`  refresh evidence waiting: ${evidenceWaiting.slice(0, 10).join(", ")}${evidenceWaiting.length > 10 ? ", ..." : ""}`);
  }
  if (protectedCards.length > 0) {
    lines.push(`  hand-edited cards protected from auto-refresh: ${protectedCards.slice(0, 10).join(", ")}${protectedCards.length > 10 ? ", ..." : ""}`);
  }

  const strugglingCount = (codex.consecutiveFailedNames || []).length;
  if (strugglingCount > 0) {
    lines.push(`  unsuccessful-name streak: ${strugglingCount}${strugglingCount >= 3 ? " — likely a formatting/model-compliance issue" : ""}`);
  }

  const revealMisses = state.unsaid.consecutiveRevealMisses || 0;
  if (revealMisses > 0) {
    lines.push(`\nReveal requests: ${revealMisses} in a row produced nothing usable${revealMisses >= 5 ? " — may indicate a model-compliance issue" : ""}`);
  }

  lines.push(`\nCast (${cfg.cast.length}): ${cfg.cast.join(", ") || "empty"}`);
  if (cfg.cast.length > 0) {
    lines.push("\nCast → Story Card resolution:");
    cfg.cast.forEach(name => {
      const matches = storyCards.filter(c => c.title && isSameCardEntity(c.title, name));
      if (matches.length === 0) {
        lines.push(`  ${name} → no matching Story Card found`);
      } else if (matches.length === 1) {
        lines.push(`  ${name} → "${matches[0].title}" (type: "${matches[0].type || ""}")`);
      } else {
        lines.push(`  ${name} → ${matches.length} matching cards; ambiguous, so automatic writes are paused for this name`);
      }
    });
  }

  return lines.join("\n");
}

function ensureCodexLogCard(type) {
  const title = codexLogTitle(type);
  const keys = title.toLowerCase();
  let card = storyCards.find(c => c.title === title || c.keys === keys);
  if (!card) {
    card = createOrFindCard(keys, " ", "Class");
    if (!card) return null;
    card.title = title;
    card.keys = keys;
    card.type = "Class";
    card.entry = `Every ${type} card Codex has made, with its initial mention count and later automatic refresh history when applicable. Codex-made cards can refresh from newer story evidence; hand-edited entries are protected by default.`;
    card.description = "";
  }
  return card;
}

function logCodexCard(name, type, mentionCount, refreshed) {
  const card = ensureCodexLogCard(type);
  if (!card) return;

  // If a later refresh repairs an old entity type, remove the stale copy
  // from the previous type log so diagnostics do not claim the same entity
  // is both a Character and a Location/Item/Faction.
  storyCards.forEach(other => {
    if (!other || other === card || typeof other.title !== "string" ||
        other.title.indexOf("UNSAID Codex Log — ") !== 0) return;
    const lines = String(other.description || "").split("\n");
    const kept = lines.filter(line => {
      const loggedName = line.split(" — ")[0].trim();
      return loggedName.toLowerCase() !== String(name).toLowerCase();
    });
    if (kept.length !== lines.length) other.description = kept.join("\n");
  });

  const entries = card.description.split("\n").map(l => l.trim()).filter(Boolean);
  const existingIdx = entries.findIndex(l => l.startsWith(`${name} —`));

  if (refreshed) {
    const logCardTarget = findStoryCardForEntity(name);
    const metaKey = (typeof codexManagedCardKey === "function")
      ? codexManagedCardKey(name, logCardTarget)
      : name;
    const meta = state.unsaid && state.unsaid.codex && state.unsaid.codex.cardMeta
      ? state.unsaid.codex.cardMeta[metaKey]
      : null;
    const count = meta && typeof meta.updateCount === "number" ? meta.updateCount : 1;
    const suffix = `; refreshed ${count}x, last turn ${state.unsaid ? state.unsaid.turn : "?"}`;
    if (existingIdx >= 0) {
      const base = entries[existingIdx].replace(/; refreshed \d+x, last turn \d+\s*$/i, "");
      entries[existingIdx] = base + suffix;
    } else {
      entries.push(`${name} — Codex-managed card${suffix}`);
    }
  } else {
    const line = `${name} — mentioned ${mentionCount}x before card created`;
    if (existingIdx >= 0) entries[existingIdx] = line;
    else entries.push(line);
  }

  if (entries.length > 500) entries.splice(0, entries.length - 500);
  card.description = entries.join("\n");
}


function resolveUnsaidRelationTarget(owner, rawTarget, cfg) {
  const raw = String(rawTarget || "")
    .replace(/^["“”'‘’\s]+|["“”'‘’\s.,:;!?]+$/g, "")
    .replace(/^(?:about|toward|towards)\s+/i, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!raw || !/[A-Za-z]/.test(raw)) return null;
  if (owner && isSameCardEntity(owner, raw)) return null;

  const blocked = excludedNames(cfg || { playerName: "" });
  if (blocked.some(name => isSameCardEntity(name, raw))) return null;

  // Fast path: title/trigger/manual aliases resolve through the per-hook card
  // index. Older builds scanned *every* Story Card and semantically retyped it
  // whenever a relationship reveal said "about X"; a 1000-card scenario could
  // spend several seconds here alone. We only inspect the card(s) that can
  // actually match the target now.
  const directMatches = typeof storyCardMatchesForEntity === "function"
    ? storyCardMatchesForEntity(raw)
    : [];
  if (directMatches.length === 1) {
    const card = directMatches[0];
    const canonical = card && card.title ? card.title : raw;
    if ((!owner || !isSameCardEntity(owner, canonical)) &&
        !blocked.some(name => isSameCardEntity(name, canonical)) &&
        isCharacterLikeCard(canonical, card) &&
        codexKindFromExistingCard(card, canonical) === "character") {
      return canonical;
    }
    return null;
  }
  if (directMatches.length > 1) return null;

  const candidates = [];
  const add = value => {
    const clean = String(value || "").trim();
    if (!clean || (owner && isSameCardEntity(owner, clean))) return;
    if (!candidates.some(existing => existing.toLowerCase() === clean.toLowerCase())) {
      candidates.push(clean);
    }
  };

  if (cfg && Array.isArray(cfg.cast)) cfg.cast.forEach(add);
  try {
    Object.keys((state.unsaid && state.unsaid.minds) || {}).forEach(add);
    const codex = state.unsaid && state.unsaid.codex;
    if (codex && codex.likelyCharacters) {
      Object.keys(codex.likelyCharacters)
        .filter(name => codex.likelyCharacters[name])
        .slice(-MENTION_TRACKING_CAP)
        .forEach(add);
    }
  } catch (e) {}

  const exact = candidates.filter(name =>
    String(name).toLowerCase() === raw.toLowerCase()
  );
  if (exact.length === 1) return exact[0];

  const fuzzy = candidates.filter(name => isSameCardEntity(name, raw));
  if (fuzzy.length !== 1) return null;

  const resolved = fuzzy[0];
  const card = findStoryCardForEntity(resolved);
  if (card && (!isCharacterLikeCard(resolved, card) || codexKindFromExistingCard(card, resolved) !== "character")) {
    return null;
  }
  if (blocked.some(name => isSameCardEntity(name, resolved))) return null;
  return resolved;
}

function recordRelation(name, other, feeling) {
  if (!state.unsaid.minds[name]) state.unsaid.minds[name] = createMind();
  const mind = state.unsaid.minds[name];
  if (!mind.relations) mind.relations = {};
  if (!mind.relationOrder) mind.relationOrder = [];
  if (!mind.relationHistory) mind.relationHistory = {};

  mind.relations[other] = feeling;
  const idx = mind.relationOrder.indexOf(other);
  if (idx !== -1) mind.relationOrder.splice(idx, 1);
  mind.relationOrder.push(other);

  if (!mind.relationHistory[other]) mind.relationHistory[other] = [];
  pushCapped(mind.relationHistory[other], feeling, RELATION_HISTORY_LIMIT);

  while (mind.relationOrder.length > MAX_RELATIONS_PER_CHARACTER) {
    const evicted = mind.relationOrder.shift();
    delete mind.relations[evicted];
    delete mind.relationHistory[evicted];
  }
}

function syncMindToCard(name, allowCoreShift, useJson) {
  const mind = state.unsaid.minds[name];
  if (!mind) return false;

  const card = findStoryCardForEntity(name);
  if (!card) return false;

  const stabilityNote = typeof mind.coreSetTurn === "number" && state.unsaid.turn > mind.coreSetTurn
    ? ` (steady for ${state.unsaid.turn - mind.coreSetTurn} turn${state.unsaid.turn - mind.coreSetTurn === 1 ? "" : "s"})`
    : "";
  const tensionActive = allowCoreShift && typeof mind.tensionLevel === "number" &&
    mind.tensionLevel >= TENSION_THRESHOLD;
  const naturallyEligible = (mind.revealCount || 0) >= REVEALS_BEFORE_SHIFT_ELIGIBLE;
  const tensionNote = tensionActive
    ? (naturallyEligible
      ? "increasingly tested"
      : "increasingly tested — though it'll take one more private moment before a shift is possible")
    : null;

  if (useJson) {
    const relations = {};
    if (mind.relationOrder) {
      mind.relationOrder.forEach(other => {
        const hist = mind.relationHistory && mind.relationHistory[other];
        relations[other] = { current: mind.relations[other], history: hist || [mind.relations[other]] };
      });
    }
    const stableForTurns = typeof mind.coreSetTurn === "number"
      ? Math.max(0, state.unsaid.turn - mind.coreSetTurn)
      : null;
    const jsonBody = {
      core: mind.core || null,
      // coreStableForTurns is the correctly named field. Keep the old
      // coreStableSince alias for backward compatibility with notes written
      // by earlier builds.
      coreStableForTurns: stableForTurns,
      coreStableSince: stableForTurns,
      coreHistory: Array.isArray(mind.coreHistory) ? mind.coreHistory.slice(-2) : [],
      formerlyBelieved: mind.coreHistory && mind.coreHistory.length > 0 ? mind.coreHistory[mind.coreHistory.length - 1] : null,
      tension: tensionNote,
      tensionLevel: typeof mind.tensionLevel === "number" ? mind.tensionLevel : 0,
      feeling: mind.feeling || null,
      feelingHistory: mind.feelingHistory || [],
      lastThought: mind.lastThoughtText || null,
      thoughtHistory: Array.isArray(mind.thoughtHistory) ? mind.thoughtHistory.slice(-THOUGHT_HISTORY_LIMIT) : [],
      want: mind.want || null,
      relations,
      revealCount: mind.revealCount || 0,
      lastRevealAgo: typeof mind.lastTurn === "number"
        ? Math.max(0, state.unsaid.turn - mind.lastTurn)
        : null,
      recentTwistImpacts: Array.isArray(mind.recentTwistImpacts) ? mind.recentTwistImpacts.slice(-4) : [],
      thoughtBank: (() => {
        ensureAdaptiveMindShape(mind);
        const out = {};
        mind.thoughtOrder.slice(-ADAPTIVE_MIND_MAX_SLOTS).forEach(key => {
          if (mind.thoughtBank[key]) out[key] = String(mind.thoughtBank[key]).slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
        });
        return out;
      })(),
      thoughtOrder: (() => {
        ensureAdaptiveMindShape(mind);
        return mind.thoughtOrder.slice(-ADAPTIVE_MIND_MAX_SLOTS);
      })(),
      lastReflectionAgo: typeof mind.lastReflectionTurn === "number"
        ? Math.max(0, state.unsaid.turn - mind.lastReflectionTurn)
        : null
    };
    const base = (card.description || "").split(MIND_NOTES_MARKER)[0].replace(/\s+$/, "");
    card.description = `${base}\n\n${MIND_NOTES_MARKER}\n${JSON.stringify(jsonBody, null, 2)}`.trim();
    return true;
  }

  const sections = [];
  if (mind.core) sections.push(`Core truth:\n${mind.core}${stabilityNote}`);
  if (tensionNote) sections.push(`⚡ Their sense of self feels ${tensionNote}.`);
  if (mind.coreHistory && mind.coreHistory.length > 0) {
    sections.push(`Formerly believed:\n${mind.coreHistory[mind.coreHistory.length - 1]}`);
  }
  if (mind.feeling) sections.push(`Currently feeling: ${mind.feeling}`);
  if (mind.feelingHistory && mind.feelingHistory.length > 1) {
    sections.push(`Recent feelings: ${mind.feelingHistory.join(" → ")}`);
  }
  if (mind.lastThoughtText) sections.push(`Last private thought:\n${mind.lastThoughtText}`);
  if (Array.isArray(mind.thoughtHistory) && mind.thoughtHistory.length > 1) {
    const recentAngles = mind.thoughtHistory.slice(-3).map(v => `  • ${String(v).replace(/\s+/g, " ").trim()}`);
    if (recentAngles.length) sections.push(`Recent private thought angles:\n${recentAngles.join("\n")}`);
  }
  if (mind.want) sections.push(`Wants: ${mind.want}`);
  if (Array.isArray(mind.recentTwistImpacts) && mind.recentTwistImpacts.length > 0) {
    const impact = mind.recentTwistImpacts[mind.recentTwistImpacts.length - 1];
    if (impact && impact.category) {
      sections.push(`Recent confirmed plot impact: ${impact.category} (${impact.tier || "significant"})${impact.partner ? `, connected to ${impact.partner}` : ""}`);
    }
  }
  if (mind.relationOrder && mind.relationOrder.length > 0) {
    const relLines = mind.relationOrder.map(other => {
      const hist = mind.relationHistory && mind.relationHistory[other];
      const trail = hist && hist.length > 1 ? hist.join(" → ") : mind.relations[other];
      return `  • ${other} — ${trail}`;
    });
    sections.push(`Feelings toward others:\n${relLines.join("\n")}`);
  }
  ensureAdaptiveMindShape(mind);
  if (mind.thoughtOrder.length > 0) {
    const adaptiveLines = mind.thoughtOrder.slice(-12).map(key => {
      const value = String(mind.thoughtBank[key] || "").slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
      return value ? `  • ${key}: ${value}` : null;
    }).filter(Boolean);
    if (adaptiveLines.length) sections.push(`Adaptive private memory:\n${adaptiveLines.join("\n")}`);
  }
  if (mind.revealCount) {
    sections.push(`${mind.revealCount} private moment${mind.revealCount === 1 ? "" : "s"} recorded so far.`);
  }
  if (sections.length === 0) return false;
  const body = sections.join("\n\n");

  const base = (card.description || "").split(MIND_NOTES_MARKER)[0].replace(/\s+$/, "");
  card.description = `${base}\n\n${MIND_NOTES_MARKER}\n${body}`.trim();
  return true;
}

function splitThoughtSentences(thought) {
  const sentences = (typeof Library !== "undefined" && Library.splitSentences)
    ? Library.splitSentences(String(thought || ""))
    : [String(thought || "")].filter(Boolean);
  return { feelingSentence: sentences[0] || thought, wantSentence: sentences[1] || null };
}

function forgetMentionTracking(name) {
  delete state.unsaid.codex.mentionCounts[name];
  delete state.unsaid.codex.attempts[name];
  delete state.unsaid.codex.firstSeenTurn[name];
  delete state.unsaid.codex.introducedTurn[name];
  delete state.unsaid.codex.likelyCharacters[name];
  delete state.unsaid.codex.observedTypes[name];
  delete state.unsaid.codex.appearanceTurns[name];
  delete state.unsaid.codex.evidence[name];
  delete state.unsaid.codex.lastMentionTurn[name];
  delete state.unsaid.codex.lastAttemptTurn[name];
  delete state.unsaid.codex.candidateScores[name];
  delete state.unsaid.codex.typeVotes[name];
  delete state.unsaid.codex.trustedEntities[name];
  delete state.unsaid.codex.lastConfidenceTurn[name];
  delete state.unsaid.codex.lastTypeVoteTurn[name];
}

function createMind() {
  return {
    core: null,
    coreHistory: [],
    coreSetTurn: null,
    tensionLevel: 0,
    revealCount: 0,
    feeling: null,
    feelingHistory: [],
    want: null,
    lastThoughtText: null,
    // Recent distinct private thought angles are kept separately from the
    // durable thought bank. This is a tiny anti-loop cache: it lets the
    // prompt reject semantic rephrasings of the last few reveals without
    // growing state forever.
    thoughtHistory: [],
    relations: {},
    relationOrder: [],
    relationHistory: {},
    // A bounded adaptive "thought bank" complements the stable core truth.
    // The core prevents personality drift; the bank lets goals, plans, fears,
    // guarded secrets, beliefs and meaningful memories evolve organically.
    thoughtBank: {},
    thoughtOrder: [],
    lastReflectionTurn: null,
    recentTwistImpacts: [],
    lastTurn: state.unsaid.turn
  };
}

function adaptiveMindSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28) || "unknown";
}

function ensureAdaptiveMindShape(mind) {
  if (!mind || typeof mind !== "object") return;
  if (!mind.thoughtBank || typeof mind.thoughtBank !== "object" || Array.isArray(mind.thoughtBank)) {
    mind.thoughtBank = {};
  }
  if (!Array.isArray(mind.thoughtOrder)) mind.thoughtOrder = [];
  mind.thoughtOrder = mind.thoughtOrder.filter(key =>
    typeof key === "string" && Object.prototype.hasOwnProperty.call(mind.thoughtBank, key)
  );
}

function adaptiveMindKeyFor(thought, about, isCoreShift, feeling, revealCount) {
  const text = String(thought || "").toLowerCase();
  if (isCoreShift) return "identity_anchor";
  if (about) return "relationship_" + adaptiveMindSlug(about);
  if (/\b(?:secret|hide|hidden|conceal|never tell|can't tell|cannot tell|mustn't know|must not know|keep this from)\b/i.test(text)) return "guarded_secret";
  if (/\b(?:afraid|fear|fearful|terrified|dread|worried|worry|anxious|panic|uneasy about)\b/i.test(text)) return "active_fear";
  if (/\b(?:plan|intend|intends|going to|next I|next we|must now|need to|should do|will try|have to find|have to get|have to stop)\b/i.test(text)) return "current_plan";
  if (/\b(?:want|wants|hope|hopes|wish|wishes|need|needs|long for|yearn|goal|aim)\b/i.test(text)) return "current_goal";
  if (/\b(?:guilt|guilty|regret|ashamed|shame|remorse|shouldn't have|should not have)\b/i.test(text)) return "unresolved_guilt";
  if (/\b(?:believe|believes|trust|trusts|doubt|doubts|suspect|suspects|think that|convinced)\b/i.test(text)) return "working_belief";
  if (/\b(?:remember|remembers|memory|reminds me|reminded me|can't forget|cannot forget)\b/i.test(text)) return "meaningful_memory";
  if (/\b(?:promise|vow|swear|swore|commit|committed)\b/i.test(text)) return "private_commitment";
  const emotionKey = adaptiveMindSlug(feeling || "reflection").slice(0, 14);
  return "reflection_" + emotionKey + "_" + (((Number(revealCount) || 0) % 3) + 1);
}

function adaptiveMindProtectedKey(key) {
  return key === "identity_anchor" ||
    /^relationship_/.test(key) ||
    key === "guarded_secret" ||
    key === "private_commitment";
}

function rememberAdaptiveThought(mind, thought, about, isCoreShift, feeling, cfg) {
  if (!mind || !thought || !cfg || cfg.adaptiveMindEnabled === false) return false;
  ensureAdaptiveMindShape(mind);

  const clean = String(thought).replace(/\s+/g, " ").trim().slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
  if (!clean) return false;

  const key = adaptiveMindKeyFor(clean, about, isCoreShift, feeling, mind.revealCount);
  const writeKey = memoryKey => {
    if (!memoryKey) return;
    mind.thoughtBank[memoryKey] = clean;
    const oldIndex = mind.thoughtOrder.indexOf(memoryKey);
    if (oldIndex !== -1) mind.thoughtOrder.splice(oldIndex, 1);
    mind.thoughtOrder.push(memoryKey);
  };
  writeKey(key);

  // A relationship thought can also carry a durable plan/fear/secret/goal.
  // Preserve both dimensions when they are genuinely present instead of
  // forcing all social thoughts into a single relationship bucket.
  if (about && !isCoreShift) {
    const semanticKey = adaptiveMindKeyFor(clean, null, false, feeling, mind.revealCount);
    if (semanticKey !== key && !/^reflection_/.test(semanticKey)) writeKey(semanticKey);
  }

  const slotLimit = Math.min(
    ADAPTIVE_MIND_MAX_SLOTS,
    Math.max(ADAPTIVE_MIND_MIN_SLOTS, Number(cfg.adaptiveMindSlots) || UNSAID_DEFAULTS.adaptiveMindSlots)
  );

  while (mind.thoughtOrder.length > slotLimit) {
    let victimIndex = mind.thoughtOrder.findIndex(k => !adaptiveMindProtectedKey(k));
    if (victimIndex < 0) victimIndex = 0;
    const victim = mind.thoughtOrder.splice(victimIndex, 1)[0];
    if (victim) delete mind.thoughtBank[victim];
  }
  return true;
}

function adaptiveMindDigest(mind, target, maxItems) {
  if (!mind) return "";
  ensureAdaptiveMindShape(mind);
  const limit = Math.max(1, Math.min(6, Number(maxItems) || 4));
  const wanted = [];
  const pushKey = key => {
    if (!key || wanted.includes(key) || !mind.thoughtBank[key]) return;
    wanted.push(key);
  };

  if (target) pushKey("relationship_" + adaptiveMindSlug(target));
  [
    "identity_anchor",
    "current_plan",
    "current_goal",
    "active_fear",
    "guarded_secret",
    "private_commitment",
    "working_belief",
    "unresolved_guilt",
    "meaningful_memory"
  ].forEach(pushKey);

  for (let i = mind.thoughtOrder.length - 1; i >= 0 && wanted.length < limit; i--) {
    pushKey(mind.thoughtOrder[i]);
  }

  // One private thought can legitimately populate two semantic slots (for
  // example relationship_carver + current_plan). Do not pay context tokens
  // twice for identical text; keep the first/highest-priority label only.
  const seenValues = new Set();
  const digestItems = [];
  for (let i = 0; i < wanted.length && digestItems.length < limit; i++) {
    const key = wanted[i];
    const value = String(mind.thoughtBank[key] || "").replace(/\s+/g, " ").trim().slice(0, 150);
    if (!value) continue;
    const normalized = value.toLowerCase();
    if (seenValues.has(normalized)) continue;
    seenValues.add(normalized);
    digestItems.push(`${key.replace(/_/g, " ")}="${value}"`);
  }
  return digestItems.join("; ");
}

function loadMindFromCard(card) {
  if (!card || !card.description) return null;
  const idx = card.description.indexOf(MIND_NOTES_MARKER);
  if (idx === -1) return null;
  const body = card.description.slice(idx + MIND_NOTES_MARKER.length).trim();
  if (!body) return null;

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const mind = createMind();
      if (typeof parsed.core === "string") mind.core = parsed.core;
      if (typeof parsed.feeling === "string") mind.feeling = parsed.feeling;
      if (Array.isArray(parsed.feelingHistory)) {
        mind.feelingHistory = parsed.feelingHistory
          .filter(f => typeof f === "string" && f.trim())
          .slice(-FEELING_HISTORY_LIMIT);
      }
      if (typeof parsed.lastThought === "string") mind.lastThoughtText = parsed.lastThought;
      if (Array.isArray(parsed.thoughtHistory)) {
        mind.thoughtHistory = parsed.thoughtHistory
          .filter(v => typeof v === "string" && v.trim())
          .map(v => v.replace(/\s+/g, " ").trim().slice(0, ADAPTIVE_MIND_TEXT_LIMIT))
          .slice(-THOUGHT_HISTORY_LIMIT);
      } else if (mind.lastThoughtText) {
        mind.thoughtHistory = [mind.lastThoughtText];
      }
      if (typeof parsed.want === "string") mind.want = parsed.want;
      if (typeof parsed.revealCount === "number" && parsed.revealCount >= 0) mind.revealCount = Math.floor(parsed.revealCount);
      if (typeof parsed.lastRevealAgo === "number" && isFinite(parsed.lastRevealAgo) && parsed.lastRevealAgo >= 0) {
        mind.lastTurn = state.unsaid.turn - parsed.lastRevealAgo;
      }
      if (typeof parsed.tensionLevel === "number" && isFinite(parsed.tensionLevel)) {
        mind.tensionLevel = Math.max(0, Math.min(TENSION_THRESHOLD * DRASTIC_TENSION_MULTIPLIER, parsed.tensionLevel));
      }
      if (Array.isArray(parsed.recentTwistImpacts)) {
        mind.recentTwistImpacts = parsed.recentTwistImpacts
          .filter(x => x && typeof x === "object")
          .slice(-4);
      }
      if (parsed.thoughtBank && typeof parsed.thoughtBank === "object" && !Array.isArray(parsed.thoughtBank)) {
        const keys = Array.isArray(parsed.thoughtOrder) ? parsed.thoughtOrder : Object.keys(parsed.thoughtBank);
        keys.slice(-ADAPTIVE_MIND_MAX_SLOTS).forEach(key => {
          if (typeof key !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(key)) return;
          const value = parsed.thoughtBank[key];
          if (typeof value !== "string" || !value.trim()) return;
          mind.thoughtBank[key] = value.replace(/\s+/g, " ").trim().slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
          mind.thoughtOrder.push(key);
        });
      }
      if (typeof parsed.lastReflectionAgo === "number" && isFinite(parsed.lastReflectionAgo) && parsed.lastReflectionAgo >= 0) {
        mind.lastReflectionTurn = state.unsaid.turn - parsed.lastReflectionAgo;
      }

      // New notes use the correctly named coreStableForTurns field. Older
      // notes wrote the same elapsed-turn value under coreStableSince.
      const stableFor = (typeof parsed.coreStableForTurns === "number")
        ? parsed.coreStableForTurns
        : parsed.coreStableSince;
      if (typeof stableFor === "number" && stableFor >= 0) {
        mind.coreSetTurn = state.unsaid.turn - stableFor;
      }

      if (Array.isArray(parsed.coreHistory)) {
        mind.coreHistory = parsed.coreHistory
          .filter(v => typeof v === "string" && v.trim())
          .slice(-2);
      } else if (typeof parsed.formerlyBelieved === "string" && parsed.formerlyBelieved) {
        mind.coreHistory = [parsed.formerlyBelieved];
      }

      if (parsed.relations && typeof parsed.relations === "object") {
        Object.keys(parsed.relations).slice(0, MAX_RELATIONS_PER_CHARACTER * 2).forEach(other => {
          const r = parsed.relations[other];
          const current = r && typeof r === "object" ? r.current : r;
          if (typeof current !== "string" || !current.trim()) return;
          if (mind.relationOrder.length >= MAX_RELATIONS_PER_CHARACTER) return;

          mind.relations[other] = current.trim();
          mind.relationOrder.push(other);
          const history = (r && Array.isArray(r.history) && r.history.length > 0)
            ? r.history.filter(v => typeof v === "string" && v.trim()).slice(-RELATION_HISTORY_LIMIT)
            : [current.trim()];
          mind.relationHistory[other] = history.length ? history : [current.trim()];
        });
      }

      const hasMeaningfulState =
        !!mind.core ||
        !!mind.feeling ||
        !!mind.want ||
        !!mind.lastThoughtText ||
        (mind.revealCount || 0) > 0 ||
        (mind.coreHistory && mind.coreHistory.length > 0) ||
        mind.relationOrder.length > 0 ||
        (mind.thoughtOrder && mind.thoughtOrder.length > 0) ||
        (mind.recentTwistImpacts && mind.recentTwistImpacts.length > 0);
      return hasMeaningfulState ? mind : null;
    }
  } catch (e) {}

  const mind = createMind();
  let found = false;
  const coreMatch = body.match(/Core truth:\n([\s\S]*?)(?:\n\n|$)/);
  if (coreMatch && coreMatch[1].trim()) {
    // The prose writer (syncMindToCard) appends a stability annotation
    // directly onto this same line — "<belief> (steady for N turns)" —
    // since it reads naturally as one sentence for the player. But that
    // annotation is a transient, freshly-recomputed display value (from
    // state.unsaid.turn - mind.coreSetTurn), not part of the belief
    // itself, and this capture group has no way to tell them apart from
    // plain text. Confirmed directly via a full sync-then-reload cycle:
    // without stripping it here, a reload after the core had stabilized
    // permanently baked the stale "(steady for 6 turns)" text into
    // mind.core itself — corrupting the actual belief a little more
    // permanently with every future reload, and something the model
    // would then see as if it were literally part of the character's
    // stated belief on their next reveal instruction.
    const rawCore = coreMatch[1].trim();
    const stabilityMatch = rawCore.match(/\s*\(steady for (\d+) turns?\)\s*$/);
    mind.core = rawCore.replace(/\s*\(steady for \d+ turns?\)\s*$/, "");
    // The elapsed-turn count this annotation encodes is exactly what's
    // needed to reconstruct coreSetTurn (never otherwise read back on
    // reload, same gap as the JSON path above) — an approximation, since
    // state.unsaid.turn at reload time isn't the same moment as the
    // original sync, but far better than always restarting the
    // stability clock from zero as if the belief had just now formed.
    if (stabilityMatch) mind.coreSetTurn = state.unsaid.turn - parseInt(stabilityMatch[1], 10);
    found = true;
  }
  const formerlyMatch = body.match(/Formerly believed:\n([\s\S]*?)(?:\n\n|$)/);
  if (formerlyMatch && formerlyMatch[1].trim()) {
    mind.coreHistory = [formerlyMatch[1].trim()];
    found = true;
  }
  const feelingMatch = body.match(/Currently feeling:\s*([^\n]+)/);
  if (feelingMatch) { mind.feeling = feelingMatch[1].trim(); found = true; }
  const wantMatch = body.match(/Wants:\s*([^\n]+)/);
  if (wantMatch) { mind.want = wantMatch[1].trim(); found = true; }
  const impactMatch = body.match(/Recent confirmed plot impact:\s*([^\n]+)/);
  if (impactMatch) {
    const rawImpact = impactMatch[1].trim();
    const im = rawImpact.match(/^([^()]+?)\s*\(([^)]+)\)(?:,\s*connected to\s*(.+))?$/);
    mind.recentTwistImpacts = [{
      turn: state.unsaid.turn,
      category: im ? im[1].trim() : rawImpact,
      tier: im ? im[2].trim() : "significant",
      partner: im && im[3] ? im[3].trim() : null
    }];
    found = true;
  }
  const lastThoughtMatch = body.match(/Last private thought:\n([\s\S]*?)(?:\n\n|$)/);
  if (lastThoughtMatch && lastThoughtMatch[1].trim()) {
    mind.lastThoughtText = lastThoughtMatch[1].trim();
    mind.thoughtHistory = [mind.lastThoughtText];
    found = true;
  }
  const thoughtHistoryMatch = body.match(/Recent private thought angles:\n([\s\S]*?)(?:\n\n|$)/);
  if (thoughtHistoryMatch) {
    const loadedAngles = thoughtHistoryMatch[1].split("\n")
      .map(line => line.replace(/^\s*[•\-*]\s*/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(-THOUGHT_HISTORY_LIMIT);
    if (loadedAngles.length) {
      mind.thoughtHistory = loadedAngles;
      if (mind.lastThoughtText && !mind.thoughtHistory.includes(mind.lastThoughtText)) {
        mind.thoughtHistory.push(mind.lastThoughtText);
        mind.thoughtHistory = mind.thoughtHistory.slice(-THOUGHT_HISTORY_LIMIT);
      }
      found = true;
    }
  }
  const countMatch = body.match(/(\d+) private moments? recorded/);
  if (countMatch) { mind.revealCount = parseInt(countMatch[1], 10); found = true; }
  const relBlockMatch = body.match(/Feelings toward others:\n([\s\S]*?)(?:\n\n|$)/);
  if (relBlockMatch) {
    relBlockMatch[1].split("\n").forEach(line => {
      const m = line.match(/^\s*[•\-*]\s*(.+?)\s*—\s*(.+)$/);
      if (!m) return;
      const other = m[1].trim();
      const trail = m[2].trim();
      const current = trail.includes(" → ") ? trail.split(" → ").pop().trim() : trail;
      if (!other || !current) return;
      mind.relations[other] = current;
      mind.relationOrder.push(other);
      mind.relationHistory[other] = [current];
      found = true;
    });
  }
  const adaptiveBlockMatch = body.match(/Adaptive private memory:\n([\s\S]*?)(?:\n\n|$)/);
  if (adaptiveBlockMatch) {
    adaptiveBlockMatch[1].split("\n").slice(-ADAPTIVE_MIND_MAX_SLOTS).forEach(line => {
      const m = line.match(/^\s*[•\-*]\s*([a-z][a-z0-9_]{0,40})\s*:\s*(.+)$/i);
      if (!m) return;
      const key = m[1].toLowerCase();
      const value = m[2].replace(/\s+/g, " ").trim().slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
      if (!value) return;
      mind.thoughtBank[key] = value;
      mind.thoughtOrder.push(key);
      found = true;
    });
  }
  return found ? mind : null;
}

function seedMindIfKnown(name) {
  if (!name || state.unsaid.minds[name]) return;
  const card = findStoryCardForEntity(name);
  const loaded = card ? loadMindFromCard(card) : null;
  if (loaded) {
    // A mind loaded from an existing card's saved JSON never has a
    // lastTurn field (that JSON blob doesn't track it — see
    // loadMindFromCard above), so this always needed *some* value to
    // make the newly-adopted character immediately eligible rather than
    // waiting through a full cooldown as if they'd just been revealed.
    // Backdating to turn-1000 worked for that one arithmetic check, but
    // leaked straight into two other places that also read lastTurn:
    // `/unsaid status` printed the raw negative number as their actual
    // "last active turn" (confirmed directly from a real player's status
    // report showing "-680" — alarming and clearly wrong-looking even
    // though nothing was actually broken), and pickBySilence uses
    // `currentTurn - lastTurn` as a *weight*, so a fake 1000-turn gap
    // gave a freshly-adopted character a wildly outsized chance of
    // winning every reveal roll versus anyone genuinely tracked, until
    // their own first reveal fixed it. Leaving lastTurn unset instead,
    // with the two read sites below now checking for that explicitly,
    // gets the same "eligible right away" behavior honestly.
    state.unsaid.minds[name] = loaded;
  }
}

function pushCapped(arr, value, limit) {
  if (arr[arr.length - 1] !== value) {
    arr.push(value);
    if (arr.length > limit) arr.shift();
  }
}

// Lightweight semantic-ish anti-looping. This deliberately avoids expensive
// NLP: private thoughts are short, so normalized content-word overlap catches
// most model paraphrases ("I can't trust him" -> "He still isn't someone I
// can trust") for a tiny, predictable runtime cost.
var UNSAID_THOUGHT_STOPWORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could",
  "did","do","does","for","from","had","has","have","he","her","hers","him","his",
  "i","if","in","into","is","it","its","me","my","of","on","or","our","ours",
  "she","so","than","that","the","their","theirs","them","they","this","to","too",
  "was","we","were","what","when","where","which","who","why","will","with","would",
  "you","your","yours","still","really","right","now","just","even","only","very",
  "until","while","though","although","yet","already","again"
]);

function thoughtSimilarityTokens(value) {
  const raw = String(value || "").toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  raw.split(/\s+/).forEach(token => {
    if (!token || token.length < 2 || UNSAID_THOUGHT_STOPWORDS.has(token)) return;
    // Small suffix folding helps detect cheap rephrases without a stemmer.
    let t = token;
    if (t.length > 5 && /(?:ing|ers|ies)$/.test(t)) t = t.replace(/(?:ing|ers|ies)$/, "");
    else if (t.length > 4 && /(?:ed|es)$/.test(t)) t = t.replace(/(?:ed|es)$/, "");
    else if (t.length > 4 && /s$/.test(t) && !/ss$/.test(t)) t = t.slice(0, -1);
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  });
  return out.slice(0, 36);
}

function thoughtSimilarity(a, b) {
  const aa = thoughtSimilarityTokens(a);
  const bb = thoughtSimilarityTokens(b);
  if (!aa.length || !bb.length) {
    return String(a || "").replace(/\s+/g, " ").trim().toLowerCase() ===
      String(b || "").replace(/\s+/g, " ").trim().toLowerCase() ? 1 : 0;
  }
  const sa = new Set(aa);
  const sb = new Set(bb);
  let shared = 0;
  sa.forEach(token => { if (sb.has(token)) shared += 1; });
  const union = sa.size + sb.size - shared;
  const jaccard = union ? shared / union : 0;
  const containment = shared / Math.max(1, Math.min(sa.size, sb.size));
  // Containment catches a short paraphrase embedded in a slightly longer
  // thought; Jaccard protects against a couple of generic shared words.
  return Math.max(jaccard, containment * 0.9);
}

function isNearRepeatThought(mind, thought) {
  if (!mind || !thought) return false;
  const history = Array.isArray(mind.thoughtHistory) && mind.thoughtHistory.length
    ? mind.thoughtHistory.slice(-THOUGHT_HISTORY_LIMIT)
    : (mind.lastThoughtText ? [mind.lastThoughtText] : []);
  for (let i = history.length - 1; i >= 0; i--) {
    if (thoughtSimilarity(history[i], thought) >= 0.72) return true;
  }
  return false;
}

function recordThoughtHistory(mind, thought) {
  if (!mind || !thought) return;
  if (!Array.isArray(mind.thoughtHistory)) mind.thoughtHistory = [];
  const clean = String(thought).replace(/\s+/g, " ").trim().slice(0, ADAPTIVE_MIND_TEXT_LIMIT);
  if (!clean) return;
  // Avoid wasting the tiny ring buffer on near-identical formatting variants.
  const duplicateIndex = mind.thoughtHistory.findIndex(v => thoughtSimilarity(v, clean) >= 0.92);
  if (duplicateIndex !== -1) mind.thoughtHistory.splice(duplicateIndex, 1);
  mind.thoughtHistory.push(clean);
  if (mind.thoughtHistory.length > THOUGHT_HISTORY_LIMIT) {
    mind.thoughtHistory = mind.thoughtHistory.slice(-THOUGHT_HISTORY_LIMIT);
  }
}

function pickBySilence(names, currentTurn) {
  if (!Array.isArray(names) || names.length === 0) return null;
  const weights = names.map(name => {
    const mind = state.unsaid.minds[name];
    if (!mind || typeof mind.lastTurn !== "number") return 24;
    return Math.max(1, Math.min(20, currentTurn - mind.lastTurn));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < names.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return names[i];
  }
  return names[names.length - 1];
}

function unsaidLastAliasIndex(name, text) {
  const source = String(text || "").toLowerCase();
  if (!source) return -1;
  const aliases = aliasesForUnsaidCharacter(name);
  let best = -1;
  aliases.forEach(alias => {
    const clean = String(alias || "").trim().toLowerCase();
    if (!clean) return;
    const at = source.lastIndexOf(clean);
    if (at > best) best = at;
  });
  return best;
}

// Reveal selection is no longer just a lottery based on who has been silent
// longest. It still protects quiet characters from starvation, but adds scene
// recency and unresolved psychological pressure so the thought usually belongs
// to the NPC the current moment is actually about.
function pickUnsaidThinker(names, currentTurn, recentText) {
  if (!Array.isArray(names) || names.length === 0) return null;
  const sourceLength = Math.max(1, String(recentText || "").length);
  const weights = names.map(name => {
    const mind = state.unsaid.minds[name];
    const silence = (!mind || typeof mind.lastTurn !== "number")
      ? 18
      : Math.max(1, Math.min(16, currentTurn - mind.lastTurn));
    const at = unsaidLastAliasIndex(name, recentText);
    const recency = at < 0 ? 0 : Math.max(1, Math.round(12 * (at / sourceLength)));
    let pressure = 0;
    if (mind) {
      ensureAdaptiveMindShape(mind);
      if (mind.thoughtBank.current_plan || mind.thoughtBank.current_goal || mind.thoughtBank.private_commitment) pressure += 2;
      const impacts = Array.isArray(mind.recentTwistImpacts) ? mind.recentTwistImpacts : [];
      const latestImpact = impacts.length ? impacts[impacts.length - 1] : null;
      if (latestImpact && typeof latestImpact.turn === "number" && currentTurn - latestImpact.turn <= 5) pressure += 3;
      if (typeof mind.tensionLevel === "number" && mind.tensionLevel >= TENSION_THRESHOLD) pressure += 2;
    }
    return Math.max(1, silence + recency + pressure);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < names.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return names[i];
  }
  return names[names.length - 1];
}

function compactContinuityValue(value, maxLen) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  const limit = Math.max(30, Number(maxLen) || 140);
  return clean.length <= limit ? clean : clean.slice(0, limit - 1).trimEnd() + "…";
}

function unsaidContinuityScore(name, mind, baseText) {
  let score = 0;
  const idx = unsaidLastAliasIndex(name, String(baseText || "").slice(-6000));
  if (idx >= 0) score += 5 + Math.round((idx / Math.max(1, String(baseText || "").slice(-6000).length)) * 5);
  if (!mind) return score;
  ensureAdaptiveMindShape(mind);
  if (mind.thoughtBank.current_plan) score += 6;
  if (mind.thoughtBank.current_goal) score += 5;
  if (mind.thoughtBank.private_commitment) score += 4;
  if (mind.want) score += 3;
  if (mind.core) score += 2;
  if (mind.relationOrder && mind.relationOrder.length) score += 2;
  return score;
}

// On turns where no hidden thought is requested, established psychology still
// matters. This instruction is deliberately narrator-only and compact: it
// turns plans/goals/relationships into visible behavioral continuity without
// forcing another thought marker or letting NPCs telepathically know each
// other's private state.
function buildBehaviorContinuityInstruction(activeNames, baseText, cfgOverride) {
  const cfg = cfgOverride || UNSAID_DEFAULTS;
  if (cfg.behavioralContinuity === false || !Array.isArray(activeNames) || !activeNames.length) return "";
  const cap = Math.max(1, Math.min(4, Number(cfg.behavioralContinuityCharacters) || UNSAID_DEFAULTS.behavioralContinuityCharacters));
  const candidates = activeNames.map(name => ({ name, mind: state.unsaid.minds[name] }))
    .filter(x => x.mind && (x.mind.core || x.mind.want || (x.mind.thoughtOrder && x.mind.thoughtOrder.length) || (x.mind.relationOrder && x.mind.relationOrder.length)))
    .sort((a, b) => unsaidContinuityScore(b.name, b.mind, baseText) - unsaidContinuityScore(a.name, a.mind, baseText))
    .slice(0, cap);
  if (!candidates.length) return "";

  const lines = [];
  candidates.forEach(({ name, mind }) => {
    ensureAdaptiveMindShape(mind);
    const parts = [];
    if (mind.thoughtBank.current_plan) parts.push(`plan: ${compactContinuityValue(mind.thoughtBank.current_plan, 120)}`);
    if (mind.thoughtBank.current_goal) parts.push(`goal: ${compactContinuityValue(mind.thoughtBank.current_goal, 110)}`);
    if (mind.thoughtBank.private_commitment) parts.push(`commitment: ${compactContinuityValue(mind.thoughtBank.private_commitment, 100)}`);
    if (!parts.length && mind.want) parts.push(`want: ${compactContinuityValue(mind.want, 110)}`);
    if (parts.length < 2 && mind.core) parts.push(`core: ${compactContinuityValue(mind.core, 105)}`);

    // Add only one relation, preferring another character who is in this scene.
    let relationTarget = null;
    if (mind.relationOrder && mind.relationOrder.length) {
      for (let i = mind.relationOrder.length - 1; i >= 0; i--) {
        if (activeNames.includes(mind.relationOrder[i])) { relationTarget = mind.relationOrder[i]; break; }
      }
      if (!relationTarget) relationTarget = mind.relationOrder[mind.relationOrder.length - 1];
    }
    if (relationTarget && mind.relations && mind.relations[relationTarget]) {
      parts.push(`toward ${relationTarget}: ${compactContinuityValue(mind.relations[relationTarget], 70)}`);
    }
    if (parts.length) lines.push(`${name} — ${parts.slice(0, 3).join("; ")}`);
  });
  if (!lines.length) return "";

  const prefix = `\n[UNSAID behavioral continuity — narrator-only. Let these established private motives subtly affect what active NPCs choose, avoid, notice, hesitate over, or pursue:\n`;
  const suffix = `\nPRIVATE-SAFETY RULE: Do not quote/expose these notes as narration, dialogue, or mind-reading. Other characters do not know them unless the visible story revealed them. Use only what matters naturally now. Never append an UNSAID thought marker because of this note alone.]\n`;
  const roomForLines = Math.max(80, UNSAID_CONTINUITY_MAX_CHARS - prefix.length - suffix.length);
  let body = lines.join("\n");
  if (body.length > roomForLines) body = body.slice(0, Math.max(20, roomForLines - 1)).replace(/\s+$/, "") + "…";
  return prefix + body + suffix;
}

function naturalCoreShiftEligible(mind, allowCoreShift) {
  if (!allowCoreShift || !mind) return false;
  const tension = typeof mind.tensionLevel === "number" ? mind.tensionLevel : 0;
  const atThreshold = tension >= TENSION_THRESHOLD;
  const atDrasticTier = tension >= TENSION_THRESHOLD * DRASTIC_TENSION_MULTIPLIER;
  const naturallyEligible = (mind.revealCount || 0) >= REVEALS_BEFORE_SHIFT_ELIGIBLE;
  return atDrasticTier || (atThreshold && naturallyEligible);
}

function compactMindScenarioGuard() {
  try {
    const p = Library.currentScenarioProfile("");
    if (!p || !p.enabled) return "";
    const tags = p.tags && p.tags.length ? p.tags.slice(0, 3).join(", ") : "general";
    return ` Keep this psychologically and socially appropriate to the current ${tags} scenario; do not invent unsupported powers, technology, magic, institutions, ranks, species, or relationships.`;
  } catch (e) {
    return "";
  }
}

function buildCoreCheckInstruction(chosen, mind) {
  const coreNote = mind && mind.core ? ` Their current anchor: "${mind.core}".` : "";
  const tensionNote = mind && typeof mind.tensionLevel === "number"
    ? (mind.tensionLevel >= TENSION_THRESHOLD
      ? " Their feelings have been genuinely unsettled for a while now — this may well be the moment."
      : " Their feelings have been fairly steady lately, for what that's worth.")
    : "";
  const scenarioNote = compactMindScenarioGuard();
  const twistBridgeNote = Library.twistPressureForMind ? Library.twistPressureForMind(chosen) : "";
  return `\n[Continue the visible story normally FIRST. Only after the visible prose, consider whether recent events have genuinely, permanently changed how ${chosen} sees themselves — not just a passing mood.${coreNote}${tensionNote}${scenarioNote}${twistBridgeNote} If yes, append at the very end (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed) "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" (replace [one-word-emotion] with an actual word, not the literal placeholder) with 1–2 concise sentences inside the required 《 》 marker. If nothing that significant has happened, do not force a marker. Never return only the hidden marker; the visible story continuation comes first.]\n`;
}

function buildAndFitThoughtInstruction(chosen, active, baseText, allowCoreShift, cfgOverride) {
  const mind = state.unsaid.minds[chosen];
  const cfg = cfgOverride || UNSAID_DEFAULTS;
  const scenarioNote = compactMindScenarioGuard();
  const twistBridgeNote = Library.twistPressureForMind ? Library.twistPressureForMind(chosen) : "";

  const others = (active || []).filter(n => n !== chosen);
  const withHistory = others.filter(n => mind && mind.relations && mind.relations[n]);
  let target = null;
  // Prefer whoever is actually most recent in the live scene. Older builds
  // could make a character privately react to an off-screen relationship
  // simply because it was the last relation stored, even while another NPC
  // had just spoken to them. Scene salience wins; relationship history then
  // supplies continuity for that target if it exists.
  const sceneTailLower = String(baseText || "").slice(-5000).toLowerCase();
  let bestSceneIndex = -1;
  others.forEach(other => {
    const at = sceneTailLower.lastIndexOf(String(other || "").toLowerCase());
    if (at > bestSceneIndex) {
      bestSceneIndex = at;
      target = at >= 0 ? other : target;
    }
  });
  if (!target && withHistory.length > 0 && mind && mind.relationOrder) {
    for (let i = mind.relationOrder.length - 1; i >= 0; i--) {
      if (withHistory.includes(mind.relationOrder[i])) {
        target = mind.relationOrder[i];
        break;
      }
    }
  }
  if (!target) {
    target = withHistory.length > 0
      ? withHistory[Math.floor(Math.random() * withHistory.length)]
      : (others.length > 0 ? others[Math.floor(Math.random() * others.length)] : null);
  }

  const historyNote = mind && mind.feelingHistory && mind.feelingHistory.length > 1
    ? ` Their feelings lately have gone: ${mind.feelingHistory.join(" → ")}.`
    : "";
  const wantNote = mind && mind.want ? ` Last known want: "${mind.want}" (can change if the scene moves them).` : "";

  const recentThoughtAngles = mind
    ? ((Array.isArray(mind.thoughtHistory) && mind.thoughtHistory.length)
      ? mind.thoughtHistory.slice(-3)
      : (mind.lastThoughtText ? [mind.lastThoughtText] : []))
    : [];
  const varietyNote = recentThoughtAngles.length
    ? ` Do not merely repeat or paraphrase these recent private-thought angles: ${recentThoughtAngles.map(v => `"${String(v).replace(/\s+/g, " ").trim().slice(0, 180)}"`).join(" | ")}. Advance, complicate, contradict, reprioritize, or react to something genuinely new in the visible scene instead.`
    : "";

  const adaptiveDigest = (mind && cfg.adaptiveMindEnabled !== false)
    ? adaptiveMindDigest(mind, target, 4)
    : "";
  const adaptiveNote = adaptiveDigest
    ? ` Durable private memory already established: ${adaptiveDigest}. Preserve continuity unless the visible story gives a real reason to update it; do not treat private memory as something other characters know.`
    : "";
  const reflectionInterval = Math.max(2, Math.min(20, Number(cfg.adaptiveReflectionInterval) || UNSAID_DEFAULTS.adaptiveReflectionInterval));
  const reflectionDue = !!mind && cfg.adaptiveMindEnabled !== false &&
    ((Number(mind.revealCount) || 0) + 1) % reflectionInterval === 0;
  const reflectionNote = reflectionDue
    ? ` This is a deeper-reflection turn: in addition to the immediate reaction, let the thought naturally expose or update ONE durable inner thread such as a goal, plan, fear, guarded secret, belief, commitment, unresolved guilt, relationship expectation, or meaningful memory. It must be supported by the story or existing private memory — never invent unsupported biography or world facts just to fill a slot.`
    : "";

  let instruction;
  if (target) {
    const relHistory = mind && mind.relationHistory && mind.relationHistory[target];
    const coreNote = mind && mind.core ? ` Core truth: "${mind.core}".` : "";
    const relationNote = relHistory && relHistory.length > 1
      ? ` Their feeling toward ${target} has gone: ${relHistory.join(" → ")} — build on that shift unless the scene reverses it.`
      : (mind && mind.relations && mind.relations[target]
        ? ` Feels ${mind.relations[target]} toward ${target} unless this scene shifts it.`
        : "");
    instruction = `\n[Continue the visible story normally FIRST. Then, at the very end, append ${chosen}'s unspoken reaction to ${target} — 1–2 concise sentences inside the required 《 》 marker: how they really feel about ${target} right now, and what they secretly want from this moment. ${target} can't perceive it.${coreNote}${relationNote}${historyNote}${wantNote}${varietyNote}${adaptiveNote}${reflectionNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally.${scenarioNote}${twistBridgeNote} Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion], about ${target}: thought.》" Never return only the hidden marker; visible story prose must come first.]\n`;
  } else if (mind && mind.core) {
    const atThreshold = allowCoreShift && typeof mind.tensionLevel === "number" &&
      mind.tensionLevel >= TENSION_THRESHOLD;
    const atDrasticTier = allowCoreShift && typeof mind.tensionLevel === "number" &&
      mind.tensionLevel >= TENSION_THRESHOLD * DRASTIC_TENSION_MULTIPLIER;
    const naturallyEligible = (mind.revealCount || 0) >= REVEALS_BEFORE_SHIFT_ELIGIBLE;
    const shiftEligible = naturalCoreShiftEligible(mind, allowCoreShift);
    const shiftNote = shiftEligible
      ? (atDrasticTier && !naturallyEligible
        ? ` Their feelings have been unraveling for a long time now, unresolved — something this significant would happen regardless. If it's truly earned, you may format this instead as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" to replace their old anchor.`
        : ` Their feelings have been genuinely shifting for a while now, not settling back — if this moment plays into that and something has truly changed how they see themselves, you may format this instead as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" to replace their old anchor. Only do this if it's really earned.`)
      : "";
    instruction = `\n[Continue the visible story normally FIRST. Then, at the very end, append ${chosen}'s private thought — 1–2 concise sentences inside the required 《 》 marker: how they really feel right now, and what they secretly want. Consistent with "${mind.core}" and their feeling of ${mind.feeling} unless this scene shifts it.${historyNote}${wantNote}${varietyNote}${shiftNote}${adaptiveNote}${reflectionNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally.${scenarioNote}${twistBridgeNote} Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it. Never return only the hidden marker; visible story prose must come first.]\n`;
  } else {
    instruction = `\n[Continue the visible story normally FIRST. Then, at the very end, append ${chosen}'s very first private thought — once revealed, it becomes a lasting psychological anchor about who they fundamentally are, not a fleeting reaction and not an excuse to invent unsupported biography. Base it on what the story has actually shown about them so far. Use 1–2 concise sentences inside the required 《 》 marker: what this deep truth is, and what they secretly want because of it. Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally.${scenarioNote}${twistBridgeNote} Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it. Never return only the hidden marker; visible story prose must come first.]\n`;
  }

  return fitInstructionToBudget(baseText, instruction);
}

function getLastActionType() {
  if (typeof history !== "undefined" && Array.isArray(history) && history.length > 0) {
    return history[history.length - 1].type || null;
  }
  return null;
}

function isNewStoryTurn(rawText) {
  if (typeof info !== "undefined" && info && Number.isInteger(info.actionCount)) {
    const current = Math.abs(info.actionCount);
    const isNew = state.unsaid.lastActionCount !== current;
    state.unsaid.lastActionCount = current;
    return isNew;
  }

  // Some models/runtimes omit actionCount. In that case, use a lightweight
  // context signature so a retry/regeneration of the same turn does not age
  // UNSAID/Codex twice.
  let source = typeof rawText === "string" ? rawText : "";
  if (!source && typeof history !== "undefined" && Array.isArray(history) && history.length) {
    const last = history[history.length - 1];
    source = last && typeof last.text === "string" ? last.text : "";
  }
  source = source.slice(-6000);
  const historyStamp = (typeof history !== "undefined" && Array.isArray(history)) ? history.length : 0;
  const stampedSource = source + "|h:" + historyStamp;
  let hash = 0;
  for (let i = 0; i < stampedSource.length; i++) hash = (hash * 31 + stampedSource.charCodeAt(i)) | 0;
  const sig = hash + ":" + stampedSource.length;
  const isNew = state.unsaid.lastStorySignature !== sig;
  state.unsaid.lastStorySignature = sig;
  return isNew;
}

var ESTIMATED_CHARS_PER_TURN = 900;
function recentTurnsText(text, turnCount) {
  const n = typeof turnCount === "number" && turnCount > 0 ? Math.min(20, Math.floor(turnCount)) : 3;
  const maxChars = Math.max(ESTIMATED_CHARS_PER_TURN * n, 1200);
  const parts = [];

  if (typeof history !== "undefined" && Array.isArray(history) && history.length > 0) {
    const start = Math.max(0, history.length - n);
    for (let i = start; i < history.length; i++) {
      const item = history[i];
      if (item && typeof item.text === "string" && item.text.trim()) {
        parts.push(item.text.trim());
      }
    }
  }

  if (typeof text === "string" && text.trim()) {
    const current = text.trim();
    if (parts.length === 0 || parts[parts.length - 1] !== current) parts.push(current);
  }

  return parts.join("\n").slice(-maxChars);
}

function syncFrontMemoryHint(subtleHints) {
  setManagedFrontMemorySegment(
    FRONT_MEMORY_MARKER,
    subtleHints
      ? "Let each character's private feelings subtly color their actions and tone right now, without ever stating them outright."
      : ""
  );
}

// Shared by both the automatic twist->reveal link and the manual /peek
// command: true if a name has no Story Card yet (can't rule it out, so
// allow by default) or an existing card typed blank/"character" — false
// for anything explicitly typed otherwise (Location, Business, Vehicle...),
// so a resolved twist about a business or a stray "/peek <location>" can't
// force a private thought onto something that was never a person.
function isCharacterLikeCard(name, knownCard) {
  if (typeof storyCards === "undefined" || !storyCards) return true;
  const existingCard = knownCard || findStoryCardForEntity(name);
  if (!existingCard) return true;

  const cardType = (existingCard.type || "").trim().toLowerCase();

  // Semantic evidence can repair an old bad card type. A Character card
  // whose own entry says "Race: Human settlement" / "a remote village"
  // should not receive private thoughts just because an older detector gave
  // it the wrong platform type.
  const strongNonCharacter = strongCodexNonCharacterEvidence(name, String(existingCard.entry || ""));
  if (strongNonCharacter && strongNonCharacter.type) return false;

  if (!cardType) return true;
  if (cardType === "character" && codexKindFromExistingCard(existingCard, name) !== "character") {
    return false;
  }
  if (/^(?:character|npc|person|companion|ally|rival|protagonist|antagonist|crewmate|crew member|student|teacher|agent|officer|doctor|patient|athlete|coach|employee|resident)$/i.test(cardType)) {
    return true;
  }
  if (/^(?:location|place|item|object|vehicle|weapon|faction|organization|organisation|business|restaurant|building|city|country|planet|world|class|event|lore)$/i.test(cardType)) {
    return false;
  }

  // Custom Story Card types are common in scenario-specific packs. If the
  // fields themselves clearly describe a person/sapient character, honor
  // that shape instead of rejecting the card solely because the author
  // called its type "Crew", "Resident", "Detective", etc.
  const entry = String(existingCard.entry || "");
  const signals = (entry.match(/^\s*(?:Race|Species|Nature|Strength Level|Personality|Background|Appearance|Abilities|Weaknesses|Relationships)\s*[:=]/gim) || []).length;
  return signals >= 2;
}

function linkTwistPayoffToReveal(entity, tier) {
  if (typeof state === "undefined" || !state.unsaid) return;
  if (state.unsaid.forcedPeek) return;
  if (!isCharacterLikeCard(entity)) return;
  let cfg;
  try { cfg = readUnsaidConfig(); } catch (e) { return; }
  if (!cfg.enabled) return;
  state.unsaid.forcedPeek = entity;
  state.unsaid.forcedPeekCore = (tier === "major" || tier === "cataclysmic") && !!cfg.allowCoreShift;
}
