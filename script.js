/* =====================================================================
   ScenarioSmith v3.4
   Based on your current uploaded code, with fixes:
   ✔ Restored NPC dropdown population
   ✔ Restored Location dropdown population
   ✔ Restored Tone save/load + HUD update
   ✔ No other functionality changed
   ===================================================================== */


/* =====================================================================
   GLOBAL STATE
   ===================================================================== */
let state = {
    currentScenarioName: "Untitled Scenario",
    scenarios: {},
    npcs: {},
    locations: {},
    undo: [],
    redo: []
};

let currentNPC = null;
let currentLocation = null;
let inputSaveTimeout = null;


/* =====================================================================
   IMAGE PATH HELPERS
   ===================================================================== */
function npcPortraitPath(file) {
    if (!file) return "";
    if (file.startsWith("portraits/") || file.startsWith("data:")) return file;
    return "portraits/" + file;
}

function locationPortraitPath(file) {
    if (!file) return "";
    if (file.startsWith("locations/") || file.startsWith("data:")) return file;
    return "locations/" + file;
}


/* =====================================================================
   INIT
   ===================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
    loadAllFromStorage();
    await loadPrebuiltData();

    populateScenarioDropdown();
    bindFormEvents();
    loadScenarioIntoForm();
    refreshHUD();
    initSlidePanels();
});


/* =====================================================================
   JSON PREBUILT IMPORT
   ===================================================================== */
async function loadPrebuiltData() {
    try {
        const npcResp = await fetch("npcs.json");
        const locResp = await fetch("locations.json");

        if (npcResp.ok) {
            const json = await npcResp.json();
            json.npcs.forEach(n => {
                if (!state.npcs[n.id]) {
                    n.portrait = npcPortraitPath(n.portrait);
                    n.prebuilt = true;
                    state.npcs[n.id] = n;
                }
            });
        }

        if (locResp.ok) {
            const json = await locResp.json();
            json.locations.forEach(l => {
                if (!state.locations[l.id]) {
                    l.portrait = locationPortraitPath(l.portrait);
                    l.prebuilt = true;
                    state.locations[l.id] = l;
                }
            });
        }

        saveAllToStorage();
    } catch (err) {
        console.warn("Failed to load prebuilt JSON", err);
    }
}


/* =====================================================================
   STORAGE
   ===================================================================== */
function saveAllToStorage() {
    localStorage.setItem("SM_state", JSON.stringify(state));
}

function loadAllFromStorage() {
    const saved = localStorage.getItem("SM_state");
    if (saved) {
        state = JSON.parse(saved);
    }
}


/* =====================================================================
   SCENARIOS
   ===================================================================== */
function blankScenario() {
    return {
        hook: "",
        truth: "",
        act1: "",
        act2: "",
        act3: "",
        npcAlly: "",
        npcAntag: "",
        npcWild: "",
        locations: ["", "", "", "", ""],
        clues: ["", "", ""],
        tones: [],
        pacing: ""
    };
}

function getCurrentScenario() {
    if (!state.scenarios[state.currentScenarioName]) {
        state.scenarios[state.currentScenarioName] = blankScenario();
    }
    return state.scenarios[state.currentScenarioName];
}

function populateScenarioDropdown() {
    const sel = document.getElementById("scenarioLoadSelect");
    sel.innerHTML = "";

    const def = document.createElement("option");
    def.value = "Untitled Scenario";
    def.textContent = "Untitled Scenario";
    sel.appendChild(def);

    Object.keys(state.scenarios).forEach(name => {
        const o = document.createElement("option");
        o.value = name;
        o.textContent = name;
        sel.appendChild(o);
    });

    sel.value = state.currentScenarioName;
}


