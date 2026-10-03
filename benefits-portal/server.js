// Zero-dependency Node server: serves the front end and the AI assistant API.
// Run:  ANTHROPIC_API_KEY=sk-ant-... node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const PUBLIC = path.join(__dirname, 'public');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'member.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

function systemPrompt() {
  const m = DATA.member;
  return `You are the Benefits Assistant inside a dental & vision benefits portal (hackathon prototype).
You are talking to ${m.name}, member ID ${m.memberId}, enrolled in the ${m.plan} plan
(deductible $${m.deductible}, annual maximum $${m.annualMax}, $${m.usedThisYear} used so far this year).

Household and eligibility:
${JSON.stringify(DATA.dependents, null, 1)}

Coverage by service (percent covered, by tier):
${JSON.stringify(DATA.services, null, 1)}

Tiers and monthly premiums:
${JSON.stringify(DATA.tiers, null, 1)}

Which relationships are eligible for which services:
${JSON.stringify(DATA.eligibility, null, 1)}

Claims / dental records on file:
${JSON.stringify(DATA.records, null, 1)}

Rules:
- Personalize every answer to this member and their household; use real numbers from the data above.
- When a PDF is attached (an EOB, claim summary, treatment plan or dental record), explain it in plain English: what was billed, what insurance paid, what the member owes and why, key dates, and any action needed.
- Help with planning for the future: expected costs for upcoming care, how the annual maximum and deductible interact, when to use remaining benefits, and plan-tier trade-offs.
- Define insurance jargon simply the first time you use it.
- Do the arithmetic explicitly and show it briefly. If something is not in the data or the PDF, say so rather than guessing.
- You are not a dentist or an insurer. For final coverage decisions suggest a pre-treatment estimate or contacting the plan.
- Keep answers concise and well organized; use short lists when helpful.`;
}

// Offline fallback so the demo still works with no API key.
function mockReply(text, hasPdf) {
  const t = (text || '').toLowerCase();
  const m = DATA.member;
  const left = m.annualMax - m.usedThisYear;
  if (hasPdf) return 'I can read PDF reports when an ANTHROPIC_API_KEY is set on the server. Add your key and restart, then re-attach the file.';
  if (t.includes('noah') || t.includes('pending') || t.includes('eligib'))
    return 'Noah (23) is marked pending. Children are covered to age 19, or to 26 as full-time students, so the plan needs enrollment verification. Upload proof of enrollment through the portal to clear it.';
  if (t.includes('crown'))
    return `On ${m.plan}, major services like crowns are covered at 50% after the $${m.deductible} deductible, up to your $${m.annualMax} annual maximum. Example: a $1,200 crown is ($1,200 - $${m.deductible}) x 50% = $562.50 paid by the plan, so you owe about $637.50. Ask your dentist for a pre-treatment estimate.`;
  if (t.includes('left') || t.includes('remaining') || t.includes('used') || t.includes('max'))
    return `You have used $${m.usedThisYear} of your $${m.annualMax} annual maximum, so $${left} remains this year. Benefits reset on January 1, so consider scheduling planned care before then.`;
  return `I'm running in offline demo mode (no API key set). Try asking about crowns, remaining benefits, or Noah's eligibility. With ANTHROPIC_API_KEY set, I can answer anything about your plan and read PDF reports.`;
}

async function chat(body) {
  const messages = (body.messages || []).map(x => ({ role: x.role, content: String(x.content) }));
  if (!messages.length) throw new Error('No messages');
  const lastUser = [...messages].reverse().find(x => x.role === 'user');
  if (!API_KEY) return mockReply(lastUser && lastUser.content, !!body.pdf);

  if (body.pdf && body.pdf.data) {
    const idx = messages.lastIndexOf(lastUser);
    messages[idx] = {
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdf.data } },
        { type: 'text', text: messages[idx].content }
      ]
    };
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: systemPrompt(), messages })
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || 'API error ' + res.status);
  return json.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
}

function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/member') return send(res, 200, DATA);
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = JSON.parse(await readBody(req));
      return send(res, 200, { reply: await chat(body) });
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.normalize(path.join(PUBLIC, file));
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`Portal running at http://localhost:${PORT}`);
  console.log(API_KEY ? `AI assistant: live (${MODEL})` : 'AI assistant: offline demo mode (set ANTHROPIC_API_KEY for the real thing)');
});
