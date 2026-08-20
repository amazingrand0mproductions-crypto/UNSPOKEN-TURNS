var CP_VERSION = "1.0";

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

var UNSPOKEN_TURNS_VERSION = "2.1.0";

function utText(value) {
  return typeof value === "string" ? value : (value == null ? "" : String(value));
}

function utCards() {
  return (typeof storyCards !== "undefined" && Array.isArray(storyCards)) ? storyCards : [];
}

function utLog(scope, error) {
  try {
    if (typeof log === "function") {
      const message = error && error.message ? error.message : utText(error);
      log(`[UNSPOKEN TURNS] ${scope}: ${message}`);
    }
  } catch (e) {}
}

function utActionKey() {
  if (typeof info !== "undefined" && info && typeof info.actionCount === "number") {
    return `action:${info.actionCount}`;
  }
  return `turn:${state && state.unsaid ? state.unsaid.turn : 0}`;
}

function utUniqueNames(values) {
  const out = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const name = utText(value).trim();
    if (!name) return;
    if (!out.some(existing => {
      try { return isSameCardEntity(existing, name); } catch (e) { return existing.toLowerCase() === name.toLowerCase(); }
    })) out.push(name);
  });
  return out;
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

  categoryBias: ""

};

var CP_INTENSITY_PACING = { low: 10, medium: 6, high: 3 };

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
  theVessel: "someone's body is carrying, containing, or channeling something that isn't their own"
};
var CP_CATEGORY_KEYS = Object.keys(CP_CATEGORIES);

