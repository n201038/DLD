// Digital Logic Analyzer - Advanced Circuit Visualization
const state = {
  numVars: 3,
  varNames: ['A','B','C'],
  ttValues: [],
  gateDelays: {AND:2.5,OR:2.5,NAND:1.5,NOR:1.5,NOT:1.0,XOR:3.5,XNOR:3.5},
  currentSOP: '0',
  currentConverted: '0',
  fullscreen: false
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  bindUI();
  rebuildTruthTableAndKmap();
  updateSimplification();
});

function initDefaults(){
  const total = 2 ** state.numVars;
  state.ttValues = Array.from({length: total}, (_, i) => i % 2 ? '1' : '0');
}

// ===== UI BINDING =====
function bindUI(){
  // Variable input (Manual Entry)
  const manualNumVars = document.getElementById('manualNumVars');
  const manualVarNames = document.getElementById('manualVarNames');
  const varErrorMsg = document.getElementById('varErrorMsg');
  const buildTableBtn = document.getElementById('buildTableBtn');

  function parseVariables() {
    const num = parseInt(manualNumVars.value, 10);
    const namesRaw = manualVarNames.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    
    if (isNaN(num) || num < 2 || num > 10) {
      varErrorMsg.textContent = 'Number of variables must be between 2 and 10.';
      varErrorMsg.style.display = 'block';
      buildTableBtn.disabled = true;
      return null;
    }
    
    if (namesRaw.length !== num) {
      varErrorMsg.textContent = `Expected ${num} variable names, but got ${namesRaw.length}.`;
      varErrorMsg.style.display = 'block';
      buildTableBtn.disabled = true;
      return null;
    }
    
    // Check for duplicates
    if (new Set(namesRaw).size !== namesRaw.length) {
      varErrorMsg.textContent = 'Variable names must be unique.';
      varErrorMsg.style.display = 'block';
      buildTableBtn.disabled = true;
      return null;
    }

    varErrorMsg.style.display = 'none';
    buildTableBtn.disabled = false;
    return { num, names: namesRaw };
  }

  manualNumVars.addEventListener('input', parseVariables);
  manualVarNames.addEventListener('input', parseVariables);

  buildTableBtn.addEventListener('click', () => {
    const parsed = parseVariables();
    if (parsed) {
      state.numVars = parsed.num;
      state.varNames = parsed.names;
      initDefaults();
      rebuildTruthTableAndKmap();
      updateSimplification();
    }
  });

  // Gate mode
  document.getElementById('gateMode').addEventListener('change', e => {
    document.getElementById('customGates').style.display = e.target.value === 'custom' ? 'block' : 'none';
    updateSimplification();
  });

  document.getElementById('gate1').addEventListener('change', updateSimplification);
  document.getElementById('gate2').addEventListener('change', updateSimplification);

  // Converter
  document.getElementById('convInput').addEventListener('input', computeConverter);

  // Modal buttons
  document.getElementById('waveBtn').addEventListener('click', () => openModal(renderTimingModal));
  document.getElementById('schematicBtn').addEventListener('click', () => openModal(renderSchematicModal));
  
  // Delay Settings Modal
  const delaySettingsBtn = document.getElementById('delaySettingsBtn');
  if (delaySettingsBtn) {
    delaySettingsBtn.addEventListener('click', () => openModal(renderDelaySettingsModal));
  }

  // Initialize variables
  const initialParsed = parseVariables();
  if(initialParsed){
    state.numVars = initialParsed.num;
    state.varNames = initialParsed.names;
    initDefaults();
    rebuildTruthTableAndKmap();
    updateSimplification();
  }

  // Tools menu
  const toolsBtn = document.getElementById('toolsBtn');
  const toolsMenu = document.createElement('div');
  toolsMenu.style.position = 'absolute';
  toolsMenu.style.background = '#fff';
  toolsMenu.style.border = '1px solid rgba(2,6,23,0.06)';
  toolsMenu.style.padding = '8px';
  toolsMenu.style.borderRadius = '8px';
  toolsMenu.style.boxShadow = '0 8px 30px rgba(2,6,23,0.08)';
  toolsMenu.style.display = 'none';
  toolsMenu.style.zIndex = '999';

  ['gray','excess3','bcd'].forEach(t => {
    const b = document.createElement('button');
    b.textContent = t.toUpperCase();
    b.style.display = 'block';
    b.style.padding = '6px 8px';
    b.style.border = '0';
    b.style.background = 'transparent';
    b.style.cursor = 'pointer';
    b.onclick = () => {
      openConverter(t);
      toolsMenu.style.display = 'none';
    };
    toolsMenu.appendChild(b);
  });
  document.body.appendChild(toolsMenu);

  toolsBtn.addEventListener('click', (e) => {
    const rect = toolsBtn.getBoundingClientRect();
    toolsMenu.style.top = (rect.bottom + 8) + 'px';
    toolsMenu.style.left = (rect.left) + 'px';
    toolsMenu.style.display = toolsMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if(!toolsBtn.contains(e.target) && !toolsMenu.contains(e.target)){
      toolsMenu.style.display = 'none';
    }
  });

  // Chat Explain Button
  const chatExplainBtn = document.getElementById('chatExplainBtn');
  if(chatExplainBtn){
    chatExplainBtn.addEventListener('click', explainCircuit);
  }
}

// ===== TRUTH TABLE & K-MAP =====
function rebuildTruthTableAndKmap(){
  const container = document.getElementById('ttContainer');
  container.innerHTML = '';
  const rows = 2 ** state.numVars;

  // Header
  const header = document.createElement('div');
  header.className = 'row';
  state.varNames.forEach(n => {
    const c = document.createElement('div');
    c.className = 'cell';
    c.textContent = n;
    header.appendChild(c);
  });
  const oc = document.createElement('div');
  oc.className = 'cell';
  oc.textContent = 'Y';
  header.appendChild(oc);
  container.appendChild(header);

  // Rows
  for(let i = 0; i < rows; i++){
    const r = document.createElement('div');
    r.className = 'row';
    for(let v = 0; v < state.numVars; v++){
      const bit = (i >> (state.numVars - 1 - v)) & 1;
      const c = document.createElement('div');
      c.className = 'cell';
      c.textContent = bit;
      r.appendChild(c);
    }
    const btn = document.createElement('button');
    btn.className = 'cell btn';
    btn.textContent = state.ttValues[i];
    btn.dataset.idx = i;
    btn.addEventListener('click', () => toggleCellByIndex(i));
    r.appendChild(btn);
    container.appendChild(r);
  }

  buildKmap();
}

