try {
  initUnsaid();
  checkCacheEfficientWarning();
} catch (e) {
  if (typeof log === "function") log("UNSAID init/Context error: " + (e && e.message));
}

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();
    if (!state.memory) state.memory = {};

    const matureWasEnabled = c.lastMatureEnabled;
    Library.applyEntryConfig(cfg);
    if (matureWasEnabled === false && cfg.allowMatureTwists) {
      // A manual config-card toggle should behave the same as /mature on:
      // rescan lore that may previously have been skipped while adult
      // categories were disabled.
      c.importedCardSignatures = {};
      c.lastContextSignature = null;
      c.lastAuthorsNoteSignature = null;
    }
    c.lastMatureEnabled = !!cfg.allowMatureTwists;
    const twistStoryAdvanced = Library.beginContextTurn(c, text);
    // Re-evaluate from live story + lore every context pass. The profile is
    // advisory and may evolve as a scenario reveals that it is hybrid,
    // grounded, speculative, historical, etc.
    Library.updateScenarioProfile(c, cfg, text);

    const cacheEfficient = !!(typeof info !== "undefined" && info && info.useCacheEfficient);
    Library.updateCacheEfficiencyWarning(cacheEfficient);

    if (typeof info !== "undefined" && info && Array.isArray(info.characterNames)) {
      c.multiplayerNames = info.characterNames.filter(n => typeof n === "string");
    }

    if (!cfg.enabled) {
      syncTwistFrontMemoryHint("");
      c.hintActive = false;
      Library.updateConfigCard(cfg, c);
      Library.updateTwistLogCard(c, cfg);
      Library.updateNudgeCard(cacheEfficient, "", []);
      return { text };
    }

    // Retries/regenerations of the same action should not seed, pay off, or
    // advance pacing twice. Keep the already-delivered managed hint in place
    // and leave pending Output work untouched.
    if (!twistStoryAdvanced && !c.forcePlant && !c.forceEntity) {
      Library.updateConfigCard(cfg, c);
      Library.updateTwistLogCard(c, cfg);
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
        if (thread && !Library.isThreadAllowed(thread, cfg)) thread = null;
      }
      if (thread) {
        hint = Library.payoffHint(thread);
        hintEntities = [thread.entity];
        c.pendingPayoffId = thread.id;
        c.pendingPayoffId2 = null;
        c.lastPayoffAttemptTurn = c.turn;
        Library.safeLog("[Twists and Turns] /twist forced a payoff for " + thread.entity + " (" + thread.category + ")");
      } else {
        // The Input hook always shows "Forcing the next twist..." on
        // /twist with no name, since it can't know in advance whether
        // anything will actually be available by the time this hook
        // runs — confirmed directly via sandbox that with zero threads
        // of any kind (a genuinely fresh game, nothing /planted, nothing
        // scanned yet), the player got that confident message and then
        // nothing happened at all: no hint, no thread, no log entry, and
        // no explanation, the exact same shape of "the command doesn't
        // work" complaint as the cfg.enabled gap fixed last round, just
        // triggered by empty state instead of a disabled system.
        pushMessage("🌀 Nothing has built up enough yet to force a twist on — try \"/plant a name\" first, or let the story develop a bit more.");
      }
      c.forceEntity = null;
    }

    if (!hint && (c.turn - c.lastPayoffTurn) >= cfg.payoffCooldown &&
        (c.turn - c.lastPayoffAttemptTurn) >= cfg.twistRetryCooldown) {
      let compound = null;
      if (cfg.allowCompoundTwists && Math.random() < Library.CP_COMPOUND_CHANCE) {
        compound = Library.pickCompoundPayoffThreads(c, cfg);
      }
      if (compound) {
        hint = Library.compoundPayoffHint(compound[0], compound[1]);
        hintEntities = [compound[0].entity, compound[1].entity];
        c.pendingPayoffId = compound[0].id;
        c.pendingPayoffId2 = compound[1].id;
        c.lastPayoffAttemptTurn = c.turn;
        Library.safeLog("[Twists and Turns] compound payoff: " + compound[0].entity + " + " + compound[1].entity);
      } else {
        const payoffThread = Library.pickPayoffThread(c, cfg);
        if (payoffThread) {
          hint = Library.payoffHint(payoffThread);
          hintEntities = [payoffThread.entity];
          c.pendingPayoffId = payoffThread.id;
          c.pendingPayoffId2 = null;
          c.lastPayoffAttemptTurn = c.turn;
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
        (c.turn - c.lastPayoffTurn) >= cfg.payoffCooldown &&
        (c.turn - c.lastPayoffAttemptTurn) >= cfg.twistRetryCooldown &&
        Math.random() < Library.CP_WILDCARD_CHANCE) {
      const candidate = Library.pickWildcardEntity(scanText, c, cfg);
      if (candidate) {
        const wildThread = Library.createThread(c, candidate, null, c.turn, cfg, scanText);
        if (wildThread) {
          wildThread.seedTouches = cfg.minSeedsForPayoff;
          wildThread.status = "ready";
          wildThread.wildcard = true;
          hint = Library.payoffHint(wildThread);
          hintEntities = [wildThread.entity];
          c.pendingPayoffId = wildThread.id;
          c.pendingPayoffId2 = null;
          c.lastPayoffAttemptTurn = c.turn;
          Library.safeLog("[Twists and Turns] wildcard payoff: " + wildThread.entity);
        }
      }
    }

    syncTwistFrontMemoryHint(hint || "");
    c.hintActive = !!hint;
    } catch (e) {
      if (typeof log === "function") log("Context/Twists inner error: " + (e && e.message));
    }

    Library.updateNudgeCard(cacheEfficient, hint, hintEntities);
    Library.updateConfigCard(cfg, c);
    Library.updateTwistLogCard(c, cfg);
  } catch (e) {
    if (typeof log === "function") log("Context/Twists error: " + (e && e.message));
  }

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const cfg = readUnsaidConfig();
    text = stripConfigNoise(text);

    // Same platform limitation TWISTS AND TURNS already works around for
    // its own hint (see updateNudgeCard) — computed here too since this is
    // a separate function from twistsModifier and doesn't share its local
    // variables.
    const cacheEfficient = !!(typeof info !== "undefined" && info && info.useCacheEfficient);

    const forcedPeek = state.unsaid.forcedPeek;
    const forcedPeekCore = state.unsaid.forcedPeekCore;
    state.unsaid.forcedPeek = null;
    state.unsaid.forcedPeekCore = null;

    const forcedCodex = state.unsaid.forcedCodex;
    state.unsaid.forcedCodex = null;

    if (!cfg.enabled) {
      state.unsaid.pending = null;
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
      state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];
      syncFrontMemoryHint(false);
      updateUnsaidBackupCard(cacheEfficient, "");
      return { text };
    }

    const storyAdvanced = isNewStoryTurn(text);
    if (!storyAdvanced && !forcedPeek && !forcedCodex) {
      state.unsaid.pending = null;
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
      state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];
      updateUnsaidBackupCard(cacheEfficient, "");
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
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
      state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];
      updateUnsaidBackupCard(cacheEfficient, "");
      return { text };
    }

    if (forcedPeek && forcedPeekCore) {
      const instruction = buildCoreCheckInstruction(forcedPeek, state.unsaid.minds[forcedPeek]);
      const fitted = fitInstructionToBudget(text, instruction);
      if (fitted) {
        state.unsaid.pending = forcedPeek;
        state.unsaid.pendingCoreShiftAllowed = true;
        state.unsaid.pendingCoreCheck = true;
        state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];
        updateUnsaidBackupCard(cacheEfficient, fitted);
        return { text: text + fitted };
      }
      pushMessage(`🌗 Not enough room left in context to check ${forcedPeek} this turn — try again once the story frees up some space.`);
    } else if (forcedPeek) {
      const fitted = buildAndFitThoughtInstruction(forcedPeek, active, text, cfg.allowCoreShift);
      if (fitted) {
        state.unsaid.pending = forcedPeek;
        state.unsaid.pendingCoreShiftAllowed = naturalCoreShiftEligible(state.unsaid.minds[forcedPeek], cfg.allowCoreShift);
        state.unsaid.pendingCoreCheck = false;
        state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];
        updateUnsaidBackupCard(cacheEfficient, fitted);
        return { text: text + fitted };
      }
      pushMessage(`👁️ Not enough room left in context to peek at ${forcedPeek} this turn — try again once the story frees up some space.`);
    }

    if (forcedCodex) {
      const type = reconcileCodexEntityType(forcedCodex, text) ||
        resolveCodexEntityType(forcedCodex, text) ||
        classifyCodexEntry(forcedCodex, text);
      const priorFailures = state.unsaid.codex.attempts[forcedCodex] || 0;
      const fitted = buildAndFitCodexInstruction([forcedCodex], text, true, priorFailures, true);
      if (fitted) {
        state.unsaid.codex.attempts[forcedCodex] = (state.unsaid.codex.attempts[forcedCodex] || 0) + 1;
        state.unsaid.codex.lastAttemptTurn[forcedCodex] = state.unsaid.turn;
        state.unsaid.codex.pendingNames = [forcedCodex];
        state.unsaid.codex.pendingTypes = { [forcedCodex]: type };
        state.unsaid.codex.pendingForced = true;
        state.unsaid.codex.pendingRefreshNames = [];
        state.unsaid.codex.lastTriggerTurn = state.unsaid.turn;
        state.unsaid.pending = null;
        state.unsaid.pendingCoreShiftAllowed = false;
        state.unsaid.pendingCoreCheck = false;
        updateUnsaidBackupCard(cacheEfficient, fitted);
        return { text: text + fitted };
      }
      pushMessage(`📇 Not enough room left in context to card ${forcedCodex} this turn — try again once the story frees up some space.`);
    }

    const sinceLastCodex = state.unsaid.turn - (state.unsaid.codex.lastTriggerTurn || 0);

    if (cfg.codexEnabled) {
      // Purge stale automatic junk candidates before any legacy-state
      // migration or scheduling. This makes the fix effective immediately
      // in existing adventures, not only for names seen after installation.
      pruneMentionCounts();

      const codexRecent = recentTurnsText(
        text,
        Math.max(
          cfg.recentTurnsWindow || 3,
          cfg.codexCharacterDeadline || 5,
          (cfg.codexCharacterMinTurns || 3) + 1
        )
      );

      // Migration + false-positive cleanup for saves that were already run
      // with the previous fast-track logic. That version could mark a mere
      // off-screen reference ("Mirelle said you'd be coming") as a character
      // introduction. We now require direct scene-presence evidence before
      // starting the character timer. Existing "likely" flags with no real
      // introduction timestamp are therefore revalidated instead of trusted.
      Object.keys(state.unsaid.codex.mentionCounts).forEach(name => {
        if (storyCards.some(c => c.title && isSameCardEntity(c.title, name))) return;

        if (typeof state.unsaid.codex.firstSeenTurn[name] !== "number") {
          state.unsaid.codex.firstSeenTurn[name] = state.unsaid.turn;
        }

        const repairedType = reconcileCodexEntityType(name, codexRecent);
        const directlyIntroduced = repairedType === "character" &&
          isLikelyCharacterIntroduction(name, codexRecent);
        const hadLegacyFlag = !!state.unsaid.codex.likelyCharacters[name];
        const hasIntroTurn = typeof state.unsaid.codex.introducedTurn[name] === "number";

        if (directlyIntroduced) {
          state.unsaid.codex.likelyCharacters[name] = true;
          state.unsaid.codex.observedTypes[name] = "character";
          if (!hasIntroTurn) {
            // Conservative migration: if we cannot know which exact old turn
            // contained the introduction, start the observation clock now.
            // Waiting three extra turns is preferable to canonizing a profile
            // too early.
            state.unsaid.codex.introducedTurn[name] = state.unsaid.turn;
          }
          if (codexAppearanceCount(name) === 0) {
            recordCodexEvidence(name, codexRecent, true);
          }
        } else if (hadLegacyFlag && !hasIntroTurn) {
          delete state.unsaid.codex.likelyCharacters[name];
          state.unsaid.codex.observedTypes[name] = state.unsaid.codex.observedTypes[name] || "character";
        }
      });

      const available = findCodexCandidates(
        cfg.mentionThreshold,
        excludedNames(cfg),
        cfg.codexMaxAttempts
      ).filter(name => (state.unsaid.codex.lastAttemptTurn[name] || -999999) < state.unsaid.turn);

      const minObserve = Math.max(0, cfg.codexCharacterMinTurns || 0);
      const minAppearances = Math.max(1, cfg.codexCharacterMinAppearances || 1);
      const deadline = Math.max(minObserve, cfg.codexCharacterDeadline || 5);

      const characterCandidates = available.filter(name =>
        !!state.unsaid.codex.likelyCharacters[name] &&
        typeof state.unsaid.codex.introducedTurn[name] === "number"
      );

      // The normal path needs BOTH enough elapsed story time and enough
      // distinct on-screen appearances. The hard deadline is deliberately
      // time-only so a recurring character cannot get stranded forever
      // because they stepped out of the scene after a strong introduction.
      const deadlineCharacters = characterCandidates.filter(name => {
        const age = state.unsaid.turn - state.unsaid.codex.introducedTurn[name];
        return age >= deadline;
      });
      const matureCharacters = characterCandidates.filter(name => {
        const age = state.unsaid.turn - state.unsaid.codex.introducedTurn[name];
        return age >= minObserve && codexAppearanceCount(name) >= minAppearances;
      });

      const nonCharacters = available.filter(name => !state.unsaid.codex.likelyCharacters[name]);
      const refreshPreview = (cfg.codexAutoRefresh && sinceLastCodex >= cfg.codexCooldown)
        ? pickCodexRefreshCandidate(cfg)
        : null;
      const refreshVeryOverdue = !!refreshPreview &&
        refreshPreview.since >= Math.max(1, cfg.codexRefreshInterval || 20) * 2;

      // Automatic character generation is intentionally one profile at a
      // time. Introduced characters always outrank maintenance. A refresh
      // that has been waiting for twice its configured interval may outrank
      // a new non-character card so long-running busy scenarios cannot starve
      // existing cards forever.
      let candidates = [];
      let hardDeadline = false;
      if (deadlineCharacters.length > 0) {
        candidates = deadlineCharacters.slice(0, 1);
        hardDeadline = true;
      } else if (matureCharacters.length > 0) {
        candidates = matureCharacters.slice(0, 1);
      } else if (sinceLastCodex >= cfg.codexCooldown && !refreshVeryOverdue) {
        // One automatic card task per story turn. Multiple hidden profiles in
        // the same model response substantially increase the chance that the
        // model outputs only metadata and forgets the visible story.
        candidates = nonCharacters.slice(0, 1);
      }

      if (candidates.length > 0) {
        const priorFailures = candidates.reduce(
          (max, name) => Math.max(max, state.unsaid.codex.attempts[name] || 0),
          0
        );

        const fitted = buildAndFitCodexInstruction(
          candidates,
          text,
          false,
          priorFailures,
          hardDeadline
        );

        if (fitted) {
          const types = {};
          candidates.forEach(name => {
            state.unsaid.codex.attempts[name] = (state.unsaid.codex.attempts[name] || 0) + 1;
            state.unsaid.codex.lastAttemptTurn[name] = state.unsaid.turn;
            types[name] = reconcileCodexEntityType(name, text) ||
              resolveCodexEntityType(name, text) ||
              state.unsaid.codex.observedTypes[name] ||
              classifyCodexEntry(name, text);
          });
          state.unsaid.codex.pendingNames = candidates;
          state.unsaid.codex.pendingTypes = types;
          state.unsaid.codex.pendingForced = false;
      state.unsaid.codex.pendingRefreshNames = [];
          state.unsaid.codex.lastTriggerTurn = state.unsaid.turn;
          state.unsaid.pending = null;
          state.unsaid.pendingCoreShiftAllowed = false;
          state.unsaid.pendingCoreCheck = false;
          updateUnsaidBackupCard(cacheEfficient, fitted);
          return { text: text + fitted };
        }

        // Context-budget failures do not consume an attempt. Mature
        // characters remain eligible next turn; non-characters wait for
        // their normal scheduling opportunity.
        pushMessage(`📇 Not enough room left in context to card ${
          candidates.length === 1 ? candidates[0] : candidates.length + " eligible names"
        } right now — Codex will retry automatically later.`);
      }

      // Periodic refreshes are intentionally lower priority than creating a
      // genuinely new card. They run only when no new-card candidate was due
      // this turn, respect the normal Codex task cooldown, and refresh at most
      // one existing Codex-made card at a time.
      if (candidates.length === 0 && sinceLastCodex >= cfg.codexCooldown && cfg.codexAutoRefresh) {
        const refresh = refreshPreview || pickCodexRefreshCandidate(cfg);
        if (refresh && refresh.name) {
          const card = findStoryCardForEntity(refresh.name);
          const refreshType = card
            ? (reconcileCodexEntityType(refresh.name, codexUpdateEvidenceTextFor(refresh.name, false)) ||
               codexKindFromExistingCard(card, refresh.name))
            : refresh.type;
          const fitted = buildAndFitCodexInstruction(
            [refresh.name],
            text,
            false,
            0,
            false,
            true
          );

          if (fitted) {
            state.unsaid.codex.pendingNames = [refresh.name];
            state.unsaid.codex.pendingTypes = { [refresh.name]: refreshType || refresh.type || "character" };
            state.unsaid.codex.pendingForced = false;
            state.unsaid.codex.pendingRefreshNames = [refresh.name];
            state.unsaid.codex.lastTriggerTurn = state.unsaid.turn;
            state.unsaid.codex.lastRefreshTriggerTurn = state.unsaid.turn;
            state.unsaid.pending = null;
            state.unsaid.pendingCoreShiftAllowed = false;
            state.unsaid.pendingCoreCheck = false;
            updateUnsaidBackupCard(cacheEfficient, fitted);
            return { text: text + fitted };
          }
        }
      }
    }

    state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingForced = false;
    state.unsaid.codex.pendingRefreshNames = [];

    if (cfg.cast.length > 0) {
      const eligible = active.filter(name => {
        const mind = state.unsaid.minds[name];
        return !mind || !mind.lastTurn || (state.unsaid.turn - mind.lastTurn) >= cfg.cooldown;
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
          state.unsaid.pendingCoreShiftAllowed = naturalCoreShiftEligible(state.unsaid.minds[chosen], cfg.allowCoreShift);
          state.unsaid.pendingCoreCheck = false;
          updateUnsaidBackupCard(cacheEfficient, fitted);
          return { text: text + fitted };
        }
      }
    }

    state.unsaid.pending = null;
    state.unsaid.pendingCoreShiftAllowed = false;
    state.unsaid.pendingCoreCheck = false;
    updateUnsaidBackupCard(cacheEfficient, "");
    return { text };
  } catch (e) {
    if (typeof log === "function") log("UNSAID Context error: " + (e && e.message));
    try {
      if (state.unsaid && state.unsaid.codex) {
        state.unsaid.codex.pendingNames = [];
        state.unsaid.codex.pendingTypes = {};
        state.unsaid.codex.pendingForced = false;
        state.unsaid.codex.pendingRefreshNames = [];
      }
      state.unsaid.pending = null;
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
    } catch (_) {}
    return { text: originalText };
  }
};

var modifier = (text) => {
  var afterTwists = twistsModifier(text);
  return unsaidModifier(afterTwists.text);
};

modifier(text);
