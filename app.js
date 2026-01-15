/* app.js — Marketing Alchemist Roast Chat (GitHub Pages)
   - Static frontend (GitHub Pages)
   - Calls your Render proxy (API key stays server-side)
   - ONLY EDIT: RENDER_API_URL (base or full /api/chat)
*/

(() => {
  // ✅ Paste either:
  // - "https://your-app.onrender.com"
  // - "https://your-app.onrender.com/api/chat"
  const RENDER_API_URL = "https://ma-insult.onrender.com"; // <-- your current value

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
  const messages = [];
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

  function scrollLogToBottom() {
    // rAF ensures DOM has painted before scrolling
    requestAnimationFrame(() => {
      logEl.scrollTop = logEl.scrollHeight;
    });
  }

  function normalizeEndpoint(raw) {
    let url = safe(raw).trim();
    if (!url) return "";
    // remove trailing slash
    url = url.replace(/\/+$/, "");
    // If they pasted base domain, append /api/chat
    if (!/\/api\/chat$/i.test(url)) url += "/api/chat";
    return url;
  }

  const ENDPOINT = normalizeEndpoint(RENDER_API_URL);

  function checkRenderUrl() {
    if (!RENDER_API_URL || RENDER_API_URL.includes("PASTE_YOUR_RENDER_LINK_HERE")) {
      addMessageToLog(
        "assistant",
        "Your experiment is missing a reagent.\n\nPaste your Render endpoint into RENDER_API_URL in app.js.\nExample:\nhttps://your-app.onrender.com (or /api/chat)",
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
    scrollLogToBottom();
  }

  // ---- Network ----
  async function callBackend() {
    const payload = {
      messages,
      roastLevel: Number(roastEl.value),
      mode: modeEl.value
    };

    const res = await fetch(ENDPOINT, {
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

  // ---- Mobile UX: auto-resize textarea (keeps it from hijacking the screen) ----
  function autoResizeTextarea() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }
  input.addEventListener("input", autoResizeTextarea);

  async function handleSend(userText) {
    if (inFlight) return;
    if (!checkRenderUrl()) return;

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
    autoResizeTextarea();
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

  setStatus("Ready. (Mobile: no page scroll. Only the log scrolls.)");
})();
