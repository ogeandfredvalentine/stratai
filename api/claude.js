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

    if (body.system) {
      messages.push({ role: "system", content: body.system });
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
        max_tokens: body.max_tokens || 1500,
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