function toggleCellByIndex(idx){
  const cur = state.ttValues[idx] || '0';
  const next = cur === '0' ? '1' : (cur === '1' ? 'X' : '0');
  state.ttValues[idx] = next;

  // Update truth table
  const tb = document.querySelector('#ttContainer button[data-idx="' + idx + '"]');
  if(tb){
    tb.textContent = next;
    styleCellElement(tb, next);
  }

  // Update kmap
  const k = document.querySelector('#kmapContainer [data-idx="' + idx + '"]');
  if(k){
    k.textContent = next;
    styleCellElement(k, next);
  }

  updateSimplification();
}

function styleCellElement(el, val){
  if(!el) return;
  if(val === '1'){
    el.style.color = '#16a34a';
    el.style.fontWeight = '700';
  } else if(val === 'X'){
    el.style.color = '#f59e0b';
    el.style.fontWeight = '700';
  } else {
    el.style.color = '#64748b';
    el.style.fontWeight = '600';
  }
}

function buildKmap(){
  const k = document.getElementById('kmapContainer');
  k.innerHTML = '';
  if(state.numVars === 2) buildKmap2(k);
  else if(state.numVars === 3) buildKmap3(k);
  else if(state.numVars === 4) buildKmap4(k);
  else {
    k.innerHTML = '<div style="padding:16px;color:#64748b;font-size:14px;text-align:center;">K-Map visualizer supports up to 4 variables. Mathematical simplification is still active for ' + state.numVars + ' variables.</div>';
  }
}

function mkCell(val, idx){
  const el = document.createElement('div');
  el.className = 'cell';
  el.textContent = val;
  if(idx >= 0){
    el.dataset.idx = idx;
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => toggleCellByIndex(idx));
    styleCellElement(el, val);
  }
  return el;
}

function buildKmap2(container){
  container.style.gridTemplateColumns = 'repeat(3,1fr)';
  container.appendChild(mkCell('A \\ B'));
  container.appendChild(mkCell('B=0'));
  container.appendChild(mkCell('B=1'));
  const map = [[0,1],[2,3]];
  ['A=0','A=1'].forEach((r_lbl, r) => {
    container.appendChild(mkCell(r_lbl));
    for(let c = 0; c < 2; c++){
      const idx = map[r][c];
      container.appendChild(mkCell(state.ttValues[idx], idx));
    }
  });
}

function buildKmap3(container){
  container.style.gridTemplateColumns = 'repeat(5,1fr)';
  container.appendChild(mkCell('A \\ BC'));
  ['00','01','11','10'].forEach(l => container.appendChild(mkCell(l)));
  const map = [[0,1,3,2],[4,5,7,6]];
  ['A=0','A=1'].forEach((r_lbl, r) => {
    container.appendChild(mkCell(r_lbl));
    for(let c = 0; c < 4; c++){
      const idx = map[r][c];
      container.appendChild(mkCell(state.ttValues[idx], idx));
    }
  });
}

function buildKmap4(container){
  container.style.gridTemplateColumns = 'repeat(5,1fr)';
  container.appendChild(mkCell('AB\\CD'));
  ['00','01','11','10'].forEach(l => container.appendChild(mkCell(l)));
  const map = [[0,1,3,2],[4,5,7,6],[12,13,15,14],[8,9,11,10]];
  ['00','01','11','10'].forEach((rl, r) => {
    container.appendChild(mkCell(rl));
    for(let c = 0; c < 4; c++){
      const idx = map[r][c];
      container.appendChild(mkCell(state.ttValues[idx], idx));
    }
  });
}

// ===== SIMPLIFICATION =====
function updateSimplification(){
  const minterms = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);
  const dont = state.ttValues.map((v, i) => v === 'X' ? i : -1).filter(i => i >= 0);
  const standardSOP = getSOP(minterms, []);
  const simplifiedSOP = getSimplifiedSOP(minterms, dont);
  
  state.currentSOP = simplifiedSOP;
  document.getElementById('baseOutput').textContent = 'Y = ' + standardSOP;
  
  const simOut = document.getElementById('simplifiedOutput');
  if (simOut) simOut.textContent = 'Y = ' + simplifiedSOP;

  // Populate minterms / maxterms
  const minBox = document.getElementById('mintermsBox');
  const maxBox = document.getElementById('maxtermsBox');
  if(minBox){
    minBox.value = minterms.length ? ('m(' + minterms.join(',') + ')') : 'None';
  }
  const total = 2 ** state.numVars;
  const maxterms = state.ttValues.map((v, i) => v === '0' ? i : -1).filter(i => i >= 0);
  if(maxBox){
    maxBox.value = maxterms.length ? ('M(' + maxterms.join(',') + ')') : 'None';
  }

  // Converted expression
  const mode = document.getElementById('gateMode').value;
  let conv = '0';
  
  if(mode === 'standard') conv = simplifiedSOP;
  else if(mode === 'nand'){
    if(['0','1'].includes(simplifiedSOP)) conv = simplifiedSOP;
    else {
      let sopTerms = simplifiedSOP.split(' + ');
      let nandTerms = sopTerms.map(t => {
         let pt = parseTerm(t);
         let literals = Object.keys(pt).map(k => pt[k] ? k : k + "'");
         if (literals.length > 1) {
             return `(${literals.join(' NAND ')})`;
         } else {
             let l = literals[0];
             return `(${l.endsWith("'") ? l.slice(0, -1) : l + "'"})`;
         }
      });
      if (nandTerms.length === 1) {
         conv = `(${nandTerms[0]}) NAND 1`;
      } else {
         conv = nandTerms.join(' NAND ');
      }
    }
  } else if(mode === 'nor'){
    const pos = getSimplifiedPOS(maxterms, dont);
    if(['0','1'].includes(pos)) conv = pos;
    else {
      let posTerms = pos.split(')(').map(t => t.replace(/[()]/g, ''));
      let norTerms = posTerms.map(t => {
         if (t.includes(' + ')) {
             return `(${t.replace(/ \+ /g, ' NOR ')})`;
         } else {
             return `(${t.endsWith("'") ? t.slice(0, -1) : t + "'"})`;
         }
      });
      if (norTerms.length === 1) {
         conv = `(${norTerms[0]}) NOR 0`;
      } else {
         conv = norTerms.join(' NOR ');
      }
    }
  } else if(mode === 'custom') {
    const g1 = document.getElementById('gate1').value.toUpperCase();
    const g2 = document.getElementById('gate2').value.toUpperCase();
    
    let baseExp = simplifiedSOP;
    if (g1 === 'XOR' || g1 === 'XNOR' || g2 === 'XOR' || g2 === 'XNOR') {
        baseExp = factorParity(simplifiedSOP);
    }
    
    if (baseExp !== simplifiedSOP) {
      conv = baseExp;
    } else {
      conv = 'Invalid form';
    }
  }

  document.getElementById('convertedOutput').textContent = 'Y = ' + conv;
  calculateCircuitDelay();
}

