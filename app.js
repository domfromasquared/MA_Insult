(() => {
  // Paste either:
  // "https://your-app.onrender.com"
  // OR "https://your-app.onrender.com/api/chat"
  const RENDER_API_URL = "https://ma-insult.onrender.com/";

  const logEl = document.getElementById("log");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const statusEl = document.getElementById("status");
  const toneEl = document.getElementById("tone");
  const phoneEl = document.getElementById("phone");

  statusEl.textContent = "Ver. 1.4";

  if (!logEl || !form || !input || !sendBtn || !statusEl || !toneEl || !phoneEl) {
    console.error("Missing DOM nodes. Check IDs in index.html.");
    return;
  }

  const messages = [];
  const safe = (s) => String(s ?? "");

  // ===== Viewport stability (kills iOS address bar jumps) =====
  function setAppHeight() {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  }
  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 50));

  // Prevent page-level bounce/overscroll (allow scroll only inside thread)
  document.addEventListener(
    "touchmove",
    (e) => {
      const inThread = e.target && e.target.closest && e.target.closest("#log");
      if (!inThread) e.preventDefault();
    },
    { passive: false }
  );

  function normalizeEndpoint(raw) {
    let url = safe(raw).trim();
    url = url.replace(/\/+$/, "");
    if (!/\/api\/chat$/i.test(url)) url += "/api/chat";
    return url;
  }
  const ENDPOINT = normalizeEndpoint(RENDER_API_URL);

  function setStatus(s) {
    statusEl.textContent = s;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      logEl.scrollTop = logEl.scrollHeight;
    });
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.slice(0, 5).map((t) => ({
      label: safe(t?.label).slice(0, 40),
      color: t?.color === "green" || t?.color === "blue" ? t.color : "",
    }));
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
      tags.forEach((t) => {
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

  // Auto-resize composer (iMessage-ish)
  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  }
  input.addEventListener("input", autoResize);

  // Send on Enter (but allow Shift+Enter for newline)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  async function callBackend() {
    const payload = {
      messages,
      toneMode: toneEl.value,
    };

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      throw new Error(`Network error (likely CORS/blocked): ${networkErr?.message || networkErr}`);
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Backend returned non-JSON: ${text.slice(0, 300)}`);
    }

    return { reply: safe(data?.reply ?? ""), tags: normalizeTags(data?.tags) };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    autoResize();

    messages.push({ role: "user", content: text });
    addBubble("user", text);

    sendBtn.disabled = true;
    input.disabled = true;
    toneEl.disabled = true;
    setStatus("Distilling…");

    try {
      const { reply, tags } = await callBackend();
      messages.push({ role: "assistant", content: reply });
      addBubble("assistant", reply, { tags });
      setStatus("Ready.");
    } catch (err) {
      console.error(err);
      addBubble(
        "assistant",
        "Proxy failed. Check Render /health, ALLOWED_ORIGIN, and OPENAI_API_KEY.",
        { tags: [{ label: "TR", color: "green" }] }
      );
      setStatus("Error.");
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      toneEl.disabled = false;
      setTimeout(scrollToBottom, 50);
    }
  });

  // Opening message
  addBubble(
    "assistant",
    "Alright. What are we trying to make happen?\n" +
      "Who’s it for?\n" +
      "And what have you tried so far?\n\n" +
      "Bring vibes if you want.\n" +
      "I’ll translate them into something measurable.",
    { tags: [{ label: "CL", color: "blue" }, { label: "ME", color: "green" }] }
  );

  setStatus("Ready.");
})();
