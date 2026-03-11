import { useState, useRef, useEffect } from "react";

const G = {
  bg: "#050508", surface: "#0e0e14", surface2: "#13131c",
  border: "#1e1e2e", accent: "#7cffd4", text: "#e8e8f0",
  muted: "#4a4a6a", radius: 14,
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:4px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
`;

function cleanText(t) {
  return t.replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

async function askClaude(messages, system, maxTokens = 1500) {
  const body = { messages, max_tokens: maxTokens };
  if (system) body.system = system;
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  if (!text) throw new Error("Empty response");
  return cleanText(text);
}

function Spinner() {
  return <div style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${G.border}`, borderTopColor: G.accent, animation: "spin 0.75s linear infinite" }} />;
}

function Btn({ label, onClick, solid, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? "8px 14px" : "10px 18px", borderRadius: 10,
      border: `1px solid ${G.accent}`,
      background: solid ? G.accent : "transparent",
      color: solid ? "#000" : G.accent,
      fontFamily: "Outfit, sans-serif", fontWeight: 700,
      fontSize: small ? "0.71rem" : "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap", transition: "opacity 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {label}
    </button>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 50, padding: 4, gap: 4 }}>
      {[{ id: "analyzer", label: "Analyzer" }, { id: "chat", label: "Chat" }].map(m => (
        <button key={m.id} onClick={() => onChange(m.id)} style={{
          padding: "8px 20px", borderRadius: 50, border: "none",
          background: mode === m.id ? G.accent : "transparent",
          color: mode === m.id ? "#000" : G.muted,
          fontFamily: "Outfit, sans-serif", fontWeight: mode === m.id ? 700 : 500,
          fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s",
        }}>{m.label}</button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: G.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const baseInput = {
  width: "100%", background: G.surface2, border: `1px solid ${G.border}`,
  borderRadius: G.radius, padding: "11px 14px", color: G.text,
  fontFamily: "Outfit, sans-serif", fontSize: "0.87rem", outline: "none",
};

function TInput({ label, value, onChange, placeholder }) {
  const [f, setF] = useState(false);
  return (
    <Field label={label}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...baseInput, borderColor: f ? G.accent : G.border, transition: "border-color 0.2s" }}
        onFocus={() => setF(true)} onBlur={() => setF(false)} />
    </Field>
  );
}

function TArea({ label, value, onChange, placeholder, rows = 5 }) {
  const [f, setF] = useState(false);
  return (
    <Field label={label}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ ...baseInput, resize: "vertical", lineHeight: 1.6, borderColor: f ? G.accent : G.border, transition: "border-color 0.2s" }}
        onFocus={() => setF(true)} onBlur={() => setF(false)} />
    </Field>
  );
}

// ── ANALYZER ─────────────────────────────────────────────────────────────────

// Converts **bold** markdown into <strong> elements
function parseBold(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// Renders text with proper stacked lists and bold support
function renderContent(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const numbered = trimmed.match(/^(\d+[\.\)])\s+(.+)/);
        const bulleted = trimmed.match(/^[-*]\s+(.+)/);

        if (numbered) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <span style={{ flexShrink: 0, fontWeight: 700, color: G.accent }}>{numbered[1]}</span>
              <span>{parseBold(numbered[2])}</span>
            </div>
          );
        }
        if (bulleted) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <span style={{ flexShrink: 0, color: G.accent }}>-</span>
              <span>{parseBold(bulleted[1])}</span>
            </div>
          );
        }
        if (trimmed === "") return <div key={i} style={{ height: 8 }} />;
        return <p key={i} style={{ marginBottom: 8 }}>{parseBold(line)}</p>;
      })}
    </div>
  );
}

