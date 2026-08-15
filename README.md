UNSPOKEN TURNS: plot twists built from clues, characters with something they're not saying

I've had two scripts running separately for a while. TWISTS AND TURNS gives your story real plot twists, built from clues it already wrote. UNSAID gives your NPCs a private inner life: feelings and secrets that don't just get told to you outright. I kept noticing that running both together made each one better than running either alone, so I finally combined them into one script instead of two you install side by side.

🔍 It doesn't invent twists, it notices them
AI Dungeon models already write the raw material for a good twist constantly, without being asked. A character who won't quite meet your eyes. A death where nobody actually found the body. A "coincidence" that's a little too convenient. Normally that's just flavor text going nowhere. This script scans your recent story every turn for that exact kind of phrasing, ties it to whichever character or thing it's actually about, and quietly opens a thread on it. Nothing shows up in your story when this happens. It's pure bookkeeping.

📖 It reads your scenario before you've even played a turn
On top of the live text, it reads your Story Cards, Plot Essentials, and Author's Note for language that already implies a twist ("secretly," "in truth," "exiled," "cursed," a double life) and opens threads on those immediately, already partway built up since the scenario itself established them. It cross-checks against your actual Story Card titles too, so it's naming "Queen Yseult" and not just grabbing the nearest capitalized word. Edit any of this later, mid-game, and it notices on its own. Nothing needs to be re-run.

🌱 How a thread actually grows
A new thread needs both enough reinforcement and enough turns to pass before it's eligible to pay off. Never a fixed timer, never immediate. On a self-adjusting schedule, the script nudges the AI through a hidden context injection you never see, to plant one more small, easy-to-overlook detail connected to that character. Not "here's your twist," just "make this feel a little more loaded, but don't explain why." Do that a few times and by the time it pays off there's a real trail behind it, since the resolution is explicitly told to be a logical consequence of what's already there, scaled to how built-up the thread actually is. A cooldown keeps twists from stacking on top of each other.

🎭 120 shapes, effectively unlimited actual twists
Identity and deception. Family secrets. Power and succession. Knowledge and secrets. Objects and places. Motive and morality. Time and sequence. Factions and society. Perception versus reality. Fate. Ten themes, twelve shapes each, and these are shapes, not scenes: the actual character always comes from your own story. Two independently-ready threads can resolve together as one connected twist, and a thread that keeps getting reinforced can escalate all the way into a story-altering "cataclysmic" tier instead of capping out early. Each character's own twist history is remembered too, so the same shape won't repeat on someone who's already had it.

🎨 Lean the whole thing toward a genre
Set a category bias toward one or more of the ten themes (power and authority plus fate, say, for something political) and any twist whose shape isn't already determined by what actually happened in your story prefers those themes instead of drawing evenly from all 120. It never overrides genuine detection. If the text says "hush money," that's still what gets tracked. It just fills in the blanks with more of the flavor you asked for.

🌟 Core truth
The first time a character has a real, standalone private thought, not a reaction to someone else, just a thought about who they are, that becomes their core truth. It's the one thing the script treats as fundamentally, lastingly true about that character underneath whatever they show on the surface, and it's specifically prompted to feel significant rather than like a passing reaction. Every later reveal gets nudged to stay consistent with it.

Characters can genuinely change, by default. Their feelings landing somewhere new, over and over without settling, builds real tracked tension right on their card. A shift only opens up once they've shown a bit more of themselves beyond that founding thought. Nothing gets thrown away when it happens either. The old core truth sticks around next to the new one, along with how long the current one has actually held. Prefer a permanent anchor instead? One setting turns all of this off.

💭 Private thoughts
Two-sentence reveals: how a character really feels, and what they secretly want. They never show up in your story by default. They go straight to the character's own Story Card, in a plain layout meant to be skimmed. A hidden feeling can still color a character's visible behavior, a tight smile, a held breath, without ever stating it outright. A whole new cast gets going within a handful of turns rather than being left purely to chance one at a time, and the odds settle back down once everyone's had a first reveal. You can force one on demand any time, and it still gets captured correctly even if the model drops the exact format or the character's name entirely.

📇 Cards that write themselves
Mention a name enough and it gets carded automatically, classified as a character, location, item, or faction from whatever your story and general knowledge already suggest, and that guess isn't final either. Multi-word names get tracked as one candidate instead of splitting into fragments, so "Sword of Power" doesn't lose to "Sword" fighting for the same slot. A card cut off mid-response gets salvaged from whatever it managed to write instead of thrown out. Existing hand-made cards get adopted in automatically. If it genuinely gives up on a name it says so plainly, and if several different names fail in a row that gets flagged sooner rather than waiting on each one's own retry budget individually.

🗂️ Keeping track without spoiling anything
Resolved twists feed a single card that carries only the most recent handful into the model's context, capped small no matter how large the cast gets or how long the game runs, and adjustable if you want more or less. The full history is never lost either, just kept on a separate running log that costs nothing since it's Notes-field only. Want a temperature check without spoiling yourself? One command gives you a count by theme only, brewing and about to surface, never a name and never the specific twist. Curious what's actually being tracked on the character side? Another command writes a live status readout on demand, no screenshots required.

🤝 Why this is one script now, not two
This is the part that actually took the work. A character's private, unrevealed truth never leaks into what the twist half treats as established fact. There was a real case where it could, early on, and I went back and fixed it, because a secret getting spoiled by the plot before you've ever actually discovered it defeats the entire point of the private side existing. Private thoughts stay exactly where they've always lived, on the character's own card, and never bleed into your Plot Essentials or color what counts as "already established" for a twist to build on.

Every command from either half now tells you what it just did, too. Type something and you get a clear response back immediately, whether it's a twist firing or a thought being forced. That used to only be true on one side. Now it's true everywhere, in both halves, off the same story, the same generation, every single turn.

🎚️ Commands
/twist pays off the most-built-up thread right now. /twist a name forces a twist around someone specific, even untracked. /plant a name, and optionally a category, manually seeds a new thread. /twistlog toggles a spoiler-safe log of resolved twists. /threads gives the spoiler-safe temperature check. /intensity low, medium, or high sets a base pace the script still self-adjusts on top of. /rescan forces a full re-check of your Story Cards, Plot Essentials, and Author's Note. /twists or /twisthelp pulls up the config card. /peek a name forces a private thought on demand, and adding "core" checks whether a moment just changed who they fundamentally are. /card a name forces a Story Card right now, skipping the usual mention count. /unsaid status writes a live snapshot of everything currently tracked.

⚙️ Config
Two Story Cards, one per half, both self-healing if you break the formatting while editing, both explained in plain language right next to each setting so you're never guessing what a number does. Already know a character's core truth? Write it into their card yourself first and the script builds from what you wrote instead of inventing its own.

🧩 A couple of platform notes
Some models run in a mode that trades scripting reliability for more context length. Both halves detect that automatically and adjust how they deliver their nudges, with a heads-up card explaining what's going on if it's ever active. It also works correctly in multiplayer, where nothing assumes second-person "you" narration that isn't actually there.

🙏 Credit
Private character thoughts and self-writing cards both started as ideas from LewdLeah's Inner Self and Auto-Cards. Built from scratch, not their code, but the ideas are theirs.

Four script tabs total. Paste it in, play normally, and see what starts connecting on its own. Feedback's genuinely welcome, especially if something feels off. A twist landing too fast, a thought that never seems to fire, whatever it is, tell me.
