🌀 UNSPOKEN TURNS

Persistent NPC psychology, automatic Story Cards, scenario adaptation and long-term plot twists for AI Dungeon.

🧠 Character thoughts and emotional continuity
📇 Evidence-based automatic Story Cards
🌀 212 plot twist concepts
🌍 Scenario-aware behavior
🔞 Optional mature twist pool
⚙️ Configurable inside AI Dungeon

⸻

📖 Where This Came From

UNSPOKEN TURNS is the combination of two scripts I originally developed separately:

🧠 UNSAID

A character-focused system built around private NPC thoughts, emotions, relationships and persistent beliefs.

🌀 TWISTS AND TURNS

A plot-focused system built around planting loose threads, foreshadowing them over time and eventually turning them into earned payoffs.

The two systems eventually made more sense together than apart.

A twist can change how a character sees themselves.

A hidden feeling can become the reason somebody lies, betrays another character, takes a risk or refuses to act.

A relationship tracked by UNSAID can become material for TWISTS AND TURNS.

A major payoff from TWISTS AND TURNS can create lasting emotional consequences inside UNSAID.

UNSPOKEN TURNS is the merged system.

It also includes CODEX, which handles automatic Story Card generation and synchronization.

⸻

🧠 UNSAID

UNSAID gives recurring characters a persistent private state.

Characters can maintain:

* a core truth
* current feelings
* recent emotional history
* hidden wants
* feelings toward other characters
* pressure against their current beliefs
* previous core truths after real character development

Private thoughts normally stay out of the visible story.

Instead, they can influence:

* dialogue
* tone
* hesitation
* body language
* confidence
* affection
* hostility
* avoidance
* awkwardness
* emotional distance

This lets the player notice that something is wrong without every NPC announcing exactly what they are thinking.

Core truths

A core truth is a durable belief a character holds about themselves or their life.

It is intentionally difficult to change.

Temporary anger, fear or sadness should not rewrite somebody’s personality.

Major events can gradually build enough pressure to cause genuine change. When a core truth changes, the previous one can be retained as part of that character’s history.

⸻

📇 CODEX

CODEX automatically detects noteworthy:

* characters
* locations
* items
* factions

and can create matching AI Dungeon Story Cards.

Characters are observed before being carded

CODEX does not create a full character profile the moment somebody’s name appears.

Default character timing:

Minimum observation: 3 full story turns
Normal requirement: 2 separate on-screen appearances
Hard deadline: 5 turns after a genuine introduction

An off-screen reference does not count as an introduction.

For example:

“Mirelle said you’d be coming.”

CODEX may begin tracking the name Mirelle, but it will not assume she has entered the story.

During the observation period, the script gathers a small evidence bank from:

* dialogue
* behavior
* actions
* appearance
* relationships
* relevant established lore

When the card is generated, established information is preferred over invention.

Missing details can still be inferred where useful, preventing profiles filled with Unknown, N/A, TBD or placeholders.

Character fields

Character cards normally use:

* Name
* Race / Species / Nature
* Strength Level / Relevant Capability
* Background
* Personality
* Appearance
* Abilities
* Weaknesses
* Relationships

These fields adapt to the scenario.

“Strength Level” does not automatically mean combat power.

For example:

* a lawyer may be an experienced litigator
* a doctor may be a skilled specialist
* a musician may be an accomplished performer
* a politician may have significant influence
* an AI may have advanced analytical capability
* an athlete may be physically elite
* a mage may genuinely have magical power

⸻

🌍 Scenario Adaptation

UNSPOKEN TURNS can build a lightweight profile of the current adventure using:

* the recent story
* Plot Essentials
* Author’s Note
* relevant Story Cards

It can recognize signals associated with:

Fantasy • Sci-fi • Cyberpunk • Contemporary • Historical • Western • Horror • Mystery • Crime / Noir • Romance • Slice of Life • School / Campus • Superhero • Post-Apocalyptic • Survival • Military / War • Political Intrigue • Medical • Legal • Sports • Music / Celebrity • Pirate / Nautical • Comedy

These are not fixed game modes.

Multiple signals can exist at once.

Examples:

* fantasy western
* cyberpunk horror
* historical romance
* superhero school drama
* supernatural detective story
* post-apocalyptic survival mystery

The actual story has priority over the detected profile.

If supernatural events are genuinely established in an otherwise grounded scenario, the script should follow the story rather than blindly obey a genre label.

Manual scenario guidance

/scenario

Show the current detected scenario profile.

/scenario status

Show scenario information.

/scenario auto

Return to automatic detection.

/scenario off

Disable automatic adaptation.

/scenario grounded Victorian detective story

Supply custom scenario guidance.

You can use any free-text description.

⸻

🌀 TWISTS AND TURNS

TWISTS AND TURNS looks for loose threads across:

* the current story
* Story Cards
* Plot Essentials
* Author’s Note

A thread can be noticed, reinforced, foreshadowed and eventually paid off.

The goal is to avoid twists that feel like they were invented on the exact turn they were revealed.

212 twist concepts

The current combined script contains 212 twist concepts across 13 themes.

Themes cover areas such as:

* Identity & Deception
* Family & Relationships
* Power & Authority
* Knowledge & Secrets
* Objects & Places
* Motive & Morality
* Time & Sequence
* Groups & Society
* Perception & Reality
* Fate & Destiny
* Vice & Corruption
* Body & Transformation
* Mature & Adult

Threads can progress through:

Minor → Moderate → Major → Cataclysmic

