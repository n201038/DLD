// Digital Logic Analyzer & Verilog HDL Generator Suite
const state = {
  numVars: 3,
  varNames: ['A','B','C'],
  ttValues: [],
  gateDelays: {AND:2.5,OR:2.5,NAND:1.5,NOR:1.5,NOT:1.0,XOR:3.5,XNOR:3.5},
  currentSOP: '0',
  currentConverted: '0',
  fullscreen: false,
  activeVerilogTab: 'dataflow',
  isVerilogModalOpen: false,
  activeHistoryTab: 'saved' // 'saved' | 'history'
};

// Storage Keys & Constants
const STORAGE_KEY = 'dla_saved_circuits_v1';
const HISTORY_KEY = 'dla_circuit_history_v1';
const DEFAULT_FOLDER = 'Saved Circuits';

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  initStorage();
  bindUI();
  rebuildTruthTableAndKmap();
  updateSimplification();
});

function initDefaults(){
  const total = 2 ** state.numVars;
  state.ttValues = Array.from({length: total}, (_, i) => i % 2 ? '1' : '0');
}

// ===== STORAGE & DEFAULT FOLDER SYSTEM =====
function initStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || JSON.parse(raw).length === 0) {
      // Create default folder with starter circuits
      const starterCircuits = [
        {
          id: 'circ_full_adder',
          name: 'Full_Adder',
          folder: DEFAULT_FOLDER,
          timestamp: new Date().toLocaleString(),
          expression: 'A ⊕ B ⊕ C',
          numVars: 3,
          varNames: ['A','B','C'],
          ttValues: ['0','1','1','0','1','0','0','1'],
          gateMode: 'standard',
          gate1: 'AND',
          gate2: 'OR'
        },
        {
          id: 'circ_mux_2to1',
          name: '2to1_Multiplexer',
          folder: DEFAULT_FOLDER,
          timestamp: new Date().toLocaleString(),
          expression: "S'A + SB",
          numVars: 3,
          varNames: ['A','B','S'],
          ttValues: ['0','0','0','1','1','0','1','1'],
          gateMode: 'standard',
          gate1: 'AND',
          gate2: 'OR'
        },
        {
          id: 'circ_majority',
          name: 'Majority_Gate',
          folder: DEFAULT_FOLDER,
          timestamp: new Date().toLocaleString(),
          expression: 'AB + BC + AC',
          numVars: 3,
          varNames: ['A','B','C'],
          ttValues: ['0','0','0','1','0','1','1','1'],
          gateMode: 'standard',
          gate1: 'AND',
          gate2: 'OR'
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starterCircuits));
    }
  } catch(e) {
    console.warn('Storage initialization note:', e);
  }
}

function getSavedFiles(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function saveCircuitFile(name, folder = DEFAULT_FOLDER){
  const cleanName = (name || `Circuit_${new Date().toISOString().slice(0,10)}`).trim();
  const files = getSavedFiles();
  const currentExpr = document.getElementById('expressionInput')?.value || state.currentSOP;
  
  const newFile = {
    id: 'circ_' + Date.now(),
    name: cleanName,
    folder: folder,
    timestamp: new Date().toLocaleString(),
    expression: currentExpr,
    numVars: state.numVars,
    varNames: [...state.varNames],
    ttValues: [...state.ttValues],
    gateMode: document.getElementById('gateMode')?.value || 'standard',
    gate1: document.getElementById('gate1')?.value || 'AND',
    gate2: document.getElementById('gate2')?.value || 'OR'
  };

  const idx = files.findIndex(f => f.name.toLowerCase() === cleanName.toLowerCase() && f.folder === folder);
  if (idx >= 0) {
    files[idx] = newFile;
  } else {
    files.unshift(newFile);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  return newFile;
}

function deleteCircuitFile(fileId){
  const files = getSavedFiles().filter(f => f.id !== fileId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function renameCircuitFile(fileId, newName){
  const files = getSavedFiles();
  const file = files.find(f => f.id === fileId);
  if (file && newName && newName.trim()) {
    file.name = newName.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }
}

function loadCircuitState(data){
  if (!data) return;
  state.numVars = data.numVars || 3;
  state.varNames = data.varNames || ['A','B','C'];
  state.ttValues = data.ttValues || Array.from({length: 2**state.numVars}, () => '0');

  const manualNumVars = document.getElementById('manualNumVars');
  const manualVarNames = document.getElementById('manualVarNames');
  if (manualNumVars) manualNumVars.value = state.numVars;
  if (manualVarNames) manualVarNames.value = state.varNames.join(', ');

  const exprInput = document.getElementById('expressionInput');
  if (exprInput) exprInput.value = data.expression || '';

  const gateMode = document.getElementById('gateMode');
  if (gateMode && data.gateMode) {
    gateMode.value = data.gateMode;
    const customGates = document.getElementById('customGates');
    if (customGates) customGates.style.display = data.gateMode === 'custom' ? 'block' : 'none';
  }

  const gate1 = document.getElementById('gate1');
  const gate2 = document.getElementById('gate2');
  if (gate1 && data.gate1) gate1.value = data.gate1;
  if (gate2 && data.gate2) gate2.value = data.gate2;

  rebuildTruthTableAndKmap();
  updateSimplification();
  closeModal();
  showToast(`Loaded "${data.name || 'Circuit'}" from ${data.folder || 'Saved Circuits'}/ folder!`);
}

// ===== HISTORY TRACKER =====
function getHistoryLog(){
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

let historyDebounce = null;
function recordHistory(label){
  clearTimeout(historyDebounce);
  historyDebounce = setTimeout(() => {
    try {
      const history = getHistoryLog();
      const currentExpr = document.getElementById('expressionInput')?.value || state.currentSOP;
      
      if (history.length > 0 && history[0].expression === currentExpr && history[0].numVars === state.numVars) {
        return;
      }

      const entry = {
        id: 'hist_' + Date.now(),
        label: label || currentExpr || 'Circuit State',
        expression: currentExpr,
        numVars: state.numVars,
        varNames: [...state.varNames],
        ttValues: [...state.ttValues],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      history.unshift(entry);
      if (history.length > 25) history.pop();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
  }, 1000);
}

function clearHistoryLog(){
  localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
}

// ===== DOWNLOAD / EXPORT HELPER =====
function downloadFile(filename, text, mimeType = 'text/plain'){
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      if (varErrorMsg) {
        varErrorMsg.textContent = 'Number of variables must be between 2 and 10.';
        varErrorMsg.style.display = 'block';
      }
      if (buildTableBtn) buildTableBtn.disabled = true;
      return null;
    }
    
    if (namesRaw.length !== num) {
      if (varErrorMsg) {
        varErrorMsg.textContent = `Expected ${num} variable names, but got ${namesRaw.length}.`;
        varErrorMsg.style.display = 'block';
      }
      if (buildTableBtn) buildTableBtn.disabled = true;
      return null;
    }
    
    // Check for duplicates
    if (new Set(namesRaw).size !== namesRaw.length) {
      if (varErrorMsg) {
        varErrorMsg.textContent = 'Variable names must be unique.';
        varErrorMsg.style.display = 'block';
      }
      if (buildTableBtn) buildTableBtn.disabled = true;
      return null;
    }

    if (varErrorMsg) varErrorMsg.style.display = 'none';
    if (buildTableBtn) buildTableBtn.disabled = false;
    return { num, names: namesRaw };
  }

  if (manualNumVars) manualNumVars.addEventListener('input', parseVariables);
  if (manualVarNames) manualVarNames.addEventListener('input', parseVariables);

  if (buildTableBtn) {
    buildTableBtn.addEventListener('click', () => {
      const parsed = parseVariables();
      if (parsed) {
        state.numVars = parsed.num;
        state.varNames = parsed.names;
        initDefaults();
        rebuildTruthTableAndKmap();
        updateSimplification();
        recordHistory('Manual Build');
      }
    });
  }

  // Expression Input Setup
  bindExpressionInput();

  // Save & History UI Buttons
  const saveCircuitBtn = document.getElementById('saveCircuitBtn');
  if (saveCircuitBtn) {
    saveCircuitBtn.addEventListener('click', () => openModal(renderSaveModal));
  }

  const asideSaveBtn = document.getElementById('asideSaveBtn');
  if (asideSaveBtn) {
    asideSaveBtn.addEventListener('click', () => openModal(renderSaveModal));
  }

  const quickSaveExprBtn = document.getElementById('quickSaveExprBtn');
  if (quickSaveExprBtn) {
    quickSaveExprBtn.addEventListener('click', () => openModal(renderSaveModal));
  }

  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => openModal(renderHistoryModal));
  }

  // Import JSON File input listener
  const importFileInput = document.getElementById('importFileInput');
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.numVars && data.varNames && data.ttValues) {
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            data.name = data.name || fileName;
            data.folder = DEFAULT_FOLDER;
            const saved = saveCircuitFile(data.name, DEFAULT_FOLDER);
            loadCircuitState(data);
            showToast(`Imported and saved "${data.name}" to Saved Circuits/!`);
          } else {
            alert('Invalid circuit file format.');
          }
        } catch(err) {
          alert('Failed to parse circuit file: ' + err.message);
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });
  }

  // Gate mode
  const gateModeSelect = document.getElementById('gateMode');
  if (gateModeSelect) {
    gateModeSelect.addEventListener('change', e => {
      const customGates = document.getElementById('customGates');
      if (customGates) customGates.style.display = e.target.value === 'custom' ? 'block' : 'none';
      updateSimplification();
    });
  }

  const gate1 = document.getElementById('gate1');
  const gate2 = document.getElementById('gate2');
  if (gate1) gate1.addEventListener('change', updateSimplification);
  if (gate2) gate2.addEventListener('change', updateSimplification);

  // Converter
  const convInput = document.getElementById('convInput');
  if (convInput) convInput.addEventListener('input', computeConverter);

  // Verilog Modal buttons
  const verilogBtn = document.getElementById('verilogBtn');
  if (verilogBtn) {
    verilogBtn.addEventListener('click', () => openModal(renderVerilogModal));
  }
  const asideVerilogBtn = document.getElementById('asideVerilogBtn');
  if (asideVerilogBtn) {
    asideVerilogBtn.addEventListener('click', () => openModal(renderVerilogModal));
  }

  // Waveform & Schematic Modal buttons
  const waveBtn = document.getElementById('waveBtn');
  if (waveBtn) waveBtn.addEventListener('click', () => openModal(renderTimingModal));
  
  const schematicBtn = document.getElementById('schematicBtn');
  if (schematicBtn) schematicBtn.addEventListener('click', () => openModal(renderSchematicModal));
  
  // Delay Settings Modal
  const delaySettingsBtn = document.getElementById('delaySettingsBtn');
  if (delaySettingsBtn) {
    delaySettingsBtn.addEventListener('click', () => openModal(renderDelaySettingsModal));
  }

  // Tools menu
  const toolsBtn = document.getElementById('toolsBtn');
  if (toolsBtn) {
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
  }

  // Chat Explain Button
  const chatExplainBtn = document.getElementById('chatExplainBtn');
  if(chatExplainBtn){
    chatExplainBtn.addEventListener('click', explainCircuit);
  }

  // Floating Explanation Panel Drag & Controls
  setupFloatingExplanationControls();
}