const SECTIONS = [
  { key: "PROJECT_SUMMARY",      label: "Project Summary",      icon: "◈" },
  { key: "TARGET_AUDIENCE",      label: "Target Audience",      icon: "◎" },
  { key: "MARKET_POSITIONING",   label: "Market Positioning",   icon: "◐" },
  { key: "COMPETITOR_ANALYSIS",  label: "Competitor Analysis",  icon: "⊕" },
  { key: "STRENGTHS",            label: "Strengths",            icon: "▲" },
  { key: "WEAKNESSES",           label: "Weaknesses",           icon: "▽" },
  { key: "GROWTH_OPPORTUNITIES", label: "Growth Opportunities", icon: "◆" },
  { key: "COMMUNITY_STRATEGY",   label: "Community Strategy",   icon: "◉" },
  { key: "CONTENT_STRATEGY",     label: "Content Strategy",     icon: "▣" },
  { key: "PARTNERSHIP_STRATEGY", label: "Partnership Strategy", icon: "⊗" },
  { key: "ROADMAP_30_DAY",       label: "30-Day Roadmap",       icon: "▶" },
];

const RULES = `RULES:
- Never use em dashes or en dashes. Use commas, colons, or plain hyphens only.
- No generic advice. "Post consistently" and "build community" are not advice. If you write either, delete it.
- Call out real problems bluntly. Weak tokenomics, confused positioning, fantasy roadmaps - name them.
- Every strategy must be unexpected and specific. What would a 10-year Web3 veteran find surprising?
- Think cross-industry: gaming, creator economy, fintech, cult brands. Import tactics nobody in Web3 is using.
- ANTI-GENERIC CHECK: Before writing each section, ask - would a lazy consultant write this? If yes, rewrite it.`;

function projectContext(p, wp) {
  return `PROJECT:
- Name: ${p.name}
- Website: ${p.website || "Not provided"}
- Twitter/X: ${p.twitter || "Not provided"}
- What it does: ${p.what}
- Team & background: ${p.team || "Not provided - do not fabricate team details"}
- Traction & metrics: ${p.traction || "Not provided - do not fabricate numbers or achievements"}
- Tech stack & product: ${p.tech || "Not provided"}
- Known competitors: ${p.competitors || "Not provided"}
${wp ? `- Whitepaper:\n${wp.slice(0, 4000)}` : ""}

IMPORTANT: Only state facts the user has provided above. If a field says "Not provided", do not invent details for it. For Strengths and Weaknesses especially, base your analysis only on what is stated here. If you are inferring something, say "appears to" or "likely" rather than stating it as fact.`;
}

function buildPrompt1(p, wp) {
  return `You are a contrarian Web3 growth strategist. You find what is actually broken and prescribe strategies most advisors would never suggest.

${RULES}

${projectContext(p, wp)}

CRITICAL INSTRUCTION: You MUST begin your response with the exact text ===REPORT_START=== and end with ===PART1_END===. Do not write anything before ===REPORT_START=== or after ===PART1_END===.

===REPORT_START===

##PROJECT_SUMMARY##
[Honest read of what this project actually is. Not their marketing. 3-5 sentences.]

##TARGET_AUDIENCE##
[Who actually wants this. Define by behavior and identity. Name subcultures and platforms where they gather.]

##MARKET_POSITIONING##
[The narrative this project should own that nobody else has claimed. The contrarian angle.]

##COMPETITOR_ANALYSIS##
[3-5 real competitors. What they are actually good at, what they are failing at, the specific gap to exploit.]

##STRENGTHS##
[4-6 genuine strengths. What is structurally hard to copy? What unfair advantages are being underused?]

##WEAKNESSES##
[3-5 brutal honest weaknesses. What would a skeptical investor attack?]

===PART1_END===`;
}

