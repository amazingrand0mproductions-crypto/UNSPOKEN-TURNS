state.message = "";

try {
  initUnsaid();
} catch (e) {
  utLog("Input init", e);
}

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();
    const cmd = Library.extractCommand(text);

    if (cmd) {
      const parts = cmd.slice(1).trim().split(/\s+/);
      const head = (parts[0] || "").toLowerCase();
      const ownCommand = ["twist", "plant", "twistlog", "intensity", "threads", "rescan", "twists", "twisthelp"].includes(head);
      if (ownCommand && state.unsaid) state.unsaid.skipStoryAdvance = true;

      if (head === "twist") {
        if (!cfg.enabled) {
          pushMessage("🌀 TWISTS AND TURNS is currently disabled — turn on \"Enable Twists and Turns\" on the config card first, or nothing will actually happen this turn.");
          text = "(A quiet moment passes.)";
          return { text };
        }
        const name = parts.slice(1).join(" ").trim();
        if (name) {
          let thread = c.threads.find(t => isSameCardEntity(t.entity, name));
          if (!thread) {
            thread = Library.createThread(c, name, null, c.turn - cfg.minTurnsForPayoff, cfg);
          }

          thread.seedTouches = Math.max(thread.seedTouches, cfg.minSeedsForPayoff);
          thread.tier = Library.tierFor(thread.seedTouches);
          thread.status = "ready";
          c.forceEntity = thread.id;
          pushMessage(`🌀 Forcing a twist around ${name}...`);
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
        const name = rest.join(" ").trim();
        if (name) {
          c.forcePlant = { entity: name, category: category };
          pushMessage(category
            ? `🌱 Planting a new thread on ${name} (${CP_CATEGORY_LABELS[category]})...`
            : `🌱 Planting a new thread on ${name}...`);
        } else {
          pushMessage("🌱 /plant needs a name — try \"/plant Kessler\" or \"/plant Kessler hiddenIdentity\".");
        }
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
  } catch (e) {}

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const cfg = readUnsaidConfig();

    if (/\/unsaid\s+status\b/i.test(text)) {
      state.unsaid.skipStoryAdvance = true;
      const report = buildStatusReport(cfg);
      let card = storyCards.find(c => c.title === "UNSAID — Status");
      if (!card) {
        card = createOrFindCard("unsaid status", " ", "Class");
      }
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

    // Built from the shared NAME_ALPHANUM class (defined in Library.js,
    // available here since Library is concatenated ahead of this file) so
    // a name with an apostrophe or hyphen (O'Brien, Draconic-Ballgown,
    // Agent-47-style designations) is captured the same way it already is
    // everywhere else in the project. The plain \w this used to use
    // silently failed to match the whole command for any such name —
    // confirmed directly via sandbox: "/peek Unit-9" and "/peek O'Brien"
    // both matched nothing at all, leaving the raw command text
    // unprocessed with no error message telling the player anything went
    // wrong, rather than actually peeking at the character.
    const NAME_COMMAND_CHARS = `[${NAME_ALPHANUM}'\u2019\\-\\s]`;
    const peekCoreMatch = text.match(new RegExp(`\\/pe(?:e|a)k\\s+([A-Za-z]${NAME_COMMAND_CHARS}*?)\\s+core\\b`, "i"));
    const peekMatch = peekCoreMatch || text.match(new RegExp(`\\/pe(?:e|a)k\\s+([A-Za-z]${NAME_COMMAND_CHARS}*?)[\\s"'.!?]*$`, "i"));
    if (peekMatch) {
      state.unsaid.skipStoryAdvance = true;
      const name = peekMatch[1].trim().slice(0, 60);
      if (!cfg.enabled) {
        pushMessage(`👁️ UNSAID is currently disabled — turn on "Enable UNSAID" on the config card first, or ${name} won't actually be peeked at this turn.`);
        return { text: "(A quiet moment passes.)" };
      }
      const matchedCard = storyCards.find(c => c.title && isSameCardEntity(c.title, name));
      if (matchedCard && !isCharacterLikeCard(name)) {
        pushMessage(`👁️ "${matchedCard.title}" is typed "${matchedCard.type}" on its Story Card, not a character — skipping the peek.`);
      } else {
        state.unsaid.forcedPeek = name;
        state.unsaid.forcedPeekCore = !!peekCoreMatch;
        pushMessage(peekCoreMatch
          ? `🌗 Checking whether this moment has changed ${name}...`
          : `👁️ Peeking into ${name}'s thoughts...`);
      }
      return { text: "(A quiet moment passes.)" };
    }

    const cardMatch = text.match(new RegExp(`\\/card\\s+([A-Za-z]${NAME_COMMAND_CHARS}*?)[\\s"'.!?]*$`, "i"));
    if (cardMatch) {
      state.unsaid.skipStoryAdvance = true;
      const name = cardMatch[1].trim().slice(0, 60);
      if (!cfg.enabled) {
        pushMessage(`📇 UNSAID is currently disabled — turn on "Enable UNSAID" on the config card first, or no card will actually be written for ${name} this turn.`);
        return { text: "(A quiet moment passes.)" };
      }
      state.unsaid.forcedCodex = name;
      pushMessage(`📇 Writing a Story Card for ${name}...`);
      return { text: "(A quiet moment passes.)" };
    }

    trackMentions(text, false);
    return { text };
  } catch (e) {
    utLog("UNSAID Input", e);
    return { text: originalText };
  }
};

var modifier = (text) => {
  var afterTwists = twistsModifier(text);
  return unsaidModifier(afterTwists.text);
};

modifier(text);
