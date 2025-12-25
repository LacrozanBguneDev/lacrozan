// BguneAI Ultra Core
// Creator: Muhammad Irham Andika Putra
// Owner: Tuan Irham

export default async function handler(req, res) {
  try {
    const q = req.query.q;
    const mode = req.query.mode || "auto";
    const ai = req.query.ai;
    const raw = req.query.raw === "true";

    if (!q) {
      return res.status(400).json({
        error: "Query 'q' wajib diisi",
        contoh: "/api/bguneai?q=halo"
      });
    }

    // ==============================
    // AI ENDPOINT POOL
    // ==============================
    const AI = {
      chat: "https://api-faa.my.id/faa/chatai",
      bard: "https://api-faa.my.id/faa/bard-google",
      epsilon: "https://api-faa.my.id/faa/epsilon-ai",
      flux: "https://api-faa.my.id/faa/fluxai",
      sora: "https://api-faa.my.id/faa/sora",
      veo: "https://api-faa.my.id/faa/veo3"
    };

    // ==============================
    // INTENT DETECTOR
    // ==============================
    const detectIntent = (text) => {
      text = text.toLowerCase();
      if (/gambar|foto|visual|desain/.test(text)) return "image";
      if (/video|film|cinematic/.test(text)) return "video";
      if (/riset|penelitian|sumber|ilmiah/.test(text)) return "research";
      return "general";
    };

    // ==============================
    // STRATEGI CERDAS
    // ==============================
    const planAI = (intent, mode) => {
      if (mode === "fast") return ["chat"];
      if (mode === "creative") return ["bard"];
      if (mode === "deep") return ["chat", "epsilon"];

      if (intent === "image") return ["flux"];
      if (intent === "video") return ["sora"];
      if (intent === "research") return ["epsilon"];

      return ["chat", "bard"];
    };

    // ==============================
    // SAFE FETCH (ANTI ERROR)
    // ==============================
    const callAI = async (url, prompt) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: prompt })
        });

        const data = await r.json();

        // UNIVERSAL PARSER
        if (typeof data === "string") return data;
        if (data.result) return data.result;
        if (data.text) return data.text;
        if (data.answer) return data.answer;
        if (data.message) return data.message;
        if (data.data) return JSON.stringify(data.data);

        return JSON.stringify(data);
      } catch (e) {
        return null;
      }
    };

    // ==============================
    // MODE MANUAL
    // ==============================
    if (mode === "manual") {
      if (!AI[ai]) {
        return res.json({ error: "AI tidak valid" });
      }

      const result = await callAI(AI[ai], q);

      return res.json({
        ai: "BguneAI",
        creator: "Muhammad Irham Andika Putra",
        owner: "Tuan Irham",
        used_ai: ai,
        result
      });
    }

    // ==============================
    // MODE CERDAS (AUTO)
    // ==============================
    const intent = detectIntent(q);
    const plan = planAI(intent, mode);
    const results = [];

    for (const model of plan) {
      const out = await callAI(AI[model], q);
      if (out) results.push(out);
    }

    return res.json({
      ai: "BguneAI",
      version: "ULTRA",
      creator: "Muhammad Irham Andika Putra",
      owner: "Tuan Irham",
      mode,
      intent,
      used_models: plan,
      result: results.join("\n\n—\n\n"),
      status: "ONLINE",
      confidence: "0.99"
    });

  } catch (err) {
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: err.message
    });
  }
}