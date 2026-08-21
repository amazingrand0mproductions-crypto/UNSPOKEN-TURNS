state.message = "";

try {
  initUnsaid();
} catch (e) {
  if (typeof log === "function") log("UNSAID init/Input error: " + (e && e.message));
}

var cleanCommandEntity = (raw, maxLen) => {
  let name = String(raw || "").trim();
  name = name.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’.!?]+$/, "").trim();
  name = name.replace(/\s+/g, " ");
  return name.slice(0, typeof maxLen === "number" ? maxLen : 80);
};

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();
    Library.applyEntryConfig(cfg);
    const cmd = Library.extractCommand(text);

    if (cmd) {
      const parts = cmd.slice(1).trim().split(/\s+/);
      const head = (parts[0] || "").toLowerCase();

      if (head === "twist") {
        if (!cfg.enabled) {
          pushMessage("🌀 TWISTS AND TURNS is currently disabled — turn on \"Enable Twists and Turns\" on the config card first, or nothing will actually happen this turn.");
          text = "(A quiet moment passes.)";
          return { text };
        }
        const name = cleanCommandEntity(parts.slice(1).join(" "));
        if (name) {
          let thread = c.threads.find(t => isSameCardEntity(t.entity, name) && Library.isThreadAllowed(t, cfg));
          if (!thread) {
            thread = Library.createThread(c, name, null, c.turn - cfg.minTurnsForPayoff, cfg);
          }

          if (!thread) {
            pushMessage(`🌀 I couldn't prepare another allowed twist thread for ${name}. They may already be at the per-entity thread cap, or only have disabled mature threads waiting.`);
          } else {
            thread.seedTouches = Math.max(thread.seedTouches, cfg.minSeedsForPayoff);
            thread.tier = Library.tierFor(thread.seedTouches);
            thread.status = "ready";
            c.forceEntity = thread.id;
            pushMessage(`🌀 Forcing a twist around ${name}...`);
          }
        } else {
          c.forceEntity = "any";
          pushMessage("🌀 Forcing the next twist...");
        }
        text = "(A quiet moment passes.)";
      } else if (head === "plant") {
        if (!cfg.enabled) {
          pushMessage("🌱 TWISTS AND TURNS is currently disabled — turn on \"Enable Twists and Turns\" on the config card first, or nothing will actually happen this turn.");
          text = "(A quiet moment passes.)";
          return { text };
        }
        const rest = parts.slice(1);
        let category = null;
        if (rest.length > 1) {
          const lastLower = rest[rest.length - 1].toLowerCase();
          const match = Library.CP_CATEGORY_KEYS.find(k => k.toLowerCase() === lastLower);
          if (match) { category = match; rest.pop(); }
        }
        const name = cleanCommandEntity(rest.join(" "));
        if (name) {
          if (category && Library.isMatureCategory(category) && !cfg.allowMatureTwists) {
            pushMessage(`🔞 ${CP_CATEGORY_LABELS[category]} is an opt-in mature twist. Use "/mature on" first.`);
          } else if (category && Library.isMatureCategory(category) && !Library.isEntityConfirmedAdult(name, "")) {
            pushMessage(`🔞 Mature twists only attach to characters with clear adult evidence. Put an adult age/description on ${name}'s Character Story Card first.`);
          } else {
            c.forcePlant = { entity: name, category: category };
            pushMessage(category
              ? `🌱 Planting a new thread on ${name} (${CP_CATEGORY_LABELS[category]})...`
              : `🌱 Planting a new thread on ${name}...`);
          }
        } else {
          pushMessage("🌱 /plant needs a name — try \"/plant Kessler\" or \"/plant Kessler hiddenIdentity\".");
        }
        text = "(A quiet moment passes.)";
      } else if (head === "mature") {
        const val = (parts[1] || "").toLowerCase();
        if (["on", "true", "yes", "enable", "enabled"].includes(val)) {
          cfg.allowMatureTwists = true;
          c.importedCardSignatures = {};
          c.lastContextSignature = null;
          c.lastAuthorsNoteSignature = null;
          pushMessage("🔞 Mature (18+) twist themes enabled for confirmed adult characters. Existing lore will be rescanned for eligible hooks.");
        } else if (["off", "false", "no", "disable", "disabled"].includes(val)) {
          cfg.allowMatureTwists = false;
          pushMessage("🔞 Mature (18+) twist themes disabled. Existing mature threads are kept but will not seed or pay off while this is off.");
        } else {
          pushMessage(`🔞 Mature (18+) twists are currently ${cfg.allowMatureTwists ? "ON" : "OFF"}. Use "/mature on" or "/mature off".`);
        }
        Library.updateConfigCard(cfg, c);
        text = "(A quiet moment passes.)";
      } else if (head === "scenario") {
        const raw = parts.slice(1).join(" ").trim();
        const val = raw.toLowerCase();
        if (!raw || val === "status") {
          const profile = Library.updateScenarioProfile(c, cfg, text);
          const tags = profile.tags && profile.tags.length ? profile.tags.join(", ") : "general";
          pushMessage(`🎭 Scenario adaptation is ${cfg.scenarioAdaptation ? "ON" : "OFF"} — detected: ${tags}; era: ${profile.era}; reality: ${profile.reality}; stakes: ${profile.scale}${cfg.scenarioOverride ? `; override: "${cfg.scenarioOverride}"` : ""}.`);
        } else if (["auto", "on", "true", "enable", "enabled"].includes(val)) {
          cfg.scenarioAdaptation = true;
          cfg.scenarioOverride = "";
          const profile = Library.updateScenarioProfile(c, cfg, text);
          pushMessage(`🎭 Automatic scenario adaptation enabled. Current read: ${(profile.tags || ["general"]).join(", ")}.`);
        } else if (["off", "false", "disable", "disabled"].includes(val)) {
          cfg.scenarioAdaptation = false;
          cfg.scenarioOverride = "";
          Library.updateScenarioProfile(c, cfg, text);
          pushMessage("🎭 Automatic scenario adaptation disabled. Twists still obey established evidence and your manual theme bias.");
        } else {
          cfg.scenarioAdaptation = true;
          cfg.scenarioOverride = cleanCommandEntity(raw, 180);
          const profile = Library.updateScenarioProfile(c, cfg, text);
          pushMessage(`🎭 Scenario override set to "${cfg.scenarioOverride}". Automatic evidence still contributes, but this guidance is treated as deliberate player direction.`);
        }
        Library.updateConfigCard(cfg, c);
        text = "(A quiet moment passes.)";
      } else if (head === "synergy" || head === "link") {
        const val = (parts[1] || "").toLowerCase();
        if (["on", "true", "yes", "enable", "enabled"].includes(val)) {
          cfg.crossSystemSynergy = true;
          pushMessage("🔗 UNSAID ↔ TWISTS AND TURNS link enabled. Established psychology can reinforce compatible active threads, and confirmed twists can feed emotional aftermath back into characters.");
        } else if (["off", "false", "no", "disable", "disabled"].includes(val)) {
          cfg.crossSystemSynergy = false;
          pushMessage("🔗 UNSAID ↔ TWISTS AND TURNS link disabled. Both systems still run independently.");
        } else {
          pushMessage(`🔗 Cross-system link is currently ${cfg.crossSystemSynergy ? "ON" : "OFF"}. Use "/synergy on" or "/synergy off".`);
        }
        Library.updateConfigCard(cfg, c);
        text = "(A quiet moment passes.)";
      } else if (head === "twisttypes" || head === "twistcategories") {
        Library.updateCategoryCatalog(cfg);
        pushMessage("🗂️ Twist category catalog written — check the \"Twists and Turns — Twist Catalog\" card.");
        text = "(A quiet moment passes.)";
      } else if (head === "twistlog") {
        cfg.showTwistLog = !cfg.showTwistLog;
        Library.updateTwistLogCard(c, cfg);
        // Every other setting-changing command here (see /intensity right
        // below) writes its new value back to the actual config card text
        // via updateConfigCard — this one never did, meaning the toggle
        // only ever lived in memory for the current turn. Since the next
        // turn's applyEntryConfig always re-parses cfg.showTwistLog fresh
        // from the card's own rendered text, and that text was never
        // updated, the very next turn silently reverted the toggle right
        // back to whatever it was before — confirmed directly via a real
        // captured transcript and reproduced in the sandbox: the
        // confirmation message correctly said "now visible," but the
        // config card's own text still read "false" immediately
        // afterward, before a single further turn had even passed.
        Library.updateConfigCard(cfg, c);
        pushMessage(cfg.showTwistLog
          ? "📜 Twist log now visible — check the \"Twists and Turns — Twist Log\" card."
          : "📜 Twist log now hidden.");
        text = "(A quiet moment passes.)";
      } else if (head === "intensity") {
        const val = (parts[1] || "").toLowerCase();
        if (["low", "medium", "high"].includes(val)) {
          cfg.intensity = val;
          pushMessage(`⚙️ Intensity set to ${val}.`);
        } else {
          pushMessage("⚙️ /intensity needs low, medium, or high — try \"/intensity high\".");
        }
        Library.updateConfigCard(cfg, c);
        text = "(A quiet moment passes.)";
      } else if (head === "threads") {
        Library.updateThreadsOverview(c);
        pushMessage("🧵 Brewing overview written — check the \"Twists and Turns — Brewing Overview\" card.");
        text = "(A quiet moment passes.)";
      } else if (head === "rescan") {
        c.importedCardSignatures = {};
        c.lastContextSignature = null;
        c.lastAuthorsNoteSignature = null;
        pushMessage("🔄 Rescanning Story Cards, Plot Essentials, and Author's Note for twist hooks...");
        text = "(A quiet moment passes.)";
      } else if (head === "twists" || head === "twisthelp") {
        Library.updateConfigCard(cfg, c);
        pushMessage("📖 Config card refreshed — check \"UNSPOKEN TURNS — Config\" for settings and commands.");
        text = "(A quiet moment passes.)";
      } else {}
    }
  } catch (e) {
    if (typeof log === "function") log("Input/Twists error: " + (e && e.message));
  }

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const commandText = (text || "").trim();
    const isUnsaidCommand = /\/(?:unsaid|pe(?:e|a)k|card)\b/i.test(commandText);

    // Commands are control input, not story evidence. Ordinary Say/Do/Story
    // input still contributes mention tracking, but "/card Mirelle" should
    // not itself make Mirelle look more established.
    if (!isUnsaidCommand) trackMentions(text, false);

    const cfg = readUnsaidConfig();

    if (/^\/unsaid\s+status\s*$/i.test(commandText)) {
      const report = buildStatusReport(cfg);
      let card = storyCards.find(c => c.title === "UNSAID — Status");
      if (!card) card = createOrFindCard("unsaid status", " ", "Class");
      if (card) {
        card.title = "UNSAID — Status";
        card.keys = "unsaid status";
        card.type = "Class";
        card.entry = " ";
        card.description = "Regenerated fresh each time you type \"/unsaid status\" as an action. Not sent to the AI.\n\n" + report;
        pushMessage("📋 Status written — check the \"UNSAID — Status\" card.");
      } else {
        pushMessage("📋 Couldn't write the status card this turn — try again in a moment.");
      }
      return { text: "(A quiet moment passes.)" };
    }

    if (/^\/unsaid\s+(?:help|commands?)\s*$/i.test(commandText)) {
      ensureSharedConfigCard();
      pushMessage("📖 UNSAID commands: /peek <name>, /peek <name> core, /card <name>, /unsaid status, /unsaid resetcodex. /card is a manual override and still works when automatic Codex is disabled. Full settings are on the \"UNSPOKEN TURNS — Config\" card.");
      return { text: "(A quiet moment passes.)" };
    }

    if (/^\/unsaid\s+resetcodex\s*$/i.test(commandText)) {
      resetCodexTrackingState();
      const configCard = ensureSharedConfigCard();
      if (configCard) {
        // Re-rendering keeps the momentary config reset flag false and
        // preserves every other edited setting.
        const currentCfg = readUnsaidConfig();
        configCard.entry = spliceConfigSection(configCard.entry, CONFIG_SECTION_UNSAID, renderUnsaidSection(currentCfg));
      }
      pushMessage("♻️ Codex tracking reset. Existing Story Cards were left untouched.");
      return { text: "(A quiet moment passes.)" };
    }

    const peekMatch = commandText.match(/^\/pe(?:e|a)k\b\s*(.*?)\s*$/i);
    if (peekMatch) {
      let rawName = peekMatch[1] || "";
      const coreRequested = /\s+core\s*$/i.test(rawName);
      if (coreRequested) rawName = rawName.replace(/\s+core\s*$/i, "");
      const name = cleanCommandEntity(rawName, 60);

      if (!name) {
        pushMessage("👁️ /peek needs a character name — try \"/peek Elara\" or \"/peek Elara core\".");
        return { text: "(A quiet moment passes.)" };
      }
      if (!cfg.enabled) {
        pushMessage(`👁️ UNSAID is currently disabled — turn on "Enable UNSAID" on the config card first, or ${name} won't actually be peeked at this turn.`);
        return { text: "(A quiet moment passes.)" };
      }

      const matchedCard = findStoryCardForEntity(name);
      if (matchedCard && !isCharacterLikeCard(name)) {
        pushMessage(`👁️ "${matchedCard.title}" is typed "${matchedCard.type}" on its Story Card, not a character — skipping the peek.`);
      } else {
        state.unsaid.forcedPeek = name;
        state.unsaid.forcedPeekCore = coreRequested;
        pushMessage(coreRequested
          ? `🌗 Checking whether this moment has changed ${name}...`
          : `👁️ Peeking into ${name}'s thoughts...`);
      }
      return { text: "(A quiet moment passes.)" };
    }

    const cardMatch = commandText.match(/^\/card\b\s*(.*?)\s*$/i);
    if (cardMatch) {
      const name = cleanCommandEntity(cardMatch[1], 60);
      if (!name) {
        pushMessage("📇 /card needs a name — try \"/card Elara\".");
        return { text: "(A quiet moment passes.)" };
      }
      if (!cfg.enabled) {
        pushMessage(`📇 UNSAID is currently disabled — turn on "Enable UNSAID" on the config card first, or no card will actually be written for ${name} this turn.`);
        return { text: "(A quiet moment passes.)" };
      }
      state.unsaid.forcedCodex = name;
      pushMessage(`📇 Writing a Story Card for ${name}...`);
      return { text: "(A quiet moment passes.)" };
    }

    return { text };
  } catch (e) {
    if (typeof log === "function") log("UNSAID Input error: " + (e && e.message));
    return { text: originalText };
  }
};

var modifier = (text) => {
  var afterTwists = twistsModifier(text);
  return unsaidModifier(afterTwists.text);
};

modifier(text);