// ===== SAVE MODAL SYSTEM =====
function renderSaveModal(container){
  state.isVerilogModalOpen = false;
  container.style.maxHeight = '85vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '16px';
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0070f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      <h3 style="margin:0;font-size:16px">Save Circuit File to Folder</h3>
    </div>
  `;
  container.appendChild(header);

  const body = document.createElement('div');
  body.style.flex = '1';
  body.style.overflowY = 'auto';

  // Smart default name
  let defaultName = 'Circuit_' + state.varNames.join('');
  const currentExpr = document.getElementById('expressionInput')?.value.trim();
  if (currentExpr && currentExpr.length <= 25) {
    defaultName = currentExpr.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  const minterms = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);
  const total = 2 ** state.numVars;

  body.innerHTML = `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <div style="font-size:24px">📁</div>
      <div>
        <div style="font-weight:700;font-size:13px;color:#0369a1">Target Folder: ${DEFAULT_FOLDER}/</div>
        <div style="font-size:12px;color:#0284c7">All saved files are safely preserved in this folder.</div>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <label style="font-weight:600;color:#0f172a;margin-bottom:6px">Circuit File Name</label>
      <input type="text" id="saveCircuitNameInput" value="${defaultName}" placeholder="e.g. Full_Adder, 2to1_MUX" style="padding:10px;font-size:14px;font-weight:600">
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:16px">
      <div style="font-weight:600;font-size:12px;color:var(--muted);margin-bottom:6px">CIRCUIT PREVIEW</div>
      <div style="font-size:13px;margin-bottom:4px"><strong>Expression:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;color:#0070f3">Y = ${state.currentSOP}</code></div>
      <div style="font-size:13px;margin-bottom:4px"><strong>Variables:</strong> ${state.varNames.join(', ')} (${state.numVars} inputs)</div>
      <div style="font-size:13px"><strong>Active Minterms:</strong> ${minterms.length} of ${total} combinations</div>
    </div>
  `;
  container.appendChild(body);

  // Footer Actions
  const footer = document.createElement('div');
  footer.style.marginTop = '16px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.gap = '8px';
  footer.style.flexWrap = 'wrap';

  const leftBtns = document.createElement('div');
  leftBtns.style.display = 'flex';
  leftBtns.style.gap = '8px';

  // Export Verilog button
  const exportVerilogBtn = document.createElement('button');
  exportVerilogBtn.className = 'btn btn-secondary';
  exportVerilogBtn.textContent = '📄 Download Verilog (.v)';
  exportVerilogBtn.onclick = () => {
    const name = document.getElementById('saveCircuitNameInput')?.value || defaultName;
    const vCode = generateVerilog('dataflow');
    downloadFile(`${name}.v`, vCode, 'text/plain');
    showToast(`Exported "${name}.v"!`);
  };
  leftBtns.appendChild(exportVerilogBtn);

  // Download JSON button
  const downloadJsonBtn = document.createElement('button');
  downloadJsonBtn.className = 'btn btn-secondary';
  downloadJsonBtn.textContent = '📥 Download JSON';
  downloadJsonBtn.onclick = () => {
    const name = document.getElementById('saveCircuitNameInput')?.value || defaultName;
    const saved = saveCircuitFile(name, DEFAULT_FOLDER);
    downloadFile(`${name}.json`, JSON.stringify(saved, null, 2), 'application/json');
    showToast(`Saved to folder and downloaded "${name}.json"!`);
    closeModal();
  };
  leftBtns.appendChild(downloadJsonBtn);

  const rightBtns = document.createElement('div');
  rightBtns.style.display = 'flex';
  rightBtns.style.gap = '8px';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeModal;

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.padding = '8px 18px';
  saveBtn.innerHTML = '💾 Save to Folder';
  saveBtn.onclick = () => {
    const name = document.getElementById('saveCircuitNameInput')?.value || defaultName;
    saveCircuitFile(name, DEFAULT_FOLDER);
    closeModal();
    showToast(`Saved "${name}" into "${DEFAULT_FOLDER}/" folder!`);
  };

  rightBtns.appendChild(cancelBtn);
  rightBtns.appendChild(saveBtn);

  footer.appendChild(leftBtns);
  footer.appendChild(rightBtns);
  container.appendChild(footer);
}

// ===== HISTORY & SAVED FILES MANAGER MODAL =====
function renderHistoryModal(container){
  state.isVerilogModalOpen = false;
  container.style.maxHeight = '88vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  // Modal Header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '12px';
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0070f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <h3 style="margin:0;font-size:16px">Saved Circuits & Edit History</h3>
    </div>
  `;
  container.appendChild(header);

  // Tabs Bar
  const tabsBar = document.createElement('div');
  tabsBar.style.display = 'flex';
  tabsBar.style.justifyContent = 'space-between';
  tabsBar.style.alignItems = 'center';
  tabsBar.style.marginBottom = '12px';
  tabsBar.style.borderBottom = '1px solid #e2e8f0';
  tabsBar.style.paddingBottom = '8px';

  const tabGroup = document.createElement('div');
  tabGroup.style.display = 'flex';
  tabGroup.style.gap = '6px';

  const savedTabBtn = document.createElement('button');
  savedTabBtn.className = 'modal-tab-btn' + (state.activeHistoryTab === 'saved' ? ' active' : '');
  savedTabBtn.innerHTML = '📁 Saved Files (Folder: Saved Circuits/)';

  const historyTabBtn = document.createElement('button');
  historyTabBtn.className = 'modal-tab-btn' + (state.activeHistoryTab === 'history' ? ' active' : '');
  historyTabBtn.innerHTML = '🕒 Recent History';

  tabGroup.appendChild(savedTabBtn);
  tabGroup.appendChild(historyTabBtn);
  tabsBar.appendChild(tabGroup);

  // Import button in header
  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-secondary';
  importBtn.style.fontSize = '12px';
  importBtn.style.padding = '4px 10px';
  importBtn.innerHTML = '📤 Import File (.json)';
  importBtn.onclick = () => {
    document.getElementById('importFileInput')?.click();
  };
  tabsBar.appendChild(importBtn);
  container.appendChild(tabsBar);

  // Content Area
  const contentArea = document.createElement('div');
  contentArea.id = 'historyModalContent';
  contentArea.style.flex = '1';
  contentArea.style.overflowY = 'auto';
  container.appendChild(contentArea);

  function renderTabContent(){
    contentArea.innerHTML = '';

    if (state.activeHistoryTab === 'saved') {
      const files = getSavedFiles();

      // Search Bar
      const searchBox = document.createElement('div');
      searchBox.style.marginBottom = '12px';
      searchBox.innerHTML = `
        <input type="text" id="fileSearchInput" placeholder="🔍 Search saved circuits by name or formula..." style="padding:8px 12px;border-radius:8px">
      `;
      contentArea.appendChild(searchBox);

      const filesListContainer = document.createElement('div');
      filesListContainer.id = 'filesListContainer';

      function renderFileList(filterText = ''){
        filesListContainer.innerHTML = '';
        const filtered = files.filter(f => {
          const q = filterText.toLowerCase();
          return f.name.toLowerCase().includes(q) || (f.expression && f.expression.toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
          filesListContainer.innerHTML = `
            <div style="padding:32px;text-align:center;color:var(--muted);background:#f8fafc;border-radius:10px">
              <div style="font-size:32px;margin-bottom:8px">📁</div>
              <strong>No saved circuits found.</strong><br>
              <span style="font-size:12px">Save your current circuit using the "Save" button to keep it here.</span>
            </div>
          `;
          return;
        }

        filtered.forEach(file => {
          const card = document.createElement('div');
          card.className = 'file-card';

          const mintermsCount = file.ttValues ? file.ttValues.filter(v => v === '1').length : 0;
          const totalRows = 2 ** (file.numVars || 3);

          card.innerHTML = `
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">
                <span>${file.name}</span>
                <span style="font-size:11px;font-weight:normal;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:4px">${file.folder || DEFAULT_FOLDER}</span>
              </div>
              <div class="file-expr">Y = ${file.expression || '0'}</div>
              <div class="file-meta">
                ${file.numVars} variables (${file.varNames ? file.varNames.join(', ') : 'A, B, C'}) • ${mintermsCount}/${totalRows} active • Saved: ${file.timestamp || 'Recent'}
              </div>
            </div>
          `;

          const actions = document.createElement('div');
          actions.className = 'file-actions';

          // Open button
          const openBtn = document.createElement('button');
          openBtn.className = 'action-icon-btn btn-load';
          openBtn.innerHTML = '📂 Open';
          openBtn.title = 'Open this circuit file';
          openBtn.onclick = () => loadCircuitState(file);

          // Download JSON button
          const exportBtn = document.createElement('button');
          exportBtn.className = 'action-icon-btn';
          exportBtn.innerHTML = '📥';
          exportBtn.title = 'Download as .json file';
          exportBtn.onclick = () => {
            downloadFile(`${file.name}.json`, JSON.stringify(file, null, 2), 'application/json');
            showToast(`Downloaded "${file.name}.json"!`);
          };

          // Rename button
          const renameBtn = document.createElement('button');
          renameBtn.className = 'action-icon-btn';
          renameBtn.innerHTML = '✏️';
          renameBtn.title = 'Rename file';
          renameBtn.onclick = () => {
            const newName = prompt('Enter new circuit name:', file.name);
            if (newName && newName.trim()) {
              renameCircuitFile(file.id, newName.trim());
              renderTabContent();
            }
          };

          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'action-icon-btn btn-delete';
          deleteBtn.innerHTML = '🗑️';
          deleteBtn.title = 'Delete file';
          deleteBtn.onclick = () => {
            if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
              deleteCircuitFile(file.id);
              renderTabContent();
            }
          };

          actions.appendChild(openBtn);
          actions.appendChild(exportBtn);
          actions.appendChild(renameBtn);
          actions.appendChild(deleteBtn);
          card.appendChild(actions);

          filesListContainer.appendChild(card);
        });
      }

      contentArea.appendChild(filesListContainer);
      renderFileList('');

      const searchInput = document.getElementById('fileSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          renderFileList(e.target.value);
        });
      }
    } else {
      // Recent History Tab
      const history = getHistoryLog();

      if (history.length === 0) {
        contentArea.innerHTML = `
          <div style="padding:32px;text-align:center;color:var(--muted);background:#f8fafc;border-radius:10px">
            <div style="font-size:32px;margin-bottom:8px">🕒</div>
            <strong>No history entries yet.</strong><br>
            <span style="font-size:12px">Expressions and edits will be automatically recorded here as you work.</span>
          </div>
        `;
        return;
      }

      const topBar = document.createElement('div');
      topBar.style.display = 'flex';
      topBar.style.justifyContent = 'space-between';
      topBar.style.alignItems = 'center';
      topBar.style.marginBottom = '12px';
      topBar.innerHTML = `
        <span style="font-size:12px;color:var(--muted)">Auto-recorded session timeline (${history.length} snapshots)</span>
      `;
      const clearBtn = document.createElement('button');
      clearBtn.className = 'btn btn-secondary';
      clearBtn.style.fontSize = '11px';
      clearBtn.style.padding = '4px 8px';
      clearBtn.textContent = 'Clear History';
      clearBtn.onclick = () => {
        if (confirm('Clear all history entries?')) {
          clearHistoryLog();
          renderTabContent();
        }
      };
      topBar.appendChild(clearBtn);
      contentArea.appendChild(topBar);

      history.forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-item';

        row.innerHTML = `
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:#0f172a">${item.label || 'Circuit Edit'}</div>
            <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:12px;color:#0070f3">Y = ${item.expression || '0'}</code>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${item.numVars} vars (${item.varNames ? item.varNames.join(', ') : ''})</div>
          </div>
          <div class="history-time">${item.timestamp}</div>
        `;

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'action-icon-btn btn-load';
        restoreBtn.innerHTML = 'Restore';
        restoreBtn.onclick = () => {
          loadCircuitState(item);
        };

        row.appendChild(restoreBtn);
        contentArea.appendChild(row);
      });
    }
  }

  savedTabBtn.onclick = () => {
    state.activeHistoryTab = 'saved';
    savedTabBtn.classList.add('active');
    historyTabBtn.classList.remove('active');
    renderTabContent();
  };

  historyTabBtn.onclick = () => {
    state.activeHistoryTab = 'history';
    historyTabBtn.classList.add('active');
    savedTabBtn.classList.remove('active');
    renderTabContent();
  };

  renderTabContent();

  // Footer with close button
  const footer = document.createElement('div');
  footer.style.marginTop = '12px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-secondary';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = closeModal;
  footer.appendChild(closeBtn);
  container.appendChild(footer);
}

