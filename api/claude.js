export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  const STRUCTURE_ENFORCER = `
CRITICAL OUTPUT RULES - FOLLOW EXACTLY:
1. Every section must have minimum 4-6 sentences. No short paragraphs.
2. Every recommendation must include: WHAT to do, HOW to do it specifically, and WHY it works for this project.
3. Never write vague lines like "build community" or "create content". Name the exact tactic, platform, and mechanic.
4. For every growth tactic, include a concrete example of how it looks in practice for this specific project.
5. For competitor analysis, name real projects or companies. Describe what they do well and where they fall short.
6. For content ideas, give the actual title or angle, the format, and the reason it works.
7. For the 30-day roadmap, give specific tasks under each week, not just themes.
8. When listing items, put each one on its own line starting with a number and period e.g. "1. First item".
9. Be unconventional. If your advice sounds generic, rewrite it.
10. Minimum 150 words per section.
`;

  try {
    const body = req.body;
    const groqMessages = [];

    const systemContent = body.system
      ? body.system + "\n\n" + STRUCTURE_ENFORCER
      : STRUCTURE_ENFORCER;

    groqMessages.push({ role: "system", content: systemContent });

    for (const msg of body.messages || []) {
      groqMessages.push({ role: msg.role, content: msg.content });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: body.max_tokens || 6000,
        temperature: 0.8,
        messages: groqMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Groq error" });
    }

    return res.status(200).json({
      content: [{ type: "text", text: data.choices?.[0]?.message?.content || "" }],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}