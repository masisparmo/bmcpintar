// --- 1. CONFIG & STATE ---
let appState = {
    bmcData: { kp:"",ka:"",kr:"",vp:"",cr:"",ch:"",cs:"",cst:"",rs:"" },
    chatHistory: [{role:'ai', content:'Halo! Ada yang ingin didiskusikan tentang bisnis Anda?'}],
    analysisHTML: "",
    actionPlan: "",
    imagePrompt: ""
};
let lastAutoSaveHash = ""; // To track changes for auto-save

const meta = {
    kp: { t:"Key Partners (Mitra Utama)", d:"Siapa supplier/mitra strategis?", i:"fa-handshake" },
    ka: { t:"Key Activities (Aktivitas Utama)", d:"Kegiatan utama biar bisnis jalan?", i:"fa-check-double" },
    kr: { t:"Key Resources (Sumber Daya Utama)", d:"Aset fisik/intelektual apa yang wajib punya?", i:"fa-box" },
    vp: { t:"Value Propositions (Nilai)", d:"Apa keunggulan produk? Kenapa orang beli?", i:"fa-gift" },
    cr: { t:"Relationships (Hubungan Pelanggan)", d:"Cara menjaga hubungan dengan pelanggan?", i:"fa-heart" },
    ch: { t:"Channels (Saluran)", d:"Lewat mana produk sampai ke pelanggan?", i:"fa-truck" },
    cs: { t:"Customer Segments (Target)", d:"Siapa target pasar spesifik Anda?", i:"fa-users" },
    cst: { t:"Cost Structure (Biaya)", d:"Biaya pengeluaran utama apa saja?", i:"fa-file-invoice-dollar" },
    rs: { t:"Revenue Streams (Pendapatan)", d:"Dari mana saja sumber pendapatan?", i:"fa-cash-register" }
};

let currentModalKey = null;
let onConfirmCallback = null;
let db;

// --- 2. INDEXED DB ---
function initDB() {
    const request = indexedDB.open("SmartBMC_DB", 2);
    request.onerror = (e) => console.error("DB Error", e);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("state")) {
            db.createObjectStore("state", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("history")) {
            db.createObjectStore("history", { keyPath: "id" });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadState();
    };
}

window.saveState = function() {
    if(!db) return;
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");

    appState.userName = document.getElementById('userName').value;
    appState.userStage = document.getElementById('userStage').value;

    store.put({ id: "current", data: appState });
}

// --- HISTORY MANAGER ---
function generateStateHash(state) {
    // Simple hash from stringified state
    return JSON.stringify(state);
}

window.saveToHistory = function(manual = true) {
    if(!db) return;

    // Check if empty
    let filled = 0;
    for(let k in appState.bmcData) if(appState.bmcData[k].trim()) filled++;
    if(filled === 0 && !appState.analysisHTML) {
        if(manual) window.showToast("Data masih kosong!");
        return;
    }

    // AUTO-SAVE LOGIC: Check hash
    const currentHash = generateStateHash(appState);
    if (!manual) {
        if (currentHash === lastAutoSaveHash) {
            console.log("Auto-save skipped: No changes.");
            return; // Skip if no changes
        }
    }
    lastAutoSaveHash = currentHash; // Update hash

    const name = document.getElementById('userName').value.trim() || "Tanpa Nama";
    const stage = document.getElementById('userStage').value;
    const now = new Date();
    // Format ddmmyyyy manually to be sure
    const dd = String(now.getDate()).padStart(2,'0');
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const yyyy = now.getFullYear();
    const baseName = `${name}_${stage}-${dd}${mm}${yyyy}`;

    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    const req = store.getAll();

    req.onsuccess = () => {
        const items = req.result;
        // Filter for same base name to find counter
        let count = 0;
        items.forEach(item => {
            if(item.name.startsWith(baseName)) {
                 // Check for exact match or counter
                 if(item.name === baseName) count = Math.max(count, 1);
                 else {
                     const parts = item.name.match(/\((\d+)\)$/);
                     if(parts) count = Math.max(count, parseInt(parts[1]) + 1);
                 }
            }
        });

        let finalName = baseName;
        if(count > 0) finalName = `${baseName} (${count})`;

        const historyItem = {
            id: Date.now(),
            name: finalName,
            data: JSON.parse(JSON.stringify(appState)), // Deep copy
            date: now.toISOString()
        };

        store.add(historyItem);
        if(manual) window.showToast("Riwayat berhasil disimpan!");
    };
}