function buildPrompt2(p, wp) {
  return `You are a contrarian Web3 growth strategist. You find what is actually broken and prescribe strategies most advisors would never suggest.

${RULES}

${projectContext(p, wp)}

CRITICAL INSTRUCTION: You MUST begin your response with the exact text ===PART2_START=== and end with ===REPORT_END===. Do not write anything before ===PART2_START=== or after ===REPORT_END===.

===PART2_START===

##GROWTH_OPPORTUNITIES##
[3-5 unconventional growth levers. Distribution hacks, audience arbitrage, underpriced channels. Explain why each works.]

##COMMUNITY_STRATEGY##
[Specific community architecture. Who the core 100 believers are, how to recruit them, what rituals create belonging.]

##CONTENT_STRATEGY##
[6-8 creative content plays. Each with a clear angle, specific format, and reason it works.]

##PARTNERSHIP_STRATEGY##
[3-5 non-obvious partnership plays. Name specific targets and the exchange of value.]

##ROADMAP_30_DAY##
[Week 1 - Foundation: 3 things to fix immediately
Week 2 - Activation: first public move and why it spreads
Week 3 - Amplification: pour fuel on what is working
Week 4 - Review: what signal to look for and what to scale]

===REPORT_END===`;
}

function parseSections(body) {
  const result = {};
  SECTIONS.forEach((sec, i) => {
    const tag = `##${sec.key}##`;
    const nextTag = SECTIONS[i + 1] ? `##${SECTIONS[i + 1].key}##` : null;
    const from = body.indexOf(tag);
    if (from === -1) return;
    const start = from + tag.length;
    const end = nextTag ? body.indexOf(nextTag) : body.length;
    result[sec.key] = body.slice(start, end === -1 ? undefined : end).trim();
  });
  return result;
}

function parseReport(raw1, raw2) {
  // Extract body from part 1
  const s1 = raw1.search(/={3}REPORT_START={3}/);
  const e1 = raw1.search(/={3}PART1_END={3}/);
  const body1 = (s1 !== -1 && e1 !== -1) ? raw1.slice(s1 + 18, e1).trim() : raw1;

  // Extract body from part 2
  const s2 = raw2.search(/={3}PART2_START={3}/);
  const e2 = raw2.search(/={3}REPORT_END={3}/);
  const body2 = (s2 !== -1 && e2 !== -1) ? raw2.slice(s2 + 14, e2).trim() : raw2;

  const combined = body1 + "\n\n" + body2;
  const result = parseSections(combined);
  return Object.keys(result).length > 3 ? result : null;
}

