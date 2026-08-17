state.message = "";

try {
  initUnsaid();
} catch (e) {}

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();
    const cmd = Library.extractCommand(text);

    if (cmd) {
      const parts = cmd.slice(1).trim().split(/\s+/);
      const head = (parts[0] || "").toLowerCase();

      if (head === "twist") {
        const name = parts.slice(1).join(" ").trim();
        if (name) {
          // fuzzy match, same as every other name lookup in the project —
          // otherwise "/twist Sera" wouldn't find an existing thread already
          // tracked under the fuller "Sera Walker" and would spawn a
          // confusing duplicate instead of paying off the real one
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
    trackMentions(text);

    if (/\/unsaid\s+status\b/i.test(text)) {
      const cfg = readUnsaidConfig();
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

    const peekCoreMatch = text.match(/\/pe(?:e|a)k\s+([A-Za-z][\w\s]*?)\s+core\b/i);
    const peekMatch = peekCoreMatch || text.match(/\/pe(?:e|a)k\s+([A-Za-z][\w\s]*?)[\s"'.!?]*$/i);
    if (peekMatch) {
      const name = peekMatch[1].trim().slice(0, 60);
      state.unsaid.forcedPeek = name;
      state.unsaid.forcedPeekCore = !!peekCoreMatch;
      pushMessage(peekCoreMatch
        ? `🌗 Checking whether this moment has changed ${name}...`
        : `👁️ Peeking into ${name}'s thoughts...`);
      return { text: "(A quiet moment passes.)" };
    }

    const cardMatch = text.match(/\/card\s+([A-Za-z][\w\s]*?)[\s"'.!?]*$/i);
    if (cardMatch) {
      const name = cardMatch[1].trim().slice(0, 60);
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