/* Change Scenario */
document.getElementById("scenarioLoadSelect").onchange = (e) => {
    state.currentScenarioName = e.target.value;
    pushUndoScenario();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* New Scenario */
document.getElementById("btnNew").onclick = () => {
    const name = prompt("Name your new scenario:");
    if (!name) return;

    state.scenarios[name] = blankScenario();
    state.currentScenarioName = name;

    pushUndoScenario();
    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* Save Scenario */
document.getElementById("btnSave").onclick = () => {
    saveScenarioFromForm();
    pushUndoScenario();
    saveAllToStorage();
    alert("Saved!");
};


/* =====================================================================
   FORM BINDING + DEBOUNCED SAVE
   ===================================================================== */
function bindFormEvents() {
    const ids = [
        "hookInput","truthInput","act1Input","act2Input","act3Input",
        "pacingInput","clue_0","clue_1","clue_2"
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        el.oninput = debouncedSaveScenario;
        el.onblur = () => {
            saveScenarioFromForm();
            pushUndoScenario();
            saveAllToStorage();
        };
    });

    ["npcAllySelect","npcAntagSelect","npcWildSelect"].forEach(id => {
        const el = document.getElementById(id);
        el.onchange = () => {
            saveScenarioFromForm();
            pushUndoScenario();
            saveAllToStorage();
        };
    });

    for (let i = 0; i < 5; i++) {
        const el = document.getElementById(`loc_${i}`);
        el.onchange = () => {
            saveScenarioFromForm();
            pushUndoScenario();
            saveAllToStorage();
        };
    }

    document.querySelectorAll(".toneChk").forEach(chk => {
        chk.onchange = () => {
            saveScenarioFromForm();
            pushUndoScenario();
            saveAllToStorage();
        };
    });
}

function debouncedSaveScenario() {
    clearTimeout(inputSaveTimeout);
    inputSaveTimeout = setTimeout(saveScenarioFromForm, 600);
}


/* =====================================================================
   SAVE CURRENT SCENARIO (patched v3.4)
   ===================================================================== */
function saveScenarioFromForm() {
    const sc = getCurrentScenario();

    sc.hook = document.getElementById("hookInput").value;
    sc.truth = document.getElementById("truthInput").value;
    sc.act1 = document.getElementById("act1Input").value;
    sc.act2 = document.getElementById("act2Input").value;
    sc.act3 = document.getElementById("act3Input").value;
    sc.pacing = document.getElementById("pacingInput").value;

    sc.clues = [
        document.getElementById("clue_0").value,
        document.getElementById("clue_1").value,
        document.getElementById("clue_2").value
    ];

    sc.npcAlly = document.getElementById("npcAllySelect").value;
    sc.npcAntag = document.getElementById("npcAntagSelect").value;
    sc.npcWild = document.getElementById("npcWildSelect").value;

    for (let i = 0; i < 5; i++) {
        sc.locations[i] = document.getElementById(`loc_${i}`).value;
    }

    /* === NEW: TONE SAVE FIX === */
    sc.tones = Array.from(document.querySelectorAll(".toneChk"))
        .filter(chk => chk.checked)
        .map(chk => chk.value);

    saveAllToStorage();
    refreshHUD();
}


/* =====================================================================
   LOAD SCENARIO INTO FORM (patched v3.4)
   ===================================================================== */
function loadScenarioIntoForm() {
    const sc = getCurrentScenario();

    document.getElementById("hookInput").value = sc.hook;
    document.getElementById("truthInput").value = sc.truth;
    document.getElementById("act1Input").value = sc.act1;
    document.getElementById("act2Input").value = sc.act2;
    document.getElementById("act3Input").value = sc.act3;
    document.getElementById("pacingInput").value = sc.pacing;

    /* DROPDOWNS RESTORED */
    loadNPCDropdowns();
    loadLocationDropdowns();
    loadClueInputs();
    loadToneChecks();

    refreshHUD();
}


/* =====================================================================
   MISSING FUNCTION — RESTORED
   NPC DROPDOWN POPULATION
   ===================================================================== */
function loadNPCDropdowns() {
    const ally = document.getElementById("npcAllySelect");
    const antag = document.getElementById("npcAntagSelect");
    const wild = document.getElementById("npcWildSelect");

    const sc = getCurrentScenario();

    ally.innerHTML = `<option value="">—</option>`;
    antag.innerHTML = `<option value="">—</option>`;
    wild.innerHTML = `<option value="">—</option>`;

    const list = Object.entries(state.npcs)
        .sort((a,b) => a[1].name.localeCompare(b[1].name));

    list.forEach(([id, npc]) => {
        const opt1 = new Option(npc.name, id);
        const opt2 = new Option(npc.name, id);
        const opt3 = new Option(npc.name, id);

        ally.appendChild(opt1);
        antag.appendChild(opt2);
        wild.appendChild(opt3);
    });

    ally.value = sc.npcAlly || "";
    antag.value = sc.npcAntag || "";
    wild.value = sc.npcWild || "";
}


/* =====================================================================
   MISSING FUNCTION — RESTORED
   LOCATION DROPDOWN POPULATION
   ===================================================================== */
function loadLocationDropdowns() {
    const sc = getCurrentScenario();

    const list = Object.entries(state.locations)
        .sort((a,b) => a[1].name.localeCompare(b[1].name));

    for (let i = 0; i < 5; i++) {
        const sel = document.getElementById(`loc_${i}`);
        sel.innerHTML = `<option value="">—</option>`;

        list.forEach(([id, loc]) => {
            const opt = new Option(loc.name, id);
            sel.appendChild(opt);
        });

        sel.value = sc.locations[i] || "";
    }
}


/* =====================================================================
   RESTORED — LOAD CLUES
   ===================================================================== */
function loadClueInputs() {
    const sc = getCurrentScenario();

    document.getElementById("clue_0").value = sc.clues[0] || "";
    document.getElementById("clue_1").value = sc.clues[1] || "";
    document.getElementById("clue_2").value = sc.clues[2] || "";
}


/* =====================================================================
   RESTORED — LOAD TONE CHECKBOXES
   ===================================================================== */
function loadToneChecks() {
    const sc = getCurrentScenario();

    document.querySelectorAll(".toneChk").forEach(chk => {
        chk.checked = sc.tones.includes(chk.value);
    });
}
/* =====================================================================
   HUD RENDERING
   ===================================================================== */
function refreshHUD() {
    const sc = getCurrentScenario();

    document.getElementById("hudHook").textContent =
        sc.hook.trim() || "—";

    document.getElementById("hudTruth").textContent =
        sc.truth.trim() || "—";

    /* NPC CARDS */
    renderNPCMiniCards(sc);

    /* LOCATION CARDS */
    renderLocationMiniCards(sc);

    /* CLUE CHIPS */
    renderClueChips(sc);

    /* === TONE FIX: show joined list === */
    document.getElementById("hudTone").textContent =
        sc.tones.length ? sc.tones.join(", ") : "None";
}


/* =====================================================================
   MINI NPC CARDS
   ===================================================================== */
function renderNPCMiniCards(sc) {
    const box = document.getElementById("hudNPCs");
    box.innerHTML = "";

    const ids = [sc.npcAlly, sc.npcAntag, sc.npcWild];

    ids.forEach(id => {
        if (!id || !state.npcs[id]) return;
        const npc = state.npcs[id];

        const card = document.createElement("div");
        card.className = "miniCard";
        card.onclick = () => openNpcEditor(id);

        const port = document.createElement("div");
        port.className = "miniCardPortrait";
        port.style.backgroundImage = `url('${npcPortraitPath(npc.portrait)}')`;

        const name = document.createElement("div");
        name.className = "miniCardName";
        name.textContent = npc.name;

        card.appendChild(port);
        card.appendChild(name);

        box.appendChild(card);
    });
}


/* =====================================================================
   MINI LOCATION CARDS
   ===================================================================== */
function renderLocationMiniCards(sc) {
    const box = document.getElementById("hudLocations");
    box.innerHTML = "";

    sc.locations.forEach(id => {
        if (!id || !state.locations[id]) return;

        const loc = state.locations[id];

        const card = document.createElement("div");
        card.className = "miniCard";
        card.onclick = () => openLocationEditor(id);

        const port = document.createElement("div");
        port.className = "miniCardPortrait";
        port.style.backgroundImage = `url('${locationPortraitPath(loc.portrait)}')`;

        const name = document.createElement("div");
        name.className = "miniCardName";
        name.textContent = loc.name;

        card.appendChild(port);
        card.appendChild(name);
        box.appendChild(card);
    });
}


/* =====================================================================
   CLUE CHIPS
   ===================================================================== */
function renderClueChips(sc) {
    const row = document.getElementById("hudClues");
    row.innerHTML = "";

    sc.clues.forEach(c => {
        if (!c.trim()) return;
        const chip = document.createElement("div");
        chip.className = "hudClueItem";
        chip.textContent = c.trim();
        row.appendChild(chip);
    });
}


/* =====================================================================
   UNDO / REDO CORE
   ===================================================================== */
function snapshotCurrentScenario() {
    const sc = getCurrentScenario();

    return JSON.stringify({
        name: state.currentScenarioName,
        data: sc
    });
}

function restoreScenarioSnapshot(snap) {
    const obj = JSON.parse(snap);
    state.currentScenarioName = obj.name;
    state.scenarios[obj.name] = obj.data;
}

function pushUndoScenario() {
    state.undo.push(snapshotCurrentScenario());
    if (state.undo.length > 12) state.undo.shift();
    state.redo = [];
}


/* Undo */
document.getElementById("btnUndo").onclick = () => {
    if (state.undo.length === 0) return;

    state.redo.push(snapshotCurrentScenario());
    const prev = state.undo.pop();
    restoreScenarioSnapshot(prev);

    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* Redo */
document.getElementById("btnRedo").onclick = () => {
    if (state.redo.length === 0) return;

    state.undo.push(snapshotCurrentScenario());
    const next = state.redo.pop();
    restoreScenarioSnapshot(next);

    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* =====================================================================
   NPC EDITOR POPUP
   ===================================================================== */
function openNpcEditor(id) {
    if (!state.npcs[id]) return;

    currentNPC = id;

    const npc = state.npcs[id];
    const portrait = npcPortraitPath(npc.portrait);

    const box = document.querySelector("#npcCard .popupCard");

    box.innerHTML = `
        <h2>Edit NPC</h2>

        <div style="display:flex; gap:10px;">

            <div style="width:150px;">
                <div id="npcPortraitBox"
                     style="
                        width:150px;height:150px;background:#ccc;border-radius:6px;
                        background-image:url('${portrait}');
                        background-size:cover;background-position:center;">
                </div>

                <button onclick="randomizeNPCPortrait()" style="margin-top:8px;width:100%;">🎲 Random Portrait</button>
                <button onclick="uploadNPCPortrait()" style="margin-top:5px;width:100%;">⬆ Upload Portrait</button>
                <button onclick="addNPCToScenario()" style="margin-top:5px;width:100%;">➕ Add to Scenario</button>
            </div>

            <div style="flex:1;">
                <label>Name:</label>
                <input id="npcName" class="popupInput" type="text" value="${npc.name || ""}"/>

                <label>Secret:</label>
                <textarea id="npcSecret" class="popupTextarea">${npc.secret || ""}</textarea>

                <label>Motivation:</label>
                <textarea id="npcMotivation" class="popupTextarea">${npc.motivation || ""}</textarea>

                <label>Personality:</label>
                <textarea id="npcPersonality" class="popupTextarea">${npc.personality || ""}</textarea>

                <label>Bio:</label>
                <textarea id="npcBio" class="popupTextarea">${npc.bio || ""}</textarea>

                <label>Tags:</label>
                <input id="npcTags" class="popupInput" value="${(npc.tags||[]).join(", ")}"/>

                <div class="popupButtons">
                    <button onclick="saveNPC()">Save</button>
                    <button onclick="closeNpcCard()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("npcCard").style.display = "flex";
}

function closeNpcCard() {
    document.getElementById("npcCard").style.display = "none";
}


/* =====================================================================
   SAVE NPC
   ===================================================================== */
function saveNPC() {
    const npc = state.npcs[currentNPC];

    npc.name = document.getElementById("npcName").value;
    npc.secret = document.getElementById("npcSecret").value;
    npc.motivation = document.getElementById("npcMotivation").value;
    npc.personality = document.getElementById("npcPersonality").value;
    npc.bio = document.getElementById("npcBio").value;

    const tagStr = document.getElementById("npcTags").value.trim();
    npc.tags = tagStr ? tagStr.split(",").map(t => t.trim()) : [];

    saveAllToStorage();
    refreshNPCList();
    loadNPCDropdowns();
    refreshHUD();
    pushUndoScenario();

    closeNpcCard();
}


/* =====================================================================
   ADD NPC TO SCENARIO
   ===================================================================== */
function addNPCToScenario() {
    const sc = getCurrentScenario();

    if (!sc.npcAlly) sc.npcAlly = currentNPC;
    else if (!sc.npcAntag) sc.npcAntag = currentNPC;
    else if (!sc.npcWild) sc.npcWild = currentNPC;

    loadNPCDropdowns();
    refreshHUD();
    pushUndoScenario();
    saveAllToStorage();
}

function addNPCToScenarioFromList(id) {
    currentNPC = id;
    addNPCToScenario();
}


/* =====================================================================
   NPC PORTRAIT FUNCTIONS
   ===================================================================== */
function randomizeNPCPortrait() {
    const list = [];
    for (let i = 1; i <= 15; i++) {
        list.push(`portraits/${String(i).padStart(3,"0")}.jpg`);
    }

    const url = list[Math.floor(Math.random()*list.length)];
    state.npcs[currentNPC].portrait = url;

    document.getElementById("npcPortraitBox").style.backgroundImage =
        `url('${url}')`;

    saveAllToStorage();
    refreshHUD();
    pushUndoScenario();
}

function uploadNPCPortrait() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            state.npcs[currentNPC].portrait = e.target.result;

            document.getElementById("npcPortraitBox").style.backgroundImage =
                `url('${e.target.result}')`;

            saveAllToStorage();
            refreshHUD();
            pushUndoScenario();
        };
        reader.readAsDataURL(file);
    };

    input.click();
}


/* =====================================================================
   NPC MANAGER PANEL
   ===================================================================== */
function refreshNPCList() {
    const box = document.getElementById("npcList");

    box.innerHTML = `
        <div style="margin-bottom:10px;">
            <input id="npcSearch" type="text" placeholder="Search NPCs..." 
                   style="width:100%;padding:5px;" oninput="refreshNPCList()" />
        </div>

       <div style="margin-bottom:10px;">
            <select id="npcFilter" style="width:100%;padding:5px;" onchange="refreshNPCList()">
                <option value="all">All NPCs</option>
                <option value="prebuilt">Prebuilt Only</option>
                <option value="created">Created This Game</option>
                <option value="previous">Created Previously</option>
            </select>
        </div>

        <button onclick="newNPC()" style="width:100%;padding:8px;margin-bottom:10px;">➕ New NPC</button>
        <button onclick="randomNPC()" style="width:100%;padding:8px;margin-bottom:20px;">🎲 Random NPC</button>
    `;

    const search = (document.getElementById("npcSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("npcFilter")?.value || "all";

    Object.keys(state.npcs).forEach(id => {
        const npc = state.npcs[id];
        if (!npc) return;

        /* Search filter */
        if (!npc.name.toLowerCase().includes(search)) return;

        /* Filter by flags */
        if (filter === "prebuilt" && !npc.prebuilt) return;
        if (filter === "created" && !npc.createdThisSession) return;
        if (filter === "previous" && (npc.prebuilt || npc.createdThisSession)) return;

        const row = document.createElement("div");
        row.className = "managerRow";
        row.innerHTML = `
            <div class="managerName">${npc.name}</div>
            <div>
                <button onclick="openNpcEditor('${id}')">Edit</button>
                <button onclick="addNPCToScenarioFromList('${id}')">Add</button>
                <button onclick="deleteNPC('${id}')">Delete
                </button>
            </div>
        `;

        box.appendChild(row);
    });
}


/* =====================================================================
   NEW NPC
   ===================================================================== */
function newNPC() {
    const id = crypto.randomUUID();
    state.npcs[id] = {
        name: "New NPC",
        secret: "",
        motivation: "",
        personality: "",
        bio: "",
        portrait: "portraits/001.jpg",
        tags: [],
        prebuilt: false,
        createdThisSession: true
    };

    currentNPC = id;
    saveAllToStorage();
    pushUndoScenario();
    refreshNPCList();
    loadNPCDropdowns();
    openNpcEditor(id);
}


/* =====================================================================
   RANDOM NPC
   ===================================================================== */
function randomNPC() {
    const names = [
        "Selene Ward", "Marvin Kline", "Etta Grange",
        "Hector Lowell", "June Hawthorne"
    ];

    const secrets = [
        "Hiding a dangerous truth.",
        "Works with the enemy.",
        "Hears voices from the dark."
    ];

    const personalities = [
        "Dry humor, analytical.",
        "Quiet, observant.",
        "Nervous, talkative.",
        "Calm but evasive."
    ];

    const motivations = [
        "To protect someone.",
        "To uncover a mystery.",
        "To stop a looming threat."
    ];

    const bios = [
        "A local with a complicated past.",
        "A traveler caught up in events.",
        "A researcher studying strange phenomena."
    ];

    const portraits = [];
    for (let i = 1; i <= 15; i++) {
        portraits.push(`portraits/${String(i).padStart(3,"0")}.jpg`);
    }

    const id = crypto.randomUUID();
    state.npcs[id] = {
        name: names[Math.floor(Math.random()*names.length)],
        secret: secrets[Math.floor(Math.random()*secrets.length)],
        motivation: motivations[Math.floor(Math.random()*motivations.length)],
        personality: personalities[Math.floor(Math.random()*personalities.length)],
        bio: bios[Math.floor(Math.random()*bios.length)],
        portrait: portraits[Math.floor(Math.random()*portraits.length)],
        tags: [],
        createdThisSession: true,
        prebuilt: false
    };

    currentNPC = id;

    saveAllToStorage();
    pushUndoScenario();
    refreshNPCList();
    loadNPCDropdowns();
    openNpcEditor(id);
}


/* =====================================================================
   DELETE NPC
   ===================================================================== */
function deleteNPC(id) {
    if (!confirm("Delete this NPC?")) return;

    delete state.npcs[id];

    saveAllToStorage();
    refreshNPCList();
    loadNPCDropdowns();
    refreshHUD();
    pushUndoScenario();
}



/* =====================================================================
   LOCATION MANAGER PANEL
   ===================================================================== */
function refreshLocationList() {
    const box = document.getElementById("locList");

    box.innerHTML = `
        <div style="margin-bottom:10px;">
            <input id="locSearch" type="text" placeholder="Search Locations..." 
                   style="width:100%;padding:5px;" oninput="refreshLocationList()" />
        </div>

        <div style="margin-bottom:10px;">
            <select id="locFilter" style="width:100%;padding:5px;" onchange="refreshLocationList()">
                <option value="all">All Locations</option>
                <option value="prebuilt">Prebuilt Only</option>
                <option value="created">Created This Game</option>
                <option value="previous">Created Previously</option>
            </select>
        </div>

        <button onclick="newLocation()" style="width:100%;padding:8px;margin-bottom:10px;">➕ New Location</button>
        <button onclick="randomLocation()" style="width:100%;padding:8px;margin-bottom:20px;">🎲 Random Location</button>
    `;

    const search = (document.getElementById("locSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("locFilter")?.value || "all";

    Object.keys(state.locations).forEach(id => {
        const loc = state.locations[id];
        if (!loc) return;

        if (!loc.name.toLowerCase().includes(search)) return;

        if (filter === "prebuilt" && !loc.prebuilt) return;
        if (filter === "created" && !loc.createdThisSession) return;
        if (filter === "previous" && (loc.prebuilt || loc.createdThisSession)) return;

        const row = document.createElement("div");
        row.className = "managerRow";
        row.innerHTML = `
            <div class="managerName">${loc.name}</div>
            <div>
                <button onclick="openLocationEditor('${id}')">Edit</button>
                <button onclick="addLocationToScenarioFromList('${id}')">Add</button>
                <button onclick="deleteLocation('${id}')">Delete</button>
            </div>
        `;

        box.appendChild(row);
    });
}


function addLocationToScenarioFromList(id) {
    currentLocation = id;
    addLocationToScenario();
}


/* =====================================================================
   LOCATION EDITOR POPUP
   ===================================================================== */
function openLocationEditor(id) {
    if (!state.locations[id]) return;
    currentLocation = id;

    const loc = state.locations[id];
    const portrait = locationPortraitPath(loc.portrait);

    const box = document.querySelector("#locationCard .popupCard");

    box.innerHTML = `
        <h2>Edit Location</h2>

        <div style="display:flex; gap:10px;">

            <div style="width:150px;">
                <div id="locPortraitBox"
                     style="
                        width:150px;height:150px;background:#ccc;border-radius:6px;
                        background-image:url('${portrait}');
                        background-size:cover;background-position:center;">
                </div>

                <button onclick="randomizeLocationPortrait()" style="margin-top:8px;width:100%;">🎲 Random Portrait</button>
                <button onclick="uploadLocationPortrait()" style="margin-top:5px;width:100%;">⬆ Upload Portrait</button>
                <button onclick="addLocationToScenario()" style="margin-top:5px;width:100%;">➕ Add to Scenario</button>
            </div>

            <div style="flex:1;">
                <label>Name:</label>
                <input id="locName" class="popupInput" type="text" value="${loc.name || ""}"/>

                <label>Sensory Hook:</label>
                <textarea id="locSensory" class="popupTextarea">${loc.sensory || ""}</textarea>

                <label>Danger Level:</label>
                <select id="locDanger" class="popupInput">
                    <option ${loc.danger==="Low"?"selected":""}>Low</option>
                    <option ${loc.danger==="Medium"?"selected":""}>Medium</option>
                    <option ${loc.danger==="High"?"selected":""}>High</option>
                </select>

                <label>
                    <input type="checkbox" id="locCluePresent" ${loc.cluePresent?"checked":""}/> Clue Present
                </label>

                <label>Description:</label>
                <textarea id="locDescription" class="popupTextarea">${loc.description || ""}</textarea>

                <label>Tags:</label>
                <input id="locTags" class="popupInput" value="${(loc.tags || []).join(", ")}"/>

                <div class="popupButtons">
                    <button onclick="saveLocation()">Save</button>
                    <button onclick="closeLocationCard()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("locationCard").style.display = "flex";
}

function closeLocationCard() {
    document.getElementById("locationCard").style.display = "none";
}


/* =====================================================================
   SAVE LOCATION
   ===================================================================== */
function saveLocation() {
    const loc = state.locations[currentLocation];

    loc.name = document.getElementById("locName").value;
    loc.sensory = document.getElementById("locSensory").value;
    loc.danger = document.getElementById("locDanger").value;
    loc.cluePresent = document.getElementById("locCluePresent").checked;
    loc.description = document.getElementById("locDescription").value;

    const tags = document.getElementById("locTags").value.trim();
    loc.tags = tags ? tags.split(",").map(s => s.trim()) : [];

    saveAllToStorage();
    refreshLocationList();
    loadLocationDropdowns();
    refreshHUD();
    pushUndoScenario();
    closeLocationCard();
}


/* =====================================================================
   ADD LOCATION TO SCENARIO
   ===================================================================== */
function addLocationToScenario() {
    const sc = getCurrentScenario();

    for (let i = 0; i < 5; i++) {
        if (!sc.locations[i]) {
            sc.locations[i] = currentLocation;
            break;
        }
    }

    saveAllToStorage();
    loadLocationDropdowns();
    refreshHUD();
    pushUndoScenario();
}


/* =====================================================================
   LOCATION PORTRAIT RANDOM + UPLOAD
   ===================================================================== */
function randomizeLocationPortrait() {
    const list = [];
    for (let i = 1; i <= 10; i++) {
        list.push(`locations/${String(i).padStart(3,"0")}.jpg`);
    }

    const url = list[Math.floor(Math.random()*list.length)];
    state.locations[currentLocation].portrait = url;

    document.getElementById("locPortraitBox").style.backgroundImage = `url('${url}')`;

    saveAllToStorage();
    refreshHUD();
    pushUndoScenario();
}

function uploadLocationPortrait() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            state.locations[currentLocation].portrait = e.target.result;

            document.getElementById("locPortraitBox").style.backgroundImage =
                `url('${e.target.result}')`;

            saveAllToStorage();
            refreshHUD();
            pushUndoScenario();
        };
        reader.readAsDataURL(file);
    };

    input.click();
}