function getSOP(minterms, dont){
  const total = 2 ** state.numVars;
  if(minterms.length === 0) return '0';
  if(minterms.length + dont.length === total) return '1';
  return minterms.map(i => {
    let s = '';
    for(let v = 0; v < state.numVars; v++){
      const bit = (i >> (state.numVars - 1 - v)) & 1;
      s += bit ? state.varNames[v] : state.varNames[v] + "'";
    }
    return s;
  }).join(' + ');
}

function getSimplifiedSOP(minterms, dontCares) {
  const total = 2 ** state.numVars;
  if (minterms.length === 0) return '0';
  if (minterms.length + dontCares.length === total) return '1';

  let terms = [...minterms, ...dontCares].map(m => {
    return { str: m.toString(2).padStart(state.numVars, '0'), minterms: [m], used: false };
  });

  let primeImplicants = [];

  function combine(t1, t2) {
    let diff = 0;
    let res = '';
    for (let i = 0; i < state.numVars; i++) {
      if (t1.str[i] !== t2.str[i]) {
        diff++;
        res += '-';
      } else {
        res += t1.str[i];
      }
    }
    return diff === 1 ? res : null;
  }

  while (terms.length > 0) {
    let nextTerms = [];
    let nextSet = new Set();
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        let combinedStr = combine(terms[i], terms[j]);
        if (combinedStr) {
          terms[i].used = true;
          terms[j].used = true;
          if (!nextSet.has(combinedStr)) {
            nextSet.add(combinedStr);
            nextTerms.push({
              str: combinedStr,
              minterms: [...new Set([...terms[i].minterms, ...terms[j].minterms])],
              used: false
            });
          }
        }
      }
    }
    for (let t of terms) {
      if (!t.used && !primeImplicants.some(p => p.str === t.str)) {
        primeImplicants.push(t);
      }
    }
    terms = nextTerms;
  }

  let uncovered = new Set(minterms);
  let essential = [];

  for (let m of minterms) {
    let covering = primeImplicants.filter(p => p.minterms.includes(m));
    if (covering.length === 1) {
      let p = covering[0];
      if (!essential.includes(p)) {
        essential.push(p);
        p.minterms.forEach(min => uncovered.delete(min));
      }
    }
  }

  let result = [...essential];
  let remaining = primeImplicants.filter(p => !essential.includes(p));

  while (uncovered.size > 0) {
    remaining.sort((a, b) => {
      let aCov = a.minterms.filter(m => uncovered.has(m)).length;
      let bCov = b.minterms.filter(m => uncovered.has(m)).length;
      return bCov - aCov;
    });
    let best = remaining.shift();
    if (!best) break;
    let coveredCount = best.minterms.filter(m => uncovered.has(m)).length;
    if (coveredCount > 0) {
      result.push(best);
      best.minterms.forEach(m => uncovered.delete(m));
    }
  }

  return result.map(p => {
    let termStr = '';
    for (let i = 0; i < state.numVars; i++) {
      if (p.str[i] === '0') termStr += state.varNames[i] + "'";
      else if (p.str[i] === '1') termStr += state.varNames[i];
    }
    return termStr === '' ? '1' : termStr;
  }).join(' + ');
}

function getSimplifiedPOS(maxterms, dontCares) {
  let fComp = getSimplifiedSOP(maxterms, dontCares);
  if (fComp === '0') return '1';
  if (fComp === '1') return '0';
  
  let terms = fComp.split(' + ');
  let posTerms = terms.map(t => {
    let pt = parseTerm(t);
    let sumParts = [];
    for (let k in pt) {
      sumParts.push(pt[k] ? k + "'" : k);
    }
    sumParts.sort();
    return '(' + sumParts.join(' + ') + ')';
  });
  return posTerms.join('');
}

