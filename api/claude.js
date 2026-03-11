async function fetchWebsite(url) {
  if (!url) return null;
  try {
    // Normalize URL
    if (!url.startsWith("http")) url = "https://" + url;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StratAI/1.0; +https://stratai.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Strip HTML tags, scripts, styles down to readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Return first 3000 chars - enough to understand the site
    return text.slice(0, 3000);
  } catch (err) {
    return null;
  }
}

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
5. For competitor analysis, name REAL, ACTUAL competitors in the same space. Do not name unrelated projects.
6. For content ideas, give the actual title or angle, the specific format, and the reason it works.
7. For the 30-day roadmap, give specific tasks under each week, not just themes.
8. When listing items, put each one on its own line starting with a number and period e.g. "1. First item".
9. ANTI-GENERIC CHECK: Before writing each section, ask yourself - would a lazy consultant write this? If yes, delete it and start over with something that would surprise a 10-year Web3 veteran.
10. Think cross-industry. What tactics from gaming, creator economy, fintech, or cult brands apply here that no Web3 advisor would suggest?
11. Minimum 150 words per section.
12. ACCURACY RULE: Only state facts that are grounded in the website content or user-provided fields. If you are inferring, use "appears to" or "likely". Never fabricate team details, metrics, or product features.
`;

  try {
    const body = req.body;

    // Fetch website if URL provided and this is an analyzer request
    let websiteContent = null;
    if (body.websiteUrl) {
      websiteContent = await fetchWebsite(body.websiteUrl);
    }

    const groqMessages = [];

    let systemContent = STRUCTURE_ENFORCER;
    if (body.system) systemContent = body.system + "\n\n" + STRUCTURE_ENFORCER;

    // Inject website content into system if available
    if (websiteContent) {
      systemContent += `\n\nWEBSITE CONTENT (scraped live from ${body.websiteUrl}):\n"""\n${websiteContent}\n"""\nUse this to ground your analysis in what the project actually says about itself.`;
    }

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
        model: "openai/gpt-oss-120b",
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
      websiteFetched: !!websiteContent,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}