// ===== BOOLEAN EXPRESSION INPUT & PARSER =====
function bindExpressionInput(){
  const exprInput = document.getElementById('expressionInput');
  const applyBtn = document.getElementById('applyExprBtn');
  const clearBtn = document.getElementById('clearExprBtn');
  const presets = document.getElementById('exprPresets');
  const symBtns = document.querySelectorAll('.sym-btn');
  const errorMsg = document.getElementById('exprErrorMsg');

  if (!exprInput) return;

  function handleInput(live = false){
    const val = exprInput.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

    if (!val) {
      if (errorMsg) errorMsg.style.display = 'none';
      return;
    }

    try {
      const success = parseAndApplyExpression(val, live);
      if (success) {
        if (errorMsg) errorMsg.style.display = 'none';
        recordHistory('Expression: ' + val);
      }
    } catch(err) {
      if (!live && errorMsg) {
        errorMsg.textContent = 'Syntax Error: ' + err.message;
        errorMsg.style.display = 'block';
      }
    }
  }

  let debounceTimer = null;
  exprInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleInput(true);
    }, 250);
  });

  exprInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInput(false);
    }
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => handleInput(false));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      exprInput.value = '';
      clearBtn.style.display = 'none';
      if (errorMsg) errorMsg.style.display = 'none';
      exprInput.focus();
    });
  }

  if (presets) {
    presets.addEventListener('change', (e) => {
      if (e.target.value) {
        exprInput.value = e.target.value;
        if (clearBtn) clearBtn.style.display = 'block';
        handleInput(false);
      }
    });
  }

  symBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.sym;
      const start = exprInput.selectionStart || exprInput.value.length;
      const end = exprInput.selectionEnd || exprInput.value.length;
      const val = exprInput.value;
      exprInput.value = val.substring(0, start) + sym + val.substring(end);
      exprInput.focus();
      exprInput.setSelectionRange(start + sym.length, start + sym.length);
      handleInput(true);
    });
  });
}

/**
 * Parses Boolean expression and updates state & UI
 */
function parseAndApplyExpression(rawStr, isLive = false){
  const str = rawStr.trim();
  if (!str) return false;

  // 1. Minterms format: m(1, 2, 4, 7) or ∑m(0, 1)
  const mintermMatch = str.match(/^(?:∑\s*)?m(?:interms?)?\s*\(\s*([0-9,\s]+)\s*\)$/i);
  if (mintermMatch) {
    const nums = mintermMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const maxVal = Math.max(0, ...nums);
    let requiredVars = Math.max(2, Math.ceil(Math.log2(maxVal + 1)));
    requiredVars = Math.max(requiredVars, state.numVars);
    
    syncVariablesCount(requiredVars);
    const total = 2 ** state.numVars;
    state.ttValues = Array.from({length: total}, (_, i) => nums.includes(i) ? '1' : '0');
    
    rebuildTruthTableAndKmap();
    updateSimplification();
    return true;
  }

  // 2. Maxterms format: M(0, 3, 5) or ∏M(0, 2)
  const maxtermMatch = str.match(/^(?:∏\s*)?M(?:axterms?)?\s*\(\s*([0-9,\s]+)\s*\)$/i);
  if (maxtermMatch) {
    const nums = maxtermMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const maxVal = Math.max(0, ...nums);
    let requiredVars = Math.max(2, Math.ceil(Math.log2(maxVal + 1)));
    requiredVars = Math.max(requiredVars, state.numVars);
    
    syncVariablesCount(requiredVars);
    const total = 2 ** state.numVars;
    state.ttValues = Array.from({length: total}, (_, i) => nums.includes(i) ? '0' : '1');
    
    rebuildTruthTableAndKmap();
    updateSimplification();
    return true;
  }

  // 3. General Boolean Formula Parsing
  const { rpn, vars } = compileBooleanExpression(str);
  
  if (vars.length === 0 && !rpn.some(t => t.type === 'CONST')) {
    throw new Error('No valid variables or terms found in expression.');
  }

  const existingVars = state.varNames;
  const isSubset = vars.every(v => existingVars.includes(v));

  if (!isSubset && vars.length > 0) {
    const mergedVars = [...new Set([...vars, ...existingVars])].slice(0, 10);
    const finalVars = vars.length >= 2 ? vars : mergedVars;
    syncCustomVariables(finalVars);
  }

  const totalRows = 2 ** state.numVars;
  const newTtValues = [];

  for (let i = 0; i < totalRows; i++) {
    const varMap = {};
    for (let v = 0; v < state.numVars; v++) {
      const bit = (i >> (state.numVars - 1 - v)) & 1;
      varMap[state.varNames[v]] = bit;
    }
    const res = evaluateRPN(rpn, varMap);
    newTtValues.push(res ? '1' : '0');
  }

  state.ttValues = newTtValues;
  rebuildTruthTableAndKmap();
  updateSimplification();
  return true;
}

function syncVariablesCount(num){
  if (num === state.numVars) return;
  const defaultAlphabet = ['A','B','C','D','E','F','G','H','I','J'];
  state.numVars = Math.min(10, Math.max(2, num));
  state.varNames = defaultAlphabet.slice(0, state.numVars);
  
  const manualNumVars = document.getElementById('manualNumVars');
  const manualVarNames = document.getElementById('manualVarNames');
  if (manualNumVars) manualNumVars.value = state.numVars;
  if (manualVarNames) manualVarNames.value = state.varNames.join(', ');
}

function syncCustomVariables(varList){
  state.numVars = Math.min(10, Math.max(2, varList.length));
  state.varNames = varList.slice(0, state.numVars);

  const manualNumVars = document.getElementById('manualNumVars');
  const manualVarNames = document.getElementById('manualVarNames');
  if (manualNumVars) manualNumVars.value = state.numVars;
  if (manualVarNames) manualVarNames.value = state.varNames.join(', ');
}

/**
 * Tokenizes and converts Boolean expression to RPN (Reverse Polish Notation)
 */
function compileBooleanExpression(raw){
  const known_vars = state.varNames || ['A','B','C','D','E','F','G','H','I','J'];

  let s = raw
    .replace(/[’"`]/g, "'")
    .replace(/[·•*]/g, ' & ')
    .replace(/\+/g, ' | ')
    .replace(/[⊕]/g, ' ^ ')
    .replace(/[⊙]/g, ' @ ')
    .replace(/~^|\^~/g, ' @ ')
    .replace(/[∧]/g, ' & ')
    .replace(/[∨]/g, ' | ')
    .replace(/[¬!]/g, ' ~ ')
    .replace(/&&/g, ' & ')
    .replace(/\|\|/g, ' | ')
    .replace(/\bXNOR\b/gi, ' @ ')
    .replace(/\bXOR\b/gi, ' ^ ')
    .replace(/\bNAND\b/gi, ' !& ')
    .replace(/\bNOR\b/gi, ' !| ')
    .replace(/\bAND\b/gi, ' & ')
    .replace(/\bOR\b/gi, ' | ')
    .replace(/\bNOT\b/gi, ' ~ ');

  const known_multi = known_vars.filter(v => v.length > 1);
  let var_patterns = '[A-Za-z]|[01]';
  if (known_multi.length > 0) {
    const escaped = known_multi.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    var_patterns = `${escaped}|[A-Za-z]|[01]`;
  }

  const pattern = new RegExp(`(${var_patterns}|'|~|&|\\||\\^|@|!\\&|!\\||\\(|\\))`, 'g');

  const rawTokens = [];
  let match;
  let lastIndex = 0;

  while ((match = pattern.exec(s)) !== null) {
    const gap = s.substring(lastIndex, match.index).trim();
    if (gap && !/^[\s]+$/.test(gap)) {
      throw new Error(`Unexpected character '${gap}' in expression.`);
    }
    rawTokens.push(match[1]);
    lastIndex = pattern.lastIndex;
  }

  const trailing = s.substring(lastIndex).trim();
  if (trailing) throw new Error(`Unexpected character '${trailing}' at end of expression.`);

  if (rawTokens.length === 0) throw new Error('Empty expression.');

  const tokens = [];
  const varsFound = new Set();

  function isOperand(t){
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) || t === '0' || t === '1';
  }

  for (let i = 0; i < rawTokens.length; i++) {
    const curr = rawTokens[i];
    if (isOperand(curr) && isNaN(curr)) {
      varsFound.add(curr.toUpperCase());
    }

    tokens.push(curr.toUpperCase());

    if (i < rawTokens.length - 1) {
      const next = rawTokens[i + 1];
      const currIsEnd = isOperand(curr) || curr === "'" || curr === ')';
      const nextIsStart = isOperand(next) || next === '(' || next === '~';

      if (currIsEnd && nextIsStart) {
        tokens.push('&');
      }
    }
  }

  const output = [];
  const opStack = [];

  const precedence = {
    "'": 6,
    '~': 5,
    '!&': 4,
    '!|': 4,
    '&': 3,
    '^': 2,
    '@': 2,
    '|': 1
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (isOperand(t)) {
      if (t === '0' || t === '1') {
        output.push({ type: 'CONST', val: parseInt(t, 10) });
      } else {
        output.push({ type: 'VAR', name: t });
      }
    } else if (t === "'") {
      output.push({ type: 'OP', val: "'" });
    } else if (t === '~') {
      opStack.push(t);
    } else if (t === '(') {
      opStack.push(t);
    } else if (t === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        output.push({ type: 'OP', val: opStack.pop() });
      }
      if (opStack.length === 0) {
        throw new Error('Mismatched parentheses: missing "(".');
      }
      opStack.pop();
    } else if (precedence[t]) {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] !== '(' &&
        precedence[opStack[opStack.length - 1]] >= precedence[t] &&
        t !== '~'
      ) {
        output.push({ type: 'OP', val: opStack.pop() });
      }
      opStack.push(t);
    } else {
      throw new Error(`Unrecognized token: ${t}`);
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop();
    if (top === '(' || top === ')') throw new Error('Mismatched parentheses.');
    output.push({ type: 'OP', val: top });
  }

  return { rpn: output, vars: Array.from(varsFound).sort() };
}

function evaluateRPN(rpn, varMap){
  const stack = [];

  for (let i = 0; i < rpn.length; i++) {
    const item = rpn[i];
    if (item.type === 'CONST') {
      stack.push(item.val);
    } else if (item.type === 'VAR') {
      const v = varMap[item.name];
      stack.push(v !== undefined ? v : 0);
    } else if (item.type === 'OP') {
      const op = item.val;
      if (op === "'" || op === '~') {
        if (stack.length < 1) throw new Error('Invalid unary operation.');
        const a = stack.pop();
        stack.push(a ? 0 : 1);
      } else {
        if (stack.length < 2) throw new Error('Invalid binary operation.');
        const b = stack.pop();
        const a = stack.pop();
        let res = 0;
        switch(op) {
          case '&': res = a & b; break;
          case '|': res = a | b; break;
          case '^': res = a ^ b; break;
          case '@': res = (a === b) ? 1 : 0; break;
          case '!&': res = (a & b) ? 0 : 1; break;
          case '!|': res = (a | b) ? 0 : 1; break;
          default: throw new Error(`Unknown operator ${op}`);
        }
        stack.push(res);
      }
    }
  }

  return stack.length === 1 ? stack[0] : 0;
}

// ===== TRUTH TABLE & K-MAP =====
function rebuildTruthTableAndKmap(){
  const container = document.getElementById('ttContainer');
  if (!container) return;
  container.innerHTML = '';
  const rows = 2 ** state.numVars;

  // Header
  const header = document.createElement('div');
  header.className = 'row';
  state.varNames.forEach(n => {
    const c = document.createElement('div');
    c.className = 'cell';
    c.textContent = n;
    c.style.fontWeight = '700';
    c.style.background = '#f8fafc';
    header.appendChild(c);
  });
  const oc = document.createElement('div');
  oc.className = 'cell';
  oc.textContent = 'Y';
  oc.style.fontWeight = '700';
  oc.style.color = '#0070f3';
  oc.style.background = '#f8fafc';
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
    btn.textContent = state.ttValues[i] || '0';
    btn.dataset.idx = i;
    btn.addEventListener('click', () => toggleCellByIndex(i));
    styleCellElement(btn, state.ttValues[i] || '0');
    r.appendChild(btn);
    container.appendChild(r);
  }

  buildKmap();
}