/* =====================================================================
   RANDOM LOCATION
   ===================================================================== */
function newLocation() {
    const id = crypto.randomUUID();
    state.locations[id] = {
        name: "New Location",
        sensory: "",
        danger: "Medium",
        cluePresent: false,
        description: "",
        portrait: "locations/001.jpg",
        tags: [],
        prebuilt: false,
        createdThisSession: true
    };

    currentLocation = id;

    saveAllToStorage();
    pushUndoScenario();
    refreshLocationList();
    loadLocationDropdowns();
    openLocationEditor(id);
}


function randomLocation() {
    const names = [
        "The Rusted Pier", "Old Quarry Pit", "The Silent Chapel",
        "Westbridge Tunnels", "Mossgate Greenhouse"
    ];

    const sensoryArr = [
        "Cold breeze; wet stone; faint echoes.",
        "Spilled chemicals; dripping metal; hollow thumps.",
        "Stale incense; cracked pews; distant whispers."
    ];

    const descArr = [
        "An abandoned site with traces of recent activity.",
        "Locals avoid this area after dark.",
        "Rumors suggest something lurks beneath the floors."
    ];

    const portraits = [];
    for (let i = 1; i <= 10; i++) {
        portraits.push(`locations/${String(i).padStart(3,"0")}.jpg`);
    }

    const id = crypto.randomUUID();
    state.locations[id] = {
        name: names[Math.floor(Math.random()*names.length)],
        sensory: sensoryArr[Math.floor(Math.random()*sensoryArr.length)],
        danger: ["Low","Medium","High"][Math.floor(Math.random()*3)],
        cluePresent: Math.random() > 0.5,
        description: descArr[Math.floor(Math.random()*descArr.length)],
        portrait: portraits[Math.floor(Math.random()*portraits.length)],
        tags: [],
        createdThisSession: true,
        prebuilt: false
    };

    currentLocation = id;

    saveAllToStorage();
    pushUndoScenario();
    refreshLocationList();
    loadLocationDropdowns();
    openLocationEditor(id);
}