function parseTerm(t) {
  let res = {};
  let vars = t.match(/[A-Z]'/g) || [];
  let unprimed = t.match(/[A-Z](?!')/g) || [];
  vars.forEach(v => res[v[0]] = false);
  unprimed.forEach(v => res[v] = true);
  return res;
}

function factorParity(sop) {
  if (sop === '0' || sop === '1') return sop;
  let terms = sop.split(' + ');
  let used = new Array(terms.length).fill(false);
  let factored = [];

  for (let i = 0; i < terms.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < terms.length; j++) {
      if (used[j]) continue;
      
      let t1 = parseTerm(terms[i]);
      let t2 = parseTerm(terms[j]);
      
      let vars1 = Object.keys(t1).sort();
      let vars2 = Object.keys(t2).sort();
      if (vars1.join(',') !== vars2.join(',')) continue;
      
      let diffVars = [];
      let sameVars = [];
      for (let v of vars1) {
        if (t1[v] !== t2[v]) diffVars.push(v);
        else sameVars.push(v);
      }
      
      if (diffVars.length === 2) {
        let v1 = diffVars[0];
        let v2 = diffVars[1];
        
        let isXOR = (t1[v1] !== t1[v2]) && (t2[v1] !== t2[v2]); 
        let isXNOR = (t1[v1] === t1[v2]) && (t2[v1] === t2[v2]);
        
        if (isXOR || isXNOR) {
          used[i] = true;
          used[j] = true;
          let operator = isXOR ? ' ⊕ ' : ' ⊙ ';
          let parityPart = `(${v1}${operator}${v2})`;
          
          let samePart = sameVars.map(v => t1[v] ? v : v + "'").join('');
          factored.push(samePart ? `${parityPart}${samePart}` : parityPart);
          break;
        }
      }
    }
    if (!used[i]) {
      factored.push(terms[i]);
    }
  }
  return factored.join(' + ');
}


// ===== CIRCUIT DELAY =====
function calculateCircuitDelay(){
  const terms = state.currentSOP.split(' + ').filter(t => t !== '0' && t !== '1');
  if(terms.length === 0){
    document.getElementById('delayOutput').textContent = 'Critical Path Delay: 0.00 ns (constant)';
    return;
  }
  const mode = document.getElementById('gateMode').value;
  let l1, l2;
  if(mode === 'nand'){
    l1 = l2 = state.gateDelays.NAND;
  } else if(mode === 'nor'){
    l1 = l2 = state.gateDelays.NOR;
  } else if(mode === 'custom'){
    l1 = state.gateDelays[document.getElementById('gate1').value] || 2.5;
    l2 = state.gateDelays[document.getElementById('gate2').value] || 2.5;
  } else {
    l1 = state.gateDelays.AND;
    l2 = state.gateDelays.OR;
  }
  document.getElementById('delayOutput').textContent = `Critical Path Delay: ${(l1 + l2).toFixed(2)} ns  (Stage1: ${l1}ns + Stage2: ${l2}ns)`;
}

// ===== CONVERTER =====
function computeConverter(){
  const v = parseInt(document.getElementById('convInput').value || 0, 10);
  const out = document.getElementById('convResult');
  if(isNaN(v) || v < 0){
    out.textContent = 'Invalid';
    out.style.color = 'red';
    return;
  }
  if(v > 99){
    out.textContent = 'Too large';
    return;
  }
  const gray = (v ^ (v >> 1)).toString(2).padStart(4, '0');
  const ex3 = (v + 3).toString(2).padStart(4, '0');
  const bcd = String(v).split('').map(d => parseInt(d).toString(2).padStart(4, '0')).join(' ');
  out.innerHTML = `<div><strong>Gray:</strong> ${gray}</div><div><strong>Excess-3:</strong> ${ex3}</div><div><strong>BCD:</strong> ${bcd}</div>`;
}

function openConverter(type){
  const v = parseInt(document.getElementById('convInput').value || 0, 10);
  const out = document.getElementById('convResult');
  if(isNaN(v) || v < 0){
    out.textContent = 'Invalid';
    out.style.color = 'red';
    return;
  }
  let res = '';
  if(type === 'gray'){
    res = (v ^ (v >> 1)).toString(2).padStart(4, '0');
    out.innerHTML = `<strong>Gray:</strong> ${res}`;
  } else if(type === 'excess3'){
    res = (v + 3).toString(2).padStart(4, '0');
    out.innerHTML = `<strong>Excess-3:</strong> ${res}`;
  } else if(type === 'bcd'){
    res = String(v).split('').map(d => parseInt(d).toString(2).padStart(4, '0')).join(' ');
    out.innerHTML = `<strong>BCD:</strong> ${res}`;
  }
}

// ===== MODAL SYSTEM =====
function openModal(renderFn){
  document.getElementById('modalBackdrop').style.display = 'flex';
  const content = document.getElementById('modalContent');
  content.innerHTML = '';
  renderFn(content);
}

function renderDelaySettingsModal(container) {
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  
  const header = document.createElement('h3');
  header.style.margin = '0 0 16px 0';
  header.textContent = 'Customize Gate Delays (ns)';
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = '12px';
  
  Object.keys(state.gateDelays).forEach(gate => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.background = '#f8f9fa';
    row.style.padding = '8px 12px';
    row.style.borderRadius = '8px';
    
    const lbl = document.createElement('label');
    lbl.textContent = gate;
    lbl.style.fontWeight = '600';
    lbl.style.margin = '0';
    
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.1';
    inp.min = '0';
    inp.value = state.gateDelays[gate];
    inp.style.width = '60px';
    inp.style.padding = '4px';
    inp.style.borderRadius = '4px';
    inp.style.border = '1px solid #ccc';
    
    inp.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.gateDelays[gate] = val;
        calculateCircuitDelay();
      }
    });
    
    row.appendChild(lbl);
    row.appendChild(inp);
    grid.appendChild(row);
  });
  
  container.appendChild(grid);
  
  const close = document.createElement('div');
  close.style.marginTop = '20px';
  close.style.textAlign = 'right';
  const btn = document.createElement('button');
  btn.textContent = 'Done';
  btn.className = 'btn';
  btn.style.background = '#0070f3';
  btn.style.color = '#fff';
  btn.onclick = closeModal;
  close.appendChild(btn);
  container.appendChild(close);
}

function closeModal(){
  document.getElementById('modalBackdrop').style.display = 'none';
  state.fullscreen = false;
}

