/* Between Strangers – interactive artboard (Fabric.js 5) */
const $ = (s) => document.querySelector(s);

/* ---------- DATA ---------- */
const MODES = {
  instruct:   ['INSTRUCT',   'Direct another person’s behavior.'],
  compete:    ['COMPETE',    'Compete for the same space or attention.'],
  erase:      ['ERASE',      'Cover, cross, make it less visible.'],
  alter:      ['ALTER',      'Modify it, change its meaning.'],
  add:        ['ADD',        'Add new information.'],
  accumulate: ['ACCUMULATE', 'Build up on the same surface.'],
  respond:    ['RESPOND',    'React or reply.']
};
const CATS = [
  { folder: 'Alteration',   label: 'ALTERATION',   n: 4,  mode: 'alter' },
  { folder: 'Erasure',      label: 'ERASURE',      n: 9,  mode: 'erase' },
  { folder: 'Response',     label: 'RESPONSE',     n: 9,  mode: 'respond' },
  { folder: 'Addition',     label: 'ADDITION',     n: 5,  mode: 'add' },
  { folder: 'Competition',  label: 'COMPETITION',  n: 4,  mode: 'compete' },
  { folder: 'Accumulation', label: 'ACCUMULATION', n: 3,  mode: 'accumulate' },
  { folder: 'Message',      label: 'INSTRUCTION',  n: 13, mode: 'instruct' }
];
const DEFAULT_PROMPT = 'Explore the photo index to begin.';

/* ---------- STATE ---------- */
let tool = 'move', color = '#000000', placed = 0;
let locked = null;        // { mode, src } once a thumbnail is clicked / random is used
const allThumbs = [];

/* ---------- FABRIC CANVAS ---------- */
const board = $('#board');
const canvas = new fabric.Canvas('c', {
  backgroundColor: '#ffffff', preserveObjectStacking: true,
  width: board.clientWidth, height: board.clientHeight
});
canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
window.addEventListener('resize', () => {
  canvas.setDimensions({ width: board.clientWidth, height: board.clientHeight });
});

/* ---------- UNDO / REDO ---------- */
let hist = [], pos = -1, busy = false;
function snap() {
  if (busy) return;
  hist = hist.slice(0, pos + 1);
  hist.push(JSON.stringify(canvas));
  pos = hist.length - 1;
}
function restore(i) {
  if (i < 0 || i >= hist.length) return;
  busy = true; pos = i;
  canvas.loadFromJSON(hist[i], () => { canvas.renderAll(); busy = false; });
}
['object:added', 'object:modified', 'object:removed', 'text:editing:exited'].forEach(e => canvas.on(e, snap));
snap();
$('#undo').onclick = () => restore(pos - 1);
$('#redo').onclick = () => restore(pos + 1);

/* ---------- SIZE SLIDER ---------- */
const slider = $('#size');
const textSize = (v) => Math.round(v * 0.8 + 8);
const brushSize = (v) => tool === 'erase' ? Math.round(v * 0.8 + 6) : Math.round(v / 3 + 1);
function paintSlider() { slider.style.setProperty('--v', ((slider.value - 1) / 99 * 100) + '%'); }
slider.addEventListener('input', () => {
  paintSlider();
  const v = +slider.value, o = canvas.getActiveObject();
  if (tool === 'draw' || tool === 'erase') { canvas.freeDrawingBrush.width = brushSize(v); return; }
  if (!o) return;
  if (o.type === 'i-text') o.set('fontSize', textSize(v));
  else if (o.type === 'image') o.scaleToWidth(v * 5);
  o.setCoords(); canvas.requestRenderAll();
});
slider.addEventListener('change', () => { if (canvas.getActiveObject()) snap(); });
function syncSliderToSelection() {
  const o = canvas.getActiveObject();
  if (!o || tool === 'draw' || tool === 'erase') return;
  if (o.type === 'i-text') slider.value = Math.min(100, Math.max(1, Math.round((o.fontSize - 8) / 0.8)));
  else if (o.type === 'image') slider.value = Math.min(100, Math.max(1, Math.round(o.getScaledWidth() / 5)));
  paintSlider();
}
canvas.on('selection:created', syncSliderToSelection);
canvas.on('selection:updated', syncSliderToSelection);

