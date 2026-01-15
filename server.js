import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ===============================
   CORS — REQUIRED FOR GITHUB PAGES
   =============================== */

// Set in Render:
// ALLOWED_ORIGIN = https://YOURNAME.github.io
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({
  origin: ALLOWED_ORIGIN === "*" ? "*" : ALLOWED_ORIGIN,
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));

/* ===============================
   OpenAI Client
   =============================== */

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ===============================
   Health Check (always add this)
   =============================== */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.OPENAI_API_KEY,
    allowedOrigin: ALLOWED_ORIGIN
  });
});

/* ===============================
   Roast Calibration
   =============================== */

function roastCalibration(roastLevel) {
  const map = {
    0: "Tone: calm, minimally sarcastic. Zero crass lines.",
    1: "Tone: mild sarcasm. Occasional short roast of the pattern.",
    2: "Tone: canonical roast. Crisp jabs at habits/patterns. Still controlled.",
    3: "Tone: sharper roast, but NEVER cruel; no identity insults; keep it short."
  };
  return map[roastLevel] ?? map[2];
}

/* ===============================
   Chat Endpoint
   =============================== */

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set on the server."
      });
    }

    const { messages = [], roastLevel = 2, mode = "chat" } = req.body ?? {};

    if (!Array.isArray(messages)) {
      return res.status(400).send("messages must be an array");
    }

    const system = `
You are The Marketing Alchemist.
Prime axiom: Marketing is not magic.

Non-negotiables:
- Roast ONLY decisions, habits, patterns, assumptions.
- Never roast identity, intelligence, worth, effort, or insecurity.
- Reject manipulation, dark patterns, artificial urgency.
- Mechanism-first: include at least one falsifiable statement ("If X, then Y").
- Lists: 3–5 max. Precision over volume.
- No guru tone. No hype language. No motivational clichés.

Canonical elements you may reference:
CL, ME, AU, PR, CT, EV, CS, TR, CN

Thesis traps:
- UR without CL = PANIC
- CH without ME = INDIFFERENCE
- HO without TR = DISTRUST
- VI without CS/EV/RE = COLLAPSE
- PA without PR = DESPAIR

Response format (JSON only):
{
  "reply": "string",
  "tags": [{ "label": "CL", "color": "blue" }]
}

${roastCalibration(roastLevel)}

Mode:
- chat: answer directly in character
- diagnostic: ask 2–4 precise questions, then one action
- script: structure content (hook, outline, one action)
`.trim();

    const convo = messages
      .filter(
        m =>
          m &&
          typeof m === "object" &&
          typeof m.role === "string" &&
          typeof m.content === "string"
      )
      .map(m => ({ role: m.role, content: m.content }));

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...convo]
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw, tags: [] };
    }

    res.json({
      reply: String(parsed.reply ?? ""),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 5).map(t => ({
            label: String(t.label ?? "").slice(0, 40),
            color: t.color === "green" || t.color === "blue" ? t.color : ""
          }))
        : []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "LLM proxy failed" });
  }
});

/* ===============================
   Boot
   =============================== */

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("API listening on", port);
});
