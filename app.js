
(() => {
  // Paste either:
  // "https://your-app.onrender.com"
  // OR "https://your-app.onrender.com/api/chat"
  const RENDER_API_URL = "https://ma-insult.onrender.com/";

  const phoneEl = document.getElementById("phone");
  const logEl = document.getElementById("log");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const statusEl = document.getElementById("status");
  const roastEl = document.getElementById("roast");
  const roastLabel = document.getElementById("roastLabel");
  const modeEl = document.getElementById("mode");

  if (!phoneEl || !logEl || !form || !input || !sendBtn || !statusEl || !roastEl || !roastLabel || !modeEl) {
    console.error("Missing DOM nodes. Check IDs in index.html.");
    return;
  }

  // ===== Viewport stability (kills iOS address bar jumps) =====
  function setAppHeight() {
    const h = window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }
  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 50));

  // Prevent page-level bounce/overscroll (allow scroll only inside log)
  document.addEventListener("touchmove", (e) => {
    const inThread = e.target && e.target.closest && e.target.closest("#log");
    if (!inThread) e.preventDefault();
  }, { passive: false });

  // ===== State =====
  const messages = [];
  let inFlight = false;

  const safe = (s) => String(s ?? "");

  function normalizeEndpoint(raw) {
    let url = safe(raw).trim();
    if (!url) return "";
    url = url.replace(/\/+$/, "");
    if (!/\/api\/chat$/i.test(url)) url += "/api/chat";
    return url;
  }
  const ENDPOINT = normalizeEndpoint(RENDER_API_URL);

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.slice(0, 5).map(t => ({
      label: safe(t?.label).slice(0, 40),
      color: (t?.color === "green" || t?.color === "blue") ? t.color : ""
    }));
  }

  function setBusy(b) {
    inFlight = b;
    sendBtn.disabled = b;
    input.disabled = b;
    roastEl.disabled = b;
    modeEl.disabled = b;
  }

  function setStatus(s) {
    statusEl.textContent = s;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      logEl.scrollTop = logEl.scrollHeight;
    });
  }

  function pushMessage(role, content) {
    messages.push({ role, content: safe(content) });
  }

  function addBubble(role, text, meta = {}) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "assistant");

    if (role === "assistant") {
      const avatar = document.createElement("img");
      avatar.className = "mini-avatar";
      avatar.src = "assets/MA.png";
      avatar.alt = "MA";
      row.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "user" : "assistant");
    bubble.textContent = safe(text);

    const tags = normalizeTags(meta.tags);
    if (tags.length) {
      const metaEl = document.createElement("div");
      metaEl.className = "meta";
      tags.forEach(t => {
        const tag = document.createElement("span");
        tag.className = "tag " + (t.color || "");
        tag.textContent = t.label;
        metaEl.appendChild(tag);
      });
      bubble.appendChild(metaEl);
    }

    row.appendChild(bubble);
    logEl.appendChild(row);
    scrollToBottom();
  }

  function checkEndpoint() {
    if (!RENDER_API_URL || RENDER_API_URL.includes("PASTE_YOUR_RENDER_LINK_HERE")) {
      addBubble("assistant",
        "Paste your Render endpoint into app.js.\nExample:\nhttps://your-app.onrender.com",
        { tags: [{ label: "CL", color: "blue" }] }
      );
      setStatus("Set RENDER_API_URL in app.js.");
      return false;
    }
    if (!/^https?:\/\//i.test(RENDER_API_URL)) {
      addBubble("assistant",
        "That endpoint isn’t a URL. It must start with https://",
        { tags: [{ label: "CL", color: "blue" }] }
      );
      setStatus("Invalid RENDER_API_URL.");
      return false;
    }
    return true;
  }

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

  // Auto-resize composer (iMessage-ish), capped
  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }
  input.addEventListener("input", autoResize);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    if (!checkEndpoint()) return;

    input.value = "";
    autoResize();

    pushMessage("user", text);
    addBubble("user", text);

    setBusy(true);
    setStatus("Distilling…");

    try {
      const { reply, tags } = await callBackend();
      pushMessage("assistant", reply);
      addBubble("assistant", reply, { tags });
      setStatus("Ready.");
    } catch (err) {
      console.error(err);
      addBubble("assistant",
        "Proxy failed.\nCheck:\n1) POST /api/chat\n2) CORS origin\n3) OPENAI_API_KEY on Render",
        { tags: [{ label: "TR", color: "green" }] }
      );
      setStatus("Error. Check Render logs.");
    } finally {
      setBusy(false);
      setTimeout(scrollToBottom, 50);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ✅ Updated opening line (your requested change)
  addBubble(
    "assistant",
    "Tell me three things:\n" +
      "your goal,\n" +
      "your audience,\n" +
      "and what you already tried.\n\n" +
      "You can bring vibes.\n" +
      "I’ll translate them into marketing.\n\n" +
      "CL.\n" +
      "Then ME.",
    { tags: [{ label: "CL", color: "blue" }, { label: "ME", color: "green" }] }
  );

  setStatus("Ready.");
})();})();