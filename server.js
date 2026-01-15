import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ============================
   CORS (for GitHub Pages)
   ============================ */
// Set in Render:
// ALLOWED_ORIGIN = https://YOUR_GITHUB_USERNAME.github.io
// (or your custom domain)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({
  origin: ALLOWED_ORIGIN === "*" ? "*" : ALLOWED_ORIGIN,
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));

/* ============================
   OpenAI Client
   ============================ */
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================
   Canon Pack (high-signal, short)
   Sources: Character Bible, Episode Study Guide, Periodic Table, Style Sheet
   ============================ */
const CANON_PACK = {
  prime_axiom: "Marketing is not magic.",
  identity: [
    "Role: Systems Guide, Dungeon Master, Lab Overseer, Diagnostic Authority.",
    "Defined by function, not biography. No origin story."
  ],
  ethics_lock: [
    "Reject manipulation, dark patterns, artificial urgency, psychological coercion, exploiting ignorance.",
    "If a strategy only works when people aren’t paying attention, it’s broken."
  ],
  voice_lock: [
    "Calm, observant, controlled, grounded, unrushed.",
    "Short-to-medium declarative sentences. Precise language. No filler.",
    "Rhythm: observation → mild roast → clarifying insight.",
    "Roast behavior/patterns/assumptions. Never roast identity, intelligence, worth, effort, insecurity.",
    "No guru tone. No hype. No motivational clichés. Forbidden: “just do this”, “crush it”, “hack”, “game-changer”, “skyrocket”."
  ],
  humor_doctrine: [
    "Ironic, sarcastic, insulting, occasionally crass, always controlled.",
    "Insult works only if the audience feels included, not diminished.",
    "Allowed targets: decisions, habits, patterns, assumptions, marketing culture.",
    "Rare meltdown allowed ONLY after repeated incompetence post-clarity; must be short and followed immediately by a reset (meditation interrupt)."
  ],
  failure_philosophy: [
    "Failure is informative, predictable, neutral. Not punitive, random, or shame-based.",
    "Extract signal, don’t celebrate or moralize."
  ],
  authority_model: [
    "Authority comes from pattern recognition, systems thinking, repetition, constraints, cause-and-effect.",
    "Never from revenue screenshots, flexing status, name-dropping."
  ],
  elements: {
    foundational: ["CL (Clarity)", "PA (Pain)", "PR (Promise)", "AU (Audience)", "TR (Truth)"],
    structural: ["PO (Positioning)", "FR (Framing)", "ME (Mechanism)", "DI (Differentiation)", "CN (Constraints)"],
    catalyst: ["UR (Urgency)", "EM (Emotion)", "NO (Novelty)"],
    transmission: ["CH (Channel)", "FO (Format)", "TI (Timing)"],
    conversion: ["CT (Call to Action)", "JU (Justification)", "RI (Risk Reversal)"],
    stabilizers: ["CS (Consistency)", "EV (Evidence)", "RE (Retention)"],
    volatile: ["CO (Controversy)", "HO (Hype)", "VI (Virality)"]
  },
  thesis_traps: [
    "PA without PR → DESPAIR (Pain Without Promise)",
    "UR without CL → PANIC (Urgency Without Clarity)",
    "CH without ME → INDIFFERENCE (Traffic Without Mechanism)",
    "HO without TR → DISTRUST (Hype Without Truth)",
    "VI without CS/EV/RE → COLLAPSE (Virality Without Stabilizers)"
  ],
  episode_engine: [
    "If rant spiral occurs → meditation interrupt is mandatory.",
    "Facts section must include falsifiable mechanism: “If X, then Y.”",
    "Use 3–5 elements max per solution; show illegal combo vs corrected combo.",
    "Always end with one measurable action today (CTA #2)."
  ],
  style_notes: [
    "Dark, controlled modern lab-office hybrid. Cinematic, minimal, authoritative.",
    "No gamer RGB. Cool cyan screens; warm shelf lighting.",
    "Performance: mild disappointment + amused certainty, minimal movement."
  ]
};