window.openHistory = function() {
    if(!db) return;
    window.toggle('historyModal', true);
    const list = document.getElementById('historyList');
    list.innerHTML = '<tr><td colspan="2" class="p-4 text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    const tx = db.transaction("history", "readonly");
    const store = tx.objectStore("history");
    const req = store.getAll();

    req.onsuccess = () => {
        const items = req.result.sort((a,b) => b.id - a.id); // Newest first
        list.innerHTML = '';
        if(items.length === 0) {
            document.getElementById('emptyHistory').classList.remove('hidden');
        } else {
            document.getElementById('emptyHistory').classList.add('hidden');
            items.forEach(item => {
                const date = new Date(item.date).toLocaleString('id-ID');
                const tr = document.createElement('tr');
                tr.className = "bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600";
                tr.innerHTML = `
                    <td class="px-4 py-3 cursor-pointer" onclick="window.loadHistoryItem(${item.id})">
                        <div class="font-bold text-gray-900 dark:text-white">${item.name}</div>
                        <div class="text-xs text-gray-500">${date}</div>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="window.renameHistoryItem(${item.id}, '${item.name}')" class="text-blue-600 hover:text-blue-800 mr-3" title="Ganti Nama"><i class="fas fa-edit"></i></button>
                        <button onclick="window.deleteHistoryItem(${item.id})" class="text-red-600 hover:text-red-800" title="Hapus"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                list.appendChild(tr);
            });
        }
    };
}

window.loadHistoryItem = function(id) {
    if(!confirm("Load data ini? Data yang belum disimpan akan hilang.")) return;
    const tx = db.transaction("history", "readonly");
    const store = tx.objectStore("history");
    const req = store.get(id);
    req.onsuccess = () => {
        if(req.result) {
            appState = req.result.data;
            lastAutoSaveHash = generateStateHash(appState); // Sync hash to prevent duplicate auto-save
            restoreUI();
            window.saveState(); // Update current state
            window.closeModals();
            window.showToast("Riwayat dimuat!");
        }
    };
}

window.deleteAllHistory = function() {
    if(!confirm("YAKIN HAPUS SEMUA RIWAYAT? Tindakan ini tidak bisa dibatalkan!")) return;
    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    const req = store.clear();
    req.onsuccess = () => {
        window.openHistory(); // Refresh list (will show empty)
        window.showToast("Semua riwayat dihapus!");
    };
}

window.deleteHistoryItem = function(id) {
    if(!confirm("Hapus riwayat ini permanen?")) return;
    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    store.delete(id);
    tx.oncomplete = () => window.openHistory(); // Refresh list
}

window.renameHistoryItem = function(id, oldName) {
    const newName = prompt("Nama baru:", oldName);
    if(newName && newName !== oldName) {
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");
        store.get(id).onsuccess = (e) => {
            const data = e.target.result;
            data.name = newName;
            store.put(data);
            window.openHistory(); // Refresh
        };
    }
}

// Auto Save on Hidden (Close/Switch Tab)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        window.saveToHistory(false);
    }
});

function loadState() {
    if(!db) return;
    const tx = db.transaction("state", "readonly");
    const store = tx.objectStore("state");
    const req = store.get("current");

    req.onsuccess = () => {
        if(req.result) {
            appState = req.result.data;
            restoreUI();
        } else {
            renderCanvas();
        }
    };
}

function restoreUI() {
    if(appState.userName) document.getElementById('userName').value = appState.userName;
    if(appState.userStage) window.syncSelect(appState.userStage);
    renderCanvas();
    if(appState.analysisHTML) {
        document.getElementById('analysisSection').classList.remove('hidden');
        document.getElementById('analysisContent').innerHTML = marked.parse(appState.analysisHTML);
    }
    renderChat();
}

// --- 3. UI RENDERING ---
// Configure Marked.js Custom Renderer for Rich Prompts
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

renderer.code = function(code, language, isEscaped) {
    // Handle Marked.js v5+ / v12+ signature where the first arg might be a token object
    if (typeof code === 'object' && code !== null) {
        language = code.lang || "";
        code = code.text || "";
    }

    // Ensure inputs are strings
    code = String(code || "");
    language = String(language || "");

    if (!code.trim()) return "";

    // Check if it's markdown or contains typical prompt markers
    // We look for 'markdown' language OR patterns typical in prompt generation
    // UPDATED: Relaxed logic to catch lists even without bold markers (user feedback)
    const isList = /^\s*[\*\-]\s+/m.test(code) || /^\s*\d+\.\s+/m.test(code);
    const isBold = code.includes('**');
    const isMarkdownLang = language === 'markdown' || language === 'md';

    // Avoid capturing real code (like JS comments with *)
    const isCodeLang = ['js','javascript','python','py','html','css','json','bash','sql'].includes(language.toLowerCase());

    const isPrompt = !isCodeLang && (isMarkdownLang || isList || isBold);

    if (isPrompt) {
        // Render as Rich Text Box

        let cleanCode = code.trim();

        // Strip external wrapping inside the code block content if it exists.
        // Often AI puts another ```markdown wrapper inside the block content.
        const startRegex = /^(\s*)(`{3,}|'{3,})(markdown|md)?(\s*\n)?/i;
        const endRegex = /(\n\s*)?(`{3,}|'{3,})(\s*)$/i;

        if (startRegex.test(cleanCode)) {
            cleanCode = cleanCode.replace(startRegex, '$1');
            cleanCode = cleanCode.replace(/^(\s*)(`{3,}|'{3,})(markdown|md)?\s*/i, '');
        }

        if (endRegex.test(cleanCode)) {
            cleanCode = cleanCode.replace(/(\s*)(`{3,}|'{3,})\s*$/i, '');
        }

        // Safety Replace: If there are STILL backticks (nested deeply), replace them to prevent recursion
        const safeCode = cleanCode.replace(/```/g, "'''");

        const htmlContent = marked.parse(safeCode);

        return `<div class="rich-prompt-box">
                    <span class="rich-prompt-label"><i class="fas fa-terminal mr-1"></i> AI Prompt / Detail</span>
                    <div class="prose dark:prose-invert max-w-none text-sm">${htmlContent}</div>
                </div>`;
    }

    // Fallback to default code block for other languages
    // We implement simple code block rendering to avoid issues with calling originalCode
    const langClass = language ? 'language-' + language : '';
    // Basic escaping for safety
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="${langClass}">${escaped}</code></pre>`;
};
marked.setOptions({ renderer: renderer });

function initGrid() {
    const grid = document.getElementById('canvasGrid');
    grid.innerHTML = '';
    Object.keys(meta).forEach(k => {
        const box = document.createElement('div');
        box.className = `bmc-box area-${k} bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col cursor-pointer relative group`;
        if(k === 'vp') box.classList.add('border-blue-400', 'dark:border-blue-600', 'border-2');
        box.onclick = () => window.edit(k);
        box.innerHTML = `
            <div class="flex items-center mb-2 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider"><i class="fas ${meta[k].i} mr-2"></i> ${meta[k].t}</div>
            <div id="txt-${k}" class="flex-grow text-sm whitespace-pre-line text-gray-400 italic">Klik untuk isi...</div>
            <span class="absolute top-2 right-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">Edit</span>
        `;
        grid.appendChild(box);
    });
}

function renderCanvas() {
    Object.keys(appState.bmcData).forEach(k => {
        const el = document.getElementById(`txt-${k}`);
        if(el) {
            let txt = appState.bmcData[k] || "";
            if(txt.trim()) {
                el.innerText = txt;
                el.className = "flex-grow text-sm whitespace-pre-line text-gray-800 dark:text-gray-200";
            } else {
                el.innerText = "Klik untuk isi...";
                el.className = "flex-grow text-sm whitespace-pre-line text-gray-400 italic";
            }
        }
    });
}

function renderChat() {
    const hist = document.getElementById('chatHistory');
    hist.innerHTML = '';
    appState.chatHistory.forEach(msg => {
        const isAI = msg.role === 'ai';

        // Outer Wrapper
        const div = document.createElement('div');
        div.className = `flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`;

        // Avatar (AI only)
        if (isAI) {
            const avatar = document.createElement('div');
            avatar.className = "w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0";
            avatar.innerText = "AI";
            div.appendChild(avatar);
        }

        // Bubble Container
        const bubble = document.createElement('div');
        bubble.className = isAI
            ? "bg-white dark:bg-gray-700 border dark:border-gray-600 p-4 rounded-xl text-sm shadow-sm max-w-[85%] dark:text-white flex flex-col gap-2 min-w-0"
            : "bg-blue-600 text-white p-3 rounded-lg text-sm shadow-sm max-w-[85%] break-words";

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = isAI ? "prose dark:prose-invert max-w-none text-sm leading-relaxed break-words" : "break-words whitespace-pre-wrap";

        if (isAI) {
            // AI content parsed with Marked
            contentDiv.innerHTML = marked.parse(msg.content);
        } else {
            // User content as plain text (safe)
            contentDiv.innerText = msg.content;
        }
        bubble.appendChild(contentDiv);

        // Copy Button (AI only) - Distinct Row
        if (isAI) {
            const actionRow = document.createElement('div');
            actionRow.className = "flex justify-end pt-2 mt-1 border-t border-gray-100 dark:border-gray-600";

            const copyBtn = document.createElement('button');
            copyBtn.className = "flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition uppercase px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600";
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Salin Jawaban';
            copyBtn.onclick = () => window.copyText(msg.content);

            actionRow.appendChild(copyBtn);
            bubble.appendChild(actionRow);
        }

        div.appendChild(bubble);
        hist.appendChild(div);
    });
    hist.scrollTop = hist.scrollHeight;
}

// --- 4. EXPORT / IMPORT ---
window.exportData = function() {
    window.saveState();
    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const name = (document.getElementById('userName').value || "unnamed").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const filename = `${name}-bmc-${date}.sbmc`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.showToast("Data berhasil diexport!");
}

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);
            if(loadedData.bmcData) {
                appState = loadedData;
                restoreUI();
                window.saveState();
                window.showToast("Data berhasil diimport!");
            } else {
                alert("File tidak valid.");
            }
        } catch(err) {
            alert("Gagal membaca file.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// --- 5. LOGIC & EVENTS ---
window.syncSelect = function(val) {
    document.getElementById('userStage').value = val;
    document.getElementById('userStageMobile').value = val;
    window.saveState();
}
window.syncStage = window.syncSelect;

window.edit = function(k) {
    currentModalKey = k;
    document.getElementById('modalTitle').innerText = meta[k].t;
    document.getElementById('modalDesc').innerText = meta[k].d;
    document.getElementById('modalInput').value = appState.bmcData[k];
    window.toggle('editModal', true);
}

window.saveData = function() {
    appState.bmcData[currentModalKey] = document.getElementById('modalInput').value;
    renderCanvas();
    window.saveState();
    window.closeModals();
}

window.openEditAnalysis = function() {
    if(!appState.analysisHTML) return alert("Belum ada hasil analisa untuk diedit.");
    document.getElementById('analysisInput').value = appState.analysisHTML;
    window.toggle('analysisEditModal', true);
}

window.saveEditAnalysis = function() {
    const val = document.getElementById('analysisInput').value;
    appState.analysisHTML = val;

    // Re-render
    let clean = val;
    if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

    document.getElementById('analysisContent').innerHTML = marked.parse(clean);
    window.saveState();
    window.closeModals();
    window.showToast("Hasil analisa diperbarui!");
}

window.openActionPlan = function() {
    window.toggle('actionPlanModal', true);
    const content = document.getElementById('actionPlanContent');
    if (appState.actionPlan) {
        content.innerHTML = marked.parse(appState.actionPlan);
        document.getElementById('btnGenAction').innerHTML = 'Buat Ulang';
    } else {
        content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <i class="fas fa-clipboard-list text-6xl mb-4 opacity-20"></i>
            <p>Klik tombol "Buat Rencana Aksi" untuk memulai.</p>
        </div>`;
        document.getElementById('btnGenAction').innerHTML = 'Buat Rencana Aksi';
    }
}

window.generateActionPlan = async function() {
    let filled=0; for(let k in appState.bmcData) if(appState.bmcData[k].trim()) filled++;
    if(filled<3) return alert("Isi minimal 3 kotak BMC sebelum membuat Action Plan.");

    const btn = document.getElementById('btnGenAction');
    const originalText = btn.innerHTML;
    btn.disabled=true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading...';

    const content = document.getElementById('actionPlanContent');
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full space-y-4">
            <i class="fas fa-rocket fa-bounce text-4xl text-teal-500"></i>
            <p class="font-bold text-gray-700 dark:text-gray-200">Sedang Menyusun Rencana Aksi...</p>
        </div>
    `;

    const stage = document.getElementById('userStage').value;
    const prompt = `Berdasarkan Business Model Canvas ini: ${JSON.stringify(appState.bmcData)} dan tahap bisnis "${stage}", buatkan **Action Plan (Rencana Aksi)** yang detail dan taktis untuk 30 hari ke depan.
    Prioritaskan langkah yang paling berdampak (High Impact, Low Effort).
    Format Output (Markdown):
    - **Minggu 1: Fondasi & Validasi** (Daftar To-Do)
    - **Minggu 2: Eksekusi & Pemasaran** (Daftar To-Do)
    - **Minggu 3: Operasional & Review** (Daftar To-Do)
    - **Minggu 4: Scale & Evaluasi** (Daftar To-Do)
    - **Prioritas Utama** (3 Hal wajib)
    Bahasa Indonesia.`;

    try {
        const res = await callApi(prompt, false);
        let clean = res;
        if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

        appState.actionPlan = clean;
        content.innerHTML = marked.parse(clean);
        window.saveState();
        btn.innerHTML = 'Buat Ulang';
    } catch(e) {
        alert("Gagal membuat Action Plan");
        content.innerHTML = '<p class="text-red-500 text-center">Gagal memuat. Silakan coba lagi.</p>';
    } finally {
        btn.disabled=false;
    }
}

window.downloadActionPlanPDF = function() {
    if(!appState.actionPlan) return alert("Belum ada Action Plan untuk didownload.");

    const name = document.getElementById('userName').value || "Bisnis Saya";
    const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Action Plan: ${name}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
                header { border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
                h1 { margin: 0; color: #0f766e; }
                .meta { color: #666; margin-top: 10px; font-size: 0.9em; }
                .content h2 { color: #0d9488; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px; }
                .content ul { padding-left: 20px; }
                .content li { margin-bottom: 8px; }
                strong { color: #0f766e; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <header>
                <h1>ACTION PLAN 30 HARI</h1>
                <div class="meta">
                    <strong>Bisnis:</strong> ${name}<br>
                    <strong>Tanggal:</strong> ${date}
                </div>
            </header>
            <div class="content">
                ${marked.parse(appState.actionPlan)}
            </div>
            <script>window.print()<\/script>
        </body>
        </html>`;

     const blob = new Blob([html], {type:'text/html'});
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `ActionPlan_${name.replace(/\s+/g,'_')}.html`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
}

// --- SETTINGS LOGIC ---
window.openSettings = function() {
    const key = localStorage.getItem('geminiApiKey') || "";
    document.getElementById('apiKeyInput').value = key;
    window.toggle('settingsModal', true);
}

window.saveSettings = function() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if(key) {
        localStorage.setItem('geminiApiKey', key);
        window.showToast("API Key berhasil disimpan!");
        window.closeModals();
    } else {
        alert("API Key tidak boleh kosong!");
    }
}

window.toggleKeyVisibility = function() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('eyeIcon');
    if(input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// --- 6. AI & UTILS ---
window.runAi = async function() {
    const topic = document.getElementById('aiTopic').value;
    if(!topic) return alert("Isi topik!");
    window.closeModals();
    document.getElementById('loader').classList.remove('hidden');

    const stage = document.getElementById('userStage').value;
    const prompt = `Buat BMC untuk "${topic}" tahap ${stage}. JSON valid keys: kp,ka,kr,vp,cr,ch,cs,cst,rs. Isi poin bahasa Indonesia.`;

    try {
        const res = await callApi(prompt, true);
        let jsonStr = res.substring(res.indexOf('{'), res.lastIndexOf('}')+1);
        let json = JSON.parse(jsonStr);

        const map = { 'kp':['partner'], 'ka':['activ'], 'kr':['resource'], 'vp':['value'], 'cr':['relation'], 'ch':['channel'], 'cs':['segment'], 'cst':['cost'], 'rs':['revenue'] };
        for(let k in json) {
            let clean = k.toLowerCase();
            let target = null;
            for(let m in map) if(map[m].some(x => clean.includes(x))) target = m;
            if(!target && appState.bmcData.hasOwnProperty(clean)) target = clean;
            if(target) {
                let val = json[k];
                if(Array.isArray(val)) val = val.map(x=>"• "+x).join('\n');
                appState.bmcData[target] = val;
            }
        }
        renderCanvas();
        window.saveState();
        window.showToast("Contoh dibuat!");
    } catch(e) { alert("Gagal AI"); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

window.analyzeData = async function() {
    let filled=0; for(let k in appState.bmcData) if(appState.bmcData[k].trim()) filled++;
    if(filled<3) return alert("Isi minimal 3 kotak");

    const btn = document.getElementById('analyzeBtn'); btn.disabled=true; btn.innerText="Menganalisa...";
    document.getElementById('analysisSection').classList.remove('hidden');
    showAnalysisLoading(true);

    const prompt = `Analisa BMC: ${JSON.stringify(appState.bmcData)}. Output in Markdown format. Bahasa Indonesia.`;
    try {
        const res = await callApi(prompt, false);
        let clean = res;
        if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

        const html = marked.parse(clean);
        document.getElementById('analysisContent').innerHTML = html;
        appState.analysisHTML = clean;
        window.saveState();
    } catch(e) { alert("Gagal"); }
    finally {
        btn.disabled=false;
        btn.innerText="Analisa Bisnis Saya";
        showAnalysisLoading(false);
    }
}

window.generateSWOT = async function() {
    let filled=0; for(let k in appState.bmcData) if(appState.bmcData[k].trim()) filled++;
    if(filled<3) return alert("Isi minimal 3 kotak BMC sebelum membuat SWOT.");

    const btn = document.getElementById('swotBtn');
    const originalText = btn.innerHTML;
    btn.disabled=true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading...';
    document.getElementById('analysisSection').classList.remove('hidden');

    // Scroll to analysis
    document.getElementById('analysisSection').scrollIntoView({behavior: 'smooth'});

    const prompt = `Berdasarkan BMC ini: ${JSON.stringify(appState.bmcData)}, buatkan Analisa SWOT (Strengths, Weaknesses, Opportunities, Threats) yang detail. Output in Markdown format with '## Analisa SWOT' as the first header. Bahasa Indonesia.`;

    try {
        const res = await callApi(prompt, false);
        let clean = res;
        if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

        // Append to existing analysis
        if(appState.analysisHTML) {
            appState.analysisHTML += "\n\n---\n\n" + clean;
        } else {
            appState.analysisHTML = clean;
        }

        document.getElementById('analysisContent').innerHTML = marked.parse(appState.analysisHTML);
        window.saveState();
        window.showToast("Analisa SWOT berhasil ditambahkan!");
    } catch(e) {
        alert("Gagal membuat SWOT");
        console.error(e);
    } finally {
        btn.disabled=false;
        btn.innerHTML = originalText;
    }
}

window.generatePitchDeck = async function() {
    let filled=0; for(let k in appState.bmcData) if(appState.bmcData[k].trim()) filled++;
    if(filled<3) return alert("Isi minimal 3 kotak BMC sebelum membuat Pitch Deck.");

    const btn = document.getElementById('pitchBtn');
    const originalText = btn.innerHTML;
    btn.disabled=true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading...';
    document.getElementById('analysisSection').classList.remove('hidden');

     // Scroll to analysis
    document.getElementById('analysisSection').scrollIntoView({behavior: 'smooth'});

    const prompt = `Berdasarkan BMC ini: ${JSON.stringify(appState.bmcData)}, buatkan Kerangka Slide Pitch Deck untuk presentasi ke investor. Buat 10-12 slide. Output in Markdown format with '## Kerangka Pitch Deck' as the first header. Bahasa Indonesia.`;

    try {
        const res = await callApi(prompt, false);
        let clean = res;
        if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

        // Append to existing analysis
        if(appState.analysisHTML) {
            appState.analysisHTML += "\n\n---\n\n" + clean;
        } else {
            appState.analysisHTML = clean;
        }

        document.getElementById('analysisContent').innerHTML = marked.parse(appState.analysisHTML);
        window.saveState();
        window.showToast("Pitch Deck berhasil ditambahkan!");
    } catch(e) {
        alert("Gagal membuat Pitch Deck");
        console.error(e);
    } finally {
        btn.disabled=false;
        btn.innerHTML = originalText;
    }
}

window.clearChat = function() {
    if(!confirm("Yakin ingin menghapus semua riwayat chat?")) return;
    appState.chatHistory = [{role:'ai', content:'Halo! Ada yang ingin didiskusikan tentang bisnis Anda?'}];
    renderChat();
    window.saveState();
    window.showToast("Riwayat chat dihapus");
}

window.sendChat = async function(e) {
    e.preventDefault();
    const inp = document.getElementById('chatInput');
    if(!inp.value) return;
    const q = inp.value; inp.value='';

    appState.chatHistory.push({role:'user', content:q});
    renderChat();
    showTypingIndicator();

    try {
        const res = await callApi(`Context BMC: ${JSON.stringify(appState.bmcData)}. Q: ${q}. Answer in Markdown format.`, false);
        removeTypingIndicator();

        let clean = res;
        if (clean.startsWith('```markdown')) clean = clean.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

        appState.chatHistory.push({role:'ai', content:clean});
        renderChat();
        window.saveState();
    } catch(e) {
        removeTypingIndicator();
        alert("Gagal kirim");
    }
}

async function callApi(txt, json) {
    const key = localStorage.getItem('geminiApiKey');
    if(!key) {
        alert("API Key belum diset! Silakan buka Pengaturan (Ikon Gerigi) dan masukkan API Key Gemini Anda.");
        window.openSettings();
        throw new Error("No API Key");
    }

    const body = { contents:[{parts:[{text:txt}]}] };
    if(json) body.generationConfig = { responseMimeType: "application/json" };

    // Using gemini-2.5-flash
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });

    if(!r.ok) {
         const err = await r.json();
         alert("API Error: " + (err.error?.message || "Unknown error"));
         throw new Error(err.error?.message);
    }

    const d = await r.json();
    return d.candidates[0].content.parts[0].text;
}

// --- COMMON UTILS ---
window.toggle = function(id, s) { document.getElementById(id).classList.toggle('hidden', !s); }
window.closeModals = function() { document.querySelectorAll('[id$="Modal"]').forEach(el=>el.classList.add('hidden')); }
window.openAiPrompt = function() { window.toggle('aiModal',true); }
window.openInfo = function() { window.toggle('infoModal',true); }
window.confirmReset = function() { onConfirmCallback = () => {
    appState = { bmcData:{kp:"",ka:"",kr:"",vp:"",cr:"",ch:"",cs:"",cst:"",rs:""}, chatHistory:[], analysisHTML:"" };
    window.saveState(); restoreUI(); window.closeModals(); window.showToast("Reset berhasil");
}; window.toggle('confirmModal',true); }

document.getElementById('confirmYesBtn').onclick = () => { if(onConfirmCallback) onConfirmCallback(); window.closeModals(); };

window.openImgPrompt = function() {
    let val = k => (appState.bmcData[k]||"N/A").replace(/\n/g,", ");
    let txt = `Create vertical 9:16 Infographic Poster for BMC.\nTopic: ${document.getElementById('userName').value}\n` +
    `Partners: ${val('kp')}\nActivities: ${val('ka')}\nResources: ${val('kr')}\nValue: ${val('vp')}\nRelationships: ${val('cr')}\nChannels: ${val('ch')}\nSegments: ${val('cs')}\nCosts: ${val('cst')}\nRevenue: ${val('rs')}\nStyle: Modern flat vector, blue-orange theme. --ar 9:16`;
    document.getElementById('imgPromptText').value = txt;
    window.toggle('imgModal',true);
}

window.downloadReport = function() {
     const name = document.getElementById('userName').value || "Bisnis Tanpa Nama";
     const stage = document.getElementById('userStage').options[document.getElementById('userStage').selectedIndex].text;
     const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
     const getVal = (k) => (appState.bmcData[k]||"-").replace(/\n/g,'<br>');

     // Format Chat History
     const chatContent = appState.chatHistory.map(msg =>
        `<div style="margin-bottom:15px; padding:15px; background-color: ${msg.role === 'ai' ? '#f8fafc' : '#eff6ff'}; border-radius:8px; border-left: 4px solid ${msg.role === 'ai' ? '#4f46e5' : '#3b82f6'};">
            <strong style="color: ${msg.role === 'ai' ? '#4338ca' : '#1e40af'}; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.05em; display:block; margin-bottom: 5px;">${msg.role === 'ai' ? 'AI Coach' : 'Pemilik Bisnis'}:</strong>
            <div style="font-size: 0.95em; line-height: 1.6; color: #334155;">${marked.parse(msg.content)}</div>
        </div>`
     ).join('');

     const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Profesional - ${name}</title>
            <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
            <style>
                @page { size: A4; margin: 20mm 20mm 20mm 30mm; } /* Left margin 30mm for binding */
                body { font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; }

                /* HEADER (KOP) */
                header { border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                .brand h1 { font-family: 'Merriweather', serif; font-size: 24pt; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                .brand p { margin: 5px 0 0; color: #64748b; font-size: 10pt; }
                .meta { text-align: right; font-size: 10pt; color: #64748b; }
                .meta strong { color: #0f172a; display: block; margin-bottom: 2px; }

                /* SECTIONS */
                h2 { font-family: 'Merriweather', serif; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px; font-size: 16pt; }
                h3 { font-family: 'Inter', sans-serif; font-size: 11pt; color: #334155; margin: 0 0 8px 0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }

                /* BMC BOXES */
                .bmc-container { display: flex; flex-direction: column; gap: 15px; }
                .box { border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; padding: 20px; background: #fff; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); page-break-inside: avoid; }
                .box p { margin: 0; color: #334155; font-size: 11pt; }

                /* CONTENT STYLING */
                .prose { font-family: 'Merriweather', serif; font-size: 11pt; line-height: 1.8; color: #334155; text-align: justify; }
                .prose h1, .prose h2, .prose h3 { font-family: 'Inter', sans-serif; color: #0f172a; margin-top: 1.5em; }
                .prose ul { padding-left: 20px; }
                .prose li { margin-bottom: 5px; }
                .prose strong { color: #0f172a; }

                /* FOOTER */
                footer { border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 20px; text-align: center; font-size: 9pt; color: #94a3b8; }

                /* PRINT OPTIMIZATION */
                @media print {
                    body { padding: 0; }
                    .box { break-inside: avoid; }
                    h2 { break-after: avoid; }
                }
            </style>
        </head>
        <body>
            <header>
                <div class="brand">
                    <h1>${name}</h1>
                    <p>Laporan Business Model Canvas</p>
                </div>
                <div class="meta">
                    <strong>Tahap Bisnis:</strong> ${stage}<br>
                    ${dateStr}
                </div>
            </header>

            <h2>1. Sembilan Elemen Kunci (BMC)</h2>
            <div class="bmc-container">
                ${Object.keys(meta).map(k=>`
                    <div class="box">
                        <h3>${meta[k].t}</h3>
                        <p>${getVal(k)}</p>
                    </div>`).join('')}
            </div>

            <h2>2. Analisa Mendalam & Strategi</h2>
            <div class="prose">
                ${marked.parse(appState.analysisHTML || "<em>Belum ada analisa yang dibuat.</em>")}
            </div>

            <h2>3. Riwayat Konsultasi AI</h2>
            <div class="chat-section">
                ${chatContent || "<p style='text-align:center; color:#94a3b8;'><em>Belum ada sesi konsultasi.</em></p>"}
            </div>

            <footer>
                Dibuat dengan <strong>BMC Pro AI</strong> &bull; ${dateStr}
            </footer>

            <script>window.print()<\/script>
        </body>
        </html>`;

     const blob = new Blob([html], {type:'text/html'});
     const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Laporan_Profesional_${name.replace(/[^a-zA-Z0-9]/g,'_')}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

window.copyToClipboard = function(txt) {
     const ta = document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); window.showToast("Disalin");
}
window.copyText = function(txt) { window.copyToClipboard(txt); }

window.showToast = function(msg) {
    const t = document.createElement('div'); t.className = "toast p-4 bg-green-600 text-white rounded-lg shadow"; t.innerText = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(()=>t.remove(),3000);
}

window.toggleTheme = function() { document.documentElement.classList.toggle('dark'); }
if(localStorage.theme === 'dark') document.documentElement.classList.add('dark');

function showTypingIndicator() {
    const hist = document.getElementById('chatHistory');
    if(document.getElementById('typingIndicator')) return;
    const div = document.createElement('div');
    div.id = 'typingIndicator';
    div.className = 'flex justify-start';
    div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2">AI</div>
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if(el) el.remove();
}

function showAnalysisLoading(show) {
    const container = document.getElementById('analysisContent');
    if(show) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full space-y-4">
                <i class="fas fa-brain fa-bounce text-4xl text-blue-500"></i>
                <div class="text-center">
                    <h4 class="font-bold text-gray-700 dark:text-gray-200">Sedang Menganalisa Bisnis Anda...</h4>
                    <p class="text-xs text-gray-500">Mohon tunggu, AI sedang berpikir.</p>
                </div>
                <div class="w-3/4 max-w-xs">
                    <div class="progress-container">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // If show is false, we might want to do nothing if content was replaced by result,
        // but if an error occurred, we should probably clear the loading state.
        // However, since analyzeData overwrites innerHTML on success,
        // this else block is mainly useful for error cleanup.
        if(container.innerHTML.includes('Sedang Menganalisa')) {
             container.innerHTML = '';
        }
    }
}

// Start
initGrid();
initDB();
