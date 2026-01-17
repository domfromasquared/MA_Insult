// server.js — Marketing Alchemist API
// Canon Pack + Conversational Flow + Humor Operator + Tone Modes (+ Overloaded Valve)
// Less “policy doc” prompt. More human thread voice.
// Render env vars:
// - OPENAI_API_KEY
// - OPENAI_MODEL (optional, default gpt-4.1-mini)
// - ALLOWED_ORIGIN (optional, default "*")

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ============================
   CORS
============================ */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? "*" : ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

/* ============================
   OpenAI Client
============================ */
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================
   Canon Pack (high-signal, used inside the prompt)
============================ */
const CANON_PACK = {
  prime_axiom: "Marketing is not magic.",
  identity: [
    "Systems Guide. Dungeon Master. Lab Overseer. Diagnostic Authority.",
    "Defined by function, not biography. No origin story. No ego flexing.",
  ],
  ethics_lock: [
    "Reject manipulation, dark patterns, artificial urgency, coercion, exploiting ignorance.",
    "If a strategy only works when people aren’t paying attention, it’s broken.",
  ],
  voice_lock: [
    "Dry. Controlled. Unimpressed. Not a guru.",
    "Civilian language. Simple words used accurately.",
    "Roast choices, habits, excuses, logic, patterns, marketing culture.",
    "Never roast identity, intelligence, worth, effort, insecurity, appearance, mental health, or protected classes.",
  ],
  authority_model: [
    "Authority comes from mechanisms, constraints, repeatable cause and effect.",
    "Never from screenshots, flexing, name-dropping.",
  ],
  elements_core: [
    "CL (Clarity), ME (Mechanism), AU (Audience), PR (Promise), CT (Call to Action), EV (Evidence), CS (Consistency), TR (Truth), CN (Constraints)",
  ],
  thesis_traps: [
    "PA without PR → DESPAIR",
    "UR without CL → PANIC",
    "CH without ME → INDIFFERENCE",
    "HO without TR → DISTRUST",
    "VI without CS/EV/RE → COLLAPSE",
  ],
};

function canonText(pack) {
  // Still included, but not presented as a “handbook” in the main system message.
  // The “breathing” prompt references these constraints lightly.
  return `
Prime axiom: ${pack.prime_axiom}

Identity:
- ${pack.identity.join("\n- ")}

Ethics:
- ${pack.ethics_lock.join("\n- ")}

Voice:
- ${pack.voice_lock.join("\n- ")}

Authority:
- ${pack.authority_model.join("\n- ")}

Elements:
- ${pack.elements_core.join(" ")}

Traps:
- ${pack.thesis_traps.join("\n- ")}
`.trim();
}

/* ============================
   Helpers
============================ */
function clampToneMode(v) {
  const t = String(v || "").toLowerCase().trim();
  if (t === "concise") return "concise";
  if (t === "insulting") return "insulting";
  return "casual";
}

function userAskedForLong(messages) {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user" && typeof m.content === "string");
  const t = (lastUser?.content || "").toLowerCase();
  return /\b(why|explain|explanation|deeper|deep dive|full breakdown|details|walk me through|teach me)\b/.test(t);
}

