// Signal - offline-first job application tracker
const STATUSES = ['Wishlist', 'Applied', 'Interview', 'Offer', 'Rejected'];
const KEY = 'signal.jobs.v1';
const $ = (id) => document.getElementById(id);

let jobs = load();
let editingId = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(jobs)); } catch (e) { alert('Could not save: ' + e.message); }
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Form ----------
$('status').innerHTML = STATUSES.map((s) => `<option>${s}</option>`).join('');
$('status').value = 'Applied';
$('date').value = today();

const FIELDS = ['company', 'role', 'location', 'salary', 'link', 'status', 'date', 'followUp', 'notes'];

$('jobForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(FIELDS.map((f) => [f, $(f).value.trim()]));
  if (editingId) {
    jobs = jobs.map((j) => (j.id === editingId ? { ...j, ...data, updated: Date.now() } : j));
  } else {
    jobs.unshift({ id: uid(), ...data, created: Date.now(), updated: Date.now() });
  }
  save();
  resetForm();
  render();
});

$('cancelEdit').addEventListener('click', resetForm);

function resetForm() {
  editingId = null;
  $('jobForm').reset();
  $('status').value = 'Applied';
  $('date').value = today();
  $('saveBtn').textContent = 'Save';
  $('cancelEdit').hidden = true;
}

function edit(id) {
  const j = jobs.find((x) => x.id === id);
  if (!j) return;
  editingId = id;
  FIELDS.forEach((f) => { $(f).value = j[f] || ''; });
  $('saveBtn').textContent = 'Update';
  $('cancelEdit').hidden = false;
  $('company').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function remove(id) {
  if (!confirm('Delete this application?')) return;
  jobs = jobs.filter((j) => j.id !== id);
  save();
  render();
}

function move(id, status) {
  const j = jobs.find((x) => x.id === id);
  if (!j || j.status === status) return;
  j.status = status;
  j.updated = Date.now();
  save();
  render();
}

// ---------- Rendering ----------
function render() {
  const q = $('search').value.toLowerCase();
  const visible = jobs.filter((j) => !q || `${j.company} ${j.role}`.toLowerCase().includes(q));

  const counts = Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length]));
  const active = jobs.filter((j) => j.status !== 'Wishlist').length;
  const responded = jobs.filter((j) => ['Interview', 'Offer'].includes(j.status)).length;
  const rate = active ? Math.round((responded / active) * 100) : 0;
  const due = jobs.filter((j) => j.followUp && j.followUp <= today() && !['Offer', 'Rejected'].includes(j.status)).length;

  $('stats').innerHTML = [
    ['Total', jobs.length], ['Applied', counts.Applied], ['Interviews', counts.Interview],
    ['Offers', counts.Offer], ['Response rate', rate + '%'], ['Follow-ups due', due],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');

  $('board').innerHTML = STATUSES.map((s) => {
    const items = visible.filter((j) => j.status === s);
    return `<div class="col" data-status="${s}">
      <h3>${s}<span>${items.length}</span></h3>
      ${items.map(card).join('')}
    </div>`;
  }).join('');
}

function card(j) {
  const due = j.followUp && j.followUp <= today() && !['Offer', 'Rejected'].includes(j.status);
  return `<article class="job s-${j.status}" draggable="true" data-id="${j.id}">
    <div class="role">${esc(j.role)}</div>
    <div class="meta">${esc(j.company)}${j.location ? ' · ' + esc(j.location) : ''}${j.salary ? ' · ' + esc(j.salary) : ''}</div>
    ${j.date ? `<div class="meta">Applied ${esc(j.date)}</div>` : ''}
    ${due ? `<div class="due">Follow up due</div>` : ''}
    <div class="btns">
      ${j.link ? `<a class="meta" href="${esc(j.link)}" target="_blank" rel="noopener">Open ↗</a>` : ''}
      <button data-act="edit">Edit</button>
      <button data-act="del">Delete</button>
    </div>
  </article>`;
}

// Event delegation for card buttons
$('board').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.job').dataset.id;
  if (btn.dataset.act === 'edit') edit(id);
  if (btn.dataset.act === 'del') remove(id);
});

// Drag and drop between columns
$('board').addEventListener('dragstart', (e) => {
  const el = e.target.closest('.job');
  if (el) e.dataTransfer.setData('text/plain', el.dataset.id);
});
$('board').addEventListener('dragover', (e) => {
  const col = e.target.closest('.col');
  if (col) { e.preventDefault(); col.classList.add('drag-over'); }
});
$('board').addEventListener('dragleave', (e) => {
  const col = e.target.closest('.col');
  if (col) col.classList.remove('drag-over');
});
$('board').addEventListener('drop', (e) => {
  const col = e.target.closest('.col');
  if (!col) return;
  e.preventDefault();
  move(e.dataTransfer.getData('text/plain'), col.dataset.status);
});

$('search').addEventListener('input', render);

// ---------- Job board deep links ----------
const BOARDS = [
  ['LinkedIn', (k, w) => `https://www.linkedin.com/jobs/search/?keywords=${k}&location=${w}`],
  ['Indeed', (k, w) => `https://uk.indeed.com/jobs?q=${k}&l=${w}`],
  ['Reed', (k) => `https://www.reed.co.uk/jobs/${k.replace(/%20/g, '-')}-jobs`],
  ['Totaljobs', (k) => `https://www.totaljobs.com/jobs/${k.replace(/%20/g, '-')}`],
  ['CWJobs', (k) => `https://www.cwjobs.co.uk/jobs/${k.replace(/%20/g, '-')}`],
  ['Glassdoor', (k) => `https://www.glassdoor.co.uk/Job/jobs.htm?sc.keyword=${k}`],
];
function renderBoards() {
  const k = encodeURIComponent($('kw').value.trim());
  const w = encodeURIComponent($('where').value.trim());
  $('boardLinks').innerHTML = BOARDS.map(([name, url]) =>
    `<a href="${url(k, w)}" target="_blank" rel="noopener">${name} ↗</a>`).join('');
}
$('kw').addEventListener('input', renderBoards);
$('where').addEventListener('input', renderBoards);
$('boardSearch').addEventListener('submit', (e) => e.preventDefault());

// ---------- Import / export ----------
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `signal-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error('Expected a list of applications');
    const known = new Set(jobs.map((j) => j.id));
    jobs = [...data.filter((j) => j && j.id && !known.has(j.id)), ...jobs];
    save();
    render();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
  e.target.value = '';
});

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').hidden = true;
});

render();
renderBoards();
