export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY environment variable is not set" });
  }

  try {
    const body = req.body;
    const messages = [];

    const structureEnforcer = `
CRITICAL OUTPUT RULES - FOLLOW EXACTLY OR YOUR RESPONSE IS WRONG:

1. Every section must have a minimum of 4-6 sentences. No short paragraphs.
2. Every recommendation must include: WHAT to do, HOW to do it specifically, and WHY it works for this project.
3. Never write vague lines like "build community" or "create content". Name the exact tactic, the exact platform, the exact mechanic.
4. For every growth tactic, include a concrete example of how it would look in practice for this specific project.
5. For competitor analysis, name real projects or companies. Describe specifically what they do well and where they fall short.
6. For content ideas, give the actual title or angle, the format (thread, video, AMA, etc.), and the reason it works.
7. For the 30-day roadmap, give specific tasks under each week — not just themes.
8. Write in clear flowing paragraphs. No bullet points. No lazy one-liners.
9. Be unconventional. If your advice sounds generic, rewrite it.
10. Minimum 150 words per section.
`;

    if (body.system) {
      messages.push({ role: "system", content: body.system + "\n\n" + structureEnforcer });
    } else {
      messages.push({ role: "system", content: structureEnforcer });
    }

    for (const msg of body.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 6000,
        temperature: 0.8,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Groq API error" });
    }

    const converted = {
      content: [
        {
          type: "text",
          text: data.choices?.[0]?.message?.content || "",
        },
      ],
    };

    return res.status(200).json(converted);

  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
}