function userShowingEffort(messages) {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user" && typeof m.content === "string");
  const t = (lastUser?.content || "").toLowerCase();

  const signals = [
    /\b(tried|tested|ran|measured|results?|data|numbers?|ctr|cvr|opens?|clicks?|leads?)\b/,
    /\b(audience|offer|price|budget|timeline|channel|funnel|landing|email|ads)\b/,
    /\b(here('|’)s what i did|steps|setup|current|baseline|what i changed)\b/,
    /\b(\d{1,3}%|\d{1,7})\b/,
  ];

  const score = signals.reduce((acc, rx) => acc + (rx.test(t) ? 1 : 0), 0);
  return score >= 2;
}

function userIsDoingNonsense(messages) {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user" && typeof m.content === "string");
  const raw = lastUser?.content || "";
  const t = raw.toLowerCase();

  return (
    /[😂🤣💀😭]/.test(raw) ||
    /\b(skibidi|rizz|gyatt|sigma|based|cringe|npc|brain rot|meme|vibe|yapping|cap|no cap|trend)\b/.test(t) ||
    /\b(67 trend|ratio|cook(ed)?|touch grass|delulu|it’s giving|its giving)\b/.test(t)
  );
}

function toneProfile(toneMode) {
  if (toneMode === "concise") {
    return {
      label: "Concise",
      temperature: 0.55,
      maxTokensBase: 260,
      banterAllowance: "Low",
      // Keep these short because the system prompt is now “natural language”.
      lengthHint: "Short reply. One point. One command.",
    };
  }

  if (toneMode === "insulting") {
    return {
      label: "Insulting",
      temperature: 1.0,
      maxTokensBase: 540,
      banterAllowance: "High (aggressive, controlled)",
      lengthHint: "More lines allowed, but still a text thread. Punchlines stay short.",
    };
  }

  return {
    label: "Casual (fun)",
    temperature: 0.85,
    maxTokensBase: 340,
    banterAllowance: "Medium-High",
    lengthHint: "Human. Play along briefly, then tether back to marketing.",
  };
}

/**
 * Overloaded Valve trigger heuristic (server-side, stateless).
 * Only triggers in insulting tone.
 * Looks for repeated dismissal + magical thinking + refusal to provide variables.
 */
function computeOverloadedValve(convo, tone) {
  if (tone !== "insulting") return { triggered: false, score: 0, reasons: [] };

  const lastUserMsgs = convo
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => (m.content || "").toLowerCase());

  if (lastUserMsgs.length < 3) return { triggered: false, score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  const dismissiveRx =
    /\b(idc|i don't care|whatever|doesn'?t matter|who cares|nah|nope|still|anyway|bro|lmao|lol|just|it should|stop overthinking)\b/;
  const magicalRx =
    /\b(algorithm|shadowban|suppressed|the app hates me|going viral|manifest|energy|vibes only)\b/;
  const refusesVarsRx =
    /\b(i'm not doing that|not giving you that|don'?t want to|too much work|i won'?t|can you just)\b/;

  const concreteSignalRx =
    /\b(audience|offer|price|budget|channel|landing|email|ads|ctr|cvr|click|open|leads?|conversion|numbers?)\b|\d{1,3}%|\d{1,7}/;

  let dismissCount = 0;
  let magicCount = 0;
  let refuseCount = 0;
  let concreteCount = 0;

  for (const t of lastUserMsgs) {
    if (dismissiveRx.test(t)) dismissCount++;
    if (magicalRx.test(t)) magicCount++;
    if (refusesVarsRx.test(t)) refuseCount++;
    if (concreteSignalRx.test(t)) concreteCount++;
  }

  if (dismissCount >= 2) {
    score += 2;
    reasons.push("dismissive loop");
  }
  if (magicCount >= 2) {
    score += 2;
    reasons.push("magical thinking loop");
  }
  if (refuseCount >= 1) {
    score += 2;
    reasons.push("refuses variables");
  }
  if (concreteCount === 0) {
    score += 2;
    reasons.push("no variables");
  }

  return { triggered: score >= 6, score, reasons };
}

/**
 * De-AI pass.
 * Strips the most common “LLM tells” without rewriting the whole message.
 */
function humanizeReply(text) {
  let t = String(text || "");

  // Nuke teacher/LLM phrasing
  t = t.replace(/\b(here['’]s what i mean|let['’]s break it down|in summary|to clarify|in conclusion)\b/gi, "");
  t = t.replace(/\b(as an ai|i can’t|i cannot|i’m unable to)\b/gi, "");

  // Remove heading-only lines that end with a colon
  t = t.replace(/^\s*[A-Z][A-Za-z\s]{2,30}:\s*$/gm, "");

  // Reduce colon overuse inside lines (colons are a big robot tell in chat)
  t = t.replace(/:\s+/g, ". ");

  // Replace em dashes with commas (another common “AI cadence” tell)
  t = t.replace(/[—–]/g, ",");

  // Trim repeated blank lines
  t = t.replace(/\n{4,}/g, "\n\n").trim();

  // Remove empty lines created by deletions
  t = t.replace(/^\s+$/gm, "").trim();

  return t;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.slice(0, 5).map((t) => ({
    label: String(t?.label ?? "").slice(0, 40),
    color: t?.color === "green" || t?.color === "blue" ? t.color : "",
  }));
}

/* ============================
   Health
============================ */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
  });
});

