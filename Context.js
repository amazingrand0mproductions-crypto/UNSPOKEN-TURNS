try {
  initUnsaid();
  checkCacheEfficientWarning();
} catch (e) {}

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();
    if (!state.memory) state.memory = {};
    c.scriptTurnCount += 1;

    Library.applyEntryConfig(cfg);

    if (typeof info !== "undefined" && info && typeof info.actionCount === "number") {
      c.turn = info.actionCount;
    } else {
      c.turn += 1;
    }

    const cacheEfficient = !!(typeof info !== "undefined" && info && info.useCacheEfficient);
    Library.updateCacheEfficiencyWarning(cacheEfficient);

    if (typeof info !== "undefined" && info && Array.isArray(info.characterNames)) {
      c.multiplayerNames = info.characterNames.filter(n => typeof n === "string");
    }

    if (!cfg.enabled) {
      Library.updateConfigCard(cfg, c);
      Library.updateTwistLogCard(c, cfg);
      Library.updateNudgeCard(cacheEfficient, "", []);
      return { text };
    }

    let hint = null;
    let hintEntities = [];

    try {
    if (c.forcePlant) {
      const existing = Library.findThreadFuzzy(c, c.forcePlant.entity);
      if (!existing) Library.createThread(c, c.forcePlant.entity, c.forcePlant.category, c.turn, cfg);
      c.forcePlant = null;
    }

    Library.scanStoryCardsForScenarioThreads(c, cfg);

    const cardTitles = Library.eligibleCardTitles();
    Library.scanPlotEssentialsForThreads(c, cfg, cardTitles);
    Library.scanAuthorsNoteForThreads(c, cfg, cardTitles);

    const scanText = text
      .replace(/\[[^\[\]]*\]/g, " ")
      .replace(/《[^》]*》?/g, " ")
      .replace(/【CARD】[\s\S]*?【\/CARD】?/g, " ");

    Library.scanForLooseThreads(scanText, c, cfg, cardTitles);

    if (c.forceEntity) {
      let thread = null;
      if (c.forceEntity === "any") {
        thread = Library.pickPayoffThread(c, cfg) || Library.pickMostBuiltUpBrewingThread(c, cfg);
        if (thread && thread.status === "brewing") {
          thread.seedTouches = Math.max(thread.seedTouches, cfg.minSeedsForPayoff);
          thread.tier = Library.tierFor(thread.seedTouches);
          thread.status = "ready";
        }
      } else {
        thread = c.threads.find(t => t.id === c.forceEntity);
      }
      if (thread) {
        hint = Library.payoffHint(thread);
        hintEntities = [thread.entity];
        c.pendingPayoffId = thread.id;
        c.pendingPayoffId2 = null;
        c.lastPayoffTurn = c.turn;
        Library.safeLog("[Twists and Turns] /twist forced a payoff for " + thread.entity + " (" + thread.category + ")");
      }
      c.forceEntity = null;
    }

    if (!hint && (c.turn - c.lastPayoffTurn) >= cfg.payoffCooldown) {
      let compound = null;
      if (cfg.allowCompoundTwists && Math.random() < Library.CP_COMPOUND_CHANCE) {
        compound = Library.pickCompoundPayoffThreads(c, cfg);
      }
      if (compound) {
        hint = Library.compoundPayoffHint(compound[0], compound[1]);
        hintEntities = [compound[0].entity, compound[1].entity];
        c.pendingPayoffId = compound[0].id;
        c.pendingPayoffId2 = compound[1].id;
        c.lastPayoffTurn = c.turn;
        Library.safeLog("[Twists and Turns] compound payoff: " + compound[0].entity + " + " + compound[1].entity);
      } else {
        const payoffThread = Library.pickPayoffThread(c, cfg);
        if (payoffThread) {
          hint = Library.payoffHint(payoffThread);
          hintEntities = [payoffThread.entity];
          c.pendingPayoffId = payoffThread.id;
          c.pendingPayoffId2 = null;
          c.lastPayoffTurn = c.turn;
          Library.safeLog("[Twists and Turns] payoff: " + payoffThread.entity + " (" + payoffThread.category + ", " + payoffThread.tier + ")");
        }
      }
    }

    let pacingTurn = false;
    if (!hint) {
      const pacing = Library.effectivePacing(cfg, c);
      pacingTurn = (c.turn % pacing === 0);
      if (pacingTurn) {
        const seedThread = Library.pickForeshadowThread(c, cfg);
        if (seedThread) {
          hint = Library.foreshadowHint(seedThread);
          hintEntities = [seedThread.entity];
          c.pendingSeedId = seedThread.id;
          Library.safeLog("[Twists and Turns] foreshadowing: " + seedThread.entity + " (" + seedThread.seedTouches + " touches so far)");
        }
      }
    }

    if (!hint && !cfg.strictLogic && cfg.allowWildcard && pacingTurn &&
        (c.turn - c.lastPayoffTurn) >= cfg.payoffCooldown && Math.random() < Library.CP_WILDCARD_CHANCE) {
      const candidate = Library.pickWildcardEntity(scanText, c, cfg);
      if (candidate) {
        const wildThread = Library.createThread(c, candidate, null, c.turn, cfg);
        wildThread.seedTouches = cfg.minSeedsForPayoff;
        wildThread.status = "ready";
        wildThread.wildcard = true;
        hint = Library.payoffHint(wildThread);
        hintEntities = [wildThread.entity];
        c.pendingPayoffId = wildThread.id;
        c.pendingPayoffId2 = null;
        c.lastPayoffTurn = c.turn;
        Library.safeLog("[Twists and Turns] wildcard payoff: " + wildThread.entity);
      }
    }

    if (hint) {
      state.memory.frontMemory = hint;
      c.hintActive = true;
    } else if (c.hintActive) {
      state.memory.frontMemory = "";
      c.hintActive = false;
    }
    } catch (e) {}

    Library.updateNudgeCard(cacheEfficient, hint, hintEntities);
    Library.updateConfigCard(cfg, c);
    Library.updateTwistLogCard(c, cfg);
  } catch (e) {}

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const cfg = readUnsaidConfig();
    text = stripConfigNoise(text);

    const forcedPeek = state.unsaid.forcedPeek;
    const forcedPeekCore = state.unsaid.forcedPeekCore;
    state.unsaid.forcedPeek = null;
    state.unsaid.forcedPeekCore = null;

    const forcedCodex = state.unsaid.forcedCodex;
    state.unsaid.forcedCodex = null;

    if (!cfg.enabled) {
      state.unsaid.pending = null;
      state.unsaid.codex.pendingNames = [];
      return { text };
    }

    const storyAdvanced = isNewStoryTurn();
    if (!storyAdvanced && !forcedPeek && !forcedCodex) {
      state.unsaid.pending = null;
      state.unsaid.codex.pendingNames = [];
      return { text };
    }

    state.unsaid.turn++;

    const recent = recentTurnsText(text, cfg.recentTurnsWindow);
    const active = cfg.cast.filter(name => nameAppears(name, recent));

    active.forEach(seedMindIfKnown);
    if (forcedPeek) seedMindIfKnown(forcedPeek);

    if (forcedPeek && forcedPeekCore && !cfg.allowCoreShift) {
      pushMessage(`🌗 Core-shift checks are off — turn on "Allow major events to rewrite a core truth" in the config card first.`);
      state.unsaid.pending = null;
      state.unsaid.codex.pendingNames = [];
      return { text };
    }

    if (forcedPeek && forcedPeekCore) {
      const instruction = buildCoreCheckInstruction(forcedPeek, state.unsaid.minds[forcedPeek]);
      const fitted = fitInstructionToBudget(text, instruction);
      if (fitted) {
        state.unsaid.pending = forcedPeek;
        state.unsaid.codex.pendingNames = [];
        return { text: text + fitted };
      }
      pushMessage(`🌗 Not enough room left in context to check ${forcedPeek} this turn — try again once the story frees up some space.`);
    } else if (forcedPeek) {
      const fitted = buildAndFitThoughtInstruction(forcedPeek, active, text, cfg.allowCoreShift);
      if (fitted) {
        state.unsaid.pending = forcedPeek;
        state.unsaid.codex.pendingNames = [];
        return { text: text + fitted };
      }
      pushMessage(`👁️ Not enough room left in context to peek at ${forcedPeek} this turn — try again once the story frees up some space.`);
    }

    if (forcedCodex) {
      const type = classifyCodexEntry(forcedCodex, text);
      const priorFailures = state.unsaid.codex.attempts[forcedCodex] || 0;
      const instruction = buildCodexInstruction([forcedCodex], text, true, priorFailures);
      const fitted = fitInstructionToBudget(text, instruction);
      if (fitted) {
        state.unsaid.codex.attempts[forcedCodex] = (state.unsaid.codex.attempts[forcedCodex] || 0) + 1;
        state.unsaid.codex.pendingNames = [forcedCodex];
        state.unsaid.codex.pendingTypes = { [forcedCodex]: type };
        state.unsaid.codex.lastTriggerTurn = state.unsaid.turn;
        state.unsaid.pending = null;
        return { text: text + fitted };
      }
      pushMessage(`📇 Not enough room left in context to card ${forcedCodex} this turn — try again once the story frees up some space.`);
    }

    const sinceLastCodex = state.unsaid.turn - (state.unsaid.codex.lastTriggerTurn || 0);
    if (cfg.codexEnabled && sinceLastCodex >= cfg.codexCooldown) {
      const candidates = findCodexCandidates(cfg.mentionThreshold, excludedNames(cfg), cfg.codexMaxAttempts);
      if (candidates.length > 0) {
        const instruction = buildCodexInstruction(candidates, text);
        const fitted = fitInstructionToBudget(text, instruction);

        if (fitted) {
          const types = {};
          candidates.forEach(name => {
            state.unsaid.codex.attempts[name] = (state.unsaid.codex.attempts[name] || 0) + 1;
            types[name] = classifyCodexEntry(name, text);
          });
          state.unsaid.codex.pendingNames = candidates;
          state.unsaid.codex.pendingTypes = types;
          state.unsaid.codex.lastTriggerTurn = state.unsaid.turn;
          state.unsaid.pending = null;
          return { text: text + fitted };
        }
      }
    }
    state.unsaid.codex.pendingNames = [];

    if (cfg.cast.length > 0) {
      const eligible = active.filter(name => {
        const mind = state.unsaid.minds[name];
        return !mind || (state.unsaid.turn - mind.lastTurn) >= cfg.cooldown;
      });

      const actionType = getLastActionType();
      const isPlayerAction = actionType === "do" || actionType === "say";
      let effectiveChance = (cfg.reduceDuringActions && isPlayerAction) ? cfg.chance * 0.5 : cfg.chance;

      const anyoneNeverRevealed = eligible.some(name => !state.unsaid.minds[name]);
      if (anyoneNeverRevealed) {
        effectiveChance = Math.min(0.9, effectiveChance * 2.5);
      }

      if (eligible.length > 0 && Math.random() < effectiveChance) {
        const chosen = pickBySilence(eligible, state.unsaid.turn);
        const fitted = buildAndFitThoughtInstruction(chosen, active, text, cfg.allowCoreShift);
        if (fitted) {
          state.unsaid.pending = chosen;
          return { text: text + fitted };
        }
      }
    }

    state.unsaid.pending = null;
    return { text };
  } catch (e) {
    if (typeof log === "function") log("UNSAID Context error: " + (e && e.message));
    return { text: originalText };
  }
};

var modifier = (text) => {
  var afterTwists = twistsModifier(text);
  return unsaidModifier(afterTwists.text);
};

modifier(text);
