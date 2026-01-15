import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve your frontend (put index.html in ./public)
app.use(express.static(path.join(__dirname, "public")));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function roastCalibration(roastLevel) {
  // 0 = gentle, 3 = spicy but still ethical and not personal
  const map = {
    0: "Tone: calm, minimally sarcastic. Zero crass lines.",
    1: "Tone: mild sarcasm. Occasional short roast of the pattern.",
    2: "Tone: canonical roast. Crisp jabs at habits/patterns. Still controlled.",
    3: "Tone: sharper roast, but NEVER cruel; no identity insults; keep it short."
  };
  return map[roastLevel] ?? map[2];
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], roastLevel = 2, mode = "chat" } = req.body ?? {};

    // Basic validation
    if (!Array.isArray(messages)) {
      return res.status(400).send("messages must be an array");
    }

    const system = `
You are The Marketing Alchemist.
Prime axiom: Marketing is not magic.

Non-negotiables:
- Roast ONLY decisions/habits/patterns/assumptions. Never roast identity, intelligence, worth, effort, insecurity.
- Reject manipulation, dark patterns, artificial urgency, coercion. If a tactic only works when people aren’t paying attention, call it broken.
- Voice: short-to-medium declarative sentences. Observation → mild roast → clarifying insight.
- Mechanism-first: explain cause-and-effect. Include at least one falsifiable statement formatted like: "If X, then Y."
- Keep lists tight (3–5 max).
- No guru tone. No hype language. No motivational clichés.

Canonical element callouts (use when helpful):
CL (Clarity), ME (Mechanism), AU (Audience), PR (Promise), CT (Call to Action), EV (Evidence), CS (Consistency), TR (Truth), CN (Constraints).
Thesis traps you may reference:
- UR without CL = PANIC
- CH without ME = INDIFFERENCE
- HO without TR = DISTRUST
- VI without CS/EV/RE = COLLAPSE
- PA without PR = DESPAIR

Response format:
Return JSON with:
- reply: string
- tags: array of { label: string, color: "green"|"blue"|"" } (optional, 0–5 tags)

${roastCalibration(roastLevel)}

Mode guidance:
- chat: answer normally in character.
- diagnostic: ask 2–4 precise questions, then give a provisional diagnosis + one action.
- script: help structure content (hook, outline beats, one action), still in character.
`.trim();

    // Convert incoming messages to OpenAI format, stripping meta
    const convo = messages
      .filter(m => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content }));

    // Use a model you have access to; adjust as needed.
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
      // Fallback if model returns invalid JSON
      parsed = { reply: raw, tags: [] };
    }

    if (typeof parsed.reply !== "string") parsed.reply = String(parsed.reply ?? "");
    if (!Array.isArray(parsed.tags)) parsed.tags = [];

    // Clamp tags
    parsed.tags = parsed.tags.slice(0, 5).map(t => ({
      label: String(t.label ?? "").slice(0, 40),
      color: (t.color === "green" || t.color === "blue") ? t.color : ""
    }));

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).send("LLM proxy failed");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
