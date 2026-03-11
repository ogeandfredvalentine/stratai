export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Convert Anthropic message format to Groq/OpenAI format
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
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: body.max_tokens || 1500,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "Groq API error" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert Groq response back to Anthropic format so the frontend works as-is
    const converted = {
      content: [
        {
          type: "text",
          text: data.choices?.[0]?.message?.content || "",
        },
      ],
    };

    return new Response(JSON.stringify(converted), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}