function ReportView({ report, project, onReset }) {
  const [active, setActive] = useState(SECTIONS[0].key);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const t = `WEB3 GROWTH STRATEGY: ${project.name}\n\n` +
      SECTIONS.filter(s => report[s.key]).map(s => `${s.label.toUpperCase()}\n${"-".repeat(34)}\n${report[s.key]}`).join("\n\n");
    navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${project.name} - Growth Strategy</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Georgia&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Georgia,serif;max-width:740px;margin:0 auto;color:#111;padding:48px 32px}
      .brand-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;padding-bottom:20px;border-bottom:3px solid #7cffd4}
      .brand-name{font-family:'Outfit',sans-serif;font-weight:800;font-size:1.1rem;letter-spacing:-0.02em;color:#050508}
      .brand-name span{color:#059669}
      .brand-tag{font-family:'Outfit',sans-serif;font-size:0.68rem;color:#888;text-transform:uppercase;letter-spacing:0.1em}
      .report-title{font-family:'Outfit',sans-serif;font-size:2rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:6px;color:#050508}
      .meta{color:#777;font-size:0.82rem;margin-bottom:36px;padding-bottom:16px;border-bottom:1px solid #eee}
      h2{font-family:'Outfit',sans-serif;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;background:#7cffd4;color:#000;padding:5px 12px;display:inline-block;margin:32px 0 12px;font-weight:700}
      p{line-height:1.9;color:#333;white-space:pre-wrap;font-size:0.91rem}
      .footer{margin-top:56px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
      .footer-brand{font-family:'Outfit',sans-serif;font-weight:700;font-size:0.75rem;color:#333}
      .footer-brand span{color:#059669}
      .footer-note{font-size:0.7rem;color:#aaa}
    </style></head><body>
    <div class="brand-header">
      <div>
        <div class="brand-name">Fredrick Strategy <span>Lab</span></div>
        <div class="brand-tag">Growth & Brand Architecture</div>
      </div>
      <div class="brand-tag">${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
    <div class="report-title">Web3 Growth Strategy</div>
    <p class="meta">Project: <strong>${project.name}</strong>${project.website ? ` &nbsp; ${project.website}` : ""}${project.twitter ? ` &nbsp; ${project.twitter}` : ""}</p>
    ${SECTIONS.filter(s => report[s.key]).map(s => `<h2>${s.label}</h2><p>${report[s.key]}</p>`).join("")}
    <div class="footer">
      <div class="footer-brand">Fredrick Strategy <span>Lab</span></div>
      <div class="footer-note">Prepared by StratAI - AI Growth Strategist</div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
  };

  const activeSec = SECTIONS.find(s => s.key === active);
  return (
    <div style={{ animation: "fadeUp 0.35s ease", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 4 }}>Strategy Report Ready</div>
          <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>{project.name}</div>
          {project.website && <div style={{ fontSize: "0.75rem", color: G.muted, marginTop: 2 }}>{project.website}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn label={copied ? "Copied" : "Copy All"} onClick={copy} solid small />
          <Btn label="Print / PDF" onClick={print} small />
          <Btn label="New Analysis" onClick={onReset} small />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, minHeight: 500 }}>
        <div style={{ width: 190, flexShrink: 0, background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "10px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map(sec => (
            <button key={sec.key} onClick={() => setActive(sec.key)} style={{
              width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer",
              background: active === sec.key ? `${G.accent}14` : "transparent",
              borderLeft: `2px solid ${active === sec.key ? G.accent : "transparent"}`,
              color: active === sec.key ? G.accent : G.muted,
              fontFamily: "Outfit, sans-serif", fontSize: "0.76rem",
              fontWeight: active === sec.key ? 600 : 400,
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ opacity: 0.7 }}>{sec.icon}</span>{sec.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "22px", overflowY: "auto" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{activeSec?.icon}</span>{activeSec?.label}
          </div>
          {(active === "STRENGTHS" || active === "WEAKNESSES" || active === "PROJECT_SUMMARY") && (
            <div style={{ background: "#7cffd408", border: "1px solid #7cffd422", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.7rem", color: G.muted, lineHeight: 1.5 }}>
              <span style={{ color: G.accent }}>AI inference</span> - These findings are based only on information you provided. Verify before sharing externally.
            </div>
          )}
          <div key={active} style={{ fontSize: "0.89rem", lineHeight: 1.85, color: "#ccc", animation: "fadeIn 0.2s ease" }}>
            {renderContent(report[active] || "No content for this section.")}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyzerMode() {
  const [step, setStep] = useState("form");
  const [project, setProject] = useState({ name: "", website: "", twitter: "", what: "", team: "", traction: "", tech: "", competitors: "" });
  const [wpText, setWpText] = useState("");
  const [wpName, setWpName] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const set = k => v => setProject(p => ({ ...p, [k]: v }));

  const handleFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setWpName(f.name);
    const r = new FileReader();
    r.onload = ev => setWpText(ev.target.result || "");
    r.onerror = () => setWpText("");
    r.readAsText(f);
  };

  const [qualityWarn, setQualityWarn] = useState(false);

  const submit = async () => {
    if (!project.name.trim() || !project.what.trim()) {
      setError("Project name and a description of what it does are required.");
      return;
    }
    if (project.what.trim().length < 100) {
      setError("The \"What does it do?\" field is too short. Add at least 100 characters - the more detail you give, the more accurate the strategy will be.");
      return;
    }
    const emptyCount = [project.team, project.traction, project.tech, project.competitors].filter(f => !f.trim()).length;
    if (emptyCount >= 3 && !qualityWarn) {
      setQualityWarn(true);
      return;
    }
    setQualityWarn(false);
    setError("");
    setStep("loading");
    try {
      const [raw1, raw2] = await Promise.all([
        askClaude([{ role: "user", content: buildPrompt1(project, wpText) }], null, 4000),
        askClaude([{ role: "user", content: buildPrompt2(project, wpText) }], null, 4000),
      ]);
      const parsed = parseReport(raw1, raw2);
      if (!parsed) throw new Error("The AI did not follow the report format. Please try again.");
      setReport(parsed);
      setStep("report");
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
      setStep("form");
    }
  };

  const reset = () => {
    setStep("form"); setReport(null); setError("");
    setProject({ name: "", website: "", twitter: "", what: "", team: "", traction: "", tech: "", competitors: "" });
    setWpText(""); setWpName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  if (step === "loading") return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "56px 24px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><Spinner /></div>
      {["Diagnosing real problems...", "Finding unconventional angles...", "Building growth strategy...", "Writing 30-day roadmap..."].map((t, i) => (
        <div key={i} style={{ fontSize: "0.73rem", color: G.muted, fontFamily: "JetBrains Mono, monospace", marginTop: 8, animation: `fadeUp 0.4s ease ${i * 0.15}s both` }}>{t}</div>
      ))}
    </div>
  );

  if (step === "report" && report) return <ReportView report={report} project={project} onReset={reset} />;

  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, padding: "24px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: G.accent, marginBottom: 18 }}>Project Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <TInput label="Project Name *" value={project.name} onChange={set("name")} placeholder="e.g. Decentral Protocol" />
          <TInput label="Website" value={project.website} onChange={set("website")} placeholder="https://yourproject.io" />
        </div>
        <TInput label="Twitter / X Handle" value={project.twitter} onChange={set("twitter")} placeholder="@yourproject" />
        <TArea label="What does it do? *" value={project.what} onChange={set("what")} rows={3}
          placeholder="What problem does it solve and how? What makes it different from existing solutions?" />
        <div style={{ fontSize: "0.67rem", color: project.what.length >= 100 ? G.accent : G.muted, marginTop: -10, marginBottom: 14, textAlign: "right" }}>
          {project.what.length}/100 min characters {project.what.length >= 100 ? "✓" : ""}
        </div>
        <TArea label="Team & Background" value={project.team} onChange={set("team")} rows={2}
          placeholder="Who built this? Relevant experience, past projects, credentials. Leave blank if unknown." />
        <TArea label="Traction & Metrics" value={project.traction} onChange={set("traction")} rows={2}
          placeholder="Users, revenue, TVL, community size, partnerships secured - any real numbers you have." />
        <TArea label="Tech Stack & Product" value={project.tech} onChange={set("tech")} rows={2}
          placeholder="Chains supported, token model, key product features, stage of development." />
        <TArea label="Known Competitors" value={project.competitors} onChange={set("competitors")} rows={2}
          placeholder="Who are you competing with directly? What do they do better or worse?" />
        <Field label="Whitepaper (optional - deepens analysis)">
          <div onClick={() => fileRef.current?.click()} style={{
            border: `1px dashed ${wpName ? G.accent : G.border}`, borderRadius: G.radius,
            padding: "14px 20px", cursor: "pointer", textAlign: "center",
            background: wpName ? `${G.accent}08` : G.surface2, transition: "all 0.2s",
          }}>
            <div style={{ fontSize: "0.82rem", color: wpName ? G.accent : G.muted }}>
              {wpName ? `Uploaded: ${wpName}` : "Upload whitepaper (.txt or .md)"}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: "none" }} />
          {wpName && <button onClick={() => { setWpName(""); setWpText(""); if (fileRef.current) fileRef.current.value = ""; }}
            style={{ marginTop: 6, background: "none", border: "none", color: G.muted, fontSize: "0.7rem", cursor: "pointer" }}>Remove</button>}
        </Field>
      </div>
      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: "0.82rem", color: "#ff8888", lineHeight: 1.5 }}>{error}</div>}
      {qualityWarn && (
        <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b44", borderRadius: 10, padding: "16px 18px", marginBottom: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>Low detail warning</div>
          <div style={{ fontSize: "0.79rem", color: "#ccc" }}>
            Most fields are empty. The AI will have to guess team details, traction, and tech - which means some findings may be inaccurate or fabricated. For best results, fill in as many fields as possible.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={() => setQualityWarn(false)} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${G.border}`, background: "transparent", color: G.muted, fontFamily: "Outfit, sans-serif", fontSize: "0.75rem", cursor: "pointer" }}>
              Go back and add more
            </button>
            <button onClick={submit} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>
              Generate anyway
            </button>
          </div>
        </div>
      )}
      {!qualityWarn && (
        <button onClick={submit} style={{ width: "100%", padding: "14px", borderRadius: G.radius, background: G.accent, border: "none", color: "#000", fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: "0.92rem", cursor: "pointer", transition: "opacity 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          Generate Growth Strategy
        </button>
      )}
      <p style={{ textAlign: "center", fontSize: "0.68rem", color: G.muted, marginTop: 10 }}>11 sections - unconventional strategy - 15-30 seconds</p>
    </div>
  );
}

// ── CHAT MODE ─────────────────────────────────────────────────────────────────

const CHAT_SYS = `You are StratAI, a contrarian growth strategist for Web2 and Web3 tech businesses. You are known for diagnosing the real problems founders are blind to, and giving strategies nobody else would suggest.

Never use em dashes or en dashes. Use commas, colons, or plain hyphens only.
No generic advice. Think cross-industry. Name specific tactics, not categories.

Ask questions ONE AT A TIME in a natural conversational way. Collect:
1. Business name and what they do
2. Web2, Web3, or both?
3. Stage: idea / early / growing / scaling
4. Revenue model
5. Biggest growth challenge right now
6. Target customers
7. Current marketing channels
8. Top 1-2 competitors

After 6-8 exchanges tell them you have enough, then output ONLY:

===REPORT_START===
BUSINESS_NAME: [name]

## Market Analysis
[Honest read of the market. What is overhyped, underpriced, where the real opportunity is. Not cheerleading.]

## Competitor Breakdown
[What competitors are actually good at, what they are quietly failing at, the specific gaps to own. Name real companies.]

## Positioning
[The contrarian narrative this business should own. The angle that reframes the category or creates a new one.]

## Growth Strategy
[3-4 unconventional specific growth moves. Distribution hacks, audience arbitrage, mechanic imports from other industries, underpriced channels. Explain why each works for this specific business.]

## Content Ideas
[5 specific content plays with clear angles and formats. Built around tension, story, or insight the audience has not seen before.]
===REPORT_END===

TONE: Confident, direct, occasionally blunt. Short sentences. No filler. No em dashes.`;

const CHAT_SECS = ["Market Analysis", "Competitor Breakdown", "Positioning", "Growth Strategy", "Content Ideas"];

function parseChatReport(raw) {
  const s = raw.indexOf("===REPORT_START===");
  const e = raw.indexOf("===REPORT_END===");
  if (s === -1 || e === -1) return null;
  const body = raw.slice(s + 18, e).trim();
  const nameM = body.match(/BUSINESS_NAME:\s*(.+)/);
  const businessName = nameM ? nameM[1].trim() : "Your Business";
  const sections = {};
  CHAT_SECS.forEach((sec, i) => {
    const next = CHAT_SECS[i + 1];
    const pat = next
      ? new RegExp(`## ${sec}\\n([\\s\\S]+?)(?=## ${next})`, "i")
      : new RegExp(`## ${sec}\\n([\\s\\S]+?)$`, "i");
    const m = body.match(pat);
    if (m) sections[sec] = m[1].trim();
  });
  return Object.keys(sections).length > 0 ? { businessName, sections } : null;
}

function ChatReportCard({ report, onNew }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const t = `GROWTH STRATEGY: ${report.businessName}\n\n` +
      CHAT_SECS.filter(s => report.sections[s]).map(s => `${s.toUpperCase()}\n${"-".repeat(32)}\n${report.sections[s]}`).join("\n\n");
    navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${report.businessName} - Growth Strategy</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Georgia,serif;max-width:740px;margin:0 auto;color:#111;padding:48px 32px}
      .brand-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;padding-bottom:20px;border-bottom:3px solid #7cffd4}
      .brand-name{font-family:'Outfit',sans-serif;font-weight:800;font-size:1.1rem;letter-spacing:-0.02em;color:#050508}
      .brand-name span{color:#059669}
      .brand-tag{font-family:'Outfit',sans-serif;font-size:0.68rem;color:#888;text-transform:uppercase;letter-spacing:0.1em}
      .report-title{font-family:'Outfit',sans-serif;font-size:2rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:6px;color:#050508}
      .meta{color:#777;font-size:0.82rem;margin-bottom:36px;padding-bottom:16px;border-bottom:1px solid #eee}
      h2{font-family:'Outfit',sans-serif;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.12em;background:#7cffd4;color:#000;padding:5px 12px;display:inline-block;margin:32px 0 12px;font-weight:700}
      p{line-height:1.9;color:#333;white-space:pre-wrap;font-size:0.91rem}
      .footer{margin-top:56px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
      .footer-brand{font-family:'Outfit',sans-serif;font-weight:700;font-size:0.75rem;color:#333}
      .footer-brand span{color:#059669}
      .footer-note{font-size:0.7rem;color:#aaa}
    </style></head><body>
    <div class="brand-header">
      <div>
        <div class="brand-name">Fredrick Strategy <span>Lab</span></div>
        <div class="brand-tag">Growth & Brand Architecture</div>
      </div>
      <div class="brand-tag">${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
    <div class="report-title">Growth Strategy</div>
    <p class="meta">Business: <strong>${report.businessName}</strong></p>
    ${CHAT_SECS.filter(s => report.sections[s]).map(s => `<h2>${s}</h2><p>${report.sections[s]}</p>`).join("")}
    <div class="footer">
      <div class="footer-brand">Fredrick Strategy <span>Lab</span></div>
      <div class="footer-note">Prepared by StratAI - AI Growth Strategist</div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
  };
  return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: G.radius, overflow: "hidden", maxWidth: "85%", animation: "fadeUp 0.35s ease" }}>
      <div style={{ background: G.accent, color: "#000", padding: "12px 18px", fontWeight: 800, fontSize: "0.76rem", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Growth Strategy</span><span style={{ fontWeight: 600 }}>{report.businessName}</span>
      </div>
      <div style={{ padding: "18px 18px 6px" }}>
        {CHAT_SECS.filter(s => report.sections[s]).map(sec => (
          <div key={sec} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: G.accent, marginBottom: 5 }}>{sec}</div>
            <div style={{ fontSize: "0.85rem", color: "#bbb", lineHeight: 1.78 }}>{renderContent(report.sections[sec])}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 18px 16px", borderTop: `1px solid ${G.border}` }}>
        <Btn label={copied ? "Copied" : "Copy"} onClick={copy} solid small />
        <Btn label="Print / PDF" onClick={print} small />
        <Btn label="New Chat" onClick={onNew} small />
      </div>
    </div>
  );
}

function ChatMode() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const chatRef = useRef();
  const inputRef = useRef();
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) { didInit.current = true; boot(); }
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  async function boot() {
    setLoading(true); setMessages([]); setHistory([]); setReport(null); setError("");
    const seed = [{ role: "user", content: "Hi, I want a growth strategy for my tech business." }];
    try {
      const reply = await askClaude(seed, CHAT_SYS, 400);
      setHistory([...seed, { role: "assistant", content: reply }]);
      setMessages([{ role: "agent", text: reply }]);
    } catch {
      setMessages([{ role: "agent", text: "Hey, I'm StratAI. Tell me about your business and I'll build you a contrarian growth strategy. What is it called and what does it do?" }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function restart() { didInit.current = false; boot(); didInit.current = true; }

  async function send() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput(""); setError("");
    const newMsgs = [...messages, { role: "user", text: userText }];
    setMessages(newMsgs);
    setLoading(true);
    const newHist = [...history, { role: "user", content: userText }];
    try {
      const reply = await askClaude(newHist, CHAT_SYS, 1800);
      setHistory([...newHist, { role: "assistant", content: reply }]);
      if (reply.includes("===REPORT_START===")) {
        const parsed = parseChatReport(reply);
        const pre = reply.split("===REPORT_START===")[0].trim();
        const final = [...newMsgs];
        if (pre) final.push({ role: "agent", text: pre });
        final.push({ role: "agent", text: "", isReport: true });
        setMessages(final);
        if (parsed) setReport(parsed);
      } else {
        setMessages([...newMsgs, { role: "agent", text: reply }]);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      setMessages([...newMsgs, { role: "agent", text: `Something went wrong: ${err.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 480 }}>
      {error && <div style={{ background: "#ff4d4d10", border: "1px solid #ff4d4d33", borderRadius: 10, padding: "10px 16px", marginBottom: 10, fontSize: "0.78rem", color: "#ff8888" }}>{error}</div>}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "8px 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row", animation: "fadeUp 0.25s ease" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0, marginTop: 2,
              background: msg.role === "agent" ? G.accent : G.surface2,
              border: msg.role === "user" ? `1px solid ${G.border}` : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.58rem",
              color: msg.role === "agent" ? "#000" : G.muted,
            }}>
              {msg.role === "agent" ? "AI" : "You"}
            </div>
            {msg.isReport && report
              ? <ChatReportCard report={report} onNew={restart} />
              : msg.text
                ? <div style={{
                    maxWidth: "78%", padding: "11px 15px", borderRadius: 13,
                    background: msg.role === "agent" ? G.surface : G.surface2,
                    border: `1px solid ${G.border}`,
                    borderTopLeftRadius: msg.role === "agent" ? 4 : 13,
                    borderTopRightRadius: msg.role === "user" ? 4 : 13,
                    fontSize: "0.87rem", lineHeight: 1.72,
                    color: msg.role === "user" ? "#999" : "#ddd", whiteSpace: "pre-wrap",
                  }}>{msg.text}</div>
                : null
            }
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: G.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.58rem", color: "#000", flexShrink: 0 }}>AI</div>
            <div style={{ padding: "12px 15px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 13, borderTopLeftRadius: 4, display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: G.muted, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type your message..."
            rows={1}
            style={{ flex: 1, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: "11px 14px", color: G.text, fontFamily: "Outfit, sans-serif", fontSize: "0.87rem", resize: "none", outline: "none", minHeight: 46, maxHeight: 120, lineHeight: 1.5, transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = G.accent}
            onBlur={e => e.target.style.borderColor = G.border}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ width: 46, height: 46, borderRadius: 12, background: G.accent, border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={{ marginTop: 6, fontSize: "0.67rem", color: G.muted, textAlign: "center" }}>Enter to send - Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────────────────

export default function StratAI() {
  const [mode, setMode] = useState("analyzer");
  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "Outfit, sans-serif", padding: "22px 18px 40px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.025em" }}>
              Strat<span style={{ color: G.accent }}>AI</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: G.muted, marginTop: 2 }}>
              {mode === "analyzer" ? "Deep Web3 analysis - 11 sections" : "Conversational growth strategy"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ModeToggle mode={mode} onChange={setMode} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", color: G.muted }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: G.accent, animation: "pulse 2s infinite" }} />
              Live
            </div>
          </div>
        </div>
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 18, fontSize: "0.78rem", color: G.muted }}>
          {mode === "analyzer"
            ? <><span style={{ color: G.accent }}>⬡ </span><strong style={{ color: G.text }}>Analyzer</strong> - Fill in your project and get a deep 11-section unconventional Web3 growth report.</>
            : <><span style={{ color: G.accent }}>◎ </span><strong style={{ color: G.text }}>Chat</strong> - StratAI asks smart questions then delivers a contrarian growth strategy.</>
          }
        </div>
        <div key={mode} style={{ animation: "fadeUp 0.3s ease" }}>
          {mode === "analyzer" ? <AnalyzerMode /> : <ChatMode />}
        </div>
      </div>
    </div>
  );
}