/* =====================================================================
   DELETE LOCATION
   ===================================================================== */
function deleteLocation(id) {
    if (!confirm("Delete this location?")) return;

    delete state.locations[id];

    saveAllToStorage();
    refreshLocationList();
    loadLocationDropdowns();
    refreshHUD();
    pushUndoScenario();
}


/* =====================================================================
   SLIDE PANEL OPEN/CLOSE
   ===================================================================== */
function openNPCPanel() {
    refreshNPCList();
    document.getElementById("slidePanelNPC").classList.add("open");
}

function closeNPCPanel() {
    document.getElementById("slidePanelNPC").classList.remove("open");
}

function openLocPanel() {
    refreshLocationList();
    document.getElementById("slidePanelLoc").classList.add("open");
}

function closeLocPanel() {
    document.getElementById("slidePanelLoc").classList.remove("open");
}


/* =====================================================================
   THREAT GENERATOR
   ===================================================================== */
document.getElementById("topNav").insertAdjacentHTML("beforeend", `
    <button onclick="generateThreat()">Threat Generator</button>
`);

function generateThreat() {
    const names = ["The Deep One", "Hollow Maw", "Sable Wraith", "Ash-Feeder"];
    const behaviors = ["Stalks silently", "Shrieks before attacking", "Toys with prey"];
    const weaknesses = ["Light", "Salt", "Iron", "Sound vibrations"];
    const hooks = [
        "It has already killed once.",
        "Its arrival heralds a storm.",
        "A villager unknowingly summoned it."
    ];

    alert(
        "=== Threat Generated ===\n\n" +
        "Name: " + names[Math.floor(Math.random()*names.length)] + "\n" +
        "Behavior: " + behaviors[Math.floor(Math.random()*behaviors.length)] + "\n" +
        "Weakness: " + weaknesses[Math.floor(Math.random()*weaknesses.length)] + "\n" +
        "Encounter Hook: " + hooks[Math.floor(Math.random()*hooks.length)]
    );
}