function explainCircuit() {
  const messages = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  if(q) {
    messages.innerHTML += `<div class="chat-msg user">${q}</div>`;
    input.value = '';
  }
  
  const terms = state.currentSOP.split(' + ').filter(t => t !== '0' && t !== '1');
  let explanation = '';
  if (state.currentSOP === '0' || state.currentSOP === '1') {
    explanation = `The output is constant ${state.currentSOP}. No logic gates are required.`;
  } else {
    explanation = `<strong>Circuit Explanation:</strong><br>`;
    explanation += `1. <strong>Inputs:</strong> The circuit takes inputs ${state.varNames.join(', ')}.<br>`;
    
    // Check if NOT gates are used
    const usesNot = terms.some(t => t.includes("'"));
    if (usesNot) {
      explanation += `2. <strong>NOT Gates:</strong> Some inputs are inverted using NOT gates (complement lines run parallel to the inputs).<br>`;
    } else {
      explanation += `2. <strong>NOT Gates:</strong> No NOT gates are used in this circuit.<br>`;
    }
    
    explanation += `3. <strong>AND Gates:</strong> There are ${terms.length} AND gate(s). Each AND gate computes a product term: ${terms.join(', ')}.<br>`;
    
    if (terms.length > 1) {
      explanation += `4. <strong>OR Gate:</strong> The outputs of the AND gates are fed into a single OR gate to produce the final output Y = ${state.currentSOP}.<br>`;
    } else {
      explanation += `4. <strong>OR Gate:</strong> Since there is only one term, no OR gate is needed for the final output. Y = ${state.currentSOP}.<br>`;
    }
  }
  
  messages.innerHTML += `<div class="chat-msg bot">${explanation}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

function toggleFullscreen(){
  state.fullscreen = !state.fullscreen;
  const modal = document.getElementById('modalContent');

  if(state.fullscreen){
    modal.classList.add('fullscreen');
  } else {
    modal.classList.remove('fullscreen');
  }
}

// ===== CIRCUIT DIAGRAM (Advanced Rendering) =====
function renderSchematicModal(container){
  container.style.maxHeight = '80vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  // Header with fullscreen button
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '12px';
  
  const titleBox = document.createElement('div');
  titleBox.style.display = 'flex';
  titleBox.style.alignItems = 'center';
  titleBox.style.gap = '12px';
  titleBox.innerHTML = '<h3 style="margin:0">Circuit Diagram</h3>';
  
  const modeSel = document.createElement('select');
  modeSel.id = 'schematicModeSelect';
  modeSel.style.padding = '6px';
  modeSel.style.borderRadius = '6px';
  modeSel.style.border = '1px solid #e5e7eb';
  modeSel.innerHTML = `
    <option value="standard">Standard SOP (AND-OR)</option>
    <option value="nand">NAND-only</option>
    <option value="nor">NOR-only</option>
    <option value="converted">Converted Expression</option>
  `;
  modeSel.addEventListener('change', () => {
    const svg = document.querySelector('#modalContent svg');
    if (svg) renderAdvancedCircuit(svg);
  });
  titleBox.appendChild(modeSel);

  const fsBtn = document.createElement('button');
  fsBtn.className = 'fs-btn';
  fsBtn.textContent = '⛶ Fullscreen';
  fsBtn.addEventListener('click', toggleFullscreen);
  
  header.appendChild(titleBox);
  header.appendChild(fsBtn);
  container.appendChild(header);

  // SVG Canvas (scrollable content)
  const svgWrapper = document.createElement('div');
  svgWrapper.style.flex = '1';
  svgWrapper.style.overflow = 'auto';
  svgWrapper.style.background = '#f8f9fa';
  svgWrapper.style.borderRadius = '8px';
  svgWrapper.style.border = '1px solid #e5e7eb';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1200');
  svg.setAttribute('height', '700');
  svg.setAttribute('viewBox', '0 0 1200 700');
  svg.style.display = 'block';

  renderAdvancedCircuit(svg);
  svgWrapper.appendChild(svg);
  container.appendChild(svgWrapper);

  // Close button
  const close = document.createElement('div');
  close.style.marginTop = '12px';
  const btn = document.createElement('button');
  btn.textContent = 'Close';
  btn.className = 'btn';
  btn.onclick = closeModal;
  close.appendChild(btn);
  container.appendChild(close);
}

function renderAdvancedCircuit(svg){
  const svgNS = svg.namespaceURI;
  svg.innerHTML = '';
  const mode = document.getElementById('schematicModeSelect')?.value || 'standard';

  let globalStage2GateType = 'AND';
  let globalStage3GateType = 'OR';
  if (mode === 'converted') {
    const mainMode = document.getElementById('gateMode').value;
    if (mainMode === 'nand') { globalStage2GateType = 'NAND'; globalStage3GateType = 'NAND'; }
    else if (mainMode === 'nor') { globalStage2GateType = 'NOR'; globalStage3GateType = 'NOR'; }
    else if (mainMode === 'custom') {
      globalStage2GateType = document.getElementById('gate1').value.toUpperCase();
      globalStage3GateType = document.getElementById('gate2').value.toUpperCase();
    }
  } else {
    globalStage2GateType = mode === 'nor' ? 'NOR' : (mode === 'nand' ? 'NAND' : 'AND');
    globalStage3GateType = mode === 'nor' ? 'NOR' : (mode === 'nand' ? 'NAND' : 'OR');
  }

  // Background grid
  const defs = document.createElementNS(svgNS, 'defs');
  const pattern = document.createElementNS(svgNS, 'pattern');
  pattern.setAttribute('id', 'grid');
  pattern.setAttribute('width', '20');
  pattern.setAttribute('height', '20');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M 20 0 L 0 0 0 20');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#e5e7eb');
  path.setAttribute('stroke-width', '0.5');
  pattern.appendChild(path);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const bg = document.createElementNS(svgNS, 'rect');
  bg.setAttribute('width', '1200');
  bg.setAttribute('height', '700');
  bg.setAttribute('fill', 'url(#grid)');
  svg.appendChild(bg);

  const terms = state.currentSOP.split(' + ').filter(t => t !== '0' && t !== '1');

  if(terms.length === 0){
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', '600');
    txt.setAttribute('y', '350');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '20');
    txt.setAttribute('fill', '#4ade80');
    txt.textContent = `Output Y: Constant ${state.currentSOP}`;
    svg.appendChild(txt);
    return;
  }

  // Configuration
  const MARGIN_LEFT = 80;
  const MARGIN_TOP = 60;
  const VAR_SPACING = 120;
  const AND_GATE_X = MARGIN_LEFT + state.numVars * VAR_SPACING + 40;
  const AND_GATE_WIDTH = 90;
  const OR_GATE_X = AND_GATE_X + 200;
  const OR_GATE_WIDTH = 100;
  const OUTPUT_X = OR_GATE_X + 180;

  // Helper functions
  function addWire(x1, y1, x2, y2, color = '#64748b', width = 2){
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', width);
    svg.appendChild(line);
  }

  function addOrthPath(points, color = '#64748b', width = 2){
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for(let i = 1; i < points.length; i++){
      pathData += ` L ${points[i].x} ${points[i].y}`;
    }
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }

  function addLabel(x, y, text, size = 12, color = '#0f172a', anchor = 'middle'){
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('font-size', size);
    label.setAttribute('fill', color);
    label.setAttribute('text-anchor', anchor);
    label.setAttribute('font-weight', '600');
    label.textContent = text;
    svg.appendChild(label);
  }

  function addThinTerminal(x, y, color = '#0070f3'){
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '2');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);
  }

  // ==== Stage 0 & 1: Input Rails and Parallel NOT Gates ====
  addLabel(MARGIN_LEFT - 10, MARGIN_TOP - 25, 'INPUTS & COMPLEMENTS', 11, '#0070f3');
  const inputRails = [];
  const complementRails = [];
  
  for(let i = 0; i < state.numVars; i++){
    const inX = MARGIN_LEFT + i * VAR_SPACING;
    const notX = inX + 25; 
    const compX = notX + 32; 
    const y = MARGIN_TOP;
    
    addLabel(inX, y, state.varNames[i], 13, '#0070f3');
    addLabel(compX, y, state.varNames[i] + "'", 13, '#f59e0b');
    
    addThinTerminal(inX, y + 20, '#0070f3');
    addWire(inX, y + 20, inX, 650, '#c7defa', 3);
    inputRails.push({x: inX, yStart: y + 20, color: '#0070f3'});
    
    const notBranchY = y + 40;
    addThinTerminal(inX, notBranchY, '#0070f3');
    addWire(inX, notBranchY, notX, notBranchY, '#c7defa', 1.5);
    
    const tri = document.createElementNS(svgNS, 'polygon');
    tri.setAttribute('points', `${notX},${notBranchY-8} ${notX},${notBranchY+8} ${notX+18},${notBranchY}`);
    tri.setAttribute('fill', '#fff');
    tri.setAttribute('stroke', '#f59e0b');
    tri.setAttribute('stroke-width', '1.5');
    svg.appendChild(tri);

    const bubble = document.createElementNS(svgNS, 'circle');
    bubble.setAttribute('cx', notX + 26);
    bubble.setAttribute('cy', notBranchY);
    bubble.setAttribute('r', '4');
    bubble.setAttribute('fill', '#fff');
    bubble.setAttribute('stroke', '#f59e0b');
    bubble.setAttribute('stroke-width', '1.5');
    svg.appendChild(bubble);

    addThinTerminal(compX, notBranchY, '#f59e0b');
    addWire(compX, notBranchY, compX, 650, '#facc15', 3);
    complementRails.push({x: compX, yStart: notBranchY, varIdx: i, color: '#f59e0b'});
  }

  // ==== Stage 2: AND gates for each product term ====
  addLabel(AND_GATE_X + AND_GATE_WIDTH/2 - 10, MARGIN_TOP - 25, 'AND GATES', 10, '#0070f3');
  const andGates = [];
  const andGateSpacing = Math.max(80, (650 - MARGIN_TOP - 40) / Math.max(1, terms.length));

  terms.forEach((term, idx) => {
    const andY = MARGIN_TOP + 80 + idx * andGateSpacing;
    const andCenterX = AND_GATE_X + AND_GATE_WIDTH / 2;
    const andCenterY = andY;

    // Collect input sources for this term
    const inputs = [];
    state.varNames.forEach((v, vi) => {
      if(term.includes(v)){
        // Use input rail
        inputs.push({source: 'input', x: inputRails[vi].x, y: inputRails[vi].yStart, color: '#0070f3', varIdx: vi});
      } else if(term.includes(v + "'")){
        // Use complement rail
        inputs.push({source: 'complement', x: complementRails[vi].x, y: complementRails[vi].yStart, color: '#f59e0b', varIdx: vi});
      }
    });

    // Route wires from rails to AND gate - THIN TERMINAL CONNECTIONS
    const inputCount = inputs.length;
    const pinSpacing = inputCount > 1 ? 18 : 0;

    inputs.forEach((input, pinIdx) => {
      const pinY = andCenterY - ((inputCount - 1) * pinSpacing / 2) + pinIdx * pinSpacing;

      // Connect from rail to AND gate with thin terminal
      addOrthPath([
        {x: input.x, y: pinY},
        {x: AND_GATE_X - 8, y: pinY}
      ], input.color, 1.5);

      addThinTerminal(AND_GATE_X - 8, pinY, input.color);
    });

    const stage2GateType = globalStage2GateType;

    const isOrShape = ['NOR', 'OR', 'XOR', 'XNOR'].includes(stage2GateType);
    const hasBubble = ['NOR', 'NAND', 'XNOR'].includes(stage2GateType);

    if (isOrShape) {
      const g = document.createElementNS(svgNS, 'path');
      g.setAttribute('d', `M ${AND_GATE_X},${andCenterY - 20} 
        Q ${AND_GATE_X + AND_GATE_WIDTH * 0.5},${andCenterY - 20} ${AND_GATE_X + AND_GATE_WIDTH},${andCenterY} 
        Q ${AND_GATE_X + AND_GATE_WIDTH * 0.5},${andCenterY + 20} ${AND_GATE_X},${andCenterY + 20} 
        Q ${AND_GATE_X + AND_GATE_WIDTH * 0.3},${andCenterY} ${AND_GATE_X},${andCenterY - 20} Z`);
      g.setAttribute('fill', '#fff');
      g.setAttribute('stroke', '#0070f3');
      g.setAttribute('stroke-width', '2');
      svg.appendChild(g);
      
      if (stage2GateType === 'XOR' || stage2GateType === 'XNOR') {
        const curve = document.createElementNS(svgNS, 'path');
        curve.setAttribute('d', `M ${AND_GATE_X - 6},${andCenterY - 20} Q ${AND_GATE_X + AND_GATE_WIDTH * 0.3 - 6},${andCenterY} ${AND_GATE_X - 6},${andCenterY + 20}`);
        curve.setAttribute('fill', 'none');
        curve.setAttribute('stroke', '#0070f3');
        curve.setAttribute('stroke-width', '2');
        svg.appendChild(curve);
      }

      if (hasBubble) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', AND_GATE_X + AND_GATE_WIDTH + 4);
        bub.setAttribute('cy', andCenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#0070f3');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
    } else {
      const andRect = document.createElementNS(svgNS, 'path');
      andRect.setAttribute('d', `M ${AND_GATE_X},${andCenterY - 20} 
        L ${AND_GATE_X + AND_GATE_WIDTH * 0.5},${andCenterY - 20} 
        A ${AND_GATE_WIDTH * 0.5},20 0 0,1 ${AND_GATE_X + AND_GATE_WIDTH * 0.5},${andCenterY + 20} 
        L ${AND_GATE_X},${andCenterY + 20} Z`);
      andRect.setAttribute('fill', '#fff');
      andRect.setAttribute('stroke', '#0070f3');
      andRect.setAttribute('stroke-width', '2');
      svg.appendChild(andRect);
      
      if (hasBubble) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', AND_GATE_X + AND_GATE_WIDTH + 4);
        bub.setAttribute('cy', andCenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#0070f3');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
    }
    addLabel(andCenterX - 5, andCenterY + 3, stage2GateType, 10, '#0070f3');

    const andOutActual = AND_GATE_X + AND_GATE_WIDTH + (hasBubble ? 8 : 0);
    addThinTerminal(andOutActual + 5, andCenterY, '#16a34a');
    addWire(andOutActual + 5, andCenterY, OR_GATE_X - 30, andCenterY, '#94a3b8', 2);

    andGates.push({x: andOutActual + 5, y: andCenterY});
  });

  const stage3GateType = globalStage3GateType;
  addLabel(OR_GATE_X + OR_GATE_WIDTH/2 - 5, MARGIN_TOP - 25, stage3GateType + ' GATE', 10, '#10b981');
  const orCenterY = MARGIN_TOP + 80 + ((terms.length - 1) * andGateSpacing) / 2;
  const orCenterX = OR_GATE_X + OR_GATE_WIDTH / 2;

  // Route AND outputs to Stage 3 with thin terminals
  andGates.forEach((andOut, idx) => {
    const lanes = Math.max(1, Math.ceil(terms.length / 2));
    const laneY = orCenterY + (idx % lanes) * 22 - ((lanes - 1) * 22) / 2;
    const connectX = ['NAND', 'NOT'].includes(stage3GateType) ? OR_GATE_X : OR_GATE_X + 10;

    addOrthPath([
      {x: andOut.x, y: andOut.y},
      {x: OR_GATE_X - 25, y: andOut.y},
      {x: OR_GATE_X - 25, y: laneY},
      {x: connectX, y: laneY}
    ], '#94a3b8', 1.5);

    addThinTerminal(connectX, laneY, '#94a3b8');
  });

  const isOrShape3 = ['NOR', 'OR', 'XOR', 'XNOR'].includes(stage3GateType);
  const hasBubble3 = ['NOR', 'NAND', 'XNOR', 'NOT'].includes(stage3GateType);

  if (!isOrShape3) {
    if (stage3GateType === 'NOT') {
      const tri = document.createElementNS(svgNS, 'polygon');
      tri.setAttribute('points', `${OR_GATE_X},${orCenterY-20} ${OR_GATE_X},${orCenterY+20} ${OR_GATE_X+OR_GATE_WIDTH},${orCenterY}`);
      tri.setAttribute('fill', '#fff');
      tri.setAttribute('stroke', '#10b981');
      tri.setAttribute('stroke-width', '2');
      svg.appendChild(tri);
    } else {
      const g = document.createElementNS(svgNS, 'path');
      g.setAttribute('d', `M ${OR_GATE_X},${orCenterY - 20} 
        L ${OR_GATE_X + OR_GATE_WIDTH * 0.5},${orCenterY - 20} 
        A ${OR_GATE_WIDTH * 0.5},20 0 0,1 ${OR_GATE_X + OR_GATE_WIDTH * 0.5},${orCenterY + 20} 
        L ${OR_GATE_X},${orCenterY + 20} Z`);
      g.setAttribute('fill', '#fff');
      g.setAttribute('stroke', '#10b981');
      g.setAttribute('stroke-width', '2');
      svg.appendChild(g);
    }
    
    if (hasBubble3) {
      const bub = document.createElementNS(svgNS, 'circle');
      bub.setAttribute('cx', OR_GATE_X + OR_GATE_WIDTH + 4);
      bub.setAttribute('cy', orCenterY);
      bub.setAttribute('r', '4');
      bub.setAttribute('fill', '#fff');
      bub.setAttribute('stroke', '#10b981');
      bub.setAttribute('stroke-width', '1.5');
      svg.appendChild(bub);
    }
  } else {
    const orGate = document.createElementNS(svgNS, 'path');
    orGate.setAttribute('d', `M ${OR_GATE_X},${orCenterY - 25} 
      Q ${OR_GATE_X + OR_GATE_WIDTH * 0.5},${orCenterY - 25} ${OR_GATE_X + OR_GATE_WIDTH},${orCenterY} 
      Q ${OR_GATE_X + OR_GATE_WIDTH * 0.5},${orCenterY + 25} ${OR_GATE_X},${orCenterY + 25} 
      Q ${OR_GATE_X + OR_GATE_WIDTH * 0.3},${orCenterY} ${OR_GATE_X},${orCenterY - 25} Z`);
    orGate.setAttribute('fill', '#fff');
    orGate.setAttribute('stroke', '#10b981');
    orGate.setAttribute('stroke-width', '2');
    svg.appendChild(orGate);

    if (stage3GateType === 'XOR' || stage3GateType === 'XNOR') {
      const curve = document.createElementNS(svgNS, 'path');
      curve.setAttribute('d', `M ${OR_GATE_X - 6},${orCenterY - 25} Q ${OR_GATE_X + OR_GATE_WIDTH * 0.3 - 6},${orCenterY} ${OR_GATE_X - 6},${orCenterY + 25}`);
      curve.setAttribute('fill', 'none');
      curve.setAttribute('stroke', '#10b981');
      curve.setAttribute('stroke-width', '2');
      svg.appendChild(curve);
    }
    
    if (hasBubble3) {
      const bub = document.createElementNS(svgNS, 'circle');
      bub.setAttribute('cx', OR_GATE_X + OR_GATE_WIDTH + 4);
      bub.setAttribute('cy', orCenterY);
      bub.setAttribute('r', '4');
      bub.setAttribute('fill', '#fff');
      bub.setAttribute('stroke', '#10b981');
      bub.setAttribute('stroke-width', '1.5');
      svg.appendChild(bub);
    }
  }
  addLabel(orCenterX - 5, orCenterY + 3, stage3GateType, 10, '#10b981');

  // ==== Output ====
  const orOutActual = OR_GATE_X + OR_GATE_WIDTH + (hasBubble3 ? 8 : 0);
  addThinTerminal(orOutActual + 5, orCenterY, '#10b981');
  addWire(orOutActual + 5, orCenterY, OUTPUT_X - 20, orCenterY, '#10b981', 3);
  addLabel(OUTPUT_X, orCenterY - 15, 'Y', 16, '#10b981');
  addThinTerminal(OUTPUT_X, orCenterY, '#10b981');
}

// ===== TIMING WAVEFORM =====
function renderTimingModal(container){
  container.style.maxHeight = '80vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  // Header with fullscreen button
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '12px';
  header.innerHTML = '<h3 style="margin:0">Timing Waveforms</h3>';
  const fsBtn = document.createElement('button');
  fsBtn.className = 'fs-btn';
  fsBtn.textContent = '⛶ Fullscreen';
  fsBtn.addEventListener('click', toggleFullscreen);
  header.appendChild(fsBtn);
  container.appendChild(header);

  // Mode selector
  const modes = document.createElement('div');
  modes.style.display = 'flex';
  modes.style.gap = '8px';
  modes.style.alignItems = 'center';
  modes.style.marginBottom = '12px';
  const sel = document.createElement('select');
  sel.id = 'timingModeSelect';
  sel.style.padding = '8px';
  sel.style.borderRadius = '8px';
  modes.appendChild(sel);
  container.appendChild(modes);

  // Canvas wrapper (scrollable)
  const canvasWrapper = document.createElement('div');
  canvasWrapper.style.flex = '1';
  canvasWrapper.style.overflow = 'auto';
  canvasWrapper.style.background = '#f8f9fa';
  canvasWrapper.style.borderRadius = '8px';
  canvasWrapper.style.border = '1px solid #e5e7eb';

  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 600;
  canvas.style.display = 'block';
  canvas.style.padding = '20px';
  canvas.style.background = '#fff';

  canvasWrapper.appendChild(canvas);
  container.appendChild(canvasWrapper);

  // Close button
  const close = document.createElement('div');
  close.style.marginTop = '12px';
  const btn = document.createElement('button');
  btn.textContent = 'Close';
  btn.className = 'btn';
  btn.onclick = closeModal;
  close.appendChild(btn);
  container.appendChild(close);

  // Populate and render
  const terms = state.currentSOP.split(' + ').filter(t => t !== '0' && t !== '1');
  sel.appendChild(new Option('Full Circuit Timing Waveform', 'full'));
  terms.forEach(t => sel.appendChild(new Option(`Stage 1: ${t}`, 'term:' + t)));
  if(terms.length) sel.appendChild(new Option('Stage 2: Combining OR Gate', 'stage2'));

  function drawWaveforms(){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTimingWaveformsAdvanced(ctx, canvas.width, canvas.height);
  }

  sel.addEventListener('change', drawWaveforms);
  drawWaveforms();
}

function drawTimingWaveformsAdvanced(ctx, width, height){
  const mode = document.getElementById('timingModeSelect')?.value || 'full';
  const periods = 16;
  const step = width / periods - 40;
  const xStart = 80;
  const yStart = 40;
  const gap = 45;

  // Grid background
  ctx.strokeStyle = '#e5e7eb';
  ctx.setLineDash([4, 4]);
  for(let t = 0; t <= periods; t++){
    const x = xStart + t * step;
    ctx.beginPath();
    ctx.moveTo(x, yStart);
    ctx.lineTo(x, yStart + (state.numVars + 2) * gap);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Input waveforms
  for(let v = 0; v < state.numVars; v++){
    const y = yStart + v * gap;
    ctx.fillStyle = '#0070f3';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('In ' + state.varNames[v], xStart - 10, y + 5);

    for(let t = 0; t < periods; t++){
      const bit = (t >> (state.numVars - 1 - v)) & 1;
      const x1 = xStart + t * step;
      const x2 = xStart + (t + 1) * step;
      const lineY = y - (bit ? 15 : 0);
      ctx.strokeStyle = '#0070f3';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, lineY);
      ctx.lineTo(x2, lineY);
      ctx.stroke();
      // Transition line
      if(t < periods - 1){
        const nextBit = ((t + 1) >> (state.numVars - 1 - v)) & 1;
        if(bit !== nextBit){
          ctx.strokeStyle = '#c7defa';
          ctx.beginPath();
          ctx.moveTo(x2, lineY);
          ctx.lineTo(x2, y - (nextBit ? 15 : 0));
          ctx.stroke();
        }
      }
    }
  }

  // Output waveform
  const outY = yStart + state.numVars * gap;
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(mode.includes('full') ? 'Output Y' : 'Gate Out', xStart - 10, outY + 5);

  for(let t = 0; t < periods; t++){
    let bit = 0;
    if(mode === 'full'){
      const raw = t < state.ttValues.length ? state.ttValues[t] : '0';
      bit = raw === '1' ? 1 : 0;
    } else if(mode.startsWith('term')){
      const termName = mode.split(':')[1];
      for(let v = 0; v < state.numVars; v++){
        const vbit = (t >> (state.numVars - 1 - v)) & 1;
        const vname = state.varNames[v];
        if(termName.includes(vname) && !termName.includes(vname + "'") && vbit === 0) break;
        if(termName.includes(vname + "'") && vbit === 1) break;
        if(v === state.numVars - 1) bit = 1;
      }
    }

    const x1 = xStart + t * step;
    const x2 = xStart + (t + 1) * step;
    const lineY = outY - (bit ? 15 : 0);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, lineY);
    ctx.lineTo(x2, lineY);
    ctx.stroke();
    // Transition
    if(t < periods - 1){
      let nextBit = 0;
      if(mode === 'full'){
        const raw = (t + 1) < state.ttValues.length ? state.ttValues[t + 1] : '0';
        nextBit = raw === '1' ? 1 : 0;
      }
      if(bit !== nextBit){
        ctx.strokeStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.moveTo(x2, lineY);
        ctx.lineTo(x2, outY - (nextBit ? 15 : 0));
        ctx.stroke();
      }
    }
  }

  // Time axis
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for(let t = 0; t <= periods; t++){
    const x = xStart + t * step;
    ctx.fillText('t' + t, x, yStart + (state.numVars + 2) * gap + 18);
  }
}

// Expose for debugging
window.__DLA = {state, updateSimplification, renderAdvancedCircuit};