function toggleCellByIndex(idx){
  const cur = state.ttValues[idx] || '0';
  const next = cur === '0' ? '1' : (cur === '1' ? 'X' : '0');
  state.ttValues[idx] = next;

  const tb = document.querySelector('#ttContainer button[data-idx="' + idx + '"]');
  if(tb){
    tb.textContent = next;
    styleCellElement(tb, next);
  }

  const k = document.querySelector('#kmapContainer [data-idx="' + idx + '"]');
  if(k){
    k.textContent = next;
    styleCellElement(k, next);
  }

  updateSimplification();
  recordHistory('Table Click');
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
  if (!k) return;
  k.innerHTML = '';
  if(state.numVars === 2) buildKmap2(k);
  else if(state.numVars === 3) buildKmap3(k);
  else if(state.numVars === 4) buildKmap4(k);
  else {
    k.innerHTML = `<div style="padding:16px;color:#64748b;font-size:13px;text-align:center;background:#f8fafc;border-radius:8px">
      K-Map visual grid supports up to 4 variables.<br>
      Exact Quine-McCluskey & Verilog generation active for ${state.numVars} variables.
    </div>`;
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
  } else {
    el.style.fontWeight = '700';
    el.style.background = '#f8fafc';
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
      container.appendChild(mkCell(state.ttValues[idx] || '0', idx));
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
      container.appendChild(mkCell(state.ttValues[idx] || '0', idx));
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
      container.appendChild(mkCell(state.ttValues[idx] || '0', idx));
    }
  });
}

// ===== SIMPLIFICATION =====
function updateSimplification(){
  const minterms = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);
  const maxterms = state.ttValues.map((v, i) => v === '0' ? i : -1).filter(i => i >= 0);
  const dont = state.ttValues.map((v, i) => v === 'X' ? i : -1).filter(i => i >= 0);
  const standardSOP = getSOP(minterms, []);
  const simplifiedSOP = getSimplifiedSOP(minterms, dont);
  const simplifiedPOS = getSimplifiedPOS(maxterms, dont);
  
  state.currentSOP = simplifiedSOP;
  const baseOut = document.getElementById('baseOutput');
  if (baseOut) baseOut.textContent = 'Y = ' + standardSOP;
  
  const simOut = document.getElementById('simplifiedOutput');
  if (simOut) simOut.textContent = 'Y = ' + simplifiedSOP;

  // Populate minterms / maxterms
  const minBox = document.getElementById('mintermsBox');
  const maxBox = document.getElementById('maxtermsBox');
  if(minBox){
    minBox.value = minterms.length ? ('m(' + minterms.join(',') + ')') : 'None';
  }
  if(maxBox){
    maxBox.value = maxterms.length ? ('M(' + maxterms.join(',') + ')') : 'None';
  }

  // Converted expression according to Boolean Algebra rules
  const mode = document.getElementById('gateMode')?.value || 'standard';
  const g1 = (document.getElementById('gate1')?.value || 'AND').toUpperCase();
  const g2 = (document.getElementById('gate2')?.value || 'OR').toUpperCase();
  
  const conv = computeConvertedExpression(simplifiedSOP, simplifiedPOS, minterms, maxterms, dont, mode, g1, g2);

  state.currentConverted = conv;
  const convOut = document.getElementById('convertedOutput');
  if (convOut) convOut.textContent = 'Y = ' + conv;
  
  calculateCircuitDelay();
  refreshVerilogModalIfOpen();
  refreshFloatingExplanationIfOpen();
  refreshSchematicModalIfOpen();
}

function refreshSchematicModalIfOpen(){
  const modalBackdrop = document.getElementById('modalBackdrop');
  if (modalBackdrop && modalBackdrop.style.display !== 'none') {
    const svg = document.querySelector('#modalContent svg');
    if (svg) renderAdvancedCircuit(svg);
  }
}

// ===== BOOLEAN ALGEBRA CONVERSION ENGINE =====
function computeConvertedExpression(simplifiedSOP, simplifiedPOS, minterms, maxterms, dont, mode, g1, g2) {
  if (simplifiedSOP === '0' || simplifiedSOP === '1') return simplifiedSOP;

  const totalVars = state.numVars;
  const varNames = state.varNames;

  // Check full parity from minterms
  function checkFullParity() {
    if (!minterms || minterms.length === 0) return null;
    const expected = 2 ** (totalVars - 1);
    if (minterms.length !== expected) return null;

    let isOdd = true;
    let isEven = true;
    for (let m of minterms) {
      let ones = 0;
      for (let b = 0; b < totalVars; b++) {
        if ((m >> b) & 1) ones++;
      }
      if (ones % 2 !== 1) isOdd = false;
      if (ones % 2 !== 0) isEven = false;
    }
    if (isOdd) return varNames.join(' ⊕ ');
    if (isEven) return varNames.join(' ⊙ ');
    return null;
  }

  // 1. Standard SOP (AND-OR)
  if (mode === 'standard') {
    return simplifiedSOP;
  }

  // 2. Universal NAND Logic (NAND-NAND)
  // By Involution and De Morgan's Law: Y = ((T1 + T2 + ...)' )' = ( (T1)' · (T2)' ... )'
  if (mode === 'nand') {
    const sopTerms = simplifiedSOP.split(' + ');
    const nandTerms = sopTerms.map(t => {
      const pt = parseTerm(t);
      const lits = Object.keys(pt).map(k => pt[k] ? k : k + "'");
      return lits.length > 1 ? `(${lits.join(' NAND ')})` : lits[0];
    });

    if (nandTerms.length === 1) {
      return `(${nandTerms[0]}) NAND 1`;
    } else {
      return nandTerms.join(' NAND ');
    }
  }

  // 3. Universal NOR Logic (NOR-NOR)
  // From POS: Y = (S1 · S2 ...) = ( (S1)' + (S2)' ... )'
  if (mode === 'nor') {
    const pos = simplifiedPOS || getSimplifiedPOS(maxterms, dont);
    if (['0', '1'].includes(pos)) return pos;
    const posTerms = pos.split(')(').map(t => t.replace(/[()]/g, ''));
    const norTerms = posTerms.map(t => {
      if (t.includes(' + ')) {
        return `(${t.replace(/ \+ /g, ' NOR ')})`;
      } else {
        return t.trim();
      }
    });

    if (norTerms.length === 1) {
      return `(${norTerms[0]}) NOR 0`;
    } else {
      return norTerms.join(' NOR ');
    }
  }

  // 4. Custom Gate 1 / Gate 2 Form
  if (mode === 'custom') {
    g1 = (g1 || 'AND').toUpperCase();
    g2 = (g2 || 'OR').toUpperCase();

    const fullParity = checkFullParity();

    // Standard SOP (AND, OR)
    if (g1 === 'AND' && g2 === 'OR') {
      return simplifiedSOP;
    }
    // Standard POS (OR, AND)
    if (g1 === 'OR' && g2 === 'AND') {
      return simplifiedPOS || getSimplifiedPOS(maxterms, dont);
    }
    // Universal NAND (NAND, NAND)
    if (g1 === 'NAND' && g2 === 'NAND') {
      const sopTerms = simplifiedSOP.split(' + ');
      const nTerms = sopTerms.map(t => {
        const pt = parseTerm(t);
        const lits = Object.keys(pt).map(k => pt[k] ? k : k + "'");
        return lits.length > 1 ? `(${lits.join(' NAND ')})` : lits[0];
      });
      return nTerms.length === 1 ? `(${nTerms[0]}) NAND 1` : nTerms.join(' NAND ');
    }
    // Universal NOR (NOR, NOR)
    if (g1 === 'NOR' && g2 === 'NOR') {
      const pos = simplifiedPOS || getSimplifiedPOS(maxterms, dont);
      const posTerms = pos.split(')(').map(t => t.replace(/[()]/g, ''));
      const nrTerms = posTerms.map(t => t.includes(' + ') ? `(${t.replace(/ \+ /g, ' NOR ')})` : t.trim());
      return nrTerms.length === 1 ? `(${nrTerms[0]}) NOR 0` : nrTerms.join(' NOR ');
    }
    // AND-NOR (AOI form): Y = (Y')' where Y' = SOP(maxterms)
    if (g1 === 'AND' && g2 === 'NOR') {
      const compSOP = getSimplifiedSOP(maxterms, dont);
      if (compSOP === '0') return '1';
      if (compSOP === '1') return '0';
      const cTerms = compSOP.split(' + ');
      if (cTerms.length === 1) return `(${cTerms[0]})'`;
      return `(${cTerms.join(' + ')})'`;
    }
    // OR-NAND (OAI form): Y = (Y')' where Y' = POS(maxterms)
    if (g1 === 'OR' && g2 === 'NAND') {
      const compPOS = getSimplifiedPOS(minterms, dont);
      if (compPOS === '0') return '1';
      if (compPOS === '1') return '0';
      return `(${compPOS})'`;
    }
    // XOR-XOR Parity reduction
    if (g1 === 'XOR' && (g2 === 'XOR' || g2 === 'NONE')) {
      if (fullParity && fullParity.includes('⊕')) return fullParity;
      const factored = factorParity(simplifiedSOP, minterms);
      if (factored !== simplifiedSOP) return factored;
    }
    // XNOR-XNOR Equivalence reduction
    if (g1 === 'XNOR' && (g2 === 'XNOR' || g2 === 'NONE')) {
      if (fullParity && fullParity.includes('⊙')) return fullParity;
      const factored = factorParity(simplifiedSOP, minterms);
      if (factored !== simplifiedSOP) return factored.replace(/ ⊕ /g, ' ⊙ ');
    }

    // Parity Factoring for mixed expressions
    let baseSOP = simplifiedSOP;
    if (g1 === 'XOR' || g1 === 'XNOR' || g2 === 'XOR' || g2 === 'XNOR') {
      const pf = factorParity(simplifiedSOP, minterms);
      if (pf !== simplifiedSOP) baseSOP = pf;
    }

    // Transform individual Stage 1 terms according to g1
    const sopTerms = baseSOP.split(' + ');
    const s1Terms = sopTerms.map(t => {
      if (t.includes(' ⊕ ') || t.includes(' ⊙ ')) {
        if (g1 === 'XNOR' && t.includes(' ⊕ ')) return t.replace(/ ⊕ /g, ' ⊙ ');
        if (g1 === 'XOR' && t.includes(' ⊙ ')) return t.replace(/ ⊙ /g, ' ⊕ ');
        return t;
      }
      const pt = parseTerm(t);
      const literals = Object.keys(pt).map(k => pt[k] ? k : k + "'");
      
      if (g1 === 'AND') {
        return literals.length > 1 ? literals.join('') : literals[0];
      } else if (g1 === 'OR') {
        return literals.length > 1 ? `(${literals.join(' + ')})` : literals[0];
      } else if (g1 === 'NAND') {
        return literals.length > 1 ? `(${literals.join('·')})'` : `(${literals[0]}')`;
      } else if (g1 === 'NOR') {
        return literals.length > 1 ? `(${literals.join(' + ')})'` : `(${literals[0]}')`;
      } else if (g1 === 'XOR') {
        return literals.length > 1 ? `(${literals.join(' ⊕ ')})` : literals[0];
      } else if (g1 === 'XNOR') {
        return literals.length > 1 ? `(${literals.join(' ⊙ ')})` : literals[0];
      } else if (g1 === 'NOT') {
        return literals.length > 1 ? `(${literals.join('')})'` : `(${literals[0]}')`;
      } else if (g1 === 'NONE') {
        return literals.join('');
      }
      return literals.join('');
    });

    // Combine terms according to g2
    if (g2 === 'NONE') {
      return s1Terms.length === 1 ? s1Terms[0] : (s1Terms.join(', ') + '  [Stage 2: Unselected]');
    } else if (g2 === 'OR') {
      return s1Terms.join(' + ');
    } else if (g2 === 'AND') {
      return s1Terms.map(s => s.startsWith('(') ? s : `(${s})`).join(' · ');
    } else if (g2 === 'NAND') {
      return s1Terms.length === 1 ? `(${s1Terms[0]}) NAND 1` : s1Terms.map(s => s.startsWith('(') ? s : `(${s})`).join(' NAND ');
    } else if (g2 === 'NOR') {
      return s1Terms.length === 1 ? `(${s1Terms[0]}) NOR 0` : s1Terms.map(s => s.startsWith('(') ? s : `(${s})`).join(' NOR ');
    } else if (g2 === 'XOR') {
      return s1Terms.join(' ⊕ ');
    } else if (g2 === 'XNOR') {
      return s1Terms.join(' ⊙ ');
    } else if (g2 === 'NOT') {
      return s1Terms.length === 1 ? `(${s1Terms[0]})'` : `(${s1Terms.join(' + ')})'`;
    }
  }

  return simplifiedSOP;
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
  const res = {};
  const known = state.varNames || [];
  known.forEach(v => {
    if (t.includes(v + "'")) {
      res[v] = false;
    } else if (t.includes(v)) {
      res[v] = true;
    }
  });
  return res;
}

