(async function () {
  const D = await (await fetch('/api/member')).json();
  const $ = (s) => document.querySelector(s);
  const money = (n) => '$' + Math.round(n).toLocaleString();
  let tier = D.member.plan.toLowerCase();

  // summary card
  const m = D.member, left = m.annualMax - m.usedThisYear;
  $('#summary').innerHTML = `
    <h3>Welcome back, ${m.name.split(' ')[0]}</h3>
    <div class="big">${D.dependents.length} people</div>
    <div class="row"><span>${m.plan} plan</span><span>ID ${m.memberId}</span></div>
    <div class="meter"><i style="width:${(m.usedThisYear / m.annualMax) * 100}%"></i></div>
    <div class="row"><span>${money(m.usedThisYear)} used</span><span>${money(left)} left of ${money(m.annualMax)}</span></div>`;

  // tiers
  function renderTiers() {
    $('#tiers').innerHTML = D.tiers.map(t => `
      <div class="tier ${t.id === tier ? 'on' : ''}" data-id="${t.id}">
        ${t.id === m.plan.toLowerCase() ? '<span class="tag">Your plan</span>' : ''}
        <h3>${t.name}</h3>
        <div class="price">${money(t.monthly)}<small> / month</small></div>
        <ul><li>${money(t.annualMax)} annual maximum</li><li>${money(t.deductible)} deductible</li></ul>
      </div>`).join('');
    document.querySelectorAll('.tier').forEach(el => el.onclick = () => { tier = el.dataset.id; renderTiers(); renderCoverage(); });
  }
  function renderCoverage() {
    $('#bars').innerHTML = D.services.map(s => `
      <div class="bar"><div class="top"><span>${s.label}</span><span>${s[tier]}%</span></div>
      <div class="track"><i style="width:${s[tier]}%"></i></div></div>`).join('');
    $('#table').innerHTML = `<tr><th>Service</th>${D.tiers.map(t => `<th class="${t.id === tier ? 'hl' : ''}">${t.name}</th>`).join('')}</tr>` +
      D.services.map(s => `<tr><td>${s.label}</td>${D.tiers.map(t => `<td class="${t.id === tier ? 'hl' : ''}">${s[t.id]}%</td>`).join('')}</tr>`).join('');
  }
  renderTiers(); renderCoverage();

  // dependents tree
  const pos = [[280, 50], [120, 170], [440, 170], [190, 280], [370, 280]];
  const layout = { 0: [280, 50], 1: [450, 50], 2: [190, 250], 3: [370, 250] };
  let sel = 0;
  function renderTree() {
    const P = layout;
    const lines = `<path d="M280 70 L280 150 M280 150 L190 215 M280 150 L370 215 M310 50 L420 50" stroke="#cfa9b9" stroke-width="3" fill="none"/>`;
    const nodes = D.dependents.map((d, i) => {
      const [x, y] = P[i];
      return `<g class="node ${i === sel ? 'on' : ''} ${d.status === 'pending' ? 'pending' : ''}" data-i="${i}">
        <circle cx="${x}" cy="${y}" r="30"/>
        <text class="n" x="${x}" y="${y + 5}">${d.name[0]}</text>
        <text x="${x}" y="${y + 52}">${d.name.split(' ')[0]}</text>
        <text class="r" x="${x}" y="${y + 67}">${d.relation}, ${d.age}</text></g>`;
    }).join('');
    $('#tree').innerHTML = lines + nodes;
    document.querySelectorAll('.node').forEach(n => n.onclick = () => { sel = +n.dataset.i; renderTree(); renderDetail(); });
  }
  function renderDetail() {
    const d = D.dependents[sel];
    const chips = D.services.map(s => {
      const ok = D.eligibility[s.key].includes(d.relation);
      if (!ok) return `<span class="chip no">${s.label.split(' (')[0]}</span>`;
      return d.status === 'pending' ? `<span class="chip pend">${s.label.split(' (')[0]} (pending)</span>` : `<span class="chip yes">${s.label.split(' (')[0]}</span>`;
    }).join('');
    $('#depDetail').innerHTML = `<h3 style="margin:0;color:var(--burgundy)">${d.name}</h3>
      <div style="color:var(--muted)">${d.relation}, age ${d.age}</div><div class="chips">${chips}</div>
      ${d.note ? `<div class="note">${d.note}</div>` : ''}`;
  }
  renderTree(); renderDetail();

  // calculator
  $('#cTier').innerHTML = D.tiers.map(t => `<option value="${t.id}" ${t.id === tier ? 'selected' : ''}>${t.name}</option>`).join('');
  function calc() {
    const t = D.tiers.find(x => x.id === $('#cTier').value);
    const people = +$('#cDeps').value, visits = +$('#cVisits').value, major = +$('#cMajor').value;
    $('#cDepsV').textContent = people; $('#cVisitsV').textContent = visits; $('#cMajorV').textContent = money(major);
    const svc = (k) => D.services.find(s => s.key === k)[t.id] / 100;
    const premium = t.monthly * 12 * (1 + (people - 1) * 0.55);
    const routine = people * visits * 220;                     // avg billed per routine visit
    const routineOut = routine * (1 - svc('preventive'));
    const majorPaid = Math.max(0, major - t.deductible) * svc('major');
    const insurerPays = Math.min(t.annualMax, routine - routineOut + majorPaid);
    const outOfPocket = routine + major - insurerPays;
    $('#result').innerHTML = `<div style="opacity:.85">Estimated annual cost</div>
      <div class="big">${money(premium + outOfPocket)}</div>
      <div class="row"><span>Premiums</span><span>${money(premium)}</span></div>
      <div class="row"><span>Your share of care</span><span>${money(outOfPocket)}</span></div>
      <div class="row"><span>Plan pays (capped at ${money(t.annualMax)})</span><span>${money(insurerPays)}</span></div>`;
  }
  ['#cTier', '#cDeps', '#cVisits', '#cMajor'].forEach(s => $(s).oninput = calc);
  calc();
})();