var CP_CATEGORY_CLUSTERS = {
  "Identity & Deception": ["hiddenIdentity","falseAlly","fakedDefeat","doubleAgent","notTheOriginal","theRescuerNeedsRescuing","secretRelation","sleeperAgent","bodySwap","theMirror","unreliableMemory","splitPersonality","theActor","disguisedEnemy","theSubstitute","livingLegend"],
  "Family & Relationship": ["theOriginStory","secretSibling","secretParentage","arrangedFate","theInheritance","disownedHeir","theWard","loversPast","theRival","familyCurse","secretMarriage"],
  "Power & Authority": ["theFigurehead","hiddenSuccessor","coupInMotion","theUsurpersRegret","falseAuthority","theKingmaker","rebellionWithin","theExile","stolenLegacy","theSuccessionWar"],
  "Knowledge & Secrets": ["buriedPast","forbiddenKnowledge","theWitness","codedMessage","theArchive","suppressedTruth","theConfession","falseMemoryImplant","theTranslator","hiddenJournal","hushMoney"],
  "Object & Place": ["hiddenNature","theRelic","falseMap","theVault","cursedGift","theKey","secretPassage","theForgery","livingWeapon","theSanctuary","buriedEvidence"],
  "Motive & Morality": ["ulteriorMotive","trustedFlip","theTest","wrongEnemy","theGreaterGood","selfishRescue","theRedemption","falseVictim","theBreakingPoint","mercyKilling","theProvocateur","guiltDriven","theInterventionist","falseFlag"],
  "Time & Sequence": ["longConGame","theFlashback","alreadyHappened","theCountdown","loopedFate","prematureVictory","theOmen","delayedConsequence","theSetup","secondChance","theRecurrence"],
  "Group & Society": ["allianceOfConvenience","hiddenFaction","infiltratedOrder","theCult","dividedLoyalties","theOutcast","collectiveAmnesia","theGatekeepers","falseConsensus","theInsurance","splinterGroup"],
  "Perception & Reality": ["misdirection","theIllusion","wrongTimeline","theDouble","theSimulation","sharedDelusion","theGaslight","wrongVillain","theRecording","dreamWithinReality","theStandin"],
  "Fate & Destiny": ["secretDebt","sharedFate","theWarningWasReal","theCostWasHidden","thePropheciesTwist","bornForThis","theSacrificePlanned","inheritedEnemy","theChosenWrong","fatesLoophole","theBargain","destinyDeferred","theSign","circleComplete"],
  "Vice & Corruption": ["hiddenAffair","theBlackmail","secretDependency","theExploiter","corruptedOath","theObsession","criminalTies","theCoverUp","soldOut","forbiddenBond"],
  "Body & Transformation": ["hiddenAilment","theInfection","notFullyHuman","theRegression","inheritedTrait","theTransferal","slowPoison","theAdaptation","buriedInstinct","theVessel"]
};
var CP_CLUSTER_NAMES = Object.keys(CP_CATEGORY_CLUSTERS);
var CP_CATEGORY_TO_CLUSTER = {};
CP_CLUSTER_NAMES.forEach(function(cluster) {
  CP_CATEGORY_CLUSTERS[cluster].forEach(function(key) { CP_CATEGORY_TO_CLUSTER[key] = cluster; });
});

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

  hiddenAffair: "Hidden Affair",
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
  theVessel: "The Vessel"
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
  { rx: /\b(old instincts? (?:resurfacing|returning|clawing back)|couldn't explain the sudden urge)\b/i, cat: "buriedInstinct" }
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

  // The batch below closes a real, substantial gap: an audit found 86 of
  // the (at the time) 140 twist categories had no detection pattern in
  // either list at all — meaning they could only ever be picked at
  // random, never actually recognized from real scenario or story text,
  // undermining this whole project's founding requirement that twists
  // build up "logically... not randomly." This doesn't close the whole
  // gap in one pass (that would risk rushed, low-quality patterns), but
  // covers a substantial, carefully-tested spread across every cluster.
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
  "Simply", "Moment", "Voice", "Eyes", "Hand", "Hands", "Face", "Head"
];
// Extra high-frequency prose/UI words that routinely appear capitalized only
// because they start a sentence. Keeping them out of both scanners prevents
// junk names from burning Codex retries or becoming twist entities.
COMMON_CAPITALIZED_STOPWORDS.push(
  "Opened", "Opening", "Closed", "Closing", "Lifted", "Lowered", "Raised",
  "Took", "Taking", "Gave", "Giving", "Pulled", "Pulling", "Pushed", "Pushing",
  "Held", "Holding", "Leaned", "Leaning", "Sat", "Sitting", "Stood", "Standing",
  "Entered", "Entering", "Arrived", "Arriving", "Left", "Leaving", "Returned",
  "Reached", "Reaching", "Turned", "Turning", "Walked", "Walking", "Ran",
  "Running", "Stepped", "Stepping", "Followed", "Following", "Noticed",
  "Noticing", "Felt", "Feeling", "Thought", "Thinking", "Knew", "Knowing",
  "Remembered", "Remembering", "Heard", "Hearing", "Saw", "Seeing", "Found",
  "Finding", "Realized", "Realizing", "Wondered", "Wondering", "Decided",
  "Trying", "Started", "Starting", "Began", "Beginning", "Waited", "Waiting",
  "Spoke", "Speaking", "Said", "Asked", "Replied", "Answered", "Whispered",
  "Murmured", "Shouted", "Smiled", "Frowned", "Nodded", "Shrugged",
  "Man", "Woman", "Girl", "Boy", "Child", "Stranger", "Traveler", "Traveller",
  "Guard", "Soldier", "Crowd", "Room", "Door", "Table", "Chair", "Road", "Path",
  "Street", "Forest", "Tree", "Trees", "House", "Building", "Bar", "Inn",
  "Tavern", "City", "Town", "Village", "Sky", "Air", "Ground", "Floor", "Wall",
  "Window", "Fire", "Water", "Blood", "Sound", "Shadow", "Distance", "Footsteps",
  "Breath", "Heart", "Words", "Plot", "Details", "Memory", "Author", "Authors",
  "Scenario", "Adventure", "Retry", "Regenerate", "Response", "Prompt", "Settings",
  "Config", "Configuration", "Enabled", "Disabled", "True", "False", "Private",
  "Thoughts", "Core", "Truth", "Mentions", "Cooldown", "Retries", "Status",
  "Commands", "Command", "Create", "Created", "Generated", "Automatic"
);

// TWISTS AND TURNS' own additions on top of the shared base — narrative-
// hedging/rumor vocabulary that matters specifically for how loose-thread
// and scenario-hint scanning phrase things ("rumored to," "legend has
// it..."), not really Codex-specific.
var CP_STOPWORDS = new Set([
  ...COMMON_CAPITALIZED_STOPWORDS,
  "Rumored", "Legend", "Legends", "According", "Reportedly", "Allegedly",
  "Apparently", "Eventually", "Recently", "Long"
].map(w => w.toLowerCase()));

var Library = (() => {
  function initState() {
    if (!state.contingency) {
      state.contingency = {
        turn: 0,
        threads: [],
        twistLog: [],
        lastPayoffTurn: -999,
        pendingPayoffId: null,
        pendingSeedId: null,
        forceEntity: null,
        forcePlant: null,
        importedCardSignatures: {},
        lastContextSignature: null,
        lastAuthorsNoteSignature: null,
        pendingPayoffId2: null,
        scriptTurnCount: 0,

        multiplayerNames: []
      };
    }
    if (typeof state.contingency.turn !== "number") state.contingency.turn = 0;
    if (!Array.isArray(state.contingency.threads)) state.contingency.threads = [];
    if (!Array.isArray(state.contingency.twistLog)) state.contingency.twistLog = [];
    if (typeof state.contingency.lastPayoffTurn !== "number") state.contingency.lastPayoffTurn = -999;
    if (typeof state.contingency.pendingPayoffId === "undefined") state.contingency.pendingPayoffId = null;
    if (typeof state.contingency.pendingSeedId === "undefined") state.contingency.pendingSeedId = null;
    if (typeof state.contingency.forceEntity === "undefined") state.contingency.forceEntity = null;
    if (typeof state.contingency.forcePlant === "undefined") state.contingency.forcePlant = null;
    if (!state.contingency.importedCardSignatures || typeof state.contingency.importedCardSignatures !== "object") state.contingency.importedCardSignatures = {};
    if (typeof state.contingency.lastContextSignature === "undefined") state.contingency.lastContextSignature = null;
    if (typeof state.contingency.lastAuthorsNoteSignature === "undefined") state.contingency.lastAuthorsNoteSignature = null;
    if (typeof state.contingency.pendingPayoffId2 === "undefined") state.contingency.pendingPayoffId2 = null;
    if (typeof state.contingency.scriptTurnCount !== "number") state.contingency.scriptTurnCount = 0;
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

  function findEntityInSentence(sentence) {
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
        const result = bridge(i);
        if (result.indexOf(" ") === -1 && typeof CODEX_TITLE_WORDS !== "undefined" && CODEX_TITLE_WORDS.has(result.toLowerCase())) continue;
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
    return out;
  }

  function findKnownEntityInSentence(sentence, titles) {
    try {
      const list = titles || eligibleCardTitles();
      for (let i = 0; i < list.length; i++) {
        if (list[i] && sentence.indexOf(list[i]) !== -1) return list[i];
      }
    } catch (e) {}
    return null;
  }

  function splitSentences(text) {
    if (!text) return [];
    const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    if (typeof SENTENCE_ABBREVIATIONS === "undefined") return rawSentences;
    const sentences = [];
    for (let i = 0; i < rawSentences.length; i++) {
      const s = rawSentences[i];
      const words = s.trim().split(/\s+/);
      const lastWord = (words[words.length - 1] || "").replace(/\.$/, "");
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

  function createThread(c, entity, category, originTurn, cfg) {
    let cat = category && CP_CATEGORIES[category] ? category : null;
    if (!cat) {
      const unused = CP_CATEGORY_KEYS.filter(k => !alreadyResolvedCombo(c, entity, k));
      let pool = unused.length > 0 ? unused : CP_CATEGORY_KEYS;

      if (cfg && cfg.categoryBias) {
        const biasClusters = cfg.categoryBias.split(",").map(s => s.trim());
        const biased = pool.filter(k => biasClusters.indexOf(CP_CATEGORY_TO_CLUSTER[k]) !== -1);
        if (biased.length > 0) pool = biased;
      }

      cat = pool[Math.floor(Math.random() * pool.length)];
    }
    const thread = {
      id: nextId(c),
      entity: entity,
      category: cat,
      originTurn: originTurn,
      seedTouches: 1,
      status: "brewing",
      tier: CP_TIER_MINOR,

      priorTwistCount: priorTwistCountFor(c, entity)
    };
    c.threads.push(thread);
    return thread;
  }

  function tierFor(seedTouches) {
    if (seedTouches >= 10) return CP_TIER_CATACLYSMIC;
    if (seedTouches >= 6) return CP_TIER_MAJOR;
    if (seedTouches >= 3) return CP_TIER_MODERATE;
    return CP_TIER_MINOR;
  }

  function reinforceFromCoreShift(c, cfg, entity) {
    // A core-shift (a character's fundamental self genuinely changing) is
    // strong cross-system material — treat it the same as an ordinary scan
    // hit reinforcing a thread, but from a stronger signal: bump whatever
    // thread already exists on this character, or plant a fresh one biased
    // toward Identity & Deception if none exists yet.
    if (!c || !cfg || !entity) return;
    // Same involvePlayer guard every other thread-creation path already
    // has — in true multiplayer, isPlayerEntity checks against ALL
    // characterNames, not just "you," so this is reachable whenever
    // another player's character ends up in UNSAID's cast list (Codex
    // auto-adds anyone mentioned enough, hand-authored cards get adopted
    // too) and later has a core-shift reveal.
    if (isPlayerEntity(c, entity) && !cfg.involvePlayer) return;
    const existing = c.threads.find(t => t.entity === entity && t.status !== "resolved");
    if (existing) {
      if (existing.status === "brewing") {
        existing.seedTouches += 1;
        existing.tier = tierFor(existing.seedTouches);
        if (isEligible(existing, c, cfg)) existing.status = "ready";
      }
    } else {
      const biasedCfg = Object.assign({}, cfg, { categoryBias: "Identity & Deception" });
      createThread(c, entity, null, c.turn, biasedCfg);
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
  function matchAnyThreadPattern(sentence) {
    for (const p of CP_LOOSE_THREAD_PATTERNS) {
      if (p.rx.test(sentence)) return p.cat;
    }
    for (const p of CP_SCENARIO_HINT_PATTERNS) {
      if (p.rx.test(sentence)) return p.cat;
    }
    return null;
  }

  function scanForLooseThreads(text, c, cfg, cardTitles) {
    if (!text) return;
    const sentences = splitSentences(text);

    let lastEntity = null;
    for (const s of sentences) {
      const sentenceEntity = findKnownEntityInSentence(s, cardTitles) || findEntityInSentence(s);
      if (sentenceEntity) lastEntity = sentenceEntity;
      const cat = matchAnyThreadPattern(s);
      if (cat) {
        const entity = sentenceEntity || lastEntity;
        if (!entity) continue;
        if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;
        if (alreadyResolvedCombo(c, entity, cat)) continue;
        const existing = findThread(c, entity, cat);
        if (existing) {
          if (existing.status === "brewing") {
            existing.seedTouches += 1;
            existing.tier = tierFor(existing.seedTouches);
            if (isEligible(existing, c, cfg)) existing.status = "ready";
          }
        } else {
          createThread(c, entity, cat, c.turn, cfg);
        }
      }
    }
  }

  function matchScenarioCategory(text) {
    if (!text) return null;
    for (const p of CP_SCENARIO_HINT_PATTERNS) {
      if (p.rx.test(text)) return p.cat;
    }
    for (const p of CP_LOOSE_THREAD_PATTERNS) {
      if (p.rx.test(text)) return p.cat;
    }
    return null;
  }

  function alreadyResolvedCombo(c, entity, category) {
    return c.twistLog.some(t => t.entity === entity && t.category === category);
  }

  function creditPartialThread(c, entity, category, cfg, source) {
    const originTurn = c.turn - Math.floor(cfg.minTurnsForPayoff / 2);
    const thread = createThread(c, entity, category, originTurn, cfg);
    thread.seedTouches = Math.max(1, Math.ceil(cfg.minSeedsForPayoff / 2));
    thread.tier = tierFor(thread.seedTouches);
    thread.source = source;
    if (isEligible(thread, c, cfg)) thread.status = "ready";
    return thread;
  }

  function scanStoryCardsForScenarioThreads(c, cfg) {
    if (typeof storyCards === "undefined" || !storyCards) return;
    for (let i = 0; i < storyCards.length; i++) {
      const card = storyCards[i];
      if (!card || !card.title) continue;
      if (isOwnCard(card.title)) continue;

      const descriptionWithoutPrivateThoughts = typeof MIND_NOTES_MARKER !== "undefined"
        ? (card.description || "").split(MIND_NOTES_MARKER)[0]
        : (card.description || "");
      const haystack = (card.entry || "") + " " + descriptionWithoutPrivateThoughts;
      const sig = textSignature(haystack);
      if (c.importedCardSignatures[card.title] === sig) continue;
      c.importedCardSignatures[card.title] = sig;

      const entity = ("" + card.title).trim();
      if (!entity || entity.length < 2) continue;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;

      const category = matchScenarioCategory(haystack);
      if (!category) continue;
      if (alreadyResolvedCombo(c, entity, category)) continue;
      if (findThread(c, entity, category)) continue;

      creditPartialThread(c, entity, category, cfg, "scenario");
    }
  }

  function scanMemoryFieldForThreads(c, cfg, text, sigStateKey, sourceTag, cardTitles) {
    if (!text) return;
    const sig = textSignature(text);
    if (c[sigStateKey] === sig) return;
    c[sigStateKey] = sig;

    const sentences = splitSentences(text);
    let lastEntity = null;
    for (const s of sentences) {
      const sentenceEntity = findKnownEntityInSentence(s, cardTitles) || findEntityInSentence(s);
      if (sentenceEntity) lastEntity = sentenceEntity;
      const category = matchScenarioCategory(s);
      if (!category) continue;
      const entity = sentenceEntity || lastEntity;
      if (!entity) continue;
      if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;
      if (alreadyResolvedCombo(c, entity, category)) continue;
      if (findThread(c, entity, category)) continue;

      creditPartialThread(c, entity, category, cfg, sourceTag);
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
    let brewing = c.threads.filter(t => t.status === "brewing");
    if (cfg && !cfg.involvePlayer) brewing = brewing.filter(t => !isPlayerEntity(c, t.entity));
    if (brewing.length === 0) return null;
    brewing.sort((a, b) => a.seedTouches - b.seedTouches || a.originTurn - b.originTurn);
    return brewing[0];
  }

  function pickMostBuiltUpBrewingThread(c, cfg) {
    let brewing = c.threads.filter(t => t.status === "brewing");
    if (!cfg.involvePlayer) brewing = brewing.filter(t => !isPlayerEntity(c, t.entity));
    if (brewing.length === 0) return null;
    brewing.sort((a, b) => b.seedTouches - a.seedTouches || a.originTurn - b.originTurn);
    return brewing[0];
  }

  function pickPayoffThread(c, cfg) {
    let ready = c.threads.filter(t => t.status === "ready");
    if (!cfg.involvePlayer) ready = ready.filter(t => !isPlayerEntity(c, t.entity));
    if (ready.length === 0) return null;
    ready.sort((a, b) => a.originTurn - b.originTurn);
    return ready[0];
  }

  function pickCompoundPayoffThreads(c, cfg) {
    let ready = c.threads.filter(t => t.status === "ready");
    if (!cfg.involvePlayer) ready = ready.filter(t => !isPlayerEntity(c, t.entity));
    if (ready.length < 2) return null;
    ready.sort((a, b) => a.originTurn - b.originTurn);
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
    return "[Subtle texture only, never explained or drawn attention to: plant one small, " +
      "easy-to-overlook detail connected to " + thread.entity + sourceNote + " that would make sense in " +
      "hindsight if it turned out that " + desc + ". Do not resolve or hint at this being " +
      "important. It should read as ordinary right now." + memoryNote(thread) + "]";
  }

  function payoffHint(thread) {
    const desc = CP_CATEGORIES[thread.category];
    if (thread.wildcard) {
      return "[A sudden but coherent twist involving " + thread.entity + " happens now: " + desc +
        ". This one doesn't need prior setup — invent a believable, specific reason it's true, " +
        "consistent with everything already established about " + thread.entity +
        "." + memoryNote(thread) + " Let the story react to it honestly.]";
    }
    const sourceNote = (thread.source === "scenario" || thread.source === "context" || thread.source === "authorsnote")
      ? " Draw on this world's own established background for " + thread.entity + ", not just recent scenes."
      : "";
    return "[A twist involving " + thread.entity + " is due now: " + desc + ". Let it emerge " +
      "as a logical consequence of details already established about " + thread.entity +
      " in this story — not a random event, not out of nowhere." + sourceNote +
      " Scale it as a " + CP_TIER_LABELS[thread.tier] + " revelation." + memoryNote(thread) +
      " Let the story react to it honestly.]";
  }

  function compoundPayoffHint(threadA, threadB) {
    const descA = CP_CATEGORIES[threadA.category];
    const descB = CP_CATEGORIES[threadB.category];
    const scaleTier = (tierRank(threadA.tier) >= tierRank(threadB.tier)) ? threadA.tier : threadB.tier;
    return "[Two threads resolve together right now, as one connected twist: " +
      threadA.entity + " — " + descA + " — turns out to be tied to " + threadB.entity +
      " — " + descB + ". Invent a specific, logical connection between them built on what's " +
      "already established about each, so the two revelations land as a single discovery, not " +
      "two coincidences. Scale it as a " + CP_TIER_LABELS[scaleTier] + " revelation." +
      memoryNote(threadA) + memoryNote(threadB) + " Let the story react honestly.]";
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
        const d = CP_CATEGORIES[t.category];
        return t.entity + ": " + d.charAt(0).toUpperCase() + d.slice(1) + " (turn " + t.resolvedTurn + ").";
      };
      const entry = recent.map(factLine).join(" ") + " Treat all of this as settled fact going forward.";

      const keys = Array.from(new Set(recent.map(t => t.entity))).join(", ");

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

    const enabledMatch = section.match(/Enable Twists and Turns:\s*(true|false)/i);
    if (enabledMatch) cfg.enabled = enabledMatch[1].toLowerCase() === "true";

    const intensityMatch = section.match(/Intensity[^:]*:\s*(low|medium|high)/i);
    if (intensityMatch) cfg.intensity = intensityMatch[1].toLowerCase();

    const strictMatch = section.match(/Strict logic only[^:]*:\s*(true|false)/i);
    if (strictMatch) cfg.strictLogic = strictMatch[1].toLowerCase() === "true";

    const wildcardMatch = section.match(/Allow wildcard twists:\s*(true|false)/i);
    if (wildcardMatch) cfg.allowWildcard = wildcardMatch[1].toLowerCase() === "true";

    const compoundMatch = section.match(/Allow compound twists:\s*(true|false)/i);
    if (compoundMatch) cfg.allowCompoundTwists = compoundMatch[1].toLowerCase() === "true";

    const involveMatch = section.match(/Involve the player character in twists:\s*(true|false)/i);
    if (involveMatch) cfg.involvePlayer = involveMatch[1].toLowerCase() === "true";

    const logMatch = section.match(/Show resolved twists in the Twist Log:\s*(true|false)/i);
    if (logMatch) cfg.showTwistLog = logMatch[1].toLowerCase() === "true";

    const seedsMatch = section.match(/Minimum seed touches before a twist can pay off:\s*(\d+)/i);
    if (seedsMatch) {
      const n = parseInt(seedsMatch[1], 10);
      if (!isNaN(n) && n >= 1 && n <= 200) cfg.minSeedsForPayoff = n;
    }

    const turnsMatch = section.match(/Minimum turns before a twist can pay off:\s*(\d+)/i);
    if (turnsMatch) {
      const n = parseInt(turnsMatch[1], 10);
      if (!isNaN(n) && n >= 1 && n <= 200) cfg.minTurnsForPayoff = n;
    }

    const payoffCooldownMatch = section.match(/Turns to wait between twist payoffs:\s*(\d+)/i);
    if (payoffCooldownMatch) {
      const n = parseInt(payoffCooldownMatch[1], 10);
      if (!isNaN(n) && n >= 1 && n <= 200) cfg.payoffCooldown = n;
    }

    const capMatch = section.match(/How many resolved twists Established Facts keeps:\s*(\d+)/i);
    if (capMatch) {
      const n = parseInt(capMatch[1], 10);
      if (!isNaN(n) && n >= 1 && n <= 30) cfg.establishedFactsCap = n;
    }

    const biasMatch = section.match(/Theme bias[^:]*:[ \t]*(.*)/i);
    if (biasMatch) {
      const raw = biasMatch[1].trim();
      if (!raw || /^(off|none)$/i.test(raw)) {
        cfg.categoryBias = "";
      } else {
        const requested = raw.split(",").map(s => s.trim()).filter(Boolean);
        const matched = requested
          .map(r => CP_CLUSTER_NAMES.find(clusterName => clusterName.toLowerCase() === r.toLowerCase()))
          .filter(Boolean);
        if (matched.length > 0) cfg.categoryBias = matched.join(", ");
      }
    }
  }

  function updateConfigCard(cfg, c) {
    const card = ensureSharedConfigCard();
    if (!card) return;

    card.entry = spliceConfigSection(card.entry, CONFIG_SECTION_TWIST, renderTwistSection(cfg));

    const brewing = c ? c.threads.filter(t => t.status === "brewing").length : 0;
    const ready = c ? c.threads.filter(t => t.status === "ready").length : 0;
    const resolved = c ? c.twistLog.length : 0;
    const notes = CONFIG_SECTION_TWIST + "\n" +
      "TWISTS AND TURNS — v" + CP_VERSION + "\n" +
      brewing + " brewing · " + ready + " about to surface · " + resolved + " resolved\n\n" +
      "- Enable Twists and Turns: turns the whole twist half on or off.\n" +
      "- Intensity: low / medium / high — how often twists build and land.\n" +
      "- Strict logic only: twists only ever come from a tracked thread, never a wildcard.\n" +
      "- Allow wildcard twists: occasional twist with no build-up.\n" +
      "- Allow compound twists: two threads can resolve together as one.\n" +
      "- Involve the player: twists may target you directly, not just NPCs.\n" +
      "- Show resolved twists in the Twist Log: reveals them on the Twist Log card.\n" +
      "- Minimum seed touches before payoff: reinforcement a thread needs before it's eligible.\n" +
      "- Minimum turns before payoff: minimum age a thread must reach before it's eligible.\n" +
      "- Turns between payoffs: cooldown between any two twists landing.\n" +
      "- Established Facts cap: how many recent twists stay visible to the AI at once.\n" +
      "- Theme bias: lean toward certain themes without overriding what the story's already established. Themes: " + CP_CLUSTER_NAMES.join(", ") + "\n\n" +
      "Commands: /twist, /twist <name>, /plant <name> [category], /twistlog, /threads, /intensity <low|medium|high>, /rescan, /twists";

    card.description = spliceConfigSection(card.description, CONFIG_SECTION_TWIST, notes);
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
        if (t.compoundWith) tags.push("with " + t.compoundWith);
        if (t.source === "scenario" || t.source === "context" || t.source === "authorsnote") tags.push("from scenario");
        return "Turn " + t.resolvedTurn + " — " + t.entity + ": " + CP_CATEGORIES[t.category] + " (" + tags.join(", ") + ")";
      });
      notes = "TWIST LOG — most recent " + lines.length + "\n\n" + lines.join("\n");
    }
    safeSetCard("Twists and Turns — Twist Log", "class", " ", notes);
  }

  return {
    CP_VERSION, CP_DEFAULTS, CP_CATEGORIES, CP_CATEGORY_KEYS, CP_TIER_MINOR, CP_TIER_MODERATE, CP_TIER_MAJOR, CP_TIER_CATACLYSMIC,
    CP_COMPOUND_CHANCE, CP_WILDCARD_CHANCE, CP_CLUSTER_NAMES, CP_CATEGORY_CLUSTERS, CP_CATEGORY_TO_CLUSTER,
    initState, getConfig, pacingFor, effectivePacing, extractCommand, nextId, findEntityInSentence, findKnownEntityInSentence, eligibleCardTitles,
    splitSentences, findThread, findThreadFuzzy, createThread, tierFor, isEligible, priorTwistCountFor, scanForLooseThreads, scanStoryCardsForScenarioThreads,
    scanPlotEssentialsForThreads, scanAuthorsNoteForThreads, pickForeshadowThread, pickMostBuiltUpBrewingThread, pickPayoffThread, pickCompoundPayoffThreads, pickWildcardEntity,
    foreshadowHint, payoffHint, compoundPayoffHint, safeSetCard, createTwistStoryCard, safeLog, applyEntryConfig,
    updateCacheEfficiencyWarning, updateNudgeCard, updateConfigCard, updateTwistLogCard, updateThreadsOverview, reinforceFromCoreShift,
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
  codexCharacterDeadline: 5,
  codexCharacterEvidenceThreshold: 6,
  codexAutoBatchSize: 1,
  playerName: ""
};

var CONTEXT_SAFETY_MARGIN = 20;
var MAX_CARD_ENTRY_LENGTH = 1800;
// Generous enough that no normal game ever notices it, low enough to
// bound the per-turn cost of scanning the cast list for who's currently
// "active" — see readUnsaidConfig for the full reasoning.
var MAX_CAST_SIZE = 60;

var FEELING_HISTORY_LIMIT = 3;
var RELATION_HISTORY_LIMIT = 2;
var MAX_RELATIONS_PER_CHARACTER = 6;
var MENTION_TRACKING_CAP = 150;

var TENSION_THRESHOLD = 3;
var DRASTIC_TENSION_MULTIPLIER = 2;
var REVEALS_BEFORE_SHIFT_ELIGIBLE = 2;

var MIND_NOTES_MARKER = "💭 Inner Life — private, not visible to other characters";
var CAST_LIST_MARKER = "===";
var CODEX_MAX_ATTEMPTS = 5;
var CODEX_MAX_CANDIDATES_PER_TURN = 3;
var CODEX_EVIDENCE_SNIPPET_LIMIT = 3;
var CODEX_FIELD_VALUE_LIMIT = 420;
// Once a name is confidently identified as a character, failed card
// generations retry on the next real story turn instead of waiting for the
// global Codex cooldown. This is what lets a newly introduced character
// actually finish inside the configured deadline rather than merely getting
// its first attempt near that deadline.
var CODEX_CHARACTER_RETRY_INTERVAL = 1;

// Built from the same COMMON_CAPITALIZED_STOPWORDS base TWISTS AND TURNS'
// CP_STOPWORDS uses (defined near the top of this file, alongside
// NAME_ALPHANUM) plus Codex-specific extras — this used to be an entirely
// separate, independently-maintained literal list, which is exactly how it
// drifted out of sync with the twist side's own filtering for so long.
var CODEX_STOPWORDS = new Set([
  ...COMMON_CAPITALIZED_STOPWORDS
].map(w => w.toLowerCase()));

var CODEX_LOCATION_HINTS = /\b(city|state|street|avenue|canyon|terminal|park|building|tower|island|country|nation|kingdom|realm|district|region|planet|world|base|facility|academy|university|bridge|river|mountain|forest|desert|battleground|warzone|hall|tavern|inn|castle|fortress|temple|level|sector|wing|chamber|vault|bay|deck|outpost|colony|settlement|village|town|hamlet|station|harbor|wharf)\b/i;
var CODEX_LOCATION_SUFFIX_HINTS = /(tower|keep|hold|spire|haven|hollow|reach|scraper)/i;

// "Faction" doubles as the best fit for any organization — guild-and-empire
// fantasy terms, but also modern businesses, restaurants, and services,
// none of which fit "location" or "item" well. A real game's Story Cards
// (custom-typed "Business", "Restaurant", "Social Media") showed this gap
// directly: none of the fantasy-only terms below matched "Thorne
// Industries" or "Dragon's Breath Fried Chicken", so both silently fell
// back to being guessed as a character.
var CODEX_FACTION_HINTS = /\b(order|guild|alliance|empire|faction|clan|brotherhood|council|syndicate|coalition|army|legion|cult|society|corporation|company|companies|initiative|division|agency|federation|dynasty|tribe|vanguard|battalion|regiment|squad|cabal|circle|sect|resistance|movement|militia|garrison|industries|industry|enterprises|incorporated|holdings|conglomerate|group|partners|associates|firm|labs?|laboratory|laboratories|studio|studios|productions|pharmaceuticals|restaurant|diner|bistro|caf[eé]|eatery|grill|kitchen|bakery|brewery|pizzeria|steakhouse|deli|hospital|clinic|salon|boutique|store|shop|franchise|chain|brand|app|platform|network|streaming)\b/i;

// Sci-fi vessel/mech/robot vocabulary was missing here entirely — the
// modern-vehicle words (car/truck/van/vehicle) already reflect an earlier
// real gap being closed the same way, but nothing parallel ever got added
// for the sci-fi equivalent, meaning a starship, mech, or robot with a
// name that happens to include one of these words (e.g. "the Mothership,"
// "Unit-9 the Android") had no name-level signal at all and fell entirely
// on the correction-note-plus-scoring fallback — the same accepted,
// unavoidable limitation as a wholly invented name like "Starhopper" with
// no recognizable component in it at all.
var CODEX_ITEM_HINTS = /\b(sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|armou?r|shield|artifact|device|weapon|tool|key|book|tome|potion|elixir|gem|crystal|relic|suit|mask|cloak|helmet|gauntlet|hammer|axe|bow|orb|blaster|scroll|spear|dagger|lance|trident|chalice|sigil|banner|car|truck|motorcycle|motorbike|van|jeep|convertible|sedan|coupe|vehicle|automobile|ship|starship|spaceship|spacecraft|shuttle|cruiser|frigate|freighter|corvette|mech|mecha|robot|android|cyborg|rover|submarine|tank|helicopter|aircraft|airship|mothership|jacket|dress|gown|coat|shirt|blouse|jeans|skirt|boots|shoes|sneakers|scarf|gloves|necklace|bracelet|earrings|sunglasses|phone|smartphone|laptop|tablet|computer|console|headset|drone|camera|backpack|purse|wallet|suitcase)\b/i;

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
  "Mr", "Mrs", "Ms", "Miss", "Dr", "Madam", "Mx"
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
  `\\b(?:(?:${[...SENTENCE_ABBREVIATIONS].filter(w => w.length > 1).join("|")})\\.\\s+)?${CODEX_NAME_TOKEN}(?:\\s+of\\s+${CODEX_NAME_TOKEN}|\\s+${CODEX_NAME_TOKEN}){0,2}\\b`,
  "g"
);

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
  if (typeof state === "undefined" || !state) return;

  if (!state.unsaid || typeof state.unsaid !== "object" || Array.isArray(state.unsaid)) {
    state.unsaid = {};
  }
  const u = state.unsaid;

  if (!u.minds || typeof u.minds !== "object" || Array.isArray(u.minds)) u.minds = {};
  if (!Number.isFinite(Number(u.turn))) u.turn = 0;
  else u.turn = Math.max(0, Math.floor(Number(u.turn)));
  if (typeof u.pending === "undefined") u.pending = null;
  if (typeof u.forcedPeek === "undefined") u.forcedPeek = null;
  if (typeof u.forcedPeekCore === "undefined") u.forcedPeekCore = null;
  if (typeof u.forcedCodex === "undefined") u.forcedCodex = null;
  if (typeof u.skipStoryAdvance !== "boolean") u.skipStoryAdvance = false;
  if (!Number.isFinite(Number(u.consecutiveRevealMisses))) u.consecutiveRevealMisses = 0;
  if (!Number.isFinite(Number(u.lastActionCount))) u.lastActionCount = -1;

  if (!u.codex || typeof u.codex !== "object" || Array.isArray(u.codex)) u.codex = {};
  const c = u.codex;
  [
    "mentionCounts", "attempts", "firstSeenTurn", "introducedTurn",
    "likelyCharacters", "observedTypes", "lastAttemptTurn", "pendingTypes",
    "evidence", "lastMentionAction", "lastEvidenceAction"
  ].forEach(key => {
    if (!c[key] || typeof c[key] !== "object" || Array.isArray(c[key])) c[key] = {};
  });
  if (!Array.isArray(c.pendingNames)) c.pendingNames = [];
  if (!Array.isArray(c.consecutiveFailedNames)) c.consecutiveFailedNames = [];
  if (!Number.isFinite(Number(c.lastTriggerTurn))) c.lastTriggerTurn = 0;

  Object.keys(c.mentionCounts).forEach(name => {
    const n = Number(c.mentionCounts[name]);
    c.mentionCounts[name] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  });
  Object.keys(c.attempts).forEach(name => {
    const n = Number(c.attempts[name]);
    c.attempts[name] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  });
  c.pendingNames = utUniqueNames(c.pendingNames).slice(0, CODEX_MAX_CANDIDATES_PER_TURN);

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
  const n = utText(name).trim();
  if (!n) return false;
  return new RegExp(`(?:^|[^A-Za-z0-9])${escapeForRegex(n)}(?=$|[^A-Za-z0-9])`, "i").test(utText(text));
}

function createOrFindCard(keys, initialEntry, type) {
  try {
    const idx = addStoryCard(keys, initialEntry, type);
    if (typeof idx === "number" && storyCards[idx]) return storyCards[idx];
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
    `> Enable Twists and Turns: ${cfg.enabled}\n` +
    `> Intensity (low/medium/high): ${cfg.intensity}\n` +
    `> Strict logic only, no wildcard twists: ${cfg.strictLogic}\n` +
    `> Allow wildcard twists: ${cfg.allowWildcard}\n` +
    `> Allow compound twists: ${cfg.allowCompoundTwists}\n` +
    `> Involve the player character in twists: ${cfg.involvePlayer}\n` +
    `> Show resolved twists in the Twist Log: ${cfg.showTwistLog}\n` +
    `> Minimum seed touches before a twist can pay off: ${cfg.minSeedsForPayoff}\n` +
    `> Minimum turns before a twist can pay off: ${cfg.minTurnsForPayoff}\n` +
    `> Turns to wait between twist payoffs: ${cfg.payoffCooldown}\n` +
    `> How many resolved twists Established Facts keeps: ${cfg.establishedFactsCap}\n` +
    `> Theme bias, comma-separated, blank for none: ${cfg.categoryBias || ""}\n`;
}

function renderUnsaidSection(cfg) {
  return CONFIG_SECTION_UNSAID + "\n" +
    "-- General --\n" +
    `> Enable UNSAID: ${cfg.enabled}\n` +
    `> Enable Codex: ${cfg.codexEnabled}\n` +
    "-- Private Thoughts --\n" +
    `> Chance of a thought per turn (0 to 1): ${cfg.chance}\n` +
    `> Turns before the same character can think again: ${cfg.cooldown}\n` +
    `> Ease off during your own Do/Say actions: ${cfg.reduceDuringActions}\n` +
    `> Recent turns counted as "active": ${cfg.recentTurnsWindow}\n` +
    `> Show private thoughts in the story text: ${cfg.showThoughtsInStory}\n` +
    `> Let hidden feelings subtly color actions: ${cfg.subtleHints}\n` +
    `> Store card notes as JSON: ${cfg.jsonNotes}\n` +
    "-- Core Truth --\n" +
    `> Allow major events to rewrite a core truth: ${cfg.allowCoreShift}\n` +
    "-- Codex --\n" +
    `> Mentions needed before Codex creates a card: ${cfg.mentionThreshold}\n` +
    `> Minimum turns between Codex cards: ${cfg.codexCooldown}\n` +
    `> Codex retries before giving up on a name: ${cfg.codexMaxAttempts}\n` +
    `> Minimum story turns to observe a newly introduced character before carding: ${cfg.codexCharacterMinTurns}\n` +
    `> Maximum turns before a newly introduced character card is forced: ${cfg.codexCharacterDeadline}\n` +
    `> Character evidence score needed after the minimum wait: ${cfg.codexCharacterEvidenceThreshold}\n` +
    `> Automatic Codex cards per story turn: ${cfg.codexAutoBatchSize}\n` +
    `> Reset Codex tracking now: false\n` +
    `> Player character (skip when Codexing): ${cfg.playerName}\n`;
}

var CONFIG_DEFAULT_UNSAID_NOTES_SECTION =
  CONFIG_SECTION_UNSAID + "\n" +
  "Commands (type as an action):\n" +
  "- /unsaid status — writes a live status report to a separate \"UNSAID — Status\" card. Not sent to the AI.\n" +
  "- /peek <character name> — force a private thought from that character right now.\n" +
  "- /peek <character name> core — force a check for whether this moment has changed that character's core truth.\n" +
  "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.\n\n" +
  "Pre-authoring a character's inner life: write \"💭 Inner Life — private, not visible to other characters\" followed by \"Core truth:\" and their established truth into a character's own Notes before their first reveal, and UNSAID will start from that instead of inventing one. Matches the same format this script writes when it syncs a reveal, so copying an existing character's Notes as a template works too.\n\n" +
  "- Enable UNSAID: master switch for private thoughts + Codex together. False turns both off.\n" +
  "- Enable Codex: auto-Story-Card generation on its own — turn off to keep private thoughts working on your existing hand-made cards without new ones appearing.\n" +
  "- Chance of a thought per turn: how likely (0–1) an eligible, active character reveals a thought on a given turn.\n" +
  "- Turns before the same character can think again: cooldown before that character is eligible again.\n" +
  "- Ease off during your own Do/Say actions: reveals are a little less likely specifically on turns you directly acted.\n" +
  "- Recent turns counted as \"active\": how many recent turns get scanned for who's currently eligible.\n" +
  "- Show private thoughts in the story text: off by default — reveals go to the character's own card, not your story.\n" +
  "- Let hidden feelings subtly color actions: lets a feeling show through tone/body language without stating it outright.\n" +
  "- Store card notes as JSON: off = plain prose, on = the same data as structured JSON.\n" +
  "- Allow major events to rewrite a core truth: on by default — old truths are kept on file, never erased.\n" +
  "- Mentions needed before Codex creates a card: how many mentions before a new name gets carded.\n" +
  "- Minimum turns between Codex cards: cooldown between one Codex card and the next.\n" +
  "- Codex retries before giving up on a name: attempts before automatic background retries stop on non-character names — introduced characters are retried instead of being abandoned. \"/card <name>\" still works directly any time regardless.\n" +
  "- Minimum story turns to observe a newly introduced character before carding: automatic character cards cannot be requested before this many full story turns have passed after the character actually appears on-screen. Default 3.\n" +
  "- Maximum turns before a newly introduced character card is forced: after this many turns, Codex escalates the profile request. The deadline is never allowed below the observation minimum.\n" +
  "- Character evidence score needed after the minimum wait: Codex prefers to see dialogue/actions/traits/relationships before carding early; the hard deadline still guarantees an introduced character is not forgotten.\n" +
  "- Automatic Codex cards per story turn: limits how many background profiles Codex asks the model for at once. Default 1 keeps card creation from flooding a scene.\n" +
  "- Reset Codex tracking now: set true to clear failed attempts/cooldowns, evidence, and introduction timing; flips back to false on its own.\n" +
  "- Player character (skip when Codexing): your own name, so Codex skips writing a profile for you.\n\n" +
  "Characters who can have private thoughts, one per line — Codex adds newly discovered ones automatically:\n" +
  CAST_LIST_MARKER;

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
    const twistSection = renderTwistSection(twistCfg);

    const unsaidEntrySection = (oldUnsaidCard && oldUnsaidCard.entry && oldUnsaidCard.entry.trim())
      ? CONFIG_SECTION_UNSAID + "\n" + oldUnsaidCard.entry.trim() + "\n"
      : renderUnsaidSection(UNSAID_DEFAULTS);
    const unsaidNotesSection = (oldUnsaidCard && oldUnsaidCard.description && oldUnsaidCard.description.trim())
      ? CONFIG_SECTION_UNSAID + "\n" + oldUnsaidCard.description.trim()
      : CONFIG_DEFAULT_UNSAID_NOTES_SECTION;

    const initialEntry = twistSection.replace(/\s+$/, "") + "\n\n" + unsaidEntrySection;
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
      if (!card.description || !card.description.trim()) card.description = unsaidNotesSection;
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
    if (card.description.indexOf(CONFIG_SECTION_UNSAID) === -1) {
      card.description = spliceConfigSection(card.description, CONFIG_SECTION_UNSAID, CONFIG_DEFAULT_UNSAID_NOTES_SECTION);
    }
  }
  return card;
}

function readUnsaidConfig() {
  const card = ensureSharedConfigCard();
  if (!card) return { ...UNSAID_DEFAULTS, cast: [] };

  const preAuthoringNote = "Pre-authoring a character's inner life: write \"💭 Inner Life — private, not visible to other characters\" followed by \"Core truth:\" and their established truth into a character's own Notes before their first reveal, and UNSAID will start from that instead of inventing one. Matches the same format this script writes when it syncs a reveal, so copying an existing character's Notes as a template works too.";
  let unsaidNotes = extractConfigSection(card.description, CONFIG_SECTION_UNSAID) || CONFIG_DEFAULT_UNSAID_NOTES_SECTION;
  if (!unsaidNotes.includes("Commands (type as an action):")) {
    unsaidNotes = CONFIG_SECTION_UNSAID + "\n" +
      "Commands (type as an action):\n" +
      "- /unsaid status — writes a live status report to a separate \"UNSAID — Status\" card. Not sent to the AI.\n" +
      "- /peek <character name> — force a private thought from that character right now.\n" +
      "- /peek <character name> core — force a check for whether this moment has changed that character's core truth.\n" +
      "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.\n\n" +
      preAuthoringNote + "\n\n" +
      unsaidNotes.replace(CONFIG_SECTION_UNSAID + "\n", "");
  } else if (!unsaidNotes.includes("Pre-authoring a character's inner life:")) {
    const cardLine = "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.";
    unsaidNotes = unsaidNotes.includes(cardLine)
      ? unsaidNotes.replace(cardLine, cardLine + "\n\n" + preAuthoringNote)
      : unsaidNotes.replace(CONFIG_SECTION_UNSAID + "\n", CONFIG_SECTION_UNSAID + "\n" + preAuthoringNote + "\n\n");
  }
  card.description = spliceConfigSection(card.description, CONFIG_SECTION_UNSAID, unsaidNotes);

  const cfg = { ...UNSAID_DEFAULTS };
  const entrySection = extractConfigSection(card.entry, CONFIG_SECTION_UNSAID);

  const enabledMatch = entrySection.match(/Enable UNSAID:\s*(true|false)/i);
  if (enabledMatch) cfg.enabled = enabledMatch[1].toLowerCase() === "true";

  const codexMatch = entrySection.match(/Enable Codex:\s*(true|false)/i);
  if (codexMatch) cfg.codexEnabled = codexMatch[1].toLowerCase() === "true";

  const showInStoryMatch = entrySection.match(/Show private thoughts in the story text:\s*(true|false)/i);
  if (showInStoryMatch) cfg.showThoughtsInStory = showInStoryMatch[1].toLowerCase() === "true";

  const subtleHintsMatch = entrySection.match(/subtly color actions:\s*(true|false)/i);
  if (subtleHintsMatch) cfg.subtleHints = subtleHintsMatch[1].toLowerCase() === "true";

  const jsonNotesMatch = entrySection.match(/Store card notes as JSON:\s*(true|false)/i);
  if (jsonNotesMatch) cfg.jsonNotes = jsonNotesMatch[1].toLowerCase() === "true";

  const coreShiftMatch = entrySection.match(/rewrite a core truth:\s*(true|false)/i);
  if (coreShiftMatch) cfg.allowCoreShift = coreShiftMatch[1].toLowerCase() === "true";

  const chanceMatch = entrySection.match(/thought per turn[^:]*:\s*([\d.]+)/i);
  if (chanceMatch) {
    const parsedChance = parseFloat(chanceMatch[1]);
    if (!isNaN(parsedChance)) cfg.chance = Math.min(1, Math.max(0, parsedChance));
  }

  const cooldownMatch = entrySection.match(/think again:\s*(\d+)/i);
  if (cooldownMatch) {
    const parsedCooldown = parseInt(cooldownMatch[1], 10);
    if (!isNaN(parsedCooldown)) cfg.cooldown = Math.max(0, Math.min(100, parsedCooldown));
  }

  const reduceMatch = entrySection.match(/Ease off during your own Do\/Say actions:\s*(true|false)/i);
  if (reduceMatch) cfg.reduceDuringActions = reduceMatch[1].toLowerCase() === "true";

  const recentTurnsMatch = entrySection.match(/Recent turns counted as "active":\s*(\d+)/i);
  if (recentTurnsMatch) {
    const parsedRecentTurns = parseInt(recentTurnsMatch[1], 10);
    if (!isNaN(parsedRecentTurns)) cfg.recentTurnsWindow = Math.max(1, Math.min(20, parsedRecentTurns));
  }

  const mentionMatch = entrySection.match(/Mentions needed before Codex creates a card:\s*(\d+)/i);
  if (mentionMatch) {
    const parsedMentions = parseInt(mentionMatch[1], 10);
    if (!isNaN(parsedMentions)) cfg.mentionThreshold = Math.max(1, Math.min(50, parsedMentions));
  }

  const codexCooldownMatch = entrySection.match(/Minimum turns between Codex cards:\s*(\d+)/i);
  if (codexCooldownMatch) {
    const parsedCodexCooldown = parseInt(codexCooldownMatch[1], 10);
    if (!isNaN(parsedCodexCooldown)) cfg.codexCooldown = Math.max(0, Math.min(100, parsedCodexCooldown));
  }

  const codexAttemptsMatch = entrySection.match(/Codex retries before giving up on a name:\s*(\d+)/i);
  if (codexAttemptsMatch) {
    const parsedAttempts = parseInt(codexAttemptsMatch[1], 10);
    if (!isNaN(parsedAttempts)) cfg.codexMaxAttempts = Math.max(1, Math.min(20, parsedAttempts));
  }

  const codexMinObserveMatch = entrySection.match(/Minimum story turns to observe a newly introduced character before carding:\s*(\d+)/i);
  if (codexMinObserveMatch) {
    const parsedMinObserve = parseInt(codexMinObserveMatch[1], 10);
    if (!isNaN(parsedMinObserve)) cfg.codexCharacterMinTurns = Math.max(0, Math.min(20, parsedMinObserve));
  }

  const codexDeadlineMatch = entrySection.match(/Maximum turns before a newly introduced character card is forced:\s*(\d+)/i);
  if (codexDeadlineMatch) {
    const parsedDeadline = parseInt(codexDeadlineMatch[1], 10);
    if (!isNaN(parsedDeadline)) cfg.codexCharacterDeadline = Math.max(1, Math.min(50, parsedDeadline));
  }
  cfg.codexCharacterDeadline = Math.max(cfg.codexCharacterMinTurns, cfg.codexCharacterDeadline);

  const evidenceMatch = entrySection.match(/Character evidence score needed after the minimum wait:\s*(\d+)/i);
  if (evidenceMatch) {
    const n = parseInt(evidenceMatch[1], 10);
    if (!isNaN(n)) cfg.codexCharacterEvidenceThreshold = Math.max(1, Math.min(30, n));
  }

  const batchMatch = entrySection.match(/Automatic Codex cards per story turn:\s*(\d+)/i);
  if (batchMatch) {
    const n = parseInt(batchMatch[1], 10);
    if (!isNaN(n)) cfg.codexAutoBatchSize = Math.max(1, Math.min(CODEX_MAX_CANDIDATES_PER_TURN, n));
  }

  const resetMatch = entrySection.match(/Reset Codex tracking now:\s*(true|false)/i);
  if (resetMatch && resetMatch[1].toLowerCase() === "true") {
    state.unsaid.codex.attempts = {};
    state.unsaid.codex.mentionCounts = {};
    state.unsaid.codex.firstSeenTurn = {};
    state.unsaid.codex.introducedTurn = {};
    state.unsaid.codex.likelyCharacters = {};
    state.unsaid.codex.observedTypes = {};
    state.unsaid.codex.lastAttemptTurn = {};
    state.unsaid.codex.evidence = {};
    state.unsaid.codex.lastMentionAction = {};
    state.unsaid.codex.lastEvidenceAction = {};
    state.unsaid.codex.lastTriggerTurn = 0;
  }

  const playerMatch = entrySection.match(/Player character \(skip when Codexing\):[ \t]*(.*)/i);
  if (playerMatch) cfg.playerName = playerMatch[1].trim();

  // If nothing was typed into the config card, fall back to a name-like
  // scenario placeholder answer (e.g. a Character Creator's "What is your
  // character's name?" prompt) — saves a manual setup step, and a value
  // typed into the config card always overrides this.
  if (!cfg.playerName && typeof state !== "undefined" && Array.isArray(state.placeholders)) {
    const nameAnswer = state.placeholders.find(p =>
      p && typeof p.question === "string" && /\bname\b/i.test(p.question) &&
      typeof p.answer === "string" && p.answer.trim()
    );
    if (nameAnswer) cfg.playerName = nameAnswer.answer.trim();
  }

  const markerIdx = unsaidNotes.indexOf(CAST_LIST_MARKER);
  const castSection = markerIdx >= 0 ? unsaidNotes.slice(markerIdx + CAST_LIST_MARKER.length) : "";

  cfg.cast = castSection
    .split("\n")
    .map(line => line.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);

  const knownLower = cfg.cast.map(n => n.toLowerCase());
  let adopted = false;
  let adoptedThisPass = 0;
  storyCards.forEach(c => {
    if (adoptedThisPass >= 20) return;
    if (!c.title) return;

    // Opt-IN on type, not opt-out: only adopt a card whose type is blank
    // (common for casually-made character cards) or literally "character"
    // in any casing. Enumerating known non-character types (location,
    // faction, item, class, and whatever else) can never keep up with
    // scenarios that use their own rich custom typing — a real game
    // observed via user report had "Business", "Restaurant", "Vehicle",
    // "Clothing", "Animal Spirit" card types, none of which matched the
    // old exclusion list, so a fried chicken restaurant and a 1965 Mustang
    // ended up in the cast getting private thoughts generated for them.
    // A card explicitly typed as anything other than blank/"character" is
    // a clear, deliberate signal from the player that it isn't a person.
    const rawType = (c.type || "").trim().toLowerCase();
    if (rawType && rawType !== "character") return;
    if (isOwnCard(c.title)) return;
    if (cfg.playerName && isSameCardEntity(c.title, cfg.playerName)) return;
    if (cfg.cast.some(existing => isSameCardEntity(c.title, existing))) return;
    cfg.cast.push(c.title);
    knownLower.push(c.title.toLowerCase());
    adopted = true;
    adoptedThisPass++;
  });
  if (adopted) {
    const alreadyListed = castSection.split("\n").map(l => l.trim());
    const newlyAdopted = cfg.cast.filter(n => !alreadyListed.includes(n));
    // trim first: the extracted section may already carry a trailing
    // newline left by the previous splice, and blindly appending another
    // would compound one extra blank line per adoption event over time
    unsaidNotes = unsaidNotes.replace(/\s+$/, "") + "\n" + newlyAdopted.join("\n");
  }

  if (cfg.playerName) {
    const beforeCount = cfg.cast.length;
    cfg.cast = cfg.cast.filter(n => !isSameCardEntity(n, cfg.playerName));
    if (cfg.cast.length !== beforeCount) {
      const markerIdx2 = unsaidNotes.indexOf(CAST_LIST_MARKER);
      if (markerIdx2 !== -1) {
        const head = unsaidNotes.slice(0, markerIdx2 + CAST_LIST_MARKER.length);
        unsaidNotes = `${head}\n${cfg.cast.join("\n")}`;
      }
    }
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
  if (MAX_CAST_SIZE < cfg.cast.length) {
    cfg.cast = cfg.cast.slice(cfg.cast.length - MAX_CAST_SIZE);
    const markerIdx3 = unsaidNotes.indexOf(CAST_LIST_MARKER);
    if (markerIdx3 !== -1) {
      const head = unsaidNotes.slice(0, markerIdx3 + CAST_LIST_MARKER.length);
      unsaidNotes = `${head}\n${cfg.cast.join("\n")}`;
    }
  }

  card.description = spliceConfigSection(card.description, CONFIG_SECTION_UNSAID, unsaidNotes);
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
  const budget = info.maxChars - CONTEXT_SAFETY_MARGIN;
  if ((baseText.length + instruction.length) <= budget) return instruction;
  const room = budget - baseText.length;
  if (room > 40) return instruction.slice(0, room - 4) + "...]\n";
  return null;
}


// Codex used to treat every capitalized entity the same and wait for a raw
// mention threshold. That makes a real character introduction unnecessarily
// slow, while the global card cooldown can make a failed first attempt take
// many more turns. These cues are deliberately person-shaped: self
// introductions, speech/action attribution, a person noun attached to the
// name, or a possessive body/voice cue. Locations/items/factions still use
// the normal mention-threshold path.
function isLikelyCharacterIntroduction(name, text) {
  const source = typeof text === "string" ? text : "";
  if (!source || classifyCodexEntry(name, source) !== "character") return false;

  const n = escapeForRegex(name);

  // "Introduced" deliberately means present in the active scene, not merely
  // mentioned in somebody else's backstory or dialogue. This distinction is
  // what prevents a line such as "Mirelle said you'd be coming" from starting
  // an automatic character-card countdown before Mirelle has actually shown
  // up. Strong cues only: a self/explicit introduction, being directly seen
  // or met, a body-language cue, or an on-screen physical action.
  const directCues = [
    new RegExp(`\\b(?:I\\s*(?:am|'m|’m)|my\\s+name\\s+is|name\\s*(?:is|'s|’s)|call\\s+me|this\\s+is|meet|known\\s+as|go\\s+by)\\s+["“”'‘’]?${n}\\b`, "i"),
    new RegExp(`\\b(?:you|he|she|they|we)\\s+(?:see|spot|notice|meet|find|face|approach)\\s+(?:the\\s+|a\\s+|an\\s+)?${n}\\b`, "i"),
    new RegExp(`\\b${n}(?:'s|’s)\\s+(?:eyes?|voice|hands?|face|expression|smile|gaze|shoulders?|breath|hair|fingers?|arms?|feet|heart|cheeks?|lips?|posture|jaw)\\b`, "i"),
    new RegExp(`\\b${n}\\b[^\\n.!?]{0,50}\\b(?:steps?|stepped|walks?|walked|approaches?|approached|enters?|entered|arrives?|arrived|comes?|came|sits?|sat|stands?|stood|leans?|leaned|reaches?|reached|turns?|turned|looks?|looked|glances?|glanced|stares?|stared|smiles?|smiled|frowns?|frowned|nods?|nodded|shrugs?|shrugged|runs?|ran|follows?|followed|kneels?|knelt|rises?|rose|flinches?|flinched|grabs?|grabbed|takes?|took|places?|placed|pushes?|pushed|pulls?|pulled|moves?|moved)\\b`, "i"),
    new RegExp(`\\b(?:a|an|the)\\s+(?:young\\s+|old\\s+|elderly\\s+)?(?:girl|boy|woman|man|lady|gentleman|teenager|teen|child|youth|guard|soldier|knight|mage|wizard|witch|priest|priestess|captain|doctor|merchant|stranger|traveler|traveller)\\s+(?:named|called)\\s+${n}\\b[^\\n.!?]{0,70}\\b(?:steps?|stands?|sits?|approaches?|walks?|looks?|turns?|enters?|arrives?)\\b`, "i"),

    // Direct dialogue attribution is accepted only when the attribution is
    // attached to quoted speech in this same passage. A bare historical
    // report such as "Mirelle said you'd be coming" has no quote after the
    // attribution and therefore does not count as an introduction.
    new RegExp(`\\b${n}\\b\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?|shouts?)\\s*,?\\s*["“]`, "i"),
    new RegExp(`["”][^\\n]{0,28}\\b${n}\\b\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?|shouts?)\\b`, "i")
  ];
  return directCues.some(re => re.test(source));
}

function promoteCodexTrackingKey(oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return oldKey || newKey;
  const c = state.unsaid.codex;
  const oldWords = oldKey.trim().split(/\s+/);
  const newWords = newKey.trim().split(/\s+/);

  // Only promote toward a more specific alias; never collapse a full name
  // back down to a bare surname/first name seen later.
  if (newWords.length <= oldWords.length) return oldKey;

  const maps = [
    "mentionCounts", "attempts", "firstSeenTurn", "introducedTurn",
    "likelyCharacters", "observedTypes", "lastAttemptTurn", "evidence",
    "lastMentionAction", "lastEvidenceAction"
  ];
  maps.forEach(key => {
    const map = c[key];
    if (!map || typeof map !== "object" || !(oldKey in map)) return;
    if (!(newKey in map)) map[newKey] = map[oldKey];
    else if (key === "mentionCounts" || key === "attempts") {
      map[newKey] = Math.max(Number(map[newKey]) || 0, Number(map[oldKey]) || 0);
    } else if (key === "firstSeenTurn" || key === "introducedTurn") {
      map[newKey] = Math.min(Number(map[newKey]) || Infinity, Number(map[oldKey]) || Infinity);
      if (!Number.isFinite(map[newKey])) map[newKey] = map[oldKey];
    }
    delete map[oldKey];
  });
  if (Array.isArray(c.pendingNames)) {
    c.pendingNames = utUniqueNames(c.pendingNames.map(n => n === oldKey ? newKey : n));
  }
  return newKey;
}

function ensureCodexEvidence(name) {
  const c = state.unsaid.codex;
  if (!c.evidence[name] || typeof c.evidence[name] !== "object") {
    c.evidence[name] = {
      presenceTurns: 0,
      dialogueTurns: 0,
      actionTurns: 0,
      traitTurns: 0,
      relationTurns: 0,
      snippets: []
    };
  }
  return c.evidence[name];
}

function updateCharacterEvidence(name, text) {
  if (!name || !state.unsaid || !state.unsaid.codex) return;
  const source = utText(text);
  if (!source || !nameAppears(name, source)) return;

  const c = state.unsaid.codex;
  const actionKey = utActionKey();
  if (c.lastEvidenceAction[name] === actionKey) return;
  c.lastEvidenceAction[name] = actionKey;

  const evidence = ensureCodexEvidence(name);
  const n = escapeForRegex(name);

  evidence.presenceTurns = (evidence.presenceTurns || 0) + 1;
  if (new RegExp(`(?:["“][^\\n]{0,160}["”]\\s*,?\\s*${n}\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?)|${n}\\s+(?:says?|asks?|replies?|answers?|whispers?|murmurs?)\\s*,?\\s*["“])`, "i").test(source)) {
    evidence.dialogueTurns = (evidence.dialogueTurns || 0) + 1;
  }
  if (new RegExp(`\\b${n}\\b[^\\n.!?]{0,70}\\b(?:steps?|walks?|runs?|turns?|looks?|glances?|smiles?|frowns?|nods?|shrugs?|reaches?|grabs?|takes?|pushes?|pulls?|fights?|attacks?|helps?|follows?|kneels?|sits?|stands?|enters?|leaves?|moves?)\\b`, "i").test(source)) {
    evidence.actionTurns = (evidence.actionTurns || 0) + 1;
  }
  if (new RegExp(`\\b${n}(?:'s|’s)?\\b[^\\n.!?]{0,90}\\b(?:eyes?|hair|face|voice|build|clothes?|wears?|scar|tall|short|young|old|calm|nervous|angry|kind|cold|confident|afraid|skilled|strong|weak)\\b`, "i").test(source)) {
    evidence.traitTurns = (evidence.traitTurns || 0) + 1;
  }
  if (new RegExp(`\\b${n}\\b[^\\n.!?]{0,100}\\b(?:brother|sister|mother|father|friend|ally|enemy|boss|partner|lover|wife|husband|daughter|son|owes|trusts?|hates?|loves?|fears?)\\b`, "i").test(source)) {
    evidence.relationTurns = (evidence.relationTurns || 0) + 1;
  }

  const snippets = source
    .split(/[\n]+|(?=[.!?]\s)/)
    .map(x => x.trim())
    .filter(x => x && nameAppears(name, x))
    .slice(-2)
    .map(x => x.length > 220 ? x.slice(0, 217) + "..." : x);
  evidence.snippets = (Array.isArray(evidence.snippets) ? evidence.snippets : []).concat(snippets).slice(-CODEX_EVIDENCE_SNIPPET_LIMIT);
}

function codexEvidenceScore(name) {
  const e = state.unsaid && state.unsaid.codex && state.unsaid.codex.evidence
    ? state.unsaid.codex.evidence[name]
    : null;
  if (!e) return 0;
  return Math.min(50,
    (e.presenceTurns || 0) * 2 +
    (e.dialogueTurns || 0) * 2 +
    (e.actionTurns || 0) +
    (e.traitTurns || 0) +
    (e.relationTurns || 0)
  );
}

function codexEvidenceSummary(name) {
  const e = state.unsaid && state.unsaid.codex && state.unsaid.codex.evidence
    ? state.unsaid.codex.evidence[name]
    : null;
  if (!e) return "";
  const bits = [];
  if (e.dialogueTurns) bits.push(`${e.dialogueTurns} dialogue turn${e.dialogueTurns === 1 ? "" : "s"}`);
  if (e.actionTurns) bits.push(`${e.actionTurns} action turn${e.actionTurns === 1 ? "" : "s"}`);
  if (e.traitTurns) bits.push(`${e.traitTurns} trait/detail turn${e.traitTurns === 1 ? "" : "s"}`);
  if (e.relationTurns) bits.push(`${e.relationTurns} relationship turn${e.relationTurns === 1 ? "" : "s"}`);
  const snippets = Array.isArray(e.snippets) && e.snippets.length
    ? ` Recent evidence: ${e.snippets.join(" | ")}`
    : "";
  return `${bits.length ? bits.join(", ") : "limited explicit detail so far"}.${snippets}`;
}

function trackMentions(text, observeIntroductions) {
  if (!state.unsaid || !state.unsaid.codex) return;
  const source = utText(text);
  if (!source) return;

  const canConfirmIntroductions = observeIntroductions !== false;
  const matches = source.match(CODEX_TITLE_ABBREV_REGEX) || [];
  const actionKey = utActionKey();

  matches.forEach(raw => {
    let name = stripPossessive(raw.trim());
    let words = name.split(/\s+/).filter(Boolean);
    const stopKey = w => utText(w).toLowerCase()
      .replace(/\u2019/g, "'")
      .replace(/\.$/, "")
      .replace(/'s$/i, "");

    while (words.length > 1 && (CODEX_STOPWORDS.has(stopKey(words[0])) || CODEX_TITLE_WORDS.has(stopKey(words[0])))) {
      words.shift();
    }
    name = words.join(" ").trim();
    if (!name) return;
    if (words.length === 1 && CODEX_STOPWORDS.has(stopKey(name))) return;
    if (words.length === 1 && CODEX_TITLE_WORDS.has(stopKey(name))) return;
    if (words.length === 1 && name.length <= 1) return;
    if (words.length === 1 && name.length <= 5 && name === name.toUpperCase() && /[A-Z]{2,}/.test(name)) return;
    if (/^\d+$/.test(name)) return;

    const keys = Object.keys(state.unsaid.codex.mentionCounts);
    let existingKey = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (!existingKey) {
      existingKey = keys.find(k => isSameCardEntity(k, name));
    }
    let key = existingKey || name;
    if (existingKey && name.split(/\s+/).length > existingKey.split(/\s+/).length) {
      key = promoteCodexTrackingKey(existingKey, name);
    }

    // Count narrative actions, not raw repetitions. "Harlan" appearing six
    // times in one response is useful evidence, but it is still one turn of
    // development and should not instantly satisfy a mention threshold.
    if (state.unsaid.codex.lastMentionAction[key] !== actionKey) {
      state.unsaid.codex.mentionCounts[key] = (state.unsaid.codex.mentionCounts[key] || 0) + 1;
      state.unsaid.codex.lastMentionAction[key] = actionKey;
    }

    if (typeof state.unsaid.codex.firstSeenTurn[key] !== "number") {
      state.unsaid.codex.firstSeenTurn[key] = state.unsaid.turn;
    }

    const observedType = classifyCodexEntry(key, source);
    if (!state.unsaid.codex.observedTypes[key] || observedType !== "character") {
      state.unsaid.codex.observedTypes[key] = observedType;
    }

    if (canConfirmIntroductions && isLikelyCharacterIntroduction(key, source)) {
      if (!state.unsaid.codex.likelyCharacters[key]) {
        state.unsaid.codex.likelyCharacters[key] = true;
        state.unsaid.codex.observedTypes[key] = "character";
        state.unsaid.codex.introducedTurn[key] = state.unsaid.turn;
      }
    }

    if (canConfirmIntroductions && state.unsaid.codex.likelyCharacters[key]) {
      updateCharacterEvidence(key, source);
    }
  });

  pruneMentionCounts();
}

function pruneMentionCounts() {
  const counts = state.unsaid.codex.mentionCounts;
  // A name that already has a matching Story Card will never be
  // reconsidered by Codex again regardless of its count (findCodexCandidates
  // excludes it directly) — but nothing ever stopped its count from
  // climbing forever as an established character keeps getting mentioned.
  // Since pruning below keeps the highest counts and drops the lowest, an
  // already-carded character's ever-growing, now-pointless count would
  // permanently occupy a slot immune to pruning, at the direct expense of
  // genuinely new, not-yet-carded names still trying to reach the mention
  // threshold — confirmed directly: a long-running game with one carded
  // character mentioned constantly could starve out new candidates
  // entirely. Clearing these every pass keeps every slot meaningful.
  Object.keys(counts).forEach(name => {
    if (storyCards.some(c => c.title && isSameCardEntity(c.title, name))) {
      delete counts[name];
      delete state.unsaid.codex.attempts[name];
      delete state.unsaid.codex.firstSeenTurn[name];
      delete state.unsaid.codex.introducedTurn[name];
      delete state.unsaid.codex.likelyCharacters[name];
      delete state.unsaid.codex.observedTypes[name];
      delete state.unsaid.codex.lastAttemptTurn[name];
      delete state.unsaid.codex.evidence[name];
      delete state.unsaid.codex.lastMentionAction[name];
      delete state.unsaid.codex.lastEvidenceAction[name];
    }
  });
  const keys = Object.keys(counts);
  if (keys.length > MENTION_TRACKING_CAP + 50) {
    keys
      .sort((a, b) => counts[a] - counts[b])
      .slice(0, keys.length - MENTION_TRACKING_CAP)
      .forEach(k => {
        delete counts[k];
        delete state.unsaid.codex.attempts[k];
        delete state.unsaid.codex.firstSeenTurn[k];
        delete state.unsaid.codex.introducedTurn[k];
        delete state.unsaid.codex.likelyCharacters[k];
        delete state.unsaid.codex.observedTypes[k];
        delete state.unsaid.codex.lastAttemptTurn[k];
        delete state.unsaid.codex.evidence[k];
        delete state.unsaid.codex.lastMentionAction[k];
        delete state.unsaid.codex.lastEvidenceAction[k];
      });
  }
  const attempts = state.unsaid.codex.attempts;
  Object.keys(attempts).forEach(name => {
    if (!(name in counts)) delete attempts[name];
  });
}

function classifyCodexEntry(name, text) {
  if (CODEX_LOCATION_HINTS.test(name)) return "location";
  if (CODEX_LOCATION_SUFFIX_HINTS.test(name)) return "location";
  if (CODEX_FACTION_HINTS.test(name)) return "faction";
  if (CODEX_ITEM_HINTS.test(name)) return "item";

  const n = escapeForRegex(name);
  const nearLocation = new RegExp(`(in|inside|outside|through|into)\\s+(?:the\\s+)?${n}\\b`, "i");
  const describedAsLocation = new RegExp(`\\b(?:city|town|village|hamlet|kingdom|realm|district|region|port|harbor|harbour|forest|woods|mountain|valley|island|station|outpost|colony|settlement|tavern|inn|castle|fortress|temple|academy|university|facility|base)\\s+(?:of|called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:city|town|village|hamlet|kingdom|realm|district|region|port|harbor|harbour|forest|station|outpost|colony|settlement|tavern|inn|castle|fortress|temple|academy|university|facility|base)\\b`, "i");
  if (nearLocation.test(text) || describedAsLocation.test(text)) return "location";

  const nearItem = new RegExp(`(wields?|holds?|wearing|wears|wore|donned|dressed\\s+in|put\\s+on|slipped\\s+into|using|uses|draws?|grips?|picks?\\s+up|holsters?|drove|drives|driving|parked|rode|riding|climbed\\s+into|hopped\\s+into|flew|flying|piloted|piloting|boarded|boarding|launched|launching|docked|docking)\\s+(the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+)?${n}\\b`, "i");
  const describedAsItem = new RegExp(`\\b(?:sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|artifact|device|weapon|tool|key|book|tome|relic|ship|starship|vehicle|car|truck|robot|android|mech)\\s+(?:called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|artifact|device|weapon|tool|key|book|tome|relic|ship|starship|vehicle|car|truck|robot|android|mech)\\b`, "i");
  if (nearItem.test(text) || describedAsItem.test(text)) return "item";

  // A name with no recognizable keyword in itself ("Dragon's Breath Fried
  // Chicken" contains no obvious business word) can still be caught from
  // how the story actually refers to it — ordering food from it, working
  // at it, being a customer of it all point at an organization/venue.
  // Deliberately specific phrases only — a bare "at"/"from" would also
  // match ordinary location references ("stood at the harbor") and
  // misclassify those instead.
  const nearBusiness = new RegExp(`(ordered\\s+from|ate\\s+at|dined\\s+at|grabbed\\s+(food\\s+)?from|work(?:s|ed)?\\s+(at|for)|employed\\s+(at|by)|shops?\\s+at|shopping\\s+at)\\s+${escapeForRegex(name)}\\b`, "i");
  if (nearBusiness.test(text)) return "faction";

  // A generic name ("Silver Hand", "VyrMusic") is often immediately
  // followed by the word that actually classifies it ("Silver Hand
  // guild", "VyrMusic app") — the hint checks above only look inside the
  // name itself, so this catches the same signal sitting just outside it.
  const followedByFactionWord = new RegExp(`${n}\\s+(order|guild|alliance|empire|faction|clan|brotherhood|council|syndicate|coalition|army|legion|cult|society|corporation|compan(?:y|ies)|division|agency|federation|dynasty|tribe|app|platform|website|network|restaurant|diner|caf[eé]|bakery|store|shop)\\b`, "i");
  const describedAsFaction = new RegExp(`\\b(?:order|guild|alliance|faction|clan|brotherhood|council|syndicate|coalition|company|corporation|agency|organization|organisation|group|gang|cult|society|restaurant|store|shop|brand|network)\\s+(?:called|named)\\s+${n}\\b|\\b${n}\\b\\s+(?:is|was)\\s+(?:an?\\s+|the\\s+)?(?:order|guild|alliance|faction|clan|brotherhood|council|syndicate|coalition|company|corporation|agency|organization|organisation|group|gang|cult|society|restaurant|store|shop|brand|network)\\b`, "i");
  if (followedByFactionWord.test(text) || describedAsFaction.test(text)) return "faction";

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
  if (isOwnCard(cardTitle)) return false;

  const normalize = value => stripCourtesyTitle(
    utText(value)
      .toLowerCase()
      .replace(/[“”"'‘’.,!?()[\]{}:;]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
  );

  const a = normalize(cardTitle);
  const b = normalize(candidateName);
  if (!a.length || !b.length) return false;
  if (a.join(" ") === b.join(" ")) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  // A bare first/last name may resolve to a full name, but not to an
  // arbitrary interior word. This keeps convenient "Elara" ↔ "Elara Voss"
  // matching without turning every shared word into the same entity.
  if (shorter.length === 1) {
    return shorter[0] === longer[0] || shorter[0] === longer[longer.length - 1];
  }

  // Multi-word aliases must appear contiguously and in order.
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    let matches = true;
    for (let j = 0; j < shorter.length; j++) {
      if (longer[i + j] !== shorter[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

var CARD_TYPE_DISPLAY = { character: "Character", location: "Location", item: "Item", faction: "Faction" };
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

function findCodexCandidates(threshold, excludeNames, maxAttempts, maxCount) {
  const exclude = excludeNames || [];
  const cap = typeof maxAttempts === "number" ? maxAttempts : CODEX_MAX_ATTEMPTS;
  const limit = typeof maxCount === "number" ? maxCount : CODEX_MAX_CANDIDATES_PER_TURN;
  const counts = state.unsaid.codex.mentionCounts;
  const likelyCharacters = state.unsaid.codex.likelyCharacters || {};
  const introducedTurn = state.unsaid.codex.introducedTurn || {};
  const observedTypes = state.unsaid.codex.observedTypes || {};
  const eligible = [];

  for (const name in counts) {
    const introducedCharacter = !!likelyCharacters[name];

    if (!introducedCharacter && counts[name] < threshold) continue;
    if (exclude.some(ex => isSameCardEntity(ex, name))) continue;
    if (storyCards.some(c => isSameCardEntity(c.title, name))) continue;

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


function buildCodexInstruction(names, text, forced, priorFailures, hardDeadline) {
  const failures = typeof priorFailures === "number" ? priorFailures : 0;

  const blocks = names.map((name, i) => {
    const type = classifyCodexEntry(name, text);
    const fields = CARD_TEMPLATES[type] || CHARACTER_CARD_FIELDS;
    const body = fields.map(f => `${f}: ${f === "Name" ? name : "..."}`).join("\n");
    const mind = type === "character" ? state.unsaid.minds[name] : null;
    const knownNote = mind && mind.core
      ? ` Already-established private truth: "${mind.core}". Personality and Background must agree with it.`
      : "";
    const correctionNote = type === "character"
      ? ` If "${name}" is genuinely a location, item, or faction instead, switch to that matching template rather than pretending it is a person.`
      : "";
    const introTurn = state.unsaid.codex.introducedTurn && state.unsaid.codex.introducedTurn[name];
    const observedTurns = type === "character" && typeof introTurn === "number"
      ? Math.max(0, state.unsaid.turn - introTurn)
      : null;
    const observationNote = observedTurns !== null
      ? ` The character has had ${observedTurns} full story turn${observedTurns === 1 ? "" : "s"} of on-screen development since introduction; prioritize details actually demonstrated during those turns.`
      : "";
    const evidenceNote = type === "character"
      ? ` Evidence score ${codexEvidenceScore(name)}. ${codexEvidenceSummary(name)}`
      : "";
    return `Profile ${i + 1} — "${name}":${knownNote}${correctionNote}${observationNote}${evidenceNote}\n【CARD】\n${body}\n【/CARD】`;
  }).join("\n\n");

  let priorityLine;
  if (hardDeadline) {
    priorityLine =
      `HARD DEADLINE: write the hidden profile block${names.length > 1 ? "s" : ""} FIRST, before any visible story prose. ` +
      `Do not postpone, summarize, or skip ${names.length > 1 ? "them" : "it"}.`;
  } else if (forced) {
    priorityLine =
      `The player explicitly requested ${names.length > 1 ? "these cards" : "this card"}. ` +
      `Write the hidden profile block${names.length > 1 ? "s" : ""} FIRST, before any visible story prose.`;
  } else if (failures > 0) {
    priorityLine =
      `A previous automatic attempt did not produce a usable card. ` +
      `This retry is mandatory: write the hidden profile block${names.length > 1 ? "s" : ""} FIRST, before continuing the story.`;
  } else {
    priorityLine =
      `Before continuing the visible story, write the hidden profile block${names.length > 1 ? "s" : ""} FIRST. ` +
      `The script removes ${names.length > 1 ? "these blocks" : "this block"} before the player sees the response, so the story can continue normally afterward.`;
  }

  return `\n[UNSAID CODEX — mandatory script task. ${priorityLine}
${blocks}
Rules:
- Keep the 【CARD】 and 【/CARD】 markers exactly.
- Output exactly one short line per listed field.
- Replace every "..." with a concrete, specific value. Never leave "...", "unknown", "N/A", "TBD", or a blank field.
- Analyze the character/entity across the story context before filling fields. Prefer repeated behavior, dialogue, relationships, appearance, demonstrated competence, and explicit lore over first-impression guesses.
- Use established facts first. Only infer fields the story still has not established, using the tone, setting, relationships, and likely direction of the story. Inferences become canon, so keep them specific, conservative, and compatible with everything already shown.
- A character being mentioned by someone else is not proof they are physically present; do not invent an on-screen encounter that has not happened.
- Do not explain the profile or mention this task outside the hidden card block.
${forced || hardDeadline ? "- Once the card block is complete, visible story prose is optional this turn." : "- After the card block is complete, continue the visible story normally."}]
`;
}

function codexLogTitle(type) {
  const heading = type.charAt(0).toUpperCase() + type.slice(1) + "s";
  return `UNSAID Codex Log — ${heading}`;
}

function buildStatusReport(cfg) {
  const lines = [];
  lines.push(`UNSPOKEN TURNS v${UNSPOKEN_TURNS_VERSION}`);
  lines.push(`UNSAID: ${cfg.enabled ? "enabled" : "DISABLED"}  |  Codex: ${cfg.codexEnabled ? "enabled" : "disabled"}  |  Turn: ${state.unsaid.turn}`);

  const cacheCard = storyCards.find(c => c.title === "UNSAID — Important, Read This ⚠️");
  if (cacheCard && cacheCard.entry && cacheCard.entry.indexOf("no longer detected") === -1) {
    lines.push(`⚠️ Cache-efficient mode is currently detected — private thoughts and Codex cannot function right now, see that card for details.`);
  }

  const mindNames = Object.keys(state.unsaid.minds);
  lines.push(`\nTracked minds (${mindNames.length}):`);
  if (mindNames.length === 0) {
    lines.push(`  none yet`);
  } else {
    mindNames.forEach(name => {
      const m = state.unsaid.minds[name];
      const coreNote = m.core ? "has a core truth" : "no standalone thought yet";
      const lastActiveNote = m.lastTurn ? `last active turn ${m.lastTurn}` : "not yet revealed under tracking";
      lines.push(`  ${name} — ${coreNote}, feeling: ${m.feeling || "none yet"}, ${m.revealCount || 0} reveal(s), ${lastActiveNote}`);
    });
  }

  const counts = state.unsaid.codex.mentionCounts;
  const attempts = state.unsaid.codex.attempts;
  const tracked = Object.keys(counts);
  const likelyCharacters = state.unsaid.codex.likelyCharacters || {};
  const introducedTurn = state.unsaid.codex.introducedTurn || {};
  const observedTypes = state.unsaid.codex.observedTypes || {};
  const alreadyCarded = tracked.filter(n => storyCards.some(c => isSameCardEntity(c.title, n)));
  const minObserve = Math.max(0, cfg.codexCharacterMinTurns || 0);

  const introduced = tracked.filter(n =>
    likelyCharacters[n] && !alreadyCarded.includes(n) &&
    typeof introducedTurn[n] === "number"
  );
  const evidenceNeeded = Math.max(1, cfg.codexCharacterEvidenceThreshold || 6);
  const deadline = Math.max(minObserve, cfg.codexCharacterDeadline || 5);
  const waitingCharacters = introduced.filter(n => {
    const age = state.unsaid.turn - introducedTurn[n];
    return age < minObserve || (age < deadline && codexEvidenceScore(n) < evidenceNeeded);
  });
  const matureCharacters = introduced.filter(n => {
    const age = state.unsaid.turn - introducedTurn[n];
    return age >= minObserve && (codexEvidenceScore(n) >= evidenceNeeded || age >= deadline);
  });
  const hearsayCharacters = tracked.filter(n =>
    !likelyCharacters[n] &&
    !alreadyCarded.includes(n) &&
    (observedTypes[n] || "character") === "character"
  );
  const nonCharacterEligible = tracked.filter(n =>
    !likelyCharacters[n] &&
    !alreadyCarded.includes(n) &&
    observedTypes[n] && observedTypes[n] !== "character" &&
    counts[n] >= cfg.mentionThreshold &&
    (attempts[n] || 0) < cfg.codexMaxAttempts
  );
  const exhausted = tracked.filter(n =>
    observedTypes[n] && observedTypes[n] !== "character" &&
    (attempts[n] || 0) >= cfg.codexMaxAttempts
  );

  lines.push(`\nCodex mention-tracking: ${tracked.length} name(s) tracked`);
  if (waitingCharacters.length > 0) {
    lines.push(`  observing introduced characters (minimum ${minObserve} full turn(s) before carding): ${waitingCharacters.slice(0, 10).map(n => {
      const age = state.unsaid.turn - introducedTurn[n];
      return `${n} (${age} turns, evidence ${codexEvidenceScore(n)}/${evidenceNeeded}, ${counts[n]} mention-turns)`;
    }).join(", ")}${waitingCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (matureCharacters.length > 0) {
    lines.push(`  character card(s) ready: ${matureCharacters.slice(0, 10).map(n => `${n} (${state.unsaid.turn - introducedTurn[n]} turns, evidence ${codexEvidenceScore(n)}/${evidenceNeeded})`).join(", ")}${matureCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (hearsayCharacters.length > 0) {
    lines.push(`  character-shaped names only mentioned/referenced so far, not introduced on-screen: ${hearsayCharacters.slice(0, 10).map(n => `${n} (${counts[n]}x)`).join(", ")}${hearsayCharacters.length > 10 ? ", ..." : ""}`);
  }
  if (nonCharacterEligible.length > 0) {
    lines.push(`  non-character candidate(s) above mention threshold: ${nonCharacterEligible.slice(0, 10).map(n => `${n} (${observedTypes[n]}, ${counts[n]}x)`).join(", ")}${nonCharacterEligible.length > 10 ? ", ..." : ""}`);
  }
  if (introduced.length > 0) {
    lines.push(`  character timing: observe at least ${minObserve} turn(s), prefer evidence ${evidenceNeeded}+, hard deadline ${deadline} turn(s), auto batch ${cfg.codexAutoBatchSize || 1}; introduced characters retry instead of being abandoned`);
  }
  if (alreadyCarded.length > 0) {
    lines.push(`  already have a Story Card, correctly skipped: ${alreadyCarded.slice(0, 10).join(", ")}${alreadyCarded.length > 10 ? ", ..." : ""}`);
  }
  if (exhausted.length > 0) {
    lines.push(`  non-character candidates paused after ${cfg.codexMaxAttempts} failed attempts: ${exhausted.join(", ")} — "/card <name>" still works directly, or "Reset Codex tracking now" clears their retry state`);
  }
  const turnsSinceCodex = state.unsaid.turn - (state.unsaid.codex.lastTriggerTurn || 0);
  lines.push(`  ${turnsSinceCodex}/${cfg.codexCooldown} turns since Codex last triggered`);
  const strugglingCount = (state.unsaid.codex.consecutiveFailedNames || []).length;
  if (strugglingCount > 0) {
    lines.push(`  ${strugglingCount} different name(s) in a row with no successful card yet${strugglingCount >= 3 ? " — looks systemic, not just bad luck on a few names" : ""}`);
  }
  const revealMisses = state.unsaid.consecutiveRevealMisses || 0;
  if (revealMisses > 0) {
    lines.push(`\nReveal requests: ${revealMisses} in a row produced nothing usable${revealMisses >= 5 ? " — may indicate a model compliance issue, not a specific character" : ""}`);
  }

  lines.push(`\nCast (${cfg.cast.length}): ${cfg.cast.join(", ") || "empty"}`);

  if (cfg.cast.length > 0) {
    lines.push(`\nCast → Story Card resolution (what each name actually matches right now):`);
    cfg.cast.forEach(name => {
      const matches = storyCards.filter(c => c.title && isSameCardEntity(c.title, name));
      if (matches.length === 0) {
        lines.push(`  ${name} → no matching Story Card found — thoughts have nowhere to be saved`);
      } else if (matches.length === 1) {
        lines.push(`  ${name} → "${matches[0].title}" (type: "${matches[0].type || ""}")`);
      } else {
        lines.push(`  ${name} → ${matches.length} cards match! Using the first: "${matches[0].title}" (type: "${matches[0].type || ""}") — others: ${matches.slice(1).map(c => `"${c.title}"`).join(", ")}`);
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
    card.entry = `Every ${type} card Codex has made, with how many times it was mentioned before the card was created. Delete a card from the story to have Codex redo it — this entry can stay.`;
    card.description = "";
  }
  return card;
}

function logCodexCard(name, type, mentionCount) {
  const card = ensureCodexLogCard(type);
  if (!card) return;
  const entries = card.description.split("\n").map(l => l.trim()).filter(Boolean);
  const line = `${name} — mentioned ${mentionCount}x before card created`;
  const existingIdx = entries.findIndex(l => l.startsWith(`${name} —`));
  if (existingIdx >= 0) entries[existingIdx] = line;
  else entries.push(line);
  if (entries.length > 500) entries.splice(0, entries.length - 500);
  card.description = entries.join("\n");
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

  const card = storyCards.find(c => c.title && isSameCardEntity(c.title, name));
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
    const jsonBody = {
      core: mind.core || null,
      coreStableSince: stabilityNote ? state.unsaid.turn - mind.coreSetTurn : null,
      formerlyBelieved: mind.coreHistory && mind.coreHistory.length > 0 ? mind.coreHistory[mind.coreHistory.length - 1] : null,
      tension: tensionNote,
      feeling: mind.feeling || null,
      feelingHistory: mind.feelingHistory || [],
      lastThought: mind.lastThoughtText || null,
      want: mind.want || null,
      relations,
      revealCount: mind.revealCount || 0
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
  if (mind.want) sections.push(`Wants: ${mind.want}`);
  if (mind.relationOrder && mind.relationOrder.length > 0) {
    const relLines = mind.relationOrder.map(other => {
      const hist = mind.relationHistory && mind.relationHistory[other];
      const trail = hist && hist.length > 1 ? hist.join(" → ") : mind.relations[other];
      return `  • ${other} — ${trail}`;
    });
    sections.push(`Feelings toward others:\n${relLines.join("\n")}`);
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
  const source = utText(thought).trim();
  if (!source) return { feelingSentence: "", wantSentence: null };

  const sentences = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (source[i + 1] && !/\s/.test(source[i + 1])) continue;

    const candidate = source.slice(start, i + 1).trim();
    const words = candidate.split(/\s+/);
    const lastWord = (words[words.length - 1] || "").replace(/[.!?]+$/, "");
    if (ch === "." && SENTENCE_ABBREVIATIONS.has(lastWord)) continue;

    if (candidate) sentences.push(candidate);
    start = i + 1;
  }
  const tail = source.slice(start).trim();
  if (tail) sentences.push(tail);
  if (!sentences.length) sentences.push(source);

  return {
    feelingSentence: sentences[0] || source,
    wantSentence: sentences[1] || null
  };
}

function forgetMentionTracking(name) {
  [
    "mentionCounts", "attempts", "firstSeenTurn", "introducedTurn",
    "likelyCharacters", "observedTypes", "lastAttemptTurn", "evidence",
    "lastMentionAction", "lastEvidenceAction"
  ].forEach(key => {
    if (state.unsaid.codex[key]) delete state.unsaid.codex[key][name];
  });
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
    relations: {},
    relationOrder: [],
    relationHistory: {},
    lastTurn: state.unsaid.turn
  };
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
      if (Array.isArray(parsed.feelingHistory)) mind.feelingHistory = parsed.feelingHistory.filter(f => typeof f === "string").slice(-FEELING_HISTORY_LIMIT);
      if (typeof parsed.lastThought === "string") mind.lastThoughtText = parsed.lastThought;
      if (typeof parsed.want === "string") mind.want = parsed.want;
      if (typeof parsed.revealCount === "number" && parsed.revealCount >= 0) mind.revealCount = parsed.revealCount;
      // Both of these are written (coreStableSince, formerlyBelieved) but
      // were never read back on reload, in either format — coreStableSince
      // actually stores an *elapsed turn count* (state.unsaid.turn minus
      // the real coreSetTurn at write time), so state.unsaid.turn minus
      // that count reconstructs a coreSetTurn that's at least approximately
      // right, rather than the reload always restarting the stability
      // clock from zero as if the belief had just now been established.
      if (typeof parsed.coreStableSince === "number" && parsed.coreStableSince >= 0) {
        mind.coreSetTurn = state.unsaid.turn - parsed.coreStableSince;
      }
      if (typeof parsed.formerlyBelieved === "string" && parsed.formerlyBelieved) {
        mind.coreHistory = [parsed.formerlyBelieved];
      }
      if (parsed.relations && typeof parsed.relations === "object") {
        Object.keys(parsed.relations).forEach(other => {
          const r = parsed.relations[other];
          const current = r && typeof r === "object" ? r.current : r;
          if (typeof current === "string") {
            mind.relations[other] = current;
            mind.relationOrder.push(other);
            mind.relationHistory[other] = (r && Array.isArray(r.history) && r.history.length > 0) ? r.history : [current];
          }
        });
      }
      return mind.core || mind.feeling || mind.relationOrder.length > 0 ? mind : null;
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
  const lastThoughtMatch = body.match(/Last private thought:\n([\s\S]*?)(?:\n\n|$)/);
  if (lastThoughtMatch && lastThoughtMatch[1].trim()) { mind.lastThoughtText = lastThoughtMatch[1].trim(); found = true; }
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
  return found ? mind : null;
}

function seedMindIfKnown(name) {
  if (!name || state.unsaid.minds[name]) return;
  const card = storyCards.find(c => c.title && isSameCardEntity(c.title, name));
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

function pickBySilence(names, currentTurn) {
  const weights = names.map(name => {
    const mind = state.unsaid.minds[name];
    // No mind at all, or a mind with no real lastTurn yet (freshly
    // adopted from an existing card's data, which never carries one) —
    // both get the same fixed high-priority weight rather than a
    // computed one, so a freshly-adopted character gets a fair (high)
    // shot at the next reveal without a fabricated turn gap dwarfing
    // everyone else's actual weight the way turn-1000 backdating did.
    if (!mind || !mind.lastTurn) return 999;
    return Math.max(1, currentTurn - mind.lastTurn);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < names.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return names[i];
  }
  return names[names.length - 1];
}

function buildCoreCheckInstruction(chosen, mind) {
  const coreNote = mind && mind.core ? ` Their current anchor: "${mind.core}".` : "";
  const tensionNote = mind && typeof mind.tensionLevel === "number"
    ? (mind.tensionLevel >= TENSION_THRESHOLD
      ? " Their feelings have been genuinely unsettled for a while now — this may well be the moment."
      : " Their feelings have been fairly steady lately, for what that's worth.")
    : "";
  return `\n[Consider whether recent events have genuinely, permanently changed how ${chosen} sees themselves — not just a passing mood.${coreNote}${tensionNote} If yes, reveal it (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed) as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" (replace [one-word-emotion] with an actual word, not the literal placeholder) (2 italicized sentences). If nothing that significant has happened, don't force it — continue the story normally with no reveal at all.]\n`;
}

function buildAndFitThoughtInstruction(chosen, active, baseText, allowCoreShift) {
  const mind = state.unsaid.minds[chosen];

  const others = (active || []).filter(n => n !== chosen);
  const withHistory = others.filter(n => mind && mind.relations && mind.relations[n]);
  let target = null;
  if (withHistory.length > 0 && mind && mind.relationOrder) {
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

  const varietyNote = mind && mind.lastThoughtText
    ? ` Word this differently than last time — don't reuse: "${mind.lastThoughtText}"`
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
    instruction = `\n[${chosen}'s unspoken reaction to ${target} — 2 italicized sentences: how they really feel about ${target} right now, and what they secretly want from this moment. ${target} can't perceive it.${coreNote}${relationNote}${historyNote}${wantNote}${varietyNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion], about ${target}: thought.》"]\n`;
  } else if (mind && mind.core) {
    const atThreshold = allowCoreShift && typeof mind.tensionLevel === "number" &&
      mind.tensionLevel >= TENSION_THRESHOLD;
    const atDrasticTier = allowCoreShift && typeof mind.tensionLevel === "number" &&
      mind.tensionLevel >= TENSION_THRESHOLD * DRASTIC_TENSION_MULTIPLIER;
    const naturallyEligible = (mind.revealCount || 0) >= REVEALS_BEFORE_SHIFT_ELIGIBLE;
    const shiftEligible = atDrasticTier || (atThreshold && naturallyEligible);
    const shiftNote = shiftEligible
      ? (atDrasticTier && !naturallyEligible
        ? ` Their feelings have been unraveling for a long time now, unresolved — something this significant would happen regardless. If it's truly earned, you may format this instead as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" to replace their old anchor.`
        : ` Their feelings have been genuinely shifting for a while now, not settling back — if this moment plays into that and something has truly changed how they see themselves, you may format this instead as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" to replace their old anchor. Only do this if it's really earned.`)
      : "";
    instruction = `\n[${chosen}'s private thought — 2 italicized sentences: how they really feel right now, and what they secretly want. Consistent with "${mind.core}" and their feeling of ${mind.feeling} unless this scene shifts it.${historyNote}${wantNote}${varietyNote}${shiftNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it.]\n`;
  } else {
    instruction = `\n[This is ${chosen}'s very first private thought — once revealed, it becomes a lasting truth about who they fundamentally are, something real and significant enough to define them going forward, not a fleeting reaction to this moment. 2 italicized sentences: what this deep truth is, and what they secretly want because of it. Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative — no asterisks or other markdown, the 《 》 pair is the only formatting needed): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it.]\n`;
  }

  return fitInstructionToBudget(baseText, instruction);
}

function getLastActionType() {
  if (typeof history !== "undefined" && Array.isArray(history) && history.length > 0) {
    return history[history.length - 1].type || null;
  }
  return null;
}

function isNewStoryTurn() {
  if (typeof info === "undefined" || !info || !Number.isInteger(info.actionCount)) {
    return true;
  }
  const current = Math.abs(info.actionCount);
  const isNew = state.unsaid.lastActionCount !== current;
  state.unsaid.lastActionCount = current;
  return isNew;
}

var ESTIMATED_CHARS_PER_TURN = 900;
function recentTurnsText(text, turnCount) {
  const n = typeof turnCount === "number" && turnCount > 0 ? turnCount : 3;
  const base = text.slice(-(n * ESTIMATED_CHARS_PER_TURN));
  let supplement = "";
  if (typeof history !== "undefined" && Array.isArray(history) && history.length > 0) {
    const last = history[history.length - 1];
    if (last && typeof last.text === "string" && last.text.length > 0) {
      supplement = last.text;
    }
  }
  return supplement ? base + "\n" + supplement : base;
}

var FRONT_MEMORY_MARKER = "[UNSAID hint]";

function syncFrontMemoryHint(subtleHints) {
  if (!state.memory || typeof state.memory !== "object") return;
  const existing = (state.memory.frontMemory || "").split(FRONT_MEMORY_MARKER)[0].replace(/\s+$/, "");
  if (!subtleHints) {
    state.memory.frontMemory = existing;
    return;
  }
  const hint = `${FRONT_MEMORY_MARKER} Let each character's private feelings subtly color their actions and tone right now, without ever stating them outright.`;
  state.memory.frontMemory = existing ? `${existing}\n\n${hint}` : hint;
}

// Shared by both the automatic twist->reveal link and the manual /peek
// command: true if a name has no Story Card yet (can't rule it out, so
// allow by default) or an existing card typed blank/"character" — false
// for anything explicitly typed otherwise (Location, Business, Vehicle...),
// so a resolved twist about a business or a stray "/peek <location>" can't
// force a private thought onto something that was never a person.
function isCharacterLikeCard(name) {
  if (typeof storyCards === "undefined" || !storyCards) return true;
  const existingCard = storyCards.find(c => c.title && isSameCardEntity(c.title, name));
  if (!existingCard) return true;
  const cardType = (existingCard.type || "").trim().toLowerCase();
  return !cardType || cardType === "character";
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
