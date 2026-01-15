(() => {
  const RENDER_API_URL = "https://ma-insult.onrender.com/";

  const logEl = document.getElementById("log");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const statusEl = document.getElementById("status");
  const toneEl = document.getElementById("tone");

  statusEl.textContent = "JS loaded ✅";

  const messages = [];
  const safe = (s) => String(s ?? "");

  function normalizeEndpoint(raw) {
    let url = safe(raw).replace(/\/+$/, "");
    if (!/\/api\/chat$/i.test(url)) url += "/api/chat";
    return url;
  }
  const ENDPOINT = normalizeEndpoint(RENDER_API_URL);

  function addBubble(role, text, meta = {}) {
    const row = document.createElement("div");
    row.className = "row " + role;

    if (role === "assistant") {
      const img = document.createElement("img");
      img.src = "assets/MA.png";
      img.className = "mini-avatar";
      row.appendChild(img);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble " + role;
    bubble.textContent = safe(text);

    if (meta.tags?.length) {
      const metaEl = document.createElement("div");
      metaEl.className = "meta";
      meta.tags.forEach(t => {
        const tag = document.createElement("span");
        tag.className = "tag " + (t.color || "");
        tag.textContent = t.label;
        metaEl.appendChild(tag);
      });
      bubble.appendChild(metaEl);
    }

    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function callBackend() {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        toneMode: toneEl.value
      })
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    messages.push({ role: "user", content: text });
    addBubble("user", text);

    sendBtn.disabled = true;
    statusEl.textContent = "Distilling…";

    try {
      const data = await callBackend();
      messages.push({ role: "assistant", content: data.reply });
      addBubble("assistant", data.reply, data);
      statusEl.textContent = "Ready.";
    } catch (err) {
      addBubble("assistant", "Proxy failed. Check Render.");
      statusEl.textContent = "Error.";
    } finally {
      sendBtn.disabled = false;
    }
  });

  addBubble(
    "assistant",
    ""Alright. What are we trying to make happen?\n" +
"Who’s it for?\n" +
"And what have you tried so far?\n\n" +
"If you give me vibes, I’ll translate them into something measurable."",
    { tags: [{ label: "CL", color: "blue" }, { label: "ME", color: "green" }] }
  );
})();