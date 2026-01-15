/* app.js — Marketing Alchemist Roast Chat (GitHub Pages)
   - Static frontend (GitHub Pages)
   - Calls your Render proxy (API key stays server-side)
   - ONLY EDIT: RENDER_API_URL
*/

(() => {
  // ✅ ONLY THING YOU EDIT:
  // Example: "https://my-alchemist-proxy.onrender.com/api/chat"
  const RENDER_API_URL = "PASTE_YOUR_RENDER_LINK_HERE";

  // ---- DOM ----
  const logEl = document.getElementById("log");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const statusEl = document.getElementById("status");
  const roastEl = document.getElementById("roast");
  const roastLabel = document.getElementById("roastLabel");
  const modeEl = document.getElementById("mode");

  if (!logEl || !form || !input || !sendBtn || !statusEl || !roastEl || !roastLabel || !modeEl) {
    console.error("Missing required DOM nodes. Check element IDs in index.html.");
    return;
  }

  // ---- State ----
  const messages = []; // [{role, content}]
  let inFlight = false;

  // ---- Helpers ----
  const safe = (s) => String(s ?? "");

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setBusy(busy) {
    inFlight = busy;
    sendBtn.disabled = busy;
    roastEl.disabled = busy;
    modeEl.disabled = busy;
    input.disabled = busy;
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.slice(0, 5).map((t) => ({
      label: safe(t?.label).slice(0, 40),
      color: (t?.color === "green" || t?.color === "blue") ? t.color : ""
    }));
  }

  function pushMessage(role, content) {
    messages.push({ role, content: safe(content) });
  }

  function checkRenderUrl() {
    if (!RENDER_API_URL || RENDER_API_URL.includes("PASTE_YOUR_RENDER_LINK_HERE")) {
      addMessageToLog(
        "assistant",
        "Your experiment is missing a reagent.\n\nPaste your Render endpoint into RENDER_API_URL in app.js.\nExample:\nhttps://your-app.onrender.com/api/chat",
        { tags: [{ label: "CL: missing endpoint", color: "blue" }] }
      );
      setStatus("Set your Render endpoint in app.js (RENDER_API_URL).");
      return false;
    }
    if (!/^https?:\/\//i.test(RENDER_API_URL)) {
      addMessageToLog(
        "assistant",
        "That endpoint isn’t a URL. It’s a wish.\n\nRENDER_API_URL must start with http:// or https://",
        { tags: [{ label: "CL: invalid URL", color: "blue" }] }
      );
      setStatus("Invalid RENDER_API_URL.");
      return false;
    }
    return true;
  }

  // ---- UI rendering ----
  function addMessageToLog(role, text, meta = {}) {
    const row = document.createElement("div");
    row.className = "msg";

    // Avatar: user = text block, assistant = image
    let avatar;
    if (role === "assistant") {
      avatar = document.createElement("img");
      avatar.src = "assets/MA.png";
      avatar.alt = "Marketing Alchemist";
      avatar.className = "avatar-img";
    } else {
      avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = "YOU";
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    metaEl.textContent =
      role === "user"
        ? `You • ${nowTime()}`
        : `Marketing Alchemist • ${nowTime()}`;

    const textEl = document.createElement("div");
    textEl.className = "text";
    textEl.textContent = safe(text);

    bubble.appendChild(metaEl);
    bubble.appendChild(textEl);

    const tags = normalizeTags(meta.tags);
    if (tags.length) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "tags";
      tags.forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "tag " + (t.color || "");
        tag.textContent = t.label;
        tagsEl.appendChild(tag);
      });
      bubble.appendChild(tagsEl);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---- Network ----
  async function callBackend() {
    const payload = {
      messages,
      roastLevel: Number(roastEl.value),
      mode: modeEl.value
    };

    const res = await fetch(RENDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText || "Request failed"}`);
    }

    const data = await res.json();
    return {
      reply: safe(data?.reply ?? "(no reply)"),
      tags: normalizeTags(data?.tags)
    };
  }

  async function handleSend(userText) {
    if (inFlight) return;
    if (!checkRenderUrl()) return;

    // Store + render user message
    pushMessage("user", userText);
    addMessageToLog("user", userText);

    setBusy(true);
    setStatus("Distilling… (No rituals. Just causality.)");

    try {
      const { reply, tags } = await callBackend();
      pushMessage("assistant", reply);
      addMessageToLog("assistant", reply, { tags });
      setStatus("Ready.");
    } catch (err) {
      console.error(err);

      const msg =
        "Your proxy just face-planted.\n" +
        "Good. Now we have data.\n\n" +
        "Check:\n" +
        "1) Render route is POST /api/chat\n" +
        "2) CORS allows your GitHub Pages origin\n" +
        "3) Render env has OPENAI_API_KEY set\n";

      pushMessage("assistant", msg);
      addMessageToLog("assistant", msg, { tags: [{ label: "TR: fix the route", color: "green" }] });
      setStatus("Error calling backend. Check CORS / route / logs.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Events ----
  roastEl.addEventListener("input", () => {
    roastLabel.textContent = String(roastEl.value);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    handleSend(text);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ---- Boot ----
  addMessageToLog(
    "assistant",
    "State your goal, your audience, and what you already tried.\nIf you give me vibes, I will return them… charred.",
    { tags: [{ label: "CL: define the goal", color: "blue" }, { label: "ME: mechanism > magic", color: "green" }] }
  );

  setStatus("Paste your Render endpoint into RENDER_API_URL in app.js.");
})();