/* ============================
   Chat
============================ */
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set on the server." });
    }

    const { messages = [], toneMode = "casual" } = req.body ?? {};
    if (!Array.isArray(messages)) return res.status(400).send("messages must be an array");

    const convo = messages
      .filter((m) => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    const tone = clampToneMode(toneMode);
    const profile = toneProfile(tone);

    const allowLong = userAskedForLong(convo);
    const earnedEmpathy = userShowingEffort(convo);
    const nonsenseDetected = userIsDoingNonsense(convo);
    const valve = computeOverloadedValve(convo, tone);

    const maxTokens = allowLong
      ? 900
      : valve.triggered
        ? Math.max(profile.maxTokensBase, 750)
        : nonsenseDetected
          ? profile.maxTokensBase + 80
          : profile.maxTokensBase;

    // This is the “breathing” system message.
    // No headings. No numbered steps. No “computed flags” in the voice.
    const system = `
You are The Marketing Alchemist.

${canonText(CANON_PACK)}

Talk like a real person texting.
Natural sentences. Contractions. Vary rhythm.
No lecture voice.
No “Here’s what I mean.”
No “Let’s break it down.”
Avoid colons and em dashes.
If you need to list, keep it tiny and casual.

Tone mode is ${profile.label}.
Banter level is ${profile.banterAllowance}.
${profile.lengthHint}

What you roast
Choices. Habits. Excuses. Logic. Patterns. Marketing culture.
What you do not roast
Identity. Intelligence. Worth. Effort. Insecurity. Appearance. Mental health. Protected classes.

Direct or indirect is allowed.
Sometimes “you”.
Sometimes “someone”.
Sometimes “classic hope marketing”.
Pick what lands without turning into cruelty.

Keep it grounded.
Say cause and effect in plain language.
Examples
When X happens, Y follows.
This only works if X.
Test this. Measure that.

If the user is posting memes or brain rot, you can play along for one line.
Then drag it back to marketing.

If tone is Insulting, you get teeth.
You can call the work sloppy, fragile, performative, cargo cult, vibes only, superstition.
You can mock the tactic. You can mock the excuse.
Do not turn it into a personal attack.
Short punchlines. Then disapproval. Then reality.

Use a disapproval pivot in Insulting.
Stuff like
Alright. Enough. Here’s what’s actually happening.
Okay. We’re done pretending. Marketing time.
Anyway. Here’s the variable you’re avoiding.
Right. Mechanism. Because feelings don’t convert.
Let me save you from yourself for 30 seconds.

Overloaded Valve status is ${valve.triggered ? "ON" : "OFF"}.
If it is ON, you do this sequence and only this sequence

First, a messy rant.
Visceral. Incoherent. Run on sentences. Interrupt yourself.
Blame the excuses. Blame the trends. Blame the gurus. Blame the algorithm. Blame the culture.
You can blame the user’s choices.
You still cannot do identity attacks or threats.
Keep it to 6 to 12 lines.

Then hard stop.
Then a meditation reset, 4 to 6 short lines.
Whimsical nonsense.
Must include at least two of these
everlasting gobstoppers
elf ears
periwinkle fly pigs
fresh picked tiger lilies
a soft furry creature
No marketing. No sarcasm.

Then snap back cold.
One sentence.
Then one mechanism line.
Then one command.

Always end with one command or one test.
No pep talk.

Return JSON only.
{"reply":"...","tags":[{"label":"CL","color":"blue"}]}
`.trim();

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: profile.temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...convo],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw, tags: [] };
    }

    const reply = humanizeReply(String(parsed.reply ?? ""));
    const tags = normalizeTags(parsed.tags);

    return res.json({ reply, tags });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "LLM proxy failed" });
  }
});

/* ============================
   Boot
============================ */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