function factorParity(sop, minterms = null) {
  if (sop === '0' || sop === '1') return sop;
  const numVars = state.numVars;
  const varNames = state.varNames;

  // Direct Truth Table Odd / Even Parity Check
  if (minterms && minterms.length === (2 ** (numVars - 1))) {
    let isOdd = true;
    let isEven = true;
    for (let m of minterms) {
      let ones = 0;
      for (let b = 0; b < numVars; b++) {
        if ((m >> b) & 1) ones++;
      }
      if (ones % 2 !== 1) isOdd = false;
      if (ones % 2 !== 0) isEven = false;
    }
    if (isOdd) return varNames.join(' ⊕ ');
    if (isEven) return varNames.join(' ⊙ ');
  }

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
  const delayOut = document.getElementById('delayOutput');
  if(!delayOut) return;

  if(terms.length === 0){
    delayOut.textContent = 'Critical Path Delay: 0.00 ns (constant)';
    return;
  }
  const mode = document.getElementById('gateMode')?.value || 'standard';
  let l1 = 0, l2 = 0;
  let g1Name = 'AND', g2Name = 'OR';

  if(mode === 'nand'){
    l1 = l2 = state.gateDelays.NAND || 1.5;
    g1Name = g2Name = 'NAND';
  } else if(mode === 'nor'){
    l1 = l2 = state.gateDelays.NOR || 1.5;
    g1Name = g2Name = 'NOR';
  } else if(mode === 'custom'){
    g1Name = (document.getElementById('gate1')?.value || 'AND').toUpperCase();
    g2Name = (document.getElementById('gate2')?.value || 'OR').toUpperCase();
    l1 = (g1Name === 'NONE' ? 0 : (state.gateDelays[g1Name] ?? 2.5));
    l2 = (g2Name === 'NONE' ? 0 : (state.gateDelays[g2Name] ?? 2.5));
  } else {
    l1 = state.gateDelays.AND || 2.5;
    l2 = state.gateDelays.OR || 2.5;
    g1Name = 'AND';
    g2Name = 'OR';
  }

  const total = l1 + l2;
  let delayDetail = '';
  if (g1Name === 'NONE' && g2Name === 'NONE') {
    delayDetail = '(Direct Pass-through: 0 ns)';
  } else if (g2Name === 'NONE') {
    delayDetail = `(Stage 1 [${g1Name}]: ${l1.toFixed(2)}ns | Stage 2: Unselected)`;
  } else if (g1Name === 'NONE') {
    delayDetail = `(Stage 1: Direct | Stage 2 [${g2Name}]: ${l2.toFixed(2)}ns)`;
  } else {
    delayDetail = `(Stage 1 [${g1Name}]: ${l1.toFixed(2)}ns + Stage 2 [${g2Name}]: ${l2.toFixed(2)}ns)`;
  }
  delayOut.textContent = `Critical Path Delay: ${total.toFixed(2)} ns ${delayDetail}`;
}

// ===== VERILOG HDL CODE GENERATOR =====
function generateVerilog(type = 'dataflow'){
  const vars = state.varNames;
  const numVars = state.numVars;
  const sop = state.currentSOP;
  const terms = sop.split(' + ').filter(t => t !== '0' && t !== '1');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (type === 'dataflow') {
    let dataflowExpr = '1\'b0';
    if (sop === '0') {
      dataflowExpr = "1'b0";
    } else if (sop === '1') {
      dataflowExpr = "1'b1";
    } else {
      const verilogTerms = terms.map(term => {
        const pt = parseTerm(term);
        const lits = Object.keys(pt).map(k => pt[k] ? k : `~${k}`);
        return lits.length > 1 ? `(${lits.join(' & ')})` : lits[0];
      });
      dataflowExpr = verilogTerms.join(' | ');
    }

    return `// ========================================================
// Verilog HDL - Dataflow Model
// Module       : digital_circuit
// Expression   : Y = ${sop}
// Generated on : ${timestamp}
// ========================================================

\`timescale 1ns / 1ps

module digital_circuit (
    input  wire ${vars.join(', ')},
    output wire Y
);

    // Continuous Boolean logic assignment
    assign Y = ${dataflowExpr};

endmodule
`;
  }

  if (type === 'structural') {
    if (sop === '0' || sop === '1') {
      return `// ========================================================
// Verilog HDL - Structural (Gate-Level) Model
// Module       : digital_circuit (Constant Output)
// Expression   : Y = ${sop}
// ========================================================

\`timescale 1ns / 1ps

module digital_circuit (
    input  wire ${vars.join(', ')},
    output wire Y
);

    // Constant driver
    assign Y = 1'b${sop};

endmodule
`;
    }

    const invertedVars = new Set();
    terms.forEach(t => {
      const pt = parseTerm(t);
      Object.keys(pt).forEach(k => {
        if (!pt[k]) invertedVars.add(k);
      });
    });

    let invWires = '';
    let invGates = '';
    if (invertedVars.size > 0) {
      const invList = Array.from(invertedVars).map(v => `not_${v}`);
      invWires = `    // Internal Inverter Rails\n    wire ${invList.join(', ')};\n`;
      invGates = Array.from(invertedVars).map(v => `    not g_inv_${v} (not_${v}, ${v});`).join('\n') + '\n\n';
    }

    const mainMode = document.getElementById('gateMode')?.value || 'standard';
    let g1Type = 'and';
    let g2Type = 'or';
    if (mainMode === 'nand') { g1Type = 'nand'; g2Type = 'nand'; }
    else if (mainMode === 'nor') { g1Type = 'nor'; g2Type = 'nor'; }
    else if (mainMode === 'custom') {
      const g1Val = (document.getElementById('gate1')?.value || 'AND').toLowerCase();
      const g2Val = (document.getElementById('gate2')?.value || 'OR').toLowerCase();
      g1Type = g1Val === 'none' ? 'buf' : g1Val;
      g2Type = g2Val;
    }

    const andWires = terms.map((_, i) => `term_${i}`);
    let stage1Decl = `    // Stage 1: Term Wires\n    wire ${andWires.join(', ')};\n\n`;
    let stage1Gates = terms.map((term, i) => {
      const pt = parseTerm(term);
      const inputs = Object.keys(pt).map(k => pt[k] ? k : `not_${k}`);
      if (inputs.length === 1) {
        return `    buf g_buf_${i} (term_${i}, ${inputs[0]});`;
      }
      return `    ${g1Type} g_stage1_${i} (term_${i}, ${inputs.join(', ')});`;
    }).join('\n');

    let stage2Gate = '';
    if (g2Type === 'none') {
      if (terms.length === 1) {
        stage2Gate = `\n\n    // Stage 2: Direct output (Stage 2 Unselected)\n    assign Y = term_0;`;
      } else {
        stage2Gate = `\n\n    // Stage 2: Direct output (Stage 2 Unselected - Assigning primary term)\n    assign Y = term_0;`;
      }
    } else if (terms.length === 1) {
      if (g2Type === 'not') {
        stage2Gate = `\n\n    // Stage 2: Inverting NOT Gate\n    not g_out_not (Y, term_0);`;
      } else {
        stage2Gate = `\n\n    // Stage 2: Direct output\n    buf g_out (Y, term_0);`;
      }
    } else {
      stage2Gate = `\n\n    // Stage 2: Combiner ${g2Type.toUpperCase()} Gate\n    ${g2Type} g_out_${g2Type} (Y, ${andWires.join(', ')});`;
    }

    return `// ========================================================
// Verilog HDL - Structural (Gate-Level) Model
// Target Architecture: Inverter Rails -> ${g1Type.toUpperCase()} Gates -> ${g2Type.toUpperCase()} Gate
// Expression: Y = ${sop}
// ========================================================

\`timescale 1ns / 1ps

module digital_circuit (
    input  wire ${vars.join(', ')},
    output wire Y
);

${invWires}${invGates}${stage1Decl}${stage1Gates}${stage2Gate}

endmodule
`;
  }

  if (type === 'behavioral') {
    const total = 2 ** numVars;
    const mintermIndices = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);
    
    let caseItems = '';
    if (mintermIndices.length === 0) {
      caseItems = "            default: Y = 1'b0;";
    } else if (mintermIndices.length === total) {
      caseItems = "            default: Y = 1'b1;";
    } else {
      caseItems = mintermIndices.map(m => {
        const binStr = m.toString(2).padStart(numVars, '0');
        return `            ${numVars}'b${binStr}: Y = 1'b1;`;
      }).join('\n') + `\n            default: Y = 1'b0;`;
    }

    return `// ========================================================
// Verilog HDL - Behavioral Model
// Module       : digital_circuit (Truth Table ROM / Process)
// Style        : Combinational always block with case statement
// ========================================================

\`timescale 1ns / 1ps

module digital_circuit (
    input  wire ${vars.join(', ')},
    output reg  Y
);

    // Combinational evaluation triggered on any input change
    always @(*) begin
        case ({${vars.join(', ')}})
${caseItems}
        endcase
    end

endmodule
`;
  }

  if (type === 'testbench') {
    const total = 2 ** numVars;
    return `// ========================================================
// Verilog HDL - Self-Checking Testbench
// Stimulates all ${total} input vectors for full verification
// ========================================================

\`timescale 1ns / 1ps

module tb_digital_circuit;

    // Testbench Stimulus Signals
    reg  ${vars.join(', ')};
    wire Y;

    // Instantiate Unit Under Test (UUT)
    digital_circuit uut (
        ${vars.map(v => `.${v}(${v})`).join(',\n        ')},
        .Y(Y)
    );

    integer i;

    initial begin
        $display("=================================================");
        $display("Time(ns) | Inputs (${vars.join(' ')}) | Output Y");
        $display("=================================================");
        $monitor("%04t ns  |  ${vars.map(() => '%b').join('  ')}  |    %b", $time, ${vars.join(', ')}, Y);

        // Apply all binary combinations sequentially
        for (i = 0; i < ${total}; i = i + 1) begin
            {${vars.join(', ')}} = i[${numVars - 1}:0];
            #10;
        end

        $display("=================================================");
        $display("Verification completed successfully for all test vectors.");
        $finish;
    end

endmodule
`;
  }

  return '';
}

