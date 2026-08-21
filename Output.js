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
  } catch (e) {
    if (typeof log === "function") log("Output/Twists error: " + (e && e.message));
  }

  return { text };
};

var unsaidModifier = (text) => {
  const originalText = text;
  try {
    const cfg = readUnsaidConfig();

    // Accept the exact markers requested by this version plus the two
    // common bracket variants models sometimes substitute on their own.
    // This is only evaluated while Codex has pending names, so broadening
    // the marker spelling cannot eat ordinary story text by itself.
    const cardOpenSource = "(?:【CARD】|〖CARD〗|\\[CARD\\]|<CARD>)";
    const cardCloseSource = "(?:【\\/CARD】|〖\\/CARD〗|\\[\\/CARD\\]|<\\/CARD>)";
    const blockPattern = new RegExp(cardOpenSource + "([\\s\\S]*?)" + cardCloseSource, "gi");
    const expectedNames = Array.isArray(state.unsaid.codex.pendingNames)
      ? state.unsaid.codex.pendingNames.slice()
      : [];
    const expectedTypes = state.unsaid.codex.pendingTypes || {};
    const maxFieldLength = 420;
    // Never strip arbitrary CARD-looking prose unless this turn actually
    // requested Codex output. This keeps user-authored bracketed text safe.
    const blockMatches = expectedNames.length > 0 ? [...text.matchAll(blockPattern)] : [];
    const succeededNames = new Set();
    const cardWasNew = {};
    const builtTypes = {};

    // Tolerant of the markdown a real model very commonly wraps structured
    // "field: value" output in — bullets, numbering, headers, bold/italic
    // around the label and/or value — none of which the original strict
    // `^\s*([A-Za-z ]+):\s*(.+)$` accepted at all. Confirmed directly: the
    // exact instruction text this project sends (verified against a real
    // captured prompt) is correct and does reach the model, but a model
    // that answers "**Name:** Silas" instead of "Name: Silas" — an
    // extremely ordinary thing for a model to do when asked to fill out a
    // labeled template — hit the old regex's total blind spot: fields["Name"]
    // never got set, tryBuildCard returned false immediately, and every
    // single field failed the same way regardless of which field or which
    // name, which is exactly the "systemic, not bad luck on a few names"
    // failure pattern real captured evidence showed (a status report
    // listing clean, legitimate names — Silas, Rielle, Kyle, Thornhaven —
    // still exhausting every retry with zero cards created).
    function matchFieldLine(line) {
      return line.match(/^\s*(?:#{1,6}\s*|[-*•+]\s*|\d+[.)]\s*)?[*_]{0,3}\s*["'“”]?([A-Za-z][A-Za-z ]+?)["'“”]?\s*[*_]{0,3}\s*[:=]\s*[*_]{0,3}\s*(.+?)\s*[*_]{0,3}\s*$/);
    }

    // A quick, non-committal peek at just the Name field of a raw block —
    // deliberately much lighter than the full tryBuildCard parse below,
    // since this only needs to answer "which candidate does this block
    // claim to be," not fully validate or score it.
    function peekBlockName(blockContent) {
      let found = null;
      const lines = blockContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const fieldMatch = matchFieldLine(lines[i]);
        if (fieldMatch && fieldMatch[1].trim().toLowerCase() === "name") {
          found = fieldMatch[2].trim();
          break;
        }
      }
      return found;
    }

    function tryBuildCard(blockContent, name, upfrontType) {
      try {
        let type = upfrontType || "character";
        const fields = {};
        const allCanonicalFields = [
          ...new Set([
            ...CHARACTER_CARD_FIELDS,
            ...LOCATION_CARD_FIELDS,
            ...ITEM_CARD_FIELDS,
            ...FACTION_CARD_FIELDS
          ])
        ];
        const fieldAliases = {
          "strength": "Strength Level",
          "power": "Strength Level",
          "power level": "Strength Level",
          "combat level": "Strength Level",
          "bio": "Background",
          "biography": "Background",
          "backstory": "Background",
          "history": "Background",
          "traits": "Personality",
          "temperament": "Personality",
          "looks": "Appearance",
          "look": "Appearance",
          "skills": "Abilities",
          "skill": "Abilities",
          "powers": "Abilities",
          "talents": "Abilities",
          "flaws": "Weaknesses",
          "weak points": "Weaknesses",
          "relations": "Relationships",
          "connections": "Relationships",
          "where": "Location",
          "key places": "Key Locations",
          "history events": "Historical Events",
          "kind": "Type",
          "features": "Properties",
          "importance": "Significance",
          "role": "Significance"
        };

        function cleanFieldValue(value) {
          return String(value || "")
            .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
            .replace(/^[*_]{1,3}\s*/, "")
            .replace(/\s*[*_]{1,3}$/, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxFieldLength);
        }

        // A model occasionally compresses the template onto one line with
        // pipes/semicolons. Expand only when a separator is followed by
        // another label-shaped "Field:" token, so punctuation inside a
        // normal value is left alone.
        const expandedBlock = blockContent.replace(
          /\s*[|;]\s*(?=["'“”]?[A-Za-z][A-Za-z ]{1,28}["'“”]?\s*[:=])/g,
          "\n"
        );

        let lastCanonical = null;
        expandedBlock.split("\n").forEach(line => {
          const fieldMatch = matchFieldLine(line);
          if (fieldMatch) {
            const rawLabel = fieldMatch[1].trim();
            const lower = rawLabel.toLowerCase();
            const canonical = allCanonicalFields.find(f => f.toLowerCase() === lower) || fieldAliases[lower];
            if (canonical) {
              fields[canonical] = cleanFieldValue(fieldMatch[2]);
              lastCanonical = canonical;
              return;
            }
          }

          // If a model wraps a long field onto an indented continuation line,
          // fold it back into that field instead of failing the whole card.
          if (lastCanonical && /^\s{2,}\S/.test(line) && !/【|〖|\[\/?CARD\]|<\/?CARD>/i.test(line)) {
            fields[lastCanonical] = cleanFieldValue(`${fields[lastCanonical]} ${line.trim()}`);
          }
        });

        // The expected name is authoritative. If the model lowercases it,
        // omits the Name line, or accidentally echoes a nearby candidate,
        // do not throw away otherwise valid semantic details.
        fields["Name"] = name;

        // Weigh the actual evidence with a proper scoring comparison rather
        // than a chain of single-condition overrides — a real transcript
        // showed exactly the failure mode this guards against: "Ella" (a
        // sixteen-year-old girl with a dagger and journal) got reclassified
        // as a location purely because the model's response happened to
        // include a "Location: Saltmarsh Quay" field — noting where she
        // was introduced, not what she is — while the actual content was
        // unmistakably about a person and no other location-shaped field
        // was present.
        //
        // A person-signal in the description contributes weight rather
        // than deciding things outright — a genuine location can quite
        // normally mention a person in passing ("guarded by an old man"),
        // and that shouldn't out-vote two or three real location fields.
        // Faction has no distinguishing field of its own (Type/Description/
        // Significance overlaps with every other type's generic fields),
        // so a name that clearly reads as an organization ("the Ashen
        // Order") needs its own signal too, independent of whichever type
        // was guessed upfront (which can itself be wrong) — otherwise a
        // founder mentioned by gender in the description ties evenly
        // against a bare "Type:" field and incorrectly favors "character"
        // by coincidence of ordering, not evidence.
        const characterFieldCount = ["Race", "Strength Level", "Personality", "Background", "Appearance", "Abilities", "Weaknesses", "Relationships"].filter(f => fields[f]).length;
        const locationFieldCount = ["Location", "Key Locations", "Historical Events"].filter(f => fields[f]).length;
        const itemFieldCount = ["Properties", "Origin"].filter(f => fields[f]).length;
        const factionShapeScore = (fields["Type"] && !fields["Race"] && !fields["Personality"] && !fields["Background"]) ? 1 : 0;
        const personSignal = /\b(girl|boy|woman|man|lady|gentlemen|gentleman|teenager|teens?|child|kids?|elderly|toddler|infant|maiden|youth)\b|\byears?[\s-]old\b/i;
        // A person mentioned via "led by a scarred man" or "founded by a
        // young woman" is describing someone associated with the entity,
        // not the entity itself — strip that kind of attribution before
        // checking, so a gang or order isn't misread as a person just
        // because its leader or founder gets a passing mention.
        const attributionPattern = /\b(?:led|founded|formed|created|ruled|run|owned|operated|guarded|watched over|managed|built|established)\s+by\s+[^.!?]*/gi;
        const readsLikeAPerson = [fields["Description"], fields["Background"], fields["Personality"], fields["Appearance"]]
          .some(text => text && personSignal.test(text.replace(attributionPattern, "")));
        // Independent, direct re-check of the name itself against the same
        // hint patterns classifyCodexEntry uses upfront — deliberately not
        // trusting upfrontType alone here, since that guess is exactly what
        // can be wrong in the first place.
        const nameLocationHint = (CODEX_LOCATION_HINTS.test(name) || CODEX_LOCATION_SUFFIX_HINTS.test(name)) ? 1 : 0;
        const nameItemHint = CODEX_ITEM_HINTS.test(name) ? 1 : 0;
        const nameFactionHint = CODEX_FACTION_HINTS.test(name) ? 1 : 0;

        const scores = {
          character: characterFieldCount + (readsLikeAPerson ? 1 : 0),
          location: locationFieldCount + nameLocationHint,
          item: itemFieldCount + nameItemHint,
          faction: factionShapeScore + nameFactionHint
        };
        const best = Object.keys(scores).reduce((a, b) => (scores[b] > scores[a] ? b : a));
        if (scores[best] > 0) type = best;

        // A copied template full of "..." is not a successful card. Require
        // every field in the chosen template to contain a concrete value so
        // Codex keeps retrying until the model has actually generated the
        // details the player asked for.
        const requiredOrder = CARD_TEMPLATES[type] || CHARACTER_CARD_FIELDS;
        const placeholderValue = (value) => {
          if (!value || !value.trim()) return true;
          const v = value.trim();
          return /^(?:\.{2,}|\?|[-—]+|unknown|not known|not yet known|unspecified|unclear|n\/?a|tbd|none|none given|not specified|<[^>]+>|\[[^\]]+\])$/i.test(v);
        };
        const missingRequired = requiredOrder.filter(f => f !== "Name" && placeholderValue(fields[f]));
        if (missingRequired.length > 0) return false;

        let card = findStoryCardForEntity(name);
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
        builtTypes[name] = type;
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

    // Positional order (block i -> expectedNames[i]) was the only signal
    // ever used to decide which candidate a block belonged to — no check
    // that the block's own stated Name actually matched. Confirmed this
    // is reachable, not just theoretical: multiple candidates go out in
    // one batch (up to 3 at a time, by design), and a model that skips
    // one candidate entirely, or simply writes its blocks in a different
    // order than the profiles were listed in — an ordinary thing for a
    // model to do, especially under the cache-efficient-mode backup
    // delivery path where the instruction arrives as ordinary card text
    // rather than a direct request — would silently shift every block
    // after that point onto the wrong name, exactly the kind of junk-card
    // cross-assignment (one person's card fields saved under a different
    // person's title) this round's testing was specifically checking
    // for. Matching each block against its own claimed Name field first,
    // falling back to strict position only when that can't be read or
    // doesn't correspond to anything actually expected this turn,
    // preserves identical behavior for the common case (one candidate
    // straightforwardly self-identifying) while no longer trusting order
    // alone when there's a better signal sitting right there in the text.
    const remainingExpected = expectedNames.slice();
    function claimBlockName(blockContent) {
      const claimed = peekBlockName(blockContent);
      if (claimed) {
        const idx = remainingExpected.findIndex(n =>
          n.toLowerCase() === claimed.toLowerCase() || isSameCardEntity(n, claimed)
        );
        // A block that explicitly names an unexpected entity must never be
        // assigned positionally to somebody else. That was a source of
        // cross-wired cards when a model hallucinated or reordered profiles.
        if (idx === -1) return null;
        return remainingExpected.splice(idx, 1)[0];
      }
      // Positional fallback is safe only when the model omitted Name.
      return remainingExpected.shift() || null;
    }

    blockMatches.forEach((match) => {
      const name = claimBlockName(match[1]);
      if (!name) return;
      tryBuildCard(match[1], name, expectedTypes[name]);
    });

    if (blockMatches.length > 0) {
      text = text.replace(blockPattern, "").replace(/\n{3,}/g, "\n\n");
    }
    const remainingOpenPattern = new RegExp(cardOpenSource + "([\\s\\S]*)$", "i");
    const remainingOpenMatch = expectedNames.length > 0 ? text.match(remainingOpenPattern) : null;
    if (remainingOpenMatch) {
      const nextName = claimBlockName(remainingOpenMatch[1]);
      if (nextName && !succeededNames.has(nextName)) {
        tryBuildCard(remainingOpenMatch[1], nextName, expectedTypes[nextName]);
      }
      text = text.replace(remainingOpenPattern, "").replace(/\n{3,}/g, "\n\n").trimEnd();
    }

    // Only clean possible marker-adjacent markdown when Codex actually ran.
    if (expectedNames.length > 0) {
      text = text.replace(/^\s*[*_]{2,}\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trimEnd();
    }

    const messageParts = [];
    if (succeededNames.size > 0) {
      const names = [...succeededNames];
      const allNew = names.every(n => cardWasNew[n]);
      const allExisting = names.every(n => !cardWasNew[n]);
      if (names.length === 1) {
        messageParts.push(cardWasNew[names[0]]
          ? `📇 Codex created a ${builtTypes[names[0]] || expectedTypes[names[0]] || "Story"} card for ${names[0]}.`
          : `📇 Codex matched ${names[0]}'s existing Story Card; its written entry was left untouched.`);
      } else if (allNew) {
        messageParts.push(`📇 Codex created ${names.length} cards: ${names.join(", ")}.`);
      } else if (allExisting) {
        messageParts.push(`📇 Codex matched ${names.length} existing Story Cards: ${names.join(", ")} (written entries left untouched).`);
      } else {
        const created = names.filter(n => cardWasNew[n]);
        const existing = names.filter(n => !cardWasNew[n]);
        messageParts.push(`📇 Codex created ${created.length} card(s) (${created.join(", ")}) and matched ${existing.length} existing card(s) (${existing.join(", ")}), leaving their written entries untouched.`);
      }
    }

    const exhausted = expectedNames.filter(name => {
      if (succeededNames.has(name)) return false;
      if (state.unsaid.codex.likelyCharacters && state.unsaid.codex.likelyCharacters[name]) return false;
      return (state.unsaid.codex.attempts[name] || 0) >= cfg.codexMaxAttempts;
    });
    const characterRetryMilestone = expectedNames.filter(name =>
      !succeededNames.has(name) &&
      state.unsaid.codex.likelyCharacters &&
      state.unsaid.codex.likelyCharacters[name] &&
      (state.unsaid.codex.attempts[name] || 0) === cfg.codexMaxAttempts
    );

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
    if (characterRetryMilestone.length > 0) {
      messageParts.push(characterRetryMilestone.length === 1
        ? `📇 Codex still hasn't received a complete profile for ${characterRetryMilestone[0]}, so it is escalating instead of giving up and will retry automatically on the next story turn.`
        : `📇 Codex still hasn't received complete profiles for ${characterRetryMilestone.join(", ")}, so it is escalating instead of giving up and will retry them automatically.`);
    }
    if (exhausted.length > 0) {
      messageParts.push(exhausted.length === 1
        ? `📇 Codex paused the non-character candidate "${exhausted[0]}" after ${state.unsaid.codex.attempts[exhausted[0]]} unusable responses. "/card ${exhausted[0]}" still works directly, or "Reset Codex tracking now" clears its retry state.`
        : `📇 Codex paused ${exhausted.length} non-character candidates (${exhausted.join(", ")}) after repeated unusable responses. "/card <name>" still works directly, or "Reset Codex tracking now" clears their retry state.`);
    }
    if (messageParts.length > 0) pushMessage(messageParts.join(" "));

    state.unsaid.codex.pendingNames = [];
    state.unsaid.codex.pendingTypes = {};

    trackMentions(text, true);

    const revealWasRequested = !!state.unsaid.pending;
    if (state.unsaid.pending) {
      const name = state.unsaid.pending;
      const strictPattern = new RegExp(
        `《${escapeForRegex(name)},\\s*([a-zA-Z][a-zA-Z-]*)(?:,\\s*(about\\s+[^:》]+|core-shift))?:\\s*([^》]*)》`,
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
          // Final fallback still requires the expected character's name.
          // Do not consume an arbitrary unrelated 《...》 block just because
          // a reveal happened to be pending.
          const barePattern = new RegExp(
            `(^|\\n)\\s*${escapeForRegex(name)},\\s*([a-zA-Z][a-zA-Z-]*)(?:,\\s*(about\\s+[^:\\n]+|core-shift))?:\\s*([^\\n]+)`,
            "i"
          );
          const bareMatch = text.match(barePattern);
          if (bareMatch) {
            const matchedText = bareMatch[0].replace(/^\n/, "");
            matchedPattern = new RegExp(escapeForRegex(matchedText));
            feeling = bareMatch[2].trim().toLowerCase();
            if (feeling === "feeling" || feeling === "emotion" || feeling === "thought") feeling = null;
            modifier2 = bareMatch[3] ? bareMatch[3].trim() : null;
            thought = bareMatch[4].trim();
            usedFallback = true;
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

        // The model is not allowed to rewrite a core truth merely because it
        // emitted the words "core-shift". Context explicitly records whether
        // this particular reveal was authorized to shift the anchor.
        const coreShiftAuthorized = !!state.unsaid.pendingCoreShiftAllowed && !!cfg.allowCoreShift;
        if (isCoreShift && !coreShiftAuthorized) {
          isCoreShift = false;
          about = null;
        }

        const { wantSentence } = splitThoughtSentences(thought);

        // Replace by exact match position rather than a plain regex
        // .replace() — the instruction only tells the model to write
        // "italicized" sentences without ever showing it how, so some
        // models wrap their own reveal in "**" trying to comply. Since
        // that "**" sits just outside whatever the bracket pattern
        // actually captured, a plain replace on the pattern alone left it
        // behind as dangling, content-less asterisks in the visible story.
        // Finding the real match bounds and trimming any asterisks
        // immediately touching them (from either side) avoids that
        // regardless of which pattern matched or what the model added.
        const revealMatch = matchedPattern.exec(text);
        if (revealMatch) {
          const start = revealMatch.index;
          const end = start + revealMatch[0].length;
          const before = text.slice(0, start).replace(/\*+\s*$/, "");
          const after = text.slice(end).replace(/^\s*\*+/, "");
          // Shown in-story as the clean extracted thought itself, not the
          // raw internal 《Name, feeling: ...》 markup — a reader shouldn't
          // ever see the formatting brackets the AI was instructed to use.
          const replacement = cfg.showThoughtsInStory ? `*${thought}*` : "";
          text = (before + replacement + after).replace(/\n{3,}/g, "\n\n").trimEnd();
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
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
    }

    if (revealWasRequested && text.indexOf("《") !== -1) {
      text = text.replace(/《[^》]*》?/g, "").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
    }

    if (!revealWasRequested) {
      state.unsaid.pendingCoreShiftAllowed = false;
      state.unsaid.pendingCoreCheck = false;
    }

    syncFrontMemoryHint(cfg.enabled && cfg.subtleHints && cfg.cast.length > 0);

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