/* =====================================================================
   PLAYER EXPORT
   ===================================================================== */
document.getElementById("topNav").insertAdjacentHTML("beforeend", `
    <button onclick="openPlayerExport()">Player Export</button>
`);

function openPlayerExport() {
    const sc = getCurrentScenario();
    const w = window.open("", "_blank");

    w.document.write(`
        <html>
        <head><title>Scenario Export</title></head>
        <body style="font-family:Arial;padding:20px;line-height:1.4;">
            <h1>${state.currentScenarioName}</h1>

            <h2>Hook</h2>
            <p>${sc.hook || "—"}</p>

            <h2>Key NPCs</h2>
            <ul>
                ${["npcAlly","npcAntag","npcWild"].map(k => {
                    const id = sc[k];
                    if (!id || !state.npcs[id]) return "";
                    const npc = state.npcs[id];
                    return `<li><strong>${npc.name}</strong> — ${npc.personality}</li>`;
                }).join("")}
            </ul>

            <h2>Locations</h2>
            <ul>
                ${sc.locations.map(id => {
                    const loc = state.locations[id];
                    if (!loc) return "";
                    return `<li><strong>${loc.name}</strong> — ${loc.sensory}</li>`;
                }).join("")}
            </ul>

            <h2>Clues</h2>
            <ul>
                ${sc.clues.filter(c => c.trim()).map(c => `<li>${c}</li>`).join("")}
            </ul>

            <h2>Tone</h2>
            <p>${sc.tones.length ? sc.tones.join(", ") : "None"}</p>

            <script>window.print();</script>
        </body>
        </html>
    `);
}


/* =====================================================================
   HUD RESIZE HANDLE
   ===================================================================== */
let resizing = false;
const handle = document.getElementById("hudResizeHandle");

handle.addEventListener("pointerdown", () => resizing = true);
window.addEventListener("pointerup", () => resizing = false);
window.addEventListener("pointermove", e => {
    if (!resizing) return;
    let h = window.innerHeight - e.clientY;

    h = Math.max(120, Math.min(600, h));
    document.getElementById("hud").style.height = h + "px";
});

/* Collapse Toggle */
document.getElementById("hudToggle").onclick = () => {
    document.getElementById("hud").classList.toggle("collapsed");
};


/* =====================================================================
   END OF FILE
   ===================================================================== */
console.log("ScenarioSmith v3.4 Loaded — NPC/Location dropdowns & Tone system restored.");