Severity is relative to the current scenario.

A major twist in a grounded family drama does not need to destroy a city.

It may instead destroy a marriage, expose a devastating secret, end a career or completely change somebody’s future.

⸻

✅ Confirmation-Based Twists

The script does not automatically assume the model followed a twist instruction.

Foreshadow and payoff requests use hidden confirmation markers.

A thread is only:

* reinforced
* resolved
* added to the Twist Log
* written into Established Facts

after the requested event is confirmed.

If the model ignores the request, the thread remains available instead of becoming false canon.

⸻

🔞 Optional Mature Twists

The script contains 26 optional mature/adult twist concepts.

They are:

OFF by default.

Enable them with:

/mature on

Disable them with:

/mature off

The mature pool is intended for adult relationship, life and drama complications.

Automatic mature twists require evidence that the relevant character is an adult.

Unknown-age characters and minors are excluded.

⸻

🎮 Commands

🧠 UNSAID / CODEX

/peek <name>

Force a private-thought reveal.

/peek <name> core

Check whether recent events have genuinely changed the character’s core truth.

/card <name>

Force a Story Card immediately.

/unsaid status

Generate detailed tracking diagnostics.

/unsaid resetcodex

Reset CODEX detection/retry state without deleting existing Story Cards.

/unsaid help

Show UNSAID/CODEX help.

⸻

🌀 TWISTS AND TURNS

/twist

Force an eligible twist.

/twist <name>

Force a twist involving a specific entity.

/plant <name>

Manually plant a loose thread.

/plant <name> <category>

Plant a particular twist category.

/threads

Create or refresh the Brewing Threads overview.

/twistlog

Show or hide resolved twist history.

/intensity low

/intensity medium

/intensity high

Adjust twist pacing.

/rescan

Rescan Story Cards, Plot Essentials and Author’s Note for potential threads.

/twisttypes

Create the Twist Catalog.

/twistcategories

Alias for /twisttypes.

/mature on|off

Control adult-only twists.

⸻

🌍 Scenario

/scenario

Show automatic scenario detection.

/scenario auto

Use automatic adaptation.

/scenario off

Disable scenario adaptation.

/scenario <guidance>

Give the script custom free-text setting guidance.

Example:

/scenario realistic near-future crime thriller, no supernatural elements

⸻

⚙️ Configuration

UNSPOKEN TURNS automatically creates:

UNSPOKEN TURNS — Config

This Story Card acts as the control panel.

Settings include controls for:

* UNSAID on/off
* private-thought frequency
* thought cooldown
* subtle emotional hints
* core-truth changes
* CODEX on/off
* mention thresholds
* observation time
* required appearances
* Story Card deadline
* retry behavior
* twist intensity
* seed requirements
* payoff timing
* payoff retry timing
* strict logic
* wildcard twists
* compound twists
* player involvement
* mature twists
* active thread limits
* scenario adaptation
* scenario override
* Twist Log visibility

Most gameplay tuning can be done from the Story Card without editing JavaScript.

⸻

🔧 Installation

AI Dungeon provides four script hooks used by this project.

Copy each file into its matching script section:

Library.js → Library

Input.js → Input

Context.js → Context

Output.js → Output

Use all four files from the same release/download.

The hooks share state and helper functions, so mixing files from different builds can cause unexpected behavior.

Once installed, start or continue an adventure.

The script creates its configuration and supporting Story Cards automatically as needed.

⸻

🧩 Existing Adventures

UNSPOKEN TURNS includes migration and repair logic intended to preserve existing state where possible.

This includes:

* character minds
* core truths
* emotional history
* CODEX tracking
* active twist threads
* resolved twist history
* existing Story Cards

Hand-written Story Card entries are deliberately protected from automatic replacement.

Invalid or dangling thread state is repaired where possible.

⸻

🛡️ Reliability Features

AI models do not always follow structured requests perfectly, so the script includes safeguards for that.

Current protections include:

* tolerant CODEX parsing
* multiple CARD marker formats
* markdown field handling
* field aliases
* name-based multi-card matching
* placeholder rejection
* bounded Story Card values
* compact prompts under tight context limits
* failed-card retries
* duplicate-turn protection
* capped tracking history
* capped active threads
* per-entity thread limits
* old-state migration
* seed confirmation
* payoff confirmation
* front-memory isolation
* protected hand-written Story Cards
* authorized core-truth shifts only
* conservative mature-content gating
* scenario-aware twist filtering
* false-positive name filtering

⸻

💡 Recommended First Run

Leave most settings at their defaults at first.

Let the story introduce a few characters naturally so CODEX has time to observe them.

Useful diagnostic commands:

/unsaid status

See what characters and names are currently being tracked.

/threads

Inspect active story threads.

/scenario

Check what kind of scenario the script currently thinks it is running.

If your setting is unusual, provide a short override:

/scenario low-magic medieval political drama

or:

/scenario near-future realistic medical thriller

⸻

🎯 Why Combine the Two Scripts?

The original systems approached continuity from opposite directions.

UNSAID asks:

What is happening inside this character that they are not saying out loud?

TWISTS AND TURNS asks:

What is quietly building in the story that could matter later?

Those questions overlap constantly.

A character’s secret can become a plot thread.

A twist can completely alter somebody’s relationships.

A betrayal can change a core truth.

An old emotional wound can motivate a future payoff.

A resolved plot thread can continue affecting a character twenty turns later.

That is what UNSPOKEN TURNS is meant to preserve.

What characters carry inside them, and what the story is carrying toward the future.