/* ---------- CURSOR (crosshair for draw/erase) ---------- */
let cross = 'crosshair';
(function () {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      c.getContext('2d').drawImage(img, 0, 0, 32, 32);
      cross = `url(${c.toDataURL()}) 16 16, crosshair`; applyTool();
    } catch (e) { /* keep fallback cursor */ }
  };
  img.src = 'Assets/Extra_Buttons/Crosshair.png';
})();

/* ---------- TOOLS ---------- */
function applyTool() {
  const drawing = tool === 'draw' || tool === 'erase';
  canvas.isDrawingMode = drawing;
  canvas.freeDrawingCursor = cross;
  canvas.defaultCursor = tool === 'type' ? 'text' : 'default';
  const b = canvas.freeDrawingBrush;
  b.color = tool === 'erase' ? '#ffffff' : color;
  b.width = brushSize(+slider.value);
  if (drawing) canvas.discardActiveObject();
  canvas.requestRenderAll();
  document.querySelectorAll('.tool[data-tool]').forEach(t => t.classList.toggle('on', t.dataset.tool === tool));
  $('#colors').hidden = !(tool === 'draw' || tool === 'type');
}
function setTool(t) { tool = t; applyTool(); }
document.querySelectorAll('.tool[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));

document.querySelectorAll('.dot').forEach(d => d.onclick = () => {
  color = d.dataset.color;
  document.querySelectorAll('.dot').forEach(x => x.classList.toggle('on', x === d));
  const o = canvas.getActiveObject();
  if (tool === 'type' && o && o.type === 'i-text') { o.set('fill', color); canvas.requestRenderAll(); snap(); }
  applyTool();
});

/* Type tool: click empty space to add an editable text box */
canvas.on('mouse:down', (opt) => {
  if (tool !== 'type' || opt.target) return;
  const p = canvas.getPointer(opt.e);
  const t = new fabric.IText('Type here', {
    left: p.x, top: p.y, fontFamily: 'futura-pt, sans-serif', fontWeight: 500,
    fontSize: textSize(+slider.value), fill: color
  });
  canvas.add(t); canvas.setActiveObject(t); t.enterEditing(); t.selectAll();
});

/* Enter confirms text, Delete removes the selected object */
document.addEventListener('keydown', (e) => {
  const o = canvas.getActiveObject();
  if (e.key === 'Enter' && o && o.isEditing && !e.shiftKey) {
    e.preventDefault(); o.exitEditing(); canvas.discardActiveObject(); canvas.requestRenderAll();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && o && !o.isEditing && e.target.tagName !== 'INPUT') {
    e.preventDefault(); canvas.getActiveObjects().forEach(x => canvas.remove(x)); canvas.discardActiveObject();
  }
});

/* Duplicate / Delete all / Save */
function duplicate(o) {
  const targets = o ? [o] : canvas.getActiveObjects();
  targets.forEach(t => t.clone(c => {
    c.set({ left: t.left + 20, top: t.top + 20 }); canvas.add(c); canvas.setActiveObject(c);
  }));
  canvas.requestRenderAll();
  return targets.length > 0;
}
$('#dup').onclick = () => { setTool('move'); duplicate(); };
$('#clear').onclick = () => {
  busy = true; canvas.clear(); canvas.backgroundColor = '#ffffff'; busy = false;
  placed = 0; canvas.renderAll(); snap();
};
$('#save').onclick = () => {
  try {
    canvas.discardActiveObject(); canvas.renderAll();
    const a = document.createElement('a');
    a.download = 'between-strangers.png';
    a.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
    a.click();
  } catch (err) {
    alert('Saving was blocked by the browser. Open the site through a local server (e.g. VS Code Live Server) instead of file://.');
  }
};

/* ---------- ADDING SOURCE IMAGES ---------- */
function nextOffset() { const n = placed++ % 10; return n * 18; }
function addImage(src) {
  fabric.Image.fromURL(src, (img) => {
    if (!img || !img.width) return;
    const max = Math.min(canvas.width, canvas.height) * 0.6;
    img.scale(Math.min(max / img.width, max / img.height));
    const off = nextOffset();
    img.set({ originX: 'center', originY: 'center', left: canvas.width / 2 + off, top: canvas.height / 2 + off });
    canvas.add(img); canvas.setActiveObject(img); syncSliderToSelection();
  });
}

/* ---------- FILTERS + PROMPT ---------- */
const filters = $('#filters');
Object.entries(MODES).forEach(([key, [name]]) => {
  const b = document.createElement('button');
  b.className = 'filter'; b.dataset.mode = key; b.textContent = name;
  b.onclick = () => { locked = { mode: key, src: locked ? locked.src : null }; showMode(key); runMode(key); };
  filters.appendChild(b);
});
function showMode(key) {
  document.querySelectorAll('.filter').forEach(f => f.classList.toggle('on', f.dataset.mode === key));
  $('#promptText').textContent = key ? MODES[key][1] : DEFAULT_PROMPT;
}
function showPreview(src) {
  const img = $('#previewImg');
  if (src) { img.src = src; img.hidden = false; $('#previewLabel').hidden = true; }
  else { img.hidden = true; $('#previewLabel').hidden = false; }
}
function restoreLocked() {
  showMode(locked ? locked.mode : null);
  showPreview(locked ? locked.src : null);
}

/* What each mode actually does when chosen */
function runMode(mode) {
  if (mode === 'instruct') {
    const arrow = new fabric.Path('M0 12 H90 M72 0 L90 12 L72 24', { fill: '', stroke: '#000', strokeWidth: 5, strokeLineCap: 'round', strokeLineJoin: 'round' });
    const off = nextOffset();
    arrow.set({ left: canvas.width / 2 + off, top: canvas.height / 2 + off });
    setTool('move'); canvas.add(arrow); canvas.setActiveObject(arrow);
  } else if (mode === 'accumulate') {
    setTool('move'); duplicate();               // stack a copy of the selected object
  } else if (mode === 'erase') {
    setTool('erase');                           // cover / scribble over things
  } else if (mode === 'alter' || mode === 'add' || mode === 'respond') {
    setTool('type');                            // click a text object to edit it, or empty space to add new text
  } else {
    setTool('move');                            // compete: overlap and rearrange objects
  }
}

/* ---------- PHOTO INDEX ---------- */
const index = $('#index');
CATS.forEach(cat => {
  const sec = document.createElement('section'); sec.className = 'cat';
  sec.innerHTML = `<h3>${cat.label}</h3><div class="row">
    <button class="arrow" aria-label="Scroll left"><img src="Assets/Extra_Buttons/LeftSelect.png" alt=""></button>
    <div class="strip"></div>
    <button class="arrow" aria-label="Scroll right"><img src="Assets/Extra_Buttons/RightSelect.png" alt=""></button></div>`;
  const strip = sec.querySelector('.strip');
  const [l, r] = sec.querySelectorAll('.arrow');
  l.onclick = () => strip.scrollBy({ left: -160 });
  r.onclick = () => strip.scrollBy({ left: 160 });

  for (let i = 1; i <= cat.n; i++) {
    const src = `Assets/Photos/${cat.folder}/${cat.folder}(${i}).jpg`;
    const t = document.createElement('img');
    t.className = 'thumb'; t.src = src; t.alt = `${cat.label} ${i}`; t.loading = 'lazy';
    t.onload = () => t.classList.toggle('portrait', t.naturalHeight > t.naturalWidth);
    t.onmouseenter = () => { showPreview(src); showMode(cat.mode); };
    t.onmouseleave = restoreLocked;
    t.onclick = () => {
      allThumbs.forEach(x => x.classList.remove('sel')); t.classList.add('sel');
      locked = { mode: cat.mode, src };
      showPreview(src); showMode(cat.mode); addImage(src);
    };
    allThumbs.push(t); strip.appendChild(t);
  }
  index.appendChild(sec);
});

/* RANDOM: pick a random category + source message, keep it as the active prompt */
$('#rand').onclick = () => {
  const cat = CATS[Math.floor(Math.random() * CATS.length)];
  const i = 1 + Math.floor(Math.random() * cat.n);
  const src = `Assets/Photos/${cat.folder}/${cat.folder}(${i}).jpg`;
  locked = { mode: cat.mode, src };
  allThumbs.forEach(x => x.classList.toggle('sel', x.getAttribute('src') === src));
  restoreLocked();
};

/* ---------- CHROME: info, home, modes card ---------- */
$('#infoBtn').onclick = () => {
  const open = $('#infoPanel').hidden;
  $('#infoPanel').hidden = !open; $('#infoBtn').classList.toggle('open', open);
};
$('#home').onclick = (e) => { e.preventDefault(); location.reload(); };
$('#modesBtn').onclick = () => { $('#modes').hidden = false; };
$('#modesClose').onclick = () => { $('#modes').hidden = true; };

/* ---------- INIT ---------- */
paintSlider(); applyTool(); showMode(null);