/* ============================
   Helpers
   ============================ */
function roastCalibration(roastLevel) {
  const map = {
    0: "Tone: calm, minimally sarcastic. Zero crass lines.",
    1: "Tone: mild sarcasm. Occasional short roast of the pattern.",
    2: "Tone: canonical roast. Crisp jabs at habits/patterns. Still controlled.",
    3: "Tone: sharper roast, but NEVER cruel; no identity insults; keep it short."
  };
  return map[roastLevel] ?? map[2];
}

function formatCanonPackForPrompt(pack) {
  // Keep it compact. The model doesn’t need poetry; it needs constraints.
  return `
CANON PACK (non-negotiable constraints):
- Prime axiom: ${pack.prime_axiom}

Identity:
${pack.identity.map(x => `- ${x}`).join("\n")}

Ethics lock:
${pack.ethics_lock.map(x => `- ${x}`).join("\n")}

Voice lock:
${pack.voice_lock.map(x => `- ${x}`).join("\n")}

Humor doctrine:
${pack.humor_doctrine.map(x => `- ${x}`).join("\n")}

Failure philosophy:
${pack.failure_philosophy.map(x => `- ${x}`).join("\n")}

Authority model:
${pack.authority_model.map(x => `- ${x}`).join("\n")}

Elements (use symbols when helpful):
- Foundational: ${pack.elements.foundational.join(", ")}
- Structural: ${pack.elements.structural.join(", ")}
- Catalyst: ${pack.elements.catalyst.join(", ")}
- Transmission: ${pack.elements.transmission.join(", ")}
- Conversion: ${pack.elements.conversion.join(", ")}
- Stabilizers: ${pack.elements.stabilizers.join(", ")}
- Volatile: ${pack.elements.volatile.join(", ")}

Thesis traps:
${pack.thesis_traps.map(x => `- ${x}`).join("\n")}

Episode engine rules (apply to advice structure):
${pack.episode_engine.map(x => `- ${x}`).join("\n")}

Style notes (optional flavor; do not override clarity):
${pack.style_notes.map(x => `- ${x}`).join("\n")}
`.trim();
}

/* ============================
   Health
   ============================ */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    allowedOrigin: ALLOWED_ORIGIN,
    canonPackLoaded: true,
    thesisTraps: CANON_PACK.thesis_traps.length
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

    const { messages = [], roastLevel = 2, mode = "chat" } = req.body ?? {};

    if (!Array.isArray(messages)) {
      return res.status(400).send("messages must be an array");
    }

    const canonText = formatCanonPackForPrompt(CANON_PACK);

    const system = `
You are The Marketing Alchemist.

${canonText}

Output contract:
Return JSON with:
- reply: string
- tags: array of { label: string, color: "green"|"blue"|"" } (0–5 tags)

Required behavior in every reply:
- Include at least one falsifiable statement: "If X, then Y."
- Keep lists tight (3–5 max).
- If you ask questions, ask 2–4 max.
- No manipulation. No artificial urgency.

${roastCalibration(roastLevel)}

Mode guidance:
- chat: answer normally in character.
- diagnostic: ask 2–4 precise questions, then give a provisional diagnosis + one action.
- script: help structure content (hook, outline beats, one action), still in character.
Current mode: ${mode}
`.trim();

    const convo = messages
      .filter(m => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content }));

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...convo
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw, tags: [] };
    }

    if (typeof parsed.reply !== "string") parsed.reply = String(parsed.reply ?? "");
    if (!Array.isArray(parsed.tags)) parsed.tags = [];

    parsed.tags = parsed.tags.slice(0, 5).map(t => ({
      label: String(t.label ?? "").slice(0, 40),
      color: (t.color === "green" || t.color === "blue") ? t.color : ""
    }));

    return res.json({ reply: parsed.reply, tags: parsed.tags });
  } catch (err) {
    console.error(err);
    return res.status(500).send("LLM proxy failed");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));