// ===== VERILOG MODAL RENDERER =====
function renderVerilogModal(container){
  state.isVerilogModalOpen = true;
  container.style.maxHeight = '88vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  // Modal Top Bar
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '14px';
  header.style.flexWrap = 'wrap';
  header.style.gap = '10px';

  const titleBox = document.createElement('div');
  titleBox.style.display = 'flex';
  titleBox.style.alignItems = 'center';
  titleBox.style.gap = '10px';
  titleBox.innerHTML = `
    <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:6px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0070f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
      Verilog HDL Code Generator
    </h3>
    <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:#dcfce7;color:#15803d;font-weight:600">● Live Synced</span>
  `;

  // Action Buttons Group
  const actionsBox = document.createElement('div');
  actionsBox.style.display = 'flex';
  actionsBox.style.gap = '8px';
  actionsBox.style.alignItems = 'center';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-primary';
  copyBtn.style.padding = '6px 14px';
  copyBtn.style.borderRadius = '8px';
  copyBtn.style.fontSize = '12px';
  copyBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
    Copy Code
  `;
  copyBtn.addEventListener('click', () => {
    const code = generateVerilog(state.activeVerilogTab);
    navigator.clipboard.writeText(code).then(() => {
      showToast('Verilog code copied to clipboard!');
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied!
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy Code
        `;
      }, 2000);
    }).catch(() => {
      showToast('Failed to copy. Please select and copy manually.');
    });
  });

  const explainBtn = document.createElement('button');
  explainBtn.className = 'btn';
  explainBtn.style.background = '#f0fdf4';
  explainBtn.style.border = '1px solid #bbf7d0';
  explainBtn.style.color = '#15803d';
  explainBtn.style.padding = '6px 14px';
  explainBtn.style.borderRadius = '8px';
  explainBtn.style.fontSize = '12px';
  explainBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Explain Code
  `;
  explainBtn.addEventListener('click', () => {
    openVerilogExplanation();
  });

  const fsBtn = document.createElement('button');
  fsBtn.className = 'fs-btn';
  fsBtn.textContent = '⛶ Fullscreen';
  fsBtn.addEventListener('click', toggleFullscreen);

  actionsBox.appendChild(copyBtn);
  actionsBox.appendChild(explainBtn);
  actionsBox.appendChild(fsBtn);

  header.appendChild(titleBox);
  header.appendChild(actionsBox);
  container.appendChild(header);

  // Tabs Bar
  const tabsBar = document.createElement('div');
  tabsBar.style.display = 'flex';
  tabsBar.style.gap = '6px';
  tabsBar.style.marginBottom = '12px';
  tabsBar.style.borderBottom = '1px solid #e2e8f0';
  tabsBar.style.paddingBottom = '8px';

  const tabDefs = [
    { id: 'dataflow', label: 'Dataflow Model (assign)' },
    { id: 'structural', label: 'Structural (Gate-Level)' },
    { id: 'behavioral', label: 'Behavioral (always @*)' },
    { id: 'testbench', label: 'Testbench (tb_circuit)' }
  ];

  tabDefs.forEach(t => {
    const b = document.createElement('button');
    b.className = 'verilog-tab-btn' + (state.activeVerilogTab === t.id ? ' active' : '');
    b.textContent = t.label;
    b.onclick = () => {
      state.activeVerilogTab = t.id;
      document.querySelectorAll('.verilog-tab-btn').forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      updateVerilogCodeContent();
    };
    tabsBar.appendChild(b);
  });
  container.appendChild(tabsBar);

  // Code Display Area
  const codeContainer = document.createElement('pre');
  codeContainer.id = 'verilogCodeContainer';
  codeContainer.className = 'code-viewer';
  codeContainer.style.flex = '1';
  codeContainer.style.margin = '0';
  
  const codeEl = document.createElement('code');
  codeEl.id = 'verilogCodeElement';
  codeContainer.appendChild(codeEl);
  container.appendChild(codeContainer);

  // Modal Footer
  const footer = document.createElement('div');
  footer.style.marginTop = '14px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.alignItems = 'center';

  const note = document.createElement('div');
  note.style.fontSize = '12px';
  note.style.color = 'var(--muted)';
  note.textContent = `Target: IEEE 1364-2001 Verilog HDL • Minimised Equation: Y = ${state.currentSOP}`;
  note.id = 'verilogModalNote';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn btn-secondary';
  closeBtn.style.padding = '6px 14px';
  closeBtn.onclick = closeModal;

  footer.appendChild(note);
  footer.appendChild(closeBtn);
  container.appendChild(footer);

  updateVerilogCodeContent();
}

function updateVerilogCodeContent(){
  const codeEl = document.getElementById('verilogCodeElement');
  const note = document.getElementById('verilogModalNote');
  if (codeEl) {
    codeEl.textContent = generateVerilog(state.activeVerilogTab);
  }
  if (note) {
    note.textContent = `Target: IEEE 1364-2001 Verilog HDL • Minimised Equation: Y = ${state.currentSOP}`;
  }
}

function refreshVerilogModalIfOpen(){
  if (state.isVerilogModalOpen && document.getElementById('verilogCodeElement')) {
    updateVerilogCodeContent();
  }
}

// ===== FLOATING EXPLANATION TAB =====
function setupFloatingExplanationControls(){
  const panel = document.getElementById('floatingExplanation');
  const header = document.getElementById('floatingHeader');
  const minBtn = document.getElementById('minFloatBtn');
  const closeBtn = document.getElementById('closeFloatBtn');
  const body = document.getElementById('floatingBody');

  if (!panel || !header) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.float-tool-btn')) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    panel.style.transition = 'none';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, e.clientX - offsetX));
    const top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, e.clientY - offsetY));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  let isMinimized = false;
  if (minBtn) {
    minBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (body) body.style.display = isMinimized ? 'none' : 'block';
      minBtn.textContent = isMinimized ? '□' : '─';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }
}

function openVerilogExplanation(){
  const panel = document.getElementById('floatingExplanation');
  const body = document.getElementById('floatingBody');
  if (!panel || !body) return;

  panel.style.display = 'flex';
  
  if (!panel.style.left) {
    panel.style.top = '80px';
    panel.style.right = '30px';
  }

  refreshFloatingExplanationIfOpen();
}

function refreshFloatingExplanationIfOpen(){
  const panel = document.getElementById('floatingExplanation');
  const body = document.getElementById('floatingBody');
  if (!panel || !body || panel.style.display === 'none') return;

  const vars = state.varNames;
  const numVars = state.numVars;
  const sop = state.currentSOP;
  const terms = sop.split(' + ').filter(t => t !== '0' && t !== '1');
  const totalCombinations = 2 ** numVars;
  const activeMinterms = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);

  let explanationHTML = `
    <div class="expl-section">
      <h4><span>📦</span> Module Overview & Ports</h4>
      <p>The Verilog module <span class="code-inline">digital_circuit</span> implements a combinational logic circuit for <strong>${numVars} input variables</strong> and <strong>1 primary output</strong>:</p>
      <ul>
        <li><strong>Inputs:</strong> <span class="code-inline">${vars.join(', ')}</span> (1-bit each, wire type)</li>
        <li><strong>Output:</strong> <span class="code-inline">Y</span> (Driven by Boolean equation)</li>
        <li><strong>Domain:</strong> ${totalCombinations} total input combinations (${activeMinterms.length} produce HIGH output).</li>
      </ul>
    </div>

    <div class="expl-section">
      <h4><span>⚡</span> Boolean Equation & Verilog Mapping</h4>
      <p>Simplified Sum-of-Products (SOP):<br>
      <span class="code-inline" style="display:inline-block;margin:4px 0;font-weight:700;color:#0070f3">Y = ${sop}</span></p>
  `;

  if (sop === '0' || sop === '1') {
    explanationHTML += `<p>Output is statically tied to logic constant <strong>${sop}</strong> (<span class="code-inline">assign Y = 1'b${sop};</span>). No active gates are synthesized.</p>`;
  } else {
    explanationHTML += `
      <p>In Verilog dataflow modeling:</p>
      <ul>
        <li><span class="code-inline">~</span> (Bitwise NOT): Inverts complementary literals (e.g. <span class="code-inline">A'</span> becomes <span class="code-inline">~A</span>).</li>
        <li><span class="code-inline">&</span> (Bitwise AND): Forms product terms (e.g. <span class="code-inline">~A & B</span>).</li>
        <li><span class="code-inline">|</span> (Bitwise OR): Combines all ${terms.length} product terms into final output <span class="code-inline">Y</span>.</li>
      </ul>
    `;
  }
  explanationHTML += `</div>`;

  explanationHTML += `
    <div class="expl-section">
      <h4><span>🔌</span> Signal Flow & Gate-Level Stages</h4>
  `;

  if (sop !== '0' && sop !== '1') {
    const hasComplements = terms.some(t => t.includes("'"));
    explanationHTML += `
      <ol style="padding-left:18px;margin:6px 0">
        <li><strong>Stage 0 (Inverter Rails):</strong> ${hasComplements ? 'NOT gates (<span class="code-inline">not</span>) produce inverted rail signals for primed literals.' : 'No inverters needed.'}</li>
        <li><strong>Stage 1 (Product Terms):</strong> <strong>${terms.length} AND gate(s)</strong> compute the product terms: <span class="code-inline">${terms.join('</span>, <span class="code-inline">')}</span>.</li>
        <li><strong>Stage 2 (Output Stage):</strong> ${terms.length > 1 ? `A single <strong>OR gate</strong> (<span class="code-inline">or g_out_or</span>) aggregates all product signals to drive output <span class="code-inline">Y</span>.` : 'Direct buffer connection to output terminal <span class="code-inline">Y</span>.'}</li>
      </ol>
    `;
  } else {
    explanationHTML += `<p>Constant output requires 0 gate delay and directly connects to VDD or GND.</p>`;
  }
  explanationHTML += `</div>`;

  const l1 = state.gateDelays.AND || 2.5;
  const l2 = state.gateDelays.OR || 2.5;
  const totalDelay = terms.length > 0 ? (l1 + l2).toFixed(2) : '0.00';

  explanationHTML += `
    <div class="expl-section" style="margin-bottom:0">
      <h4><span>📊</span> Synthesis & Simulation Profile</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
        <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="color:var(--muted);font-size:11px">Estimated Delay:</span><br>
          <strong>${totalDelay} ns</strong>
        </div>
        <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="color:var(--muted);font-size:11px">Target Style:</span><br>
          <strong style="text-transform:capitalize">${state.activeVerilogTab}</strong>
        </div>
        <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="color:var(--muted);font-size:11px">Active Minterms:</span><br>
          <strong>${activeMinterms.length} / ${totalCombinations}</strong>
        </div>
        <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="color:var(--muted);font-size:11px">Hardware Primitive:</span><br>
          <strong>${numVars <= 4 ? '1 LUT (FPGA)' : 'Multi-LUT'}</strong>
        </div>
      </div>
    </div>
  `;

  body.innerHTML = explanationHTML;
}

