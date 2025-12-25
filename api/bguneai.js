import fetch from "node-fetch";

const AI = {
  chat: "https://api-faa.my.id/faa/chatai",
  bard: "https://api-faa.my.id/faa/bard-google",
  epsilon: "https://api-faa.my.id/faa/epsilon-ai",
  flux: "https://api-faa.my.id/faa/fluxai",
  sora: "https://api-faa.my.id/faa/sora",
  veo: "https://api-faa.my.id/faa/veo3"
};

function detectIntent(text) {
  text = text.toLowerCase();
  if (/gambar|foto|visual/.test(text)) return "image";
  if (/video|film/.test(text)) return "video";
  if (/riset|sumber/.test(text)) return "research";
  return "general";
}

function planAI(intent, mode) {
  if (mode === "fast") return ["chat"];
  if (mode === "creative") return ["bard"];
  if (mode === "deep") return ["chat", "epsilon"];

  if (intent === "image") return ["flux"];
  if (intent === "video") return ["sora"];
  if (intent === "research") return ["epsilon"];

  return ["chat", "bard"];
}

async function callAI(url, prompt) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  return await res.json();
}

export default async function handler(req, res) {
  const { q, mode = "auto", ai, raw } = req.query;

  if (!q) return res.json({ error: "Query 'q' wajib diisi" });

  // MODE MANUAL
  if (mode === "manual") {
    if (!AI[ai]) return res.json({ error: "AI tidak valid" });

    const data = await callAI(AI[ai], q);
    return res.json(raw ? data : {
      ai: "BguneAI",
      used_ai: ai,
      result: data
    });
  }

  // AUTO MODE
  const intent = detectIntent(q);
  const plan = planAI(intent, mode);
  const results = [];

  for (const p of plan) {
    const r = await callAI(AI[p], q);
    if (r) results.push(r.text || r.result);
  }

  const final = results.join("\n\n—\n\n");

  res.json(raw ? final : {
    ai: "BguneAI",
    mode,
    intent,
    used_models: plan,
    result: final
  });
}