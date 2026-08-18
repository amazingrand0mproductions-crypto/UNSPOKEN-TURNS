try {
  initUnsaid();
} catch (e) {}

if (!state.memory) state.memory = {};

var twistsModifier = (text) => {
  try {
    const { c, cfg } = Library.initState();

    if (c.pendingPayoffId) {
      const thread = c.threads.find(t => t.id === c.pendingPayoffId);
      const partner = c.pendingPayoffId2 ? c.threads.find(t => t.id === c.pendingPayoffId2) : null;

      if (thread) {
        thread.status = "resolved";
        thread.resolvedTurn = c.turn;
        c.twistLog.push({
          entity: thread.entity,
          category: thread.category,
          tier: thread.tier,
          resolvedTurn: c.turn,
          wildcard: !!thread.wildcard,
          source: thread.source || "live",
          compoundWith: partner ? partner.entity : null
        });
        Library.createTwistStoryCard(c, cfg, thread, partner ? partner.entity : null);
      }
      if (partner) {
        partner.status = "resolved";
        partner.resolvedTurn = c.turn;
        c.twistLog.push({
          entity: partner.entity,
          category: partner.category,
          tier: partner.tier,
          resolvedTurn: c.turn,
          wildcard: !!partner.wildcard,
          source: partner.source || "live",
          compoundWith: thread ? thread.entity : null
        });
        Library.createTwistStoryCard(c, cfg, partner, thread ? thread.entity : null);
      }

      // Prime a private-thought check for whichever character just had a
      // twist land on them. For a compound twist (both resolve together),
      // pick one at random rather than always favoring `thread` — forcedPeek
      // only has room for one character next turn, so a fixed preference
      // would mean the partner entity never benefits from this.
      if (typeof linkTwistPayoffToReveal === "function") {
        const linkCandidates = [thread, partner].filter(Boolean);
        if (linkCandidates.length > 0) {
          const chosen = linkCandidates[Math.floor(Math.random() * linkCandidates.length)];
          linkTwistPayoffToReveal(chosen.entity, chosen.tier);
        }
      }

      c.threads = c.threads.filter(t => t.status !== "resolved");

      if (c.twistLog.length > 2000) c.twistLog = c.twistLog.slice(-2000);

      c.pendingPayoffId = null;
      c.pendingPayoffId2 = null;
    }

    if (c.pendingSeedId) {
      const thread = c.threads.find(t => t.id === c.pendingSeedId);
      if (thread && thread.status === "brewing") {
        thread.seedTouches += 1;
        thread.tier = Library.tierFor(thread.seedTouches);
        if (Library.isEligible(thread, c, cfg)) thread.status = "ready";
      }
      c.pendingSeedId = null;
    }

    Library.updateConfigCard(cfg, c);
    Library.updateTwistLogCard(c, cfg);
  } catch (e) {}

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const cfg = readUnsaidConfig();

    const blockPattern = /【CARD】([\s\S]*?)【\/CARD】/g;
    const blockMatches = [...text.matchAll(blockPattern)];
    const expectedNames = state.unsaid.codex.pendingNames || [];
    const expectedTypes = state.unsaid.codex.pendingTypes || {};
    const succeededNames = new Set();
    const cardWasNew = {};

    function tryBuildCard(blockContent, name, upfrontType) {
      try {
        let type = upfrontType || "character";
        const fields = {};
        blockContent.split("\n").forEach(line => {
          const fieldMatch = line.match(/^\s*([A-Za-z ]+):\s*(.+)$/);
          if (fieldMatch) fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
        });
        if (!fields["Name"]) return false;

        if (fields["Location"] || fields["Key Locations"]) type = "location";
        else if (fields["Properties"] || fields["Origin"]) type = "item";
        else if (fields["Type"] && !fields["Race"] && !fields["Personality"] && !fields["Background"] && type === "character") {
          type = "faction";
        }

        let card = storyCards.find(c => c.title && isSameCardEntity(c.title, name));
        const isNewCard = !card;
        if (isNewCard) {
          card = createOrFindCard(name.toLowerCase(), " ", type);
          if (!card) return false;
          card.title = name;
          card.keys = name.toLowerCase();
        }
        // Only set the type for a genuinely new card, or one that never had
        // a real type — an existing card's type (whether the platform's
        // standard four or a player's own custom one like "Business" or
        // "Restaurant") is a deliberate choice. A later /card refresh or
        // organic Codex re-visit shouldn't silently overwrite it with the
        // script's closest built-in guess just because that guess differs.
        if (isNewCard || !card.type || !card.type.trim()) {
          card.type = platformType(type);
        }
        cardWasNew[name] = isNewCard;
        succeededNames.add(name);

        const order = CARD_TEMPLATES[type] || CHARACTER_CARD_FIELDS;
        let builtEntry = order
          .filter(f => fields[f])
          .map(f => `${f}: ${fields[f]}`)
          .join("\n");
        if (builtEntry.length > MAX_CARD_ENTRY_LENGTH) {
          builtEntry = builtEntry.slice(0, MAX_CARD_ENTRY_LENGTH - 3) + "...";
        }

        if (isNewCard || !card.entry || !card.entry.trim()) {
          card.entry = builtEntry;
        }

        logCodexCard(name, type, state.unsaid.codex.mentionCounts[name] || 0);
        forgetMentionTracking(name);

        if (type === "character") {
          const configCard = ensureSharedConfigCard();
          if (configCard) {
            const unsaidNotes = extractConfigSection(configCard.description, CONFIG_SECTION_UNSAID);
            if (unsaidNotes && !unsaidNotes.includes(name)) {
              const markerIdx = unsaidNotes.indexOf(CAST_LIST_MARKER);
              const updatedNotes = markerIdx !== -1
                ? unsaidNotes.replace(/\s+$/, "") + `\n${name}`
                : unsaidNotes;
              configCard.description = spliceConfigSection(configCard.description, CONFIG_SECTION_UNSAID, updatedNotes);
            }
          }
          syncMindToCard(name, cfg.allowCoreShift, cfg.jsonNotes);
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    blockMatches.forEach((match, i) => {
      const name = expectedNames[i];
      if (!name) return;
      tryBuildCard(match[1], name, expectedTypes[name]);
    });

    if (blockMatches.length > 0) {
      text = text.replace(blockPattern, "").replace(/\n{3,}/g, "\n\n");
    }
    const remainingOpenMatch = text.match(/【CARD】([\s\S]*)$/);
    if (remainingOpenMatch) {
      const nextName = expectedNames[blockMatches.length];
      if (nextName && !succeededNames.has(nextName)) {
        tryBuildCard(remainingOpenMatch[1], nextName, expectedTypes[nextName]);
      }
      text = text.replace(/【CARD】[\s\S]*$/, "").replace(/\n{3,}/g, "\n\n").trimEnd();
    }

    const messageParts = [];
    if (succeededNames.size > 0) {
      const names = [...succeededNames];
      const allNew = names.every(n => cardWasNew[n]);
      const allExisting = names.every(n => !cardWasNew[n]);
      if (names.length === 1) {
        messageParts.push(cardWasNew[names[0]]
          ? `📇 Codex created a ${expectedTypes[names[0]]} card for ${names[0]}.`
          : `📇 Codex synced notes onto ${names[0]}'s existing Story Card (their written entry was left untouched).`);
      } else if (allNew) {
        messageParts.push(`📇 Codex created ${names.length} cards: ${names.join(", ")}.`);
      } else if (allExisting) {
        messageParts.push(`📇 Codex synced notes onto ${names.length} existing Story Cards: ${names.join(", ")} (entries left untouched).`);
      } else {
        const created = names.filter(n => cardWasNew[n]);
        const existing = names.filter(n => !cardWasNew[n]);
        messageParts.push(`📇 Codex created ${created.length} card(s) (${created.join(", ")}) and synced notes onto ${existing.length} existing card(s) (${existing.join(", ")}).`);
      }
    }

    const exhausted = expectedNames.filter(name => {
      if (succeededNames.has(name)) return false;
      return (state.unsaid.codex.attempts[name] || 0) >= cfg.codexMaxAttempts;
    });

    if (!state.unsaid.codex.consecutiveFailedNames) state.unsaid.codex.consecutiveFailedNames = [];
    if (expectedNames.length > 0 && succeededNames.size === 0) {
      expectedNames.forEach(n => {
        if (!state.unsaid.codex.consecutiveFailedNames.includes(n)) {
          state.unsaid.codex.consecutiveFailedNames.push(n);
        }
      });
      if (state.unsaid.codex.consecutiveFailedNames.length > 10) {
        state.unsaid.codex.consecutiveFailedNames = state.unsaid.codex.consecutiveFailedNames.slice(-10);
      }
    } else if (succeededNames.size > 0) {
      state.unsaid.codex.consecutiveFailedNames = [];
    }
    const strugglingCount = state.unsaid.codex.consecutiveFailedNames.length;
    if (strugglingCount >= 3 && exhausted.length === 0 && succeededNames.size === 0) {
      messageParts.push(`📇 Codex has attempted ${strugglingCount} different names in a row without a single card succeeding — this pattern usually means something broader than any one name, not bad luck on a few names specifically. Check "/unsaid status" and, if you're on a model prone to it, the cache-efficient warning card.`);
    }
    if (exhausted.length > 0) {
      messageParts.push(exhausted.length === 1
        ? `📇 Codex gave up on "${exhausted[0]}" after ${state.unsaid.codex.attempts[exhausted[0]]} attempts without a usable response. Use "Reset Codex tracking now" in the config card to let it try again.`
        : `📇 Codex gave up on ${exhausted.length} names (${exhausted.join(", ")}) after repeated attempts without a usable response. Use "Reset Codex tracking now" in the config card to let them try again.`);
    }
    if (messageParts.length > 0) pushMessage(messageParts.join(" "));

    state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingTypes = {};

    trackMentions(text);

    const revealWasRequested = !!state.unsaid.pending;
    if (state.unsaid.pending) {
      const name = state.unsaid.pending;
      const strictPattern = new RegExp(
        `《${escapeForRegex(name)},\\s*([a-zA-Z]+)(?:,\\s*(about\\s+[^:》]+|core-shift))?:\\s*([^》]*)》`,
        "i"
      );
      let matchedPattern = strictPattern;
      let thoughtMatch = text.match(strictPattern);
      let feeling, modifier2, thought, usedFallback = false;

      if (thoughtMatch) {
        feeling = thoughtMatch[1].trim().toLowerCase();
        if (feeling === "feeling" || feeling === "emotion" || feeling === "thought") feeling = null;
        modifier2 = thoughtMatch[2] ? thoughtMatch[2].trim() : null;
        thought = thoughtMatch[3].trim();
      } else {
        const loosePattern = new RegExp(`《${escapeForRegex(name)},\\s*([^》]+)》`, "i");
        const looseMatch = text.match(loosePattern);
        if (looseMatch) {
          matchedPattern = loosePattern;
          thought = looseMatch[1].trim().replace(/^feeling\s+/i, "");
          usedFallback = true;
        } else {
          const anyBracketPattern = /《([^》]+)》/;
          const anyMatch = text.match(anyBracketPattern);
          if (anyMatch) {
            matchedPattern = anyBracketPattern;
            thought = anyMatch[1].trim().replace(/^feeling\s+/i, "");
            usedFallback = true;
          } else {
            const barePattern = new RegExp(
              `(?<=^|\\n)\\s*${escapeForRegex(name)},\\s*([a-zA-Z]+)(?:,\\s*(about\\s+[^:\\n]+|core-shift))?:\\s*([^\\n]+)`,
              "i"
            );
            const bareMatch = text.match(barePattern);
            if (bareMatch) {
              matchedPattern = new RegExp(escapeForRegex(bareMatch[0]));
              feeling = bareMatch[1].trim().toLowerCase();
              if (feeling === "feeling" || feeling === "emotion" || feeling === "thought") feeling = null;
              modifier2 = bareMatch[2] ? bareMatch[2].trim() : null;
              thought = bareMatch[3].trim();
              usedFallback = true;
            }
          }
        }
      }

      if (!thoughtMatch && !usedFallback && text.indexOf("《") !== -1) {
        text = text.replace(/《[\s\S]*$/, "").replace(/\n{3,}/g, "\n\n").trimEnd();
      }

      if (thoughtMatch || (usedFallback && thought)) {
        if (!feeling) {
          const existingMind = state.unsaid.minds[name];
          feeling = (existingMind && existingMind.feeling) || "conflicted";
        }
        let isCoreShift = modifier2 && /^core-shift$/i.test(modifier2);
        let about = modifier2 && !isCoreShift ? modifier2.replace(/^about\s+/i, "").trim() : null;
        if (!isCoreShift && usedFallback && /^core-shift\s*[:,]?\s*/i.test(thought)) {
          isCoreShift = true;
          thought = thought.replace(/^core-shift\s*[:,]?\s*/i, "");
        }
        const { wantSentence } = splitThoughtSentences(thought);

        if (cfg.showThoughtsInStory) {
          text = text.replace(matchedPattern, (full) =>
            full.trim().startsWith("*") ? full : `*${full.trim()}*`
          );
        } else {
          text = text.replace(matchedPattern, "").replace(/\n{3,}/g, "\n\n").trimEnd();
        }

        seedMindIfKnown(name);
        if (!state.unsaid.minds[name]) state.unsaid.minds[name] = createMind();
        const mind = state.unsaid.minds[name];
        const previousFeeling = mind.feeling;
        const normalizeThought = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
        const isStaleRepeat = !!mind.lastThoughtText && normalizeThought(thought) === normalizeThought(mind.lastThoughtText);
        let justShifted = false;
        if (isCoreShift && cfg.allowCoreShift && thought && thought !== mind.core) {
          if (!mind.coreHistory) mind.coreHistory = [];
          if (mind.core) pushCapped(mind.coreHistory, mind.core, 2);
          mind.core = thought;
          mind.coreSetTurn = state.unsaid.turn;
          mind.tensionLevel = 0;
          justShifted = true;
          // Feed this back into the twist half: a character's fundamental
          // self just genuinely changed, which is exactly the kind of thing
          // a twist thread should build on — never the private content
          // itself, just the fact that it happened and to whom.
          try {
            const { c: tc, cfg: tcfg } = Library.initState();
            Library.reinforceFromCoreShift(tc, tcfg, name);
          } catch (e) {}
        } else if (!mind.core && !about) {
          mind.core = thought;
          mind.coreSetTurn = state.unsaid.turn;
        }
        mind.feeling = feeling;
        if (wantSentence) mind.want = wantSentence;
        mind.lastThoughtText = thought;
        mind.lastTurn = state.unsaid.turn;
        if (!isStaleRepeat) {
          mind.revealCount = (mind.revealCount || 0) + 1;
          if (!mind.feelingHistory) mind.feelingHistory = [];
          pushCapped(mind.feelingHistory, feeling, FEELING_HISTORY_LIMIT);
        }

        let tensionJustCrossed = false;
        if (!justShifted && !isStaleRepeat) {
          if (typeof mind.tensionLevel !== "number") mind.tensionLevel = 0;
          const wasBelowThreshold = mind.tensionLevel < TENSION_THRESHOLD;
          const tensionCap = TENSION_THRESHOLD * DRASTIC_TENSION_MULTIPLIER;
          if (previousFeeling && previousFeeling !== feeling) {
            mind.tensionLevel = Math.min(tensionCap, mind.tensionLevel + 1);
          } else if (previousFeeling === feeling) {
            mind.tensionLevel = Math.max(0, mind.tensionLevel - 1);
          }
          tensionJustCrossed = cfg.allowCoreShift && wasBelowThreshold && mind.tensionLevel >= TENSION_THRESHOLD;
        }

        if (about) {
          recordRelation(name, about, feeling);
        }
        const synced = syncMindToCard(name, cfg.allowCoreShift, cfg.jsonNotes);

        if (!synced) {
          pushMessage(`⚠️ ${name} had a private thought, but no matching Story Card was found to save it on — try "/card ${name}" to create one, or check "/unsaid status".`);
        } else if (isCoreShift && cfg.allowCoreShift) {
          pushMessage(`🌗 ${name} has been fundamentally changed — check their Story Card.`);
        } else if (tensionJustCrossed) {
          pushMessage(`⚡ ${name}'s sense of self is starting to waver...`);
        } else if (isStaleRepeat) {
          pushMessage(`💭 ${name}'s mind circled back to the same thought — nothing new this time.`);
        } else {
          pushMessage(cfg.showThoughtsInStory
            ? `💭 ${name} is thinking something they're not saying...`
            : `💭 ${name} is secretly feeling ${feeling} — check their Story Card for the rest.`);
        }
        state.unsaid.consecutiveRevealMisses = 0;
      } else {
        state.unsaid.consecutiveRevealMisses = (state.unsaid.consecutiveRevealMisses || 0) + 1;
        if (state.unsaid.consecutiveRevealMisses >= 5) {
          pushMessage(`💭 The last ${state.unsaid.consecutiveRevealMisses} reveal requests in a row produced nothing usable at all — not even a malformed attempt. If this keeps happening, the model may be struggling with the format itself rather than any specific character. Check "/unsaid status," and consider lowering "Chance of a thought per turn" temporarily.`);
        }
      }
      state.unsaid.pending = null;
    }

    if (revealWasRequested && text.indexOf("《") !== -1) {
      text = text.replace(/《[^》]*》?/g, "").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
    }

    syncFrontMemoryHint(cfg.subtleHints);

    if (!text || !text.trim()) {
      text = "*(A quiet moment passes.)*";
    }

    return { text };
  } catch (e) {
    if (typeof log === "function") log("UNSAID Output error: " + (e && e.message));
    return { text: originalText };
  }
};

var modifier = (text) => {
  var afterTwists = twistsModifier(text);
  return unsaidModifier(afterTwists.text);
};

modifier(text);