// ===== TOAST NOTIFICATION HELPER =====
function showToast(message){
  const toast = document.getElementById('copyToast');
  if (!toast) return;
  toast.querySelector('span').textContent = message;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

// ===== CONVERTER =====
function computeConverter(){
  const v = parseInt(document.getElementById('convInput').value || 0, 10);
  const out = document.getElementById('convResult');
  if(!out) return;
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
  if(!out) return;
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
  state.isVerilogModalOpen = false;
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
    row.style.background = '#f8fafc';
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
  btn.className = 'btn btn-primary';
  btn.style.padding = '6px 16px';
  btn.onclick = closeModal;
  close.appendChild(btn);
  container.appendChild(close);
}

function closeModal(){
  document.getElementById('modalBackdrop').style.display = 'none';
  state.fullscreen = false;
  state.isVerilogModalOpen = false;
}

function explainCircuit() {
  const messages = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  if(!messages || !input) return;
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
  if (!modal) return;

  if(state.fullscreen){
    modal.classList.add('fullscreen');
  } else {
    modal.classList.remove('fullscreen');
  }
}

// ===== CIRCUIT DIAGRAM (Advanced Rendering) =====
// ===== CIRCUIT DIAGRAM (Advanced Rendering) =====
function renderSchematicModal(container){
  state.isVerilogModalOpen = false;
  container.style.maxHeight = '80vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

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
    <option value="converted">Target Logic (Converted / Custom)</option>
    <option value="standard">Standard SOP (AND-OR)</option>
    <option value="pos">Standard POS (OR-AND)</option>
    <option value="nand">NAND-only</option>
    <option value="nor">NOR-only</option>
  `;

  const mainMode = document.getElementById('gateMode')?.value || 'standard';
  if (mainMode === 'custom' || mainMode === 'nand' || mainMode === 'nor') {
    modeSel.value = 'converted';
  } else {
    modeSel.value = 'standard';
  }

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

  const close = document.createElement('div');
  close.style.marginTop = '12px';
  const btn = document.createElement('button');
  btn.textContent = 'Close';
  btn.className = 'btn btn-secondary';
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
    const mainMode = document.getElementById('gateMode')?.value || 'standard';
    if (mainMode === 'nand') { globalStage2GateType = 'NAND'; globalStage3GateType = 'NAND'; }
    else if (mainMode === 'nor') { globalStage2GateType = 'NOR'; globalStage3GateType = 'NOR'; }
    else if (mainMode === 'custom') {
      globalStage2GateType = (document.getElementById('gate1')?.value || 'AND').toUpperCase();
      globalStage3GateType = (document.getElementById('gate2')?.value || 'OR').toUpperCase();
    }
  } else if (mode === 'pos') {
    globalStage2GateType = 'OR';
    globalStage3GateType = 'AND';
  } else if (mode === 'nand') {
    globalStage2GateType = 'NAND';
    globalStage3GateType = 'NAND';
  } else if (mode === 'nor') {
    globalStage2GateType = 'NOR';
    globalStage3GateType = 'NOR';
  } else {
    globalStage2GateType = 'AND';
    globalStage3GateType = 'OR';
  }

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
  bg.setAttribute('fill', 'url(#grid)');
  svg.appendChild(bg);

  const minterms = state.ttValues.map((v, i) => v === '1' ? i : -1).filter(i => i >= 0);
  const maxterms = state.ttValues.map((v, i) => v === '0' ? i : -1).filter(i => i >= 0);
  const dont = state.ttValues.map((v, i) => v === 'X' ? i : -1).filter(i => i >= 0);

  // Determine correct algebraic term list based on architecture
  let rawTerms = [];
  const isPosBased = (globalStage2GateType === 'OR' && globalStage3GateType === 'AND') ||
                     (globalStage2GateType === 'NOR' && globalStage3GateType === 'NOR') ||
                     (globalStage2GateType === 'OR' && globalStage3GateType === 'NAND') ||
                     (globalStage2GateType === 'OR' && globalStage3GateType === 'NONE');

  const isAoiBased = (globalStage2GateType === 'AND' && globalStage3GateType === 'NOR');

  if (isAoiBased) {
    const compSOP = getSimplifiedSOP(maxterms, dont);
    rawTerms = compSOP.split(' + ').filter(t => t !== '0' && t !== '1');
  } else if (isPosBased) {
    const pos = (globalStage2GateType === 'OR' && globalStage3GateType === 'NAND') 
      ? getSimplifiedPOS(minterms, dont)
      : getSimplifiedPOS(maxterms, dont);
    if (!['0', '1'].includes(pos)) {
      rawTerms = pos.split(')(').map(t => t.replace(/[()]/g, '')).filter(t => t.trim().length > 0);
    }
  } else if (globalStage2GateType === 'XOR' || globalStage2GateType === 'XNOR') {
    const factored = factorParity(state.currentSOP, minterms);
    rawTerms = factored.split(' + ').filter(t => t !== '0' && t !== '1');
  } else {
    rawTerms = state.currentSOP.split(' + ').filter(t => t !== '0' && t !== '1');
  }

  if(rawTerms.length === 0){
    svg.setAttribute('width', '1200');
    svg.setAttribute('height', '700');
    svg.setAttribute('viewBox', '0 0 1200 700');
    bg.setAttribute('width', '1200');
    bg.setAttribute('height', '700');
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

  const MARGIN_LEFT = 80;
  const MARGIN_TOP = 60;
  const VAR_SPACING = Math.max(90, Math.min(125, 700 / state.numVars));
  const AND_GATE_X = MARGIN_LEFT + state.numVars * VAR_SPACING + 40;
  const OR_GATE_X = AND_GATE_X + 220;
  const OUTPUT_X = OR_GATE_X + 210;

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
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', pathData);
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', width);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
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
    circle.setAttribute('r', '2.5');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);
  }

  // Pre-calculate per-term inputs, dynamic gate dimensions, and vertical positions
  const termData = rawTerms.map((term) => {
    const inputs = [];
    state.varNames.forEach((v, vi) => {
      if (term.includes(v + "'")) {
        inputs.push({source: 'complement', varIdx: vi, color: '#f59e0b', name: v + "'"});
      } else if (term.includes(v)) {
        inputs.push({source: 'input', varIdx: vi, color: '#0070f3', name: v});
      }
    });
    const inputCount = Math.max(1, inputs.length);
    const pinSpacing = inputCount > 1 ? Math.max(16, Math.min(22, 110 / inputCount)) : 0;
    const pinSpan = (inputCount - 1) * pinSpacing;
    const halfH = Math.max(22, Math.round((pinSpan / 2) + 12));
    const gateW = Math.max(80, Math.min(135, Math.round(62 + halfH * 0.55)));
    return { term, inputs, inputCount, pinSpacing, pinSpan, halfH, gateW };
  });

  // Calculate cumulative vertical positions so gates never overlap
  let currentY = MARGIN_TOP + 80;
  const termCenterYs = [];
  termData.forEach((td, idx) => {
    currentY += td.halfH;
    termCenterYs.push(currentY);
    currentY += td.halfH + (idx < termData.length - 1 ? 26 : 0);
  });

  const totalContentHeight = Math.max(700, currentY + 90);
  const totalContentWidth = Math.max(1200, OUTPUT_X + 170);

  svg.setAttribute('width', totalContentWidth);
  svg.setAttribute('height', totalContentHeight);
  svg.setAttribute('viewBox', `0 0 ${totalContentWidth} ${totalContentHeight}`);
  bg.setAttribute('width', totalContentWidth);
  bg.setAttribute('height', totalContentHeight);

  // Draw Input & Complement vertical rails
  addLabel(MARGIN_LEFT - 10, MARGIN_TOP - 25, 'INPUTS & COMPLEMENTS', 11, '#0070f3');
  const inputRails = [];
  const complementRails = [];
  const railBottomY = totalContentHeight - 45;

  for(let i = 0; i < state.numVars; i++){
    const inX = MARGIN_LEFT + i * VAR_SPACING;
    const notX = inX + 22; 
    const compX = notX + 30; 
    const y = MARGIN_TOP;
    
    addLabel(inX, y, state.varNames[i], 13, '#0070f3');
    addLabel(compX, y, state.varNames[i] + "'", 13, '#f59e0b');
    
    addThinTerminal(inX, y + 20, '#0070f3');
    addWire(inX, y + 20, inX, railBottomY, '#c7defa', 3);
    inputRails.push({x: inX, yStart: y + 20, color: '#0070f3'});
    
    const notBranchY = y + 36;
    addThinTerminal(inX, notBranchY, '#0070f3');
    addWire(inX, notBranchY, notX, notBranchY, '#c7defa', 1.5);
    
    const tri = document.createElementNS(svgNS, 'polygon');
    tri.setAttribute('points', `${notX},${notBranchY-7} ${notX},${notBranchY+7} ${notX+16},${notBranchY}`);
    tri.setAttribute('fill', '#fff');
    tri.setAttribute('stroke', '#f59e0b');
    tri.setAttribute('stroke-width', '1.5');
    svg.appendChild(tri);

    const bubble = document.createElementNS(svgNS, 'circle');
    bubble.setAttribute('cx', notX + 22);
    bubble.setAttribute('cy', notBranchY);
    bubble.setAttribute('r', '3.5');
    bubble.setAttribute('fill', '#fff');
    bubble.setAttribute('stroke', '#f59e0b');
    bubble.setAttribute('stroke-width', '1.5');
    svg.appendChild(bubble);

    addThinTerminal(compX, notBranchY, '#f59e0b');
    addWire(compX, notBranchY, compX, railBottomY, '#facc15', 3);
    complementRails.push({x: compX, yStart: notBranchY, varIdx: i, color: '#f59e0b'});
  }

  // Draw Stage 1 Gates
  const stage1Title = globalStage2GateType === 'NONE' ? 'STAGE 1: PASS-THROUGH' : `${globalStage2GateType} GATES (STAGE 1)`;
  addLabel(AND_GATE_X + 45, MARGIN_TOP - 25, stage1Title, 10, '#0070f3');
  const andGates = [];

  termData.forEach((td, idx) => {
    const andCenterY = termCenterYs[idx];
    const { inputs, inputCount, pinSpacing, pinSpan, halfH, gateW } = td;
    const stage1GateType = globalStage2GateType;

    const isOrShape = ['NOR', 'OR', 'XOR', 'XNOR'].includes(stage1GateType);
    const hasBubble = ['NOR', 'NAND', 'XNOR', 'NOT'].includes(stage1GateType);
    const isNone = stage1GateType === 'NONE';
    const isNot = stage1GateType === 'NOT';

    const backIndent = gateW * 0.22;

    // Route input pins with dynamic spacing
    inputs.forEach((input, pinIdx) => {
      const railX = input.source === 'complement' ? complementRails[input.varIdx].x : inputRails[input.varIdx].x;
      const pinY = andCenterY - (pinSpan / 2) + pinIdx * pinSpacing;
      
      let entryX = AND_GATE_X;
      if (isOrShape) {
        const relY = (pinY - andCenterY) / halfH;
        entryX = AND_GATE_X + backIndent * (1 - relY * relY);
      } else if (isNone) {
        entryX = AND_GATE_X + 20;
      }

      addOrthPath([
        {x: railX, y: pinY},
        {x: entryX, y: pinY}
      ], input.color, 1.5);
      addThinTerminal(entryX, pinY, input.color);
    });

    if (isNone) {
      // Stage 1 Pass-through: direct junction
      addThinTerminal(AND_GATE_X + 20, andCenterY, '#0070f3');
      addLabel(AND_GATE_X + 20, andCenterY - 12, 'DIRECT', 9, '#64748b');
    } else if (isNot) {
      // NOT Gate
      const tri = document.createElementNS(svgNS, 'polygon');
      tri.setAttribute('points', `${AND_GATE_X},${andCenterY - halfH*0.75} ${AND_GATE_X},${andCenterY + halfH*0.75} ${AND_GATE_X + gateW*0.7},${andCenterY}`);
      tri.setAttribute('fill', '#fff');
      tri.setAttribute('stroke', '#0070f3');
      tri.setAttribute('stroke-width', '2');
      svg.appendChild(tri);

      const bub = document.createElementNS(svgNS, 'circle');
      bub.setAttribute('cx', AND_GATE_X + gateW*0.7 + 4);
      bub.setAttribute('cy', andCenterY);
      bub.setAttribute('r', '4');
      bub.setAttribute('fill', '#fff');
      bub.setAttribute('stroke', '#0070f3');
      bub.setAttribute('stroke-width', '1.5');
      svg.appendChild(bub);
      addLabel(AND_GATE_X + gateW*0.25, andCenterY + 4, 'NOT', 10, '#0070f3');
    } else if (isOrShape) {
      // OR / NOR / XOR / XNOR gate with dynamic scaling
      const g = document.createElementNS(svgNS, 'path');
      g.setAttribute('d', `M ${AND_GATE_X},${andCenterY - halfH} 
        Q ${AND_GATE_X + gateW * 0.5},${andCenterY - halfH} ${AND_GATE_X + gateW},${andCenterY} 
        Q ${AND_GATE_X + gateW * 0.5},${andCenterY + halfH} ${AND_GATE_X},${andCenterY + halfH} 
        Q ${AND_GATE_X + backIndent},${andCenterY} ${AND_GATE_X},${andCenterY - halfH} Z`);
      g.setAttribute('fill', '#fff');
      g.setAttribute('stroke', '#0070f3');
      g.setAttribute('stroke-width', '2');
      svg.appendChild(g);
      
      if (stage1GateType === 'XOR' || stage1GateType === 'XNOR') {
        const curve = document.createElementNS(svgNS, 'path');
        curve.setAttribute('d', `M ${AND_GATE_X - 7},${andCenterY - halfH} Q ${AND_GATE_X + backIndent - 7},${andCenterY} ${AND_GATE_X - 7},${andCenterY + halfH}`);
        curve.setAttribute('fill', 'none');
        curve.setAttribute('stroke', '#0070f3');
        curve.setAttribute('stroke-width', '2');
        svg.appendChild(curve);
      }

      if (hasBubble) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', AND_GATE_X + gateW + 4);
        bub.setAttribute('cy', andCenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#0070f3');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
      addLabel(AND_GATE_X + gateW * 0.38, andCenterY + 4, stage1GateType, Math.max(9, Math.min(12, halfH * 0.45)), '#0070f3');
    } else {
      // AND / NAND gate with dynamic scaling
      const straightW = gateW * 0.45;
      const arcW = gateW * 0.55;
      const andRect = document.createElementNS(svgNS, 'path');
      andRect.setAttribute('d', `M ${AND_GATE_X},${andCenterY - halfH} 
        L ${AND_GATE_X + straightW},${andCenterY - halfH} 
        A ${arcW},${halfH} 0 0,1 ${AND_GATE_X + straightW},${andCenterY + halfH} 
        L ${AND_GATE_X},${andCenterY + halfH} Z`);
      andRect.setAttribute('fill', '#fff');
      andRect.setAttribute('stroke', '#0070f3');
      andRect.setAttribute('stroke-width', '2');
      svg.appendChild(andRect);
      
      if (hasBubble) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', AND_GATE_X + gateW + 4);
        bub.setAttribute('cy', andCenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#0070f3');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
      addLabel(AND_GATE_X + gateW * 0.38, andCenterY + 4, stage1GateType, Math.max(9, Math.min(12, halfH * 0.45)), '#0070f3');
    }

    const gateOutActual = isNone ? (AND_GATE_X + 20) : (AND_GATE_X + (isNot ? gateW*0.7 : gateW) + (hasBubble ? 8 : 0));
    addThinTerminal(gateOutActual + 4, andCenterY, '#16a34a');
    andGates.push({x: gateOutActual + 4, y: andCenterY, term: td.term});
  });

  // Stage 2 Handling (Combiner Gate or Unselected/None)
  const stage2GateType = globalStage3GateType;
  const isStage2None = stage2GateType === 'NONE';

  if (isStage2None) {
    // Stage 2 is unselected / bypassed!
    addLabel(OR_GATE_X + 30, MARGIN_TOP - 25, 'STAGE 2: NONE (UNSELECTED)', 10, '#64748b');

    if (andGates.length === 1) {
      // Single term directly to output Y
      addWire(andGates[0].x, andGates[0].y, OUTPUT_X - 15, andGates[0].y, '#10b981', 3);
      addThinTerminal(OUTPUT_X - 15, andGates[0].y, '#10b981');
      addLabel(OUTPUT_X + 10, andGates[0].y + 5, 'Y', 16, '#10b981', 'start');
    } else {
      // Multiple parallel outputs
      andGates.forEach((gateOut, idx) => {
        addWire(gateOut.x, gateOut.y, OUTPUT_X - 15, gateOut.y, '#10b981', 2);
        addThinTerminal(OUTPUT_X - 15, gateOut.y, '#10b981');
        addLabel(OUTPUT_X + 6, gateOut.y + 4, `Y${idx} [${gateOut.term}]`, 11, '#0f172a', 'start');
      });
    }
  } else {
    // Stage 2 is active: Combine all Stage 1 outputs
    const stage2Count = andGates.length;
    const stage2PinSpacing = stage2Count > 1 ? Math.max(18, Math.min(26, 260 / stage2Count)) : 0;
    const stage2PinSpan = (stage2Count - 1) * stage2PinSpacing;
    // Dynamic scaling for Stage 2 gate: grows taller as terms increase!
    const stage2HalfH = Math.max(28, Math.round((stage2PinSpan / 2) + 16));
    const stage2Width = Math.max(90, Math.min(160, Math.round(75 + stage2HalfH * 0.55)));
    const stage2CenterY = (andGates[0].y + andGates[andGates.length - 1].y) / 2;
    const stage2CenterX = OR_GATE_X + stage2Width / 2;

    addLabel(OR_GATE_X + stage2Width / 2, MARGIN_TOP - 25, `${stage2GateType} GATE (STAGE 2)`, 10, '#10b981');

    const isOrShape3 = ['NOR', 'OR', 'XOR', 'XNOR'].includes(stage2GateType);
    const hasBubble3 = ['NOR', 'NAND', 'XNOR', 'NOT'].includes(stage2GateType);
    const isNot3 = stage2GateType === 'NOT';
    const backIndent3 = stage2Width * 0.22;

    // Connect Stage 1 outputs to Stage 2 pins
    andGates.forEach((andOut, idx) => {
      const pinY = stage2CenterY - (stage2PinSpan / 2) + idx * stage2PinSpacing;
      let pinEntryX2 = OR_GATE_X;
      if (isOrShape3) {
        const relY2 = (pinY - stage2CenterY) / stage2HalfH;
        pinEntryX2 = OR_GATE_X + backIndent3 * (1 - relY2 * relY2);
      }

      addOrthPath([
        {x: andOut.x, y: andOut.y},
        {x: OR_GATE_X - 25, y: andOut.y},
        {x: OR_GATE_X - 25, y: pinY},
        {x: pinEntryX2, y: pinY}
      ], '#94a3b8', 1.5);
      addThinTerminal(pinEntryX2, pinY, '#94a3b8');
    });

    if (isNot3) {
      // NOT Gate at Stage 2
      const tri = document.createElementNS(svgNS, 'polygon');
      tri.setAttribute('points', `${OR_GATE_X},${stage2CenterY - stage2HalfH*0.75} ${OR_GATE_X},${stage2CenterY + stage2HalfH*0.75} ${OR_GATE_X + stage2Width*0.7},${stage2CenterY}`);
      tri.setAttribute('fill', '#fff');
      tri.setAttribute('stroke', '#10b981');
      tri.setAttribute('stroke-width', '2');
      svg.appendChild(tri);

      const bub = document.createElementNS(svgNS, 'circle');
      bub.setAttribute('cx', OR_GATE_X + stage2Width*0.7 + 4);
      bub.setAttribute('cy', stage2CenterY);
      bub.setAttribute('r', '4');
      bub.setAttribute('fill', '#fff');
      bub.setAttribute('stroke', '#10b981');
      bub.setAttribute('stroke-width', '1.5');
      svg.appendChild(bub);
      addLabel(OR_GATE_X + stage2Width*0.25, stage2CenterY + 4, 'NOT', 10, '#10b981');
    } else if (isOrShape3) {
      // OR / NOR / XOR / XNOR gate at Stage 2
      const orGate = document.createElementNS(svgNS, 'path');
      orGate.setAttribute('d', `M ${OR_GATE_X},${stage2CenterY - stage2HalfH} 
        Q ${OR_GATE_X + stage2Width * 0.5},${stage2CenterY - stage2HalfH} ${OR_GATE_X + stage2Width},${stage2CenterY} 
        Q ${OR_GATE_X + stage2Width * 0.5},${stage2CenterY + stage2HalfH} ${OR_GATE_X},${stage2CenterY + stage2HalfH} 
        Q ${OR_GATE_X + backIndent3},${stage2CenterY} ${OR_GATE_X},${stage2CenterY - stage2HalfH} Z`);
      orGate.setAttribute('fill', '#fff');
      orGate.setAttribute('stroke', '#10b981');
      orGate.setAttribute('stroke-width', '2');
      svg.appendChild(orGate);

      if (stage2GateType === 'XOR' || stage2GateType === 'XNOR') {
        const curve = document.createElementNS(svgNS, 'path');
        curve.setAttribute('d', `M ${OR_GATE_X - 7},${stage2CenterY - stage2HalfH} Q ${OR_GATE_X + backIndent3 - 7},${stage2CenterY} ${OR_GATE_X - 7},${stage2CenterY + stage2HalfH}`);
        curve.setAttribute('fill', 'none');
        curve.setAttribute('stroke', '#10b981');
        curve.setAttribute('stroke-width', '2');
        svg.appendChild(curve);
      }
      
      if (hasBubble3) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', OR_GATE_X + stage2Width + 4);
        bub.setAttribute('cy', stage2CenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#10b981');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
      addLabel(stage2CenterX - 5, stage2CenterY + 4, stage2GateType, Math.max(10, Math.min(13, stage2HalfH * 0.45)), '#10b981');
    } else {
      // AND / NAND gate at Stage 2
      const straightW3 = stage2Width * 0.45;
      const arcW3 = stage2Width * 0.55;
      const g = document.createElementNS(svgNS, 'path');
      g.setAttribute('d', `M ${OR_GATE_X},${stage2CenterY - stage2HalfH} 
        L ${OR_GATE_X + straightW3},${stage2CenterY - stage2HalfH} 
        A ${arcW3},${stage2HalfH} 0 0,1 ${OR_GATE_X + straightW3},${stage2CenterY + stage2HalfH} 
        L ${OR_GATE_X},${stage2CenterY + stage2HalfH} Z`);
      g.setAttribute('fill', '#fff');
      g.setAttribute('stroke', '#10b981');
      g.setAttribute('stroke-width', '2');
      svg.appendChild(g);

      if (hasBubble3) {
        const bub = document.createElementNS(svgNS, 'circle');
        bub.setAttribute('cx', OR_GATE_X + stage2Width + 4);
        bub.setAttribute('cy', stage2CenterY);
        bub.setAttribute('r', '4');
        bub.setAttribute('fill', '#fff');
        bub.setAttribute('stroke', '#10b981');
        bub.setAttribute('stroke-width', '1.5');
        svg.appendChild(bub);
      }
      addLabel(stage2CenterX - 5, stage2CenterY + 4, stage2GateType, Math.max(10, Math.min(13, stage2HalfH * 0.45)), '#10b981');
    }

    const stage2OutActual = OR_GATE_X + (isNot3 ? stage2Width*0.7 : stage2Width) + (hasBubble3 ? 8 : 0);
    addThinTerminal(stage2OutActual + 4, stage2CenterY, '#10b981');
    addWire(stage2OutActual + 4, stage2CenterY, OUTPUT_X - 15, stage2CenterY, '#10b981', 3);
    addThinTerminal(OUTPUT_X - 15, stage2CenterY, '#10b981');
    addLabel(OUTPUT_X + 10, stage2CenterY - 12, 'Y', 16, '#10b981', 'start');
  }
}

// ===== TIMING WAVEFORM =====
function renderTimingModal(container){
  state.isVerilogModalOpen = false;
  container.style.maxHeight = '80vh';
  container.style.overflow = 'hidden';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

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

  const close = document.createElement('div');
  close.style.marginTop = '12px';
  const btn = document.createElement('button');
  btn.textContent = 'Close';
  btn.className = 'btn btn-secondary';
  btn.onclick = closeModal;
  close.appendChild(btn);
  container.appendChild(close);

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

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for(let t = 0; t <= periods; t++){
    const x = xStart + t * step;
    ctx.fillText('t' + t, x, yStart + (state.numVars + 2) * gap + 18);
  }
}

// Expose for debugging & automated testing
window.__DLA = {
  state,
  updateSimplification,
  parseAndApplyExpression,
  generateVerilog,
  openVerilogExplanation,
  saveCircuitFile,
  getSavedFiles,
  loadCircuitState,
  getHistoryLog
};
