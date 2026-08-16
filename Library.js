var CP_VERSION = "1.0";

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
  circleComplete: "current events mirror or complete something from generations back"
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
  "Fate & Destiny": ["secretDebt","sharedFate","theWarningWasReal","theCostWasHidden","thePropheciesTwist","bornForThis","theSacrificePlanned","inheritedEnemy","theChosenWrong","fatesLoophole","theBargain","destinyDeferred","theSign","circleComplete"]
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
  circleComplete: "Circle Complete"
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
  { rx: /\b(had happened before, to someone else|had played out before)\b/i, cat: "loopedFate" }
];

var CP_SCENARIO_HINT_PATTERNS = [
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
  { rx: /\b(ancient relic|artifact of great power|relic of (great )?power)\b/i, cat: "theRelic" }
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

var CP_STOPWORDS = new Set([
  "The","A","An","I","He","She","They","It","We","But","And","Or","So",
  "Then","Now","Still","Yet","There","Here","This","That","These","Those",
  "Suddenly","Meanwhile","However","Perhaps","Maybe","Something","Someone",
  "Nothing","Everyone","No","Yes",
  "Rumored","Legend","Legends","According","Reportedly","Allegedly","Apparently",
  "Once","Eventually","Recently","Later","Before","After","During","Since",
  "Because","Although","Though","While","Despite","Unless","Until",
  "Many","Some","Few","Most","All","Each","Every","Long",
  "Rain","Snow","Fog","Mist","Frost","Thunder","Lightning","Wind",
  "Storm","Dawn","Dusk","Twilight","Midnight","Noon","Sunrise","Sunset",
  "North","South","East","West","Northeast","Northwest","Southeast","Southwest",
  "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",
  "January","February","March","April","June","July","August",
  "September","October","November","December"
]);

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

  function isOwnCard(title) {
    return !!title && (title.indexOf("Twists and Turns") === 0 || title.indexOf("Twist — ") === 0);
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
    const matches = Array.from(sentence.matchAll(/\b[A-Z][a-zA-Z'-]*\b/g));
    if (!matches.length) return null;

    const bridge = (i) => {
      const w = stripPossessive(matches[i][0]);
      if (i + 1 < matches.length) {
        const next = stripPossessive(matches[i + 1][0]);
        const gap = sentence.slice(matches[i].index + matches[i][0].length, matches[i + 1].index);
        if (!CP_STOPWORDS.has(next) && next.length > 1 && /^\s?$/.test(gap)) {
          return w + " " + next;
        }
      }
      if (i - 1 >= 0) {
        const prev = stripPossessive(matches[i - 1][0]);
        const gap = sentence.slice(matches[i - 1].index + matches[i - 1][0].length, matches[i].index);
        if (!CP_STOPWORDS.has(prev) && prev.length > 1 && /^\s?$/.test(gap)) {
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
        if (CP_STOPWORDS.has(w) || w.length <= 1) continue;
        const result = bridge(i);
        if (result.indexOf(" ") === -1 && typeof CODEX_TITLE_WORDS !== "undefined" && CODEX_TITLE_WORDS.has(result)) continue;
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
      if (title && !isOwnCard(title) && title.indexOf("UNSAID") !== 0) out.push(title);
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

  function isEligible(thread, c, cfg) {
    return thread.status === "brewing" &&
      thread.seedTouches >= cfg.minSeedsForPayoff &&
      (c.turn - thread.originTurn) >= cfg.minTurnsForPayoff;
  }

  function scanForLooseThreads(text, c, cfg, cardTitles) {
    if (!text) return;
    const sentences = splitSentences(text);

    let lastEntity = null;
    for (const s of sentences) {
      const sentenceEntity = findKnownEntityInSentence(s, cardTitles) || findEntityInSentence(s);
      if (sentenceEntity) lastEntity = sentenceEntity;
      for (const p of CP_LOOSE_THREAD_PATTERNS) {
        if (p.rx.test(s)) {
          const entity = sentenceEntity || lastEntity;
          if (!entity) continue;
          if (isPlayerEntity(c, entity) && !cfg.involvePlayer) continue;
          if (alreadyResolvedCombo(c, entity, p.cat)) continue;
          const existing = findThread(c, entity, p.cat);
          if (existing) {
            if (existing.status === "brewing") {
              existing.seedTouches += 1;
              existing.tier = tierFor(existing.seedTouches);
              if (isEligible(existing, c, cfg)) existing.status = "ready";
            }
          } else {
            createThread(c, entity, p.cat, c.turn, cfg);
          }
          break;
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
      if (card.title.indexOf("UNSAID") === 0) continue;

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

  function pickForeshadowThread(c) {
    const brewing = c.threads.filter(t => t.status === "brewing");
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
        const beforeLen = storyCards.length;
        addStoryCard(title.toLowerCase(), entry, type, title, notes);
        if (storyCards.length > beforeLen) {
          card = storyCards[storyCards.length - 1];
        } else {
          for (let i = 0; i < storyCards.length; i++) {
            if (storyCards[i] && storyCards[i].title === title) { card = storyCards[i]; break; }
          }
        }
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

  var CP_CONFIG_BOOLEAN_KEYS = ["enabled", "strictLogic", "allowWildcard", "allowCompoundTwists", "involvePlayer", "showTwistLog"];

  var CP_CONFIG_NUMBER_RANGES = {
    minSeedsForPayoff: [1, 200],
    minTurnsForPayoff: [1, 200],
    payoffCooldown: [1, 200],
    establishedFactsCap: [1, 30]
  };

  function applyConfigChange(cfg, key, rawValue) {
    if (!key || !rawValue) return false;
    const matchKey = Object.keys(CP_DEFAULTS).find(k => k.toLowerCase() === key.toLowerCase());
    if (!matchKey) return false;

    if (matchKey === "intensity") {
      const v = rawValue.toLowerCase();
      if (["low", "medium", "high"].indexOf(v) === -1) return false;
      cfg.intensity = v;
      return true;
    }
    if (matchKey === "categoryBias") {
      const v = rawValue.trim().toLowerCase();
      if (v === "off" || v === "none") { cfg.categoryBias = ""; return true; }
      const requested = rawValue.split(",").map(s => s.trim()).filter(Boolean);
      const matched = requested
        .map(r => CP_CLUSTER_NAMES.find(c => c.toLowerCase() === r.toLowerCase()))
        .filter(Boolean);
      if (matched.length === 0) return false;
      cfg.categoryBias = matched.join(", ");
      return true;
    }
    if (CP_CONFIG_BOOLEAN_KEYS.indexOf(matchKey) !== -1) {
      const v = rawValue.toLowerCase();
      if (["true", "on", "yes"].indexOf(v) !== -1) { cfg[matchKey] = true; return true; }
      if (["false", "off", "no"].indexOf(v) !== -1) { cfg[matchKey] = false; return true; }
      return false;
    }
    if (CP_CONFIG_NUMBER_RANGES[matchKey]) {
      const range = CP_CONFIG_NUMBER_RANGES[matchKey];
      const n = parseInt(rawValue, 10);
      if (isNaN(n) || n < range[0] || n > range[1]) return false;
      cfg[matchKey] = n;
      return true;
    }
    return false;
  }

  function findCardByTitle(title) {
    for (let i = 0; i < storyCards.length; i++) {
      if (storyCards[i] && storyCards[i].title === title) return storyCards[i];
    }
    return null;
  }

  function parseConfigFromEntry(cfg, entryText) {
    if (!entryText) return;
    const lines = entryText.split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z]+)\s*[:=]\s*(.+?)\s*$/);
      if (!m) continue;
      applyConfigChange(cfg, m[1], m[2]);
    }
  }

  var CP_CONFIG_ENTRY_TEMPLATE =
    "Edit this box to change settings — one per line.\n" +
    "e.g. intensity: high\n\n" +
    "Every option and what it does is explained in Notes below.";

  function applyEntryConfig(cfg) {
    const card = findConfigCardTolerant("Twists and Turns Config");
    if (card) parseConfigFromEntry(cfg, card.entry);
  }

  function updateConfigCard(cfg, c) {
    const title = "Twists and Turns Config";
    let card = findConfigCardTolerant(title);
    if (card && card.title !== title) card.title = title;

    if (!card) {
      const beforeLen = storyCards.length;
      try { addStoryCard(title.toLowerCase(), CP_CONFIG_ENTRY_TEMPLATE, "class", title, ""); } catch (e) {}
      card = storyCards.length > beforeLen ? storyCards[storyCards.length - 1] : findCardByTitle(title);
    }

    const brewing = c ? c.threads.filter(t => t.status === "brewing").length : 0;
    const ready = c ? c.threads.filter(t => t.status === "ready").length : 0;
    const resolved = c ? c.twistLog.length : 0;
    const onOff = (b) => b ? "on" : "off";
    const notes =
      "TWISTS AND TURNS — v" + CP_VERSION + "\n" +
      "Quietly builds and pays off plot twists based on your own story.\n\n" +
      "STATUS\n" +
      brewing + " brewing · " + ready + " about to surface · " + resolved + " resolved\n\n" +
      "TO CHANGE A SETTING\n" +
      "Edit the box above (Entry) — one \"name: value\" per line. Takes effect on your next action.\n\n" +
      "SETTINGS (current value — what it does)\n" +
      "enabled: " + onOff(cfg.enabled) + " — turns the whole script on or off\n" +
      "intensity: " + cfg.intensity + " — low / medium / high, how often twists build and land\n" +
      "strictLogic: " + onOff(cfg.strictLogic) + " — twists only ever come from a tracked thread\n" +
      "allowWildcard: " + onOff(cfg.allowWildcard) + " — occasional twist with no build-up\n" +
      "allowCompoundTwists: " + onOff(cfg.allowCompoundTwists) + " — two threads can resolve together\n" +
      "involvePlayer: " + onOff(cfg.involvePlayer) + " — twists may target you, not just NPCs\n" +
      "showTwistLog: " + onOff(cfg.showTwistLog) + " — reveals resolved twists on the log card\n" +
      "minSeedsForPayoff: " + cfg.minSeedsForPayoff + " — reinforcement touches a thread needs before it can pay off\n" +
      "minTurnsForPayoff: " + cfg.minTurnsForPayoff + " — minimum turns a thread must exist before it can pay off\n" +
      "payoffCooldown: " + cfg.payoffCooldown + " — minimum turns between any two twists\n" +
      "establishedFactsCap: " + cfg.establishedFactsCap + " — how many recent twists stay visible to the AI at once\n" +
      "categoryBias: " + (cfg.categoryBias || "off") + " — prefer certain twist themes (e.g. \"Power & Authority, Fate & Destiny\") when a shape isn't already determined by the story itself. Themes: " + CP_CLUSTER_NAMES.join(", ") + "\n\n" +
      "COMMANDS\n" +
      "/twist — pay off the most-built-up thread now\n" +
      "/twist <name> — force a twist around someone specific\n" +
      "/plant <name> [category] — seed a new thread manually\n" +
      "/twistlog — toggle the resolved-twist log\n" +
      "/threads — spoiler-safe overview of what's brewing, by theme only\n" +
      "/intensity low | medium | high — same as editing intensity above\n" +
      "/rescan — force a full re-check of your Story Cards, Plot Essentials, and Author's Note\n" +
      "/twists help — show this card";

    if (card) {
      card.title = title;
      card.type = "class";
      card.description = notes;

    }
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
    splitSentences, findThread, createThread, tierFor, isEligible, priorTwistCountFor, scanForLooseThreads, scanStoryCardsForScenarioThreads,
    scanPlotEssentialsForThreads, scanAuthorsNoteForThreads, pickForeshadowThread, pickMostBuiltUpBrewingThread, pickPayoffThread, pickCompoundPayoffThreads, pickWildcardEntity,
    foreshadowHint, payoffHint, compoundPayoffHint, safeSetCard, createTwistStoryCard, safeLog, applyConfigChange, applyEntryConfig,
    updateCacheEfficiencyWarning, updateNudgeCard, updateConfigCard, updateTwistLogCard, updateThreadsOverview
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
  codexMaxAttempts: 5,
  playerName: ""
};

var CONTEXT_SAFETY_MARGIN = 20;
var MAX_CARD_ENTRY_LENGTH = 1800;

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

var CODEX_STOPWORDS = new Set([
  "I", "The", "A", "An", "You", "He", "She", "They", "It", "We", "But",
  "And", "So", "Then", "If", "When", "As", "At", "In", "On", "With",
  "This", "That", "There", "Here", "What", "Who", "Why", "How", "Yes",
  "No", "Okay", "Oh", "Well", "Suddenly", "Meanwhile", "Finally",
  "Perhaps", "Maybe", "However", "Still", "Yet", "Now", "Later",
  "Before", "After", "Once", "Just", "Even", "Also", "Instead",
  "Indeed", "Certainly", "Clearly", "Obviously", "Surely",
  "Sometimes", "Always", "Never", "Really", "Actually", "Honestly",
  "Wait", "Look", "Listen", "Right", "Alright", "Hey", "Huh", "Hmm", "Ah",
  "Easy", "Careful", "Steady", "Quiet", "Patience", "Hush", "Stop",
  "Freeze", "Move", "Run", "Go", "Come", "Stay", "Help", "Please",
  "Sorry", "Thanks", "Fine", "Sure", "Great", "Good", "Bad", "Nice",
  "Your", "My", "His", "Her", "Its", "Our", "Their", "These", "Those",
  "Some", "Any", "All", "Each", "Every", "Nothing", "Something", "Anything",
  "Turn", "Chapter", "Part", "Scene", "Day", "Night", "Morning",
  "Evening", "Afternoon", "Time", "Silence", "Darkness", "Light",
  "Fate", "Death", "Life", "Space", "Everything",

  "Rain", "Snow", "Fog", "Mist", "Frost", "Thunder", "Lightning", "Wind",
  "Storm", "Dawn", "Dusk", "Twilight", "Midnight", "Noon", "Sunrise", "Sunset",
  "Not", "Nor", "Only", "Too", "Off", "Out", "Up", "Down", "Away",
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
  "September", "October", "November", "December"
]);

var CODEX_LOCATION_HINTS = /\b(city|state|street|avenue|canyon|terminal|park|building|tower|island|country|nation|kingdom|realm|district|region|planet|world|base|facility|academy|university|bridge|river|mountain|forest|desert|battleground|warzone|hall|tavern|inn|castle|fortress|temple|level|sector|wing|chamber|vault|bay|deck|outpost|colony|settlement|village|town|hamlet|station|harbor|wharf)\b/i;
var CODEX_LOCATION_SUFFIX_HINTS = /(tower|keep|hold|spire|haven|hollow|reach|scraper)/i;

var CODEX_FACTION_HINTS = /\b(order|guild|alliance|empire|faction|clan|brotherhood|council|syndicate|coalition|army|legion|cult|society|corporation|company|initiative|division|agency|federation|dynasty|tribe|vanguard|battalion|regiment|squad|cabal|circle|sect|resistance|movement|militia|garrison)\b/i;

var CODEX_ITEM_HINTS = /\b(sword|blade|gun|rifle|pistol|staff|wand|amulet|ring|armou?r|shield|artifact|device|weapon|tool|key|book|tome|potion|elixir|gem|crystal|relic|suit|mask|cloak|helmet|gauntlet|hammer|axe|bow|orb|blaster|scroll|spear|dagger|lance|trident|chalice|sigil|banner)\b/i;

var CODEX_TITLE_WORDS = new Set([
  "Emperor", "Empress", "King", "Queen", "Prince", "Princess", "Duke",
  "Duchess", "Lord", "Lady", "Sir", "Dame", "Baron", "Baroness", "Count",
  "Countess", "President", "General", "Admiral", "Captain", "Colonel",
  "Major", "Sergeant", "Lieutenant", "Commander", "Chief", "Director",
  "Minister", "Governor", "Senator", "Ambassador", "Doctor", "Professor",
  "Master", "Mistress", "Reverend", "Bishop", "Cardinal", "Judge",
  "Justice", "Mayor", "Chancellor", "Agent", "Officer", "Detective",
  "Sheriff", "Marshal", "Warden", "Overlord", "Warlord", "Elder",
  "Guardian", "Knight", "Priest", "Priestess"
]);

var SENTENCE_ABBREVIATIONS = new Set([
  "Dr", "Mr", "Mrs", "Ms", "Prof", "St", "Jr", "Sr", "Capt", "Gen",
  "Col", "Lt", "Sgt", "Rev", "Hon", "Fr", "Rep", "Sen", "Gov", "Adm",
  "Cmdr", "Maj", "Mt", "vs", "etc"
]);
// A name "word" is a capitalized token that may contain an internal
// apostrophe (O'Brien, Ba'al, D'Angelo) — without this, an apostrophe was
// treated as a hard break, fracturing a single name into two or three
// separate tracked/carded fragments (e.g. "Captain O'Brien" splitting into
// "Captain O" and "Brien" as two unrelated entities).
var CODEX_NAME_TOKEN = "[A-Z][a-zA-Z]*(?:['\u2019][a-zA-Z]+)*";
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
    "still runs but its result is never sent to the AI — meaning " +
    "UNSAID's private thoughts and auto-generated Story Cards cannot " +
    "work right now, through no fault of your config. This is a " +
    "platform limitation, not a bug in the script. To use UNSAID, " +
    "switch to a model without cache efficiency enabled, or disable " +
    "cache efficiency for this model if your plan allows it.";
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
      codex: { mentionCounts: {}, attempts: {}, pendingNames: [], pendingTypes: {}, consecutiveFailedNames: [] }
    };
  }
  if (!state.unsaid.codex) {
    state.unsaid.codex = { mentionCounts: {}, attempts: {}, pendingNames: [], pendingTypes: {}, consecutiveFailedNames: [] };
  }
  if (!state.unsaid.codex.mentionCounts) state.unsaid.codex.mentionCounts = {};
  if (!state.unsaid.codex.pendingNames) state.unsaid.codex.pendingNames = [];
  if (!state.unsaid.codex.pendingTypes) state.unsaid.codex.pendingTypes = {};
  if (!state.unsaid.codex.consecutiveFailedNames) state.unsaid.codex.consecutiveFailedNames = [];
  if (typeof state.unsaid.lastActionCount !== "number") state.unsaid.lastActionCount = -1;
  ensureConfigCard();
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

function pushMessage(msg) {
  if (!msg) return;
  state.message = state.message ? state.message + " " + msg : msg;
}

function nameAppears(name, text) {
  return new RegExp(`\\b${escapeForRegex(name)}\\b`, "i").test(text);
}

function createOrFindCard(keys, initialEntry, type) {
  try {
    const beforeLen = storyCards.length;
    addStoryCard(keys, initialEntry, type);
    if (storyCards.length > beforeLen) {
      const card = storyCards[storyCards.length - 1];
      if (card) return card;
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

function ensureConfigCard() {
  let card = findConfigCardTolerant("UNSAID Config");
  if (card && card.title !== "UNSAID Config") card.title = "UNSAID Config";
  if (!card) {
    card = createOrFindCard("unsaid config", " ", "Class");
    if (!card) return null;
    card.title = "UNSAID Config";
    card.keys = "unsaid config";
    card.type = "Class";
    card.entry =
      "-- General --\n" +
      "> Enable UNSAID: true\n" +
      "> Enable Codex: true\n" +
      "-- Private Thoughts --\n" +
      "> Chance of a thought per turn (0 to 1): 0.3\n" +
      "> Turns before the same character can think again: 3\n" +
      "> Ease off during your own Do/Say actions: true\n" +
      "> Recent turns counted as \"active\": 3\n" +
      "> Show private thoughts in the story text: false\n" +
      "> Let hidden feelings subtly color actions: true\n" +
      "> Store card notes as JSON: false\n" +
      "-- Core Truth --\n" +
      "> Allow major events to rewrite a core truth: true\n" +
      "-- Codex --\n" +
      "> Mentions needed before Codex creates a card: 3\n" +
      "> Minimum turns between Codex cards: 5\n" +
      "> Codex retries before giving up on a name: 5\n" +
      "> Reset Codex tracking now: false\n" +
      "> Player character (skip when Codexing): \n";
    card.description =
      "Commands (type as an action):\n" +
      "- /unsaid status — writes a live status report to a separate \"UNSAID — Status\" card. Not sent to the AI.\n" +
      "- /peek <character name> — force a private thought from that character right now.\n" +
      "- /peek <character name> core — force a check for whether this moment has changed that character's core truth.\n" +
      "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.\n\n" +
      "Pre-authoring a character's inner life: write \"💭 Inner Life — private, not visible to other characters\" followed by \"Core truth:\" and their established truth into a character's own Notes before their first reveal, and UNSAID will start from that instead of inventing one. Matches the same format this script writes when it syncs a reveal, so copying an existing character's Notes as a template works too.\n\n" +
      "UNSAID Config — what each setting above does:\n" +
      "- Enable UNSAID: master switch for the whole script (private thoughts and Codex together). False turns everything off.\n" +
      "- Enable Codex: turns automatic Story Card generation on or off by itself. Turn this off to keep private thoughts working normally on your existing, hand-made cards without any new ones being generated.\n" +
      "- Chance of a thought per turn: how likely (0 to 1) it is that an eligible, active character reveals a private thought on any given turn. Higher means more frequent reveals. (Reveals are already a little less likely during your own Do/Say actions, and a character's own core truth naturally takes a bit longer to shift than an ordinary mood, on a fixed pace behind the scenes.)\n" +
      "- Turns before the same character can think again: a cooldown, in turns, before that same character is eligible for another thought — keeps one character from dominating.\n" +
      "- Ease off during your own Do/Say actions: when true (default), a reveal is less likely to fire specifically on turns where you took a deliberate Do or Say action, so it doesn't compete for attention right when you've acted. Turns you didn't directly drive (Continue, Story) are unaffected either way.\n" +
      "- Recent turns counted as \"active\": roughly how many recent turns get scanned for who's currently active and eligible for a reveal, sized generously since a single detailed turn can run to several thousand characters — raise it if characters feel like they drop out of relevance too fast in a slow-paced story, lower it to keep the cast tightly focused on only the very latest turn.\n" +
      "- Show private thoughts in the story text: when false (default), a reveal never appears in your story — it's written straight to that character's own Story Card instead, so you look them up rather than having their private thoughts narrated at you. Set to true for the old behavior: an italicized line shown right in the story.\n" +
      "- Let hidden feelings subtly color actions: when true (default), a character's hidden feeling is allowed to quietly show through in their body language and tone in the actual story — a tight smile, a held breath — without ever stating the feeling outright or giving away their private thought. Turn off for characters who should read as unreadable.\n" +
      "- Store card notes as JSON: off by default — notes are written as plain, skimmable prose. Turn on to instead write the exact same data as structured JSON, if you specifically want it machine-parseable rather than easy to read at a glance.\n" +
      "- Allow major events to rewrite a core truth: on by default. A genuinely major story event can replace a character's core truth, earned naturally through ordinary play (no commands needed) — their old core truth is kept on file rather than erased, and how long the current one has held is shown right on their card. Turn off if you want core truths to stay permanent instead.\n" +
      "- Mentions needed before Codex creates a card: how many times a new name must appear before Codex writes a card for it, so background one-off names don't get cards of their own.\n" +
      "- Minimum turns between Codex cards: how many turns must pass between one Codex card and the next, regardless of how many names qualify — keeps Codex from taking over several turns in a row.\n" +
      "- Codex retries before giving up on a name: how many times Codex will try to get a properly formatted card out of the AI before giving up on that name for good. Raise this if cards are failing to complete.\n" +
      "- Reset Codex tracking now: set to true and Codex will forget every failed attempt and cooldown timer, then flip this back to false on its own. Use this if cards seem stuck and not being made.\n" +
      "- Player character (skip when Codexing): put your own character's name here if you don't want Codex writing an AI-authored profile for them. Leave blank to let Codex treat them like anyone else. In Multiplayer, everyone's character name is already skipped automatically.\n\n" +
      "Add the names of characters who can have private thoughts below, one per line. Codex adds newly discovered characters here automatically.\n" +
      CAST_LIST_MARKER + "\n" +
      "Marcus\n" +
      "Aria";
  }
  return card;
}

function readUnsaidConfig() {
  const card = ensureConfigCard();
  if (!card) return { ...UNSAID_DEFAULTS, cast: [] };
  const preAuthoringNote = "Pre-authoring a character's inner life: write \"💭 Inner Life — private, not visible to other characters\" followed by \"Core truth:\" and their established truth into a character's own Notes before their first reveal, and UNSAID will start from that instead of inventing one. Matches the same format this script writes when it syncs a reveal, so copying an existing character's Notes as a template works too.";
  if (!card.description.includes("Commands (type as an action):")) {
    card.description =
      "Commands (type as an action):\n" +
      "- /unsaid status — writes a live status report to a separate \"UNSAID — Status\" card. Not sent to the AI.\n" +
      "- /peek <character name> — force a private thought from that character right now.\n" +
      "- /peek <character name> core — force a check for whether this moment has changed that character's core truth.\n" +
      "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.\n\n" +
      preAuthoringNote + "\n\n" +
      card.description;
  } else if (!card.description.includes("Pre-authoring a character's inner life:")) {
    const cardLine = "- /card <character name> — force Codex to write or refresh that character's Story Card right now, skipping the mention count and cooldown.";
    card.description = card.description.includes(cardLine)
      ? card.description.replace(cardLine, cardLine + "\n\n" + preAuthoringNote)
      : preAuthoringNote + "\n\n" + card.description;
  }
  const cfg = { ...UNSAID_DEFAULTS };

  const enabledMatch = card.entry.match(/Enable UNSAID:\s*(true|false)/i);
  if (enabledMatch) cfg.enabled = enabledMatch[1].toLowerCase() === "true";

  const codexMatch = card.entry.match(/Enable Codex:\s*(true|false)/i);
  if (codexMatch) cfg.codexEnabled = codexMatch[1].toLowerCase() === "true";

  const showInStoryMatch = card.entry.match(/Show private thoughts in the story text:\s*(true|false)/i);
  if (showInStoryMatch) cfg.showThoughtsInStory = showInStoryMatch[1].toLowerCase() === "true";

  const subtleHintsMatch = card.entry.match(/subtly color actions:\s*(true|false)/i);
  if (subtleHintsMatch) cfg.subtleHints = subtleHintsMatch[1].toLowerCase() === "true";

  const jsonNotesMatch = card.entry.match(/Store card notes as JSON:\s*(true|false)/i);
  if (jsonNotesMatch) cfg.jsonNotes = jsonNotesMatch[1].toLowerCase() === "true";

  const coreShiftMatch = card.entry.match(/rewrite a core truth:\s*(true|false)/i);
  if (coreShiftMatch) cfg.allowCoreShift = coreShiftMatch[1].toLowerCase() === "true";

  const chanceMatch = card.entry.match(/thought per turn[^:]*:\s*([\d.]+)/i);
  if (chanceMatch) {
    const parsedChance = parseFloat(chanceMatch[1]);
    if (!isNaN(parsedChance)) cfg.chance = Math.min(1, Math.max(0, parsedChance));
  }

  const cooldownMatch = card.entry.match(/think again:\s*(\d+)/i);
  if (cooldownMatch) {
    const parsedCooldown = parseInt(cooldownMatch[1], 10);
    if (!isNaN(parsedCooldown)) cfg.cooldown = Math.max(0, parsedCooldown);
  }

  const reduceMatch = card.entry.match(/Ease off during your own Do\/Say actions:\s*(true|false)/i);
  if (reduceMatch) cfg.reduceDuringActions = reduceMatch[1].toLowerCase() === "true";

  const recentTurnsMatch = card.entry.match(/Recent turns counted as "active":\s*(\d+)/i);
  if (recentTurnsMatch) {
    const parsedRecentTurns = parseInt(recentTurnsMatch[1], 10);
    if (!isNaN(parsedRecentTurns)) cfg.recentTurnsWindow = Math.max(1, parsedRecentTurns);
  }

  const mentionMatch = card.entry.match(/Mentions needed before Codex creates a card:\s*(\d+)/i);
  if (mentionMatch) {
    const parsedMentions = parseInt(mentionMatch[1], 10);
    if (!isNaN(parsedMentions)) cfg.mentionThreshold = Math.max(0, parsedMentions);
  }

  const codexCooldownMatch = card.entry.match(/Minimum turns between Codex cards:\s*(\d+)/i);
  if (codexCooldownMatch) {
    const parsedCodexCooldown = parseInt(codexCooldownMatch[1], 10);
    if (!isNaN(parsedCodexCooldown)) cfg.codexCooldown = Math.max(0, parsedCodexCooldown);
  }

  const codexAttemptsMatch = card.entry.match(/Codex retries before giving up on a name:\s*(\d+)/i);
  if (codexAttemptsMatch) {
    const parsedAttempts = parseInt(codexAttemptsMatch[1], 10);
    if (!isNaN(parsedAttempts)) cfg.codexMaxAttempts = Math.max(1, parsedAttempts);
  }

  const resetMatch = card.entry.match(/Reset Codex tracking now:\s*(true|false)/i);
  if (resetMatch && resetMatch[1].toLowerCase() === "true") {
    state.unsaid.codex.attempts = {};
    state.unsaid.codex.mentionCounts = {};
    state.unsaid.codex.lastTriggerTurn = 0;
  }

  const playerMatch = card.entry.match(/Player character \(skip when Codexing\):[ \t]*(.*)/i);
  if (playerMatch) cfg.playerName = playerMatch[1].trim();

  const markerIdx = card.description.indexOf(CAST_LIST_MARKER);
  const castSection = markerIdx >= 0
    ? card.description.slice(markerIdx + CAST_LIST_MARKER.length)
    : card.description.split("\n").slice(1).join("\n");

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

    if (isCardOfKind(c, "location") || isCardOfKind(c, "faction") || isCardOfKind(c, "item") || isCardOfKind(c, "class")) return;
    if (typeof CP_TWIST_CARD_TYPE !== "undefined" && isCardOfKind(c, CP_TWIST_CARD_TYPE)) return;
    if (c.title.indexOf("Twists and Turns") === 0 || c.title.indexOf("Twist — ") === 0) return;
    if (c.title === "UNSAID Config") return;
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
    card.description += "\n" + newlyAdopted.join("\n");
  }

  if (cfg.playerName) {
    const beforeCount = cfg.cast.length;
    cfg.cast = cfg.cast.filter(n => !isSameCardEntity(n, cfg.playerName));
    if (cfg.cast.length !== beforeCount) {
      const markerIdx2 = card.description.indexOf(CAST_LIST_MARKER);
      if (markerIdx2 !== -1) {
        const head = card.description.slice(0, markerIdx2 + CAST_LIST_MARKER.length);
        card.description = `${head}\n${cfg.cast.join("\n")}`;
      }
    }
  }

  card.entry =
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
    `> Reset Codex tracking now: false\n` +
    `> Player character (skip when Codexing): ${cfg.playerName}\n`;

  return cfg;
}

function stripConfigNoise(text) {
  let cleaned = text;
  storyCards
    .filter(c => isCardOfKind(c, "class") && c.title && c.title.indexOf("UNSAID") === 0)
    .forEach(card => {
      if (card.entry) cleaned = cleaned.split(card.entry).join("");
      if (card.description) cleaned = cleaned.split(card.description).join("");
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

function trackMentions(text) {
  if (!state.unsaid || !state.unsaid.codex) return;
  const matches = text.match(CODEX_TITLE_ABBREV_REGEX) || [];
  matches.forEach(raw => {
    // strip a trailing possessive ("Ba'al's" -> "Ba'al") so a name mentioned
    // both plainly and possessively is tracked/carded as one entity, not two
    let name = stripPossessive(raw.trim());
    let words = name.split(" ");
    while (words.length > 1 && CODEX_STOPWORDS.has(words[0])) {
      words = words.slice(1);
      name = words.join(" ");
    }
    if (words.length === 1 && CODEX_STOPWORDS.has(words[0])) return;
    if (words.length === 1 && CODEX_TITLE_WORDS.has(name)) return;
    state.unsaid.codex.mentionCounts[name] = (state.unsaid.codex.mentionCounts[name] || 0) + 1;
  });
  pruneMentionCounts();
}

function pruneMentionCounts() {
  const counts = state.unsaid.codex.mentionCounts;
  const keys = Object.keys(counts);
  if (keys.length > MENTION_TRACKING_CAP + 50) {
    keys
      .sort((a, b) => counts[a] - counts[b])
      .slice(0, keys.length - MENTION_TRACKING_CAP)
      .forEach(k => delete counts[k]);
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

  const nearLocation = new RegExp(`(in|inside|outside|through)\\s+${escapeForRegex(name)}\\b`, "i");
  if (nearLocation.test(text)) return "location";

  const nearItem = new RegExp(`(wields?|holds?|wearing|wears|using|uses|draws?|grips?|picks?\\s+up|holsters?)\\s+(the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+)?${escapeForRegex(name)}\\b`, "i");
  if (nearItem.test(text)) return "item";

  return "character";
}

function isSameCardEntity(cardTitle, candidateName) {
  const title = cardTitle.toLowerCase();
  const name = candidateName.toLowerCase();
  const isReserved = t => t.indexOf("twists and turns") === 0 || t.indexOf("twist — ") === 0 || t.indexOf("unsaid") === 0;
  if (isReserved(title) !== isReserved(name)) return false;
  if (title === name) return true;
  const titleWords = title.split(" ");
  const nameWords = name.split(" ");
  const shorter = titleWords.length <= nameWords.length ? titleWords : nameWords;
  const longer = titleWords.length <= nameWords.length ? nameWords : titleWords;
  return shorter.length > 0 && shorter.every(w => longer.includes(w));
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
  const eligible = [];
  for (const name in counts) {
    if (counts[name] <= threshold) continue;
    if (exclude.some(ex => isSameCardEntity(ex, name))) continue;
    if (storyCards.some(c => isSameCardEntity(c.title, name))) continue;
    if ((state.unsaid.codex.attempts[name] || 0) >= cap) continue;
    eligible.push({ name, count: counts[name] });
  }
  eligible.sort((a, b) => b.count - a.count);

  const picked = [];
  for (const candidate of eligible) {
    if (picked.length >= limit) break;
    if (picked.some(p => isSameCardEntity(p.name, candidate.name))) continue;
    picked.push(candidate);
  }
  return picked.map(p => p.name);
}

function buildCodexInstruction(names, text) {
  const blocks = names.map((name, i) => {
    const type = classifyCodexEntry(name, text);
    const fields = CARD_TEMPLATES[type] || CHARACTER_CARD_FIELDS;
    const body = fields.map(f => `${f}: ${f === "Name" ? name : "..."}`).join("\n");
    const mind = type === "character" ? state.unsaid.minds[name] : null;
    const knownNote = mind && mind.core
      ? ` They've privately shown this about themselves: "${mind.core}" — let Personality and Background agree with it, not invent something that contradicts it.`
      : "";
    const correctionNote = type === "character"
      ? ` If "${name}" is actually a location, item, or faction rather than a character, use Location/Description/Key Locations/Historical Events/Significance, or Type/Description/Properties/Origin/Significance, or Type/Description/Significance instead of the fields below — whichever genuinely fits it.`
      : "";
    return `Profile ${i + 1} — "${name}":${knownNote}${correctionNote}\n【CARD】\n${body}\n【/CARD】`;
  }).join("\n\n");

  return `\n[Finish the story normally first — that's the priority. Then, on new lines after it, add ${names.length > 1 ? "these brief hidden profiles" : "a brief hidden profile"} wrapped between 【CARD】 and 【/CARD】, not part of the visible narrative:\n${blocks}\nKeep each field to a few words — this should take one or two lines total per profile, not paragraphs. Use whatever the story has actually shown; where it hasn't shown much yet, fill in your best reasonable answer instead of leaving a field blank or vague — draw on general knowledge for anything real-world (an actual place, a well-known title, a common item), and a sensible, in-fiction guess for anything invented that the story just hasn't detailed yet.]\n`;
}

function codexLogTitle(type) {
  const heading = type.charAt(0).toUpperCase() + type.slice(1) + "s";
  return `UNSAID Codex Log — ${heading}`;
}

function buildStatusReport(cfg) {
  const lines = [];
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
      lines.push(`  ${name} — ${coreNote}, feeling: ${m.feeling || "none yet"}, ${m.revealCount || 0} reveal(s), last active turn ${m.lastTurn}`);
    });
  }

  const counts = state.unsaid.codex.mentionCounts;
  const attempts = state.unsaid.codex.attempts;
  const tracked = Object.keys(counts);
  const exhausted = tracked.filter(n => (attempts[n] || 0) >= cfg.codexMaxAttempts);
  const eligible = tracked.filter(n => counts[n] > cfg.mentionThreshold && !exhausted.includes(n));
  lines.push(`\nCodex mention-tracking: ${tracked.length} name(s) tracked, ${eligible.length} genuinely eligible now (above the mention threshold of ${cfg.mentionThreshold}, not yet exhausted)`);
  if (eligible.length > 0) {
    lines.push(`  eligible now: ${eligible.slice(0, 10).map(n => `${n} (${counts[n]}x)`).join(", ")}${eligible.length > 10 ? ", ..." : ""}`);
  }
  if (exhausted.length > 0) {
    lines.push(`  gave up after ${cfg.codexMaxAttempts} attempts: ${exhausted.join(", ")} — "Reset Codex tracking now" to retry`);
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
  const rawSentences = thought.split(/(?<=[.!?])\s+/).filter(Boolean);
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
  return { feelingSentence: sentences[0] || thought, wantSentence: sentences[1] || null };
}

function forgetMentionTracking(name) {
  delete state.unsaid.codex.mentionCounts[name];
  delete state.unsaid.codex.attempts[name];
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
  if (coreMatch && coreMatch[1].trim()) { mind.core = coreMatch[1].trim(); found = true; }
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
    loaded.lastTurn = state.unsaid.turn - 1000;
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
    return mind ? Math.max(1, currentTurn - mind.lastTurn) : 999;
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
  return `\n[Consider whether recent events have genuinely, permanently changed how ${chosen} sees themselves — not just a passing mood.${coreNote}${tensionNote} If yes, reveal it (keep the 《 》 characters exactly as shown, they're required, not decorative) as "《${chosen}, [one-word-emotion], core-shift: new lasting truth.》" (replace [one-word-emotion] with an actual word, not the literal placeholder) (2 italicized sentences). If nothing that significant has happened, don't force it — continue the story normally with no reveal at all.]\n`;
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
    instruction = `\n[${chosen}'s unspoken reaction to ${target} — 2 italicized sentences: how they really feel about ${target} right now, and what they secretly want from this moment. ${target} can't perceive it.${coreNote}${relationNote}${historyNote}${wantNote}${varietyNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative): "《${chosen}, [one-word-emotion], about ${target}: thought.》"]\n`;
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
    instruction = `\n[${chosen}'s private thought — 2 italicized sentences: how they really feel right now, and what they secretly want. Consistent with "${mind.core}" and their feeling of ${mind.feeling} unless this scene shifts it.${historyNote}${wantNote}${varietyNote}${shiftNote} Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it.]\n`;
  } else {
    instruction = `\n[This is ${chosen}'s very first private thought — once revealed, it becomes a lasting truth about who they fundamentally are, something real and significant enough to define them going forward, not a fleeting reaction to this moment. 2 italicized sentences: what this deep truth is, and what they secretly want because of it. Replace [one-word-emotion] with an actual single word (e.g. wary, hopeful) — do not write the words "feeling" or "emotion" literally. Format (keep the 《 》 characters exactly as shown, they're required, not decorative): "《${chosen}, [one-word-emotion]: thought.》" No one else perceives it.]\n`;
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

function linkTwistPayoffToReveal(entity, tier) {
  if (typeof state === "undefined" || !state.unsaid) return;
  if (state.unsaid.forcedPeek) return;
  let cfg;
  try { cfg = readUnsaidConfig(); } catch (e) { return; }
  if (!cfg.enabled) return;
  state.unsaid.forcedPeek = entity;
  state.unsaid.forcedPeekCore = (tier === "major" || tier === "cataclysmic") && !!cfg.allowCoreShift;
}
