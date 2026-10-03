(async function () {
  const D = await (await fetch('/api/member')).json();
  const $ = (s) => document.querySelector(s);
  const m = D.member;
  const history = [];
  let pdf = null;

  $('#who').innerHTML = `<h4>${m.name}</h4>
    <div class="k"><span>Plan</span><b>${m.plan}</b></div>
    <div class="k"><span>Member ID</span><b>${m.memberId}</b></div>
    <div class="k"><span>Used</span><b>$${m.usedThisYear} / $${m.annualMax}</b></div>
    <div class="k"><span>Household</span><b>${D.dependents.length}</b></div>`;

  const suggestions = [
    'How much of my annual maximum is left?',
    'What would a $1,200 crown cost me?',
    'Why is Noah pending?',
    'Explain the PDF I attached',
    'Should I upgrade to Premium next year?',
    'Summarize my dental records so far'
  ];
  $('#sugg').innerHTML = suggestions.map(s => `<button type="button">${s}</button>`).join('');
  document.querySelectorAll('#sugg button').forEach(b => b.onclick = () => send(b.textContent));

  function add(role, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'm ' + (role === 'user' ? 'me' : 'bot') + ' ' + cls;
    el.textContent = text;
    $('#msgs').appendChild(el); $('#msgs').scrollTop = 1e9;
    return el;
  }
  add('assistant', `Hi ${m.name.split(' ')[0]}! I can explain your ${m.plan} plan, your family's eligibility, your dental records, and any PDF report (like an EOB or treatment plan). Attach a PDF or ask me anything.`);

  function renderPill() {
    $('#pillBox').innerHTML = pdf ? `<span class="pill">${pdf.name}<button type="button" id="rm">x</button></span>` : '';
    if (pdf) $('#rm').onclick = () => { pdf = null; renderPill(); };
  }

  $('#file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert('Please choose a PDF under 10 MB.'); return; }
    const r = new FileReader();
    r.onload = () => { pdf = { name: f.name, data: r.result.split(',')[1] }; renderPill(); };
    r.readAsDataURL(f);
    e.target.value = '';
  };

  async function send(text) {
    text = (text || '').trim(); if (!text) return;
    add('user', text); history.push({ role: 'user', content: text });
    $('#input').value = '';
    const wait = add('assistant', 'Thinking...', 'typing');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history, pdf })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Request failed');
      wait.remove(); add('assistant', j.reply); history.push({ role: 'assistant', content: j.reply });
    } catch (err) {
      wait.remove(); add('assistant', 'Sorry, something went wrong: ' + err.message);
      history.pop();
    }
  }
  $('#form').onsubmit = (e) => { e.preventDefault(); send($('#input').value); };
})();
