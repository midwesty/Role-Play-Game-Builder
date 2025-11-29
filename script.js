/* =====================================================================
   ScenarioSmith v3.2 – Full Updated JS
   ---------------------------------------------------------------------
   Fixes & Features Added:
   - Local image loader for portraits & locations
   - HUD background moved to assets/hud/hud_bg.jpg
   - Random Location Generator
   - “Add to Scenario” button in NPC & Location managers
   - New Location popup fixed
   - Dropdowns load correctly even without created items
   - Save file deletion
   - Stability improvements (OOM crash prevention)
   - Debounced saving
   - Prebuilt JSON loading safe & non-duplicating
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


/* Load Scenario */
document.getElementById("scenarioLoadSelect").onchange = (e) => {
    state.currentScenarioName = e.target.value;
    pushUndoState();
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
    pushUndoState();
    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* Save Scenario */
document.getElementById("btnSave").onclick = () => {
    saveScenarioFromForm();
    saveAllToStorage();
    alert("Saved!");
};


/* Delete Scenario */
document.getElementById("btnDeleteScenario").onclick = () => {
    if (!confirm("Delete this scenario?")) return;

    delete state.scenarios[state.currentScenarioName];
    state.currentScenarioName = "Untitled Scenario";

    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
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
        document.getElementById(id).oninput = debouncedSaveScenario;
    });

    ["npcAllySelect","npcAntagSelect","npcWildSelect"].forEach(id => {
        document.getElementById(id).onchange = saveScenarioFromForm;
    });

    for (let i = 0; i < 5; i++) {
        document.getElementById(`loc_${i}`).onchange = saveScenarioFromForm;
    }

    document.querySelectorAll(".toneChk").forEach(chk => {
        chk.onchange = saveScenarioFromForm;
    });
}

function debouncedSaveScenario() {
    clearTimeout(inputSaveTimeout);
    inputSaveTimeout = setTimeout(saveScenarioFromForm, 300);
}


/* =====================================================================
   LOAD SCENARIO INTO FORM
   ===================================================================== */
function loadScenarioIntoForm() {
    const sc = getCurrentScenario();

    document.getElementById("hookInput").value = sc.hook;
    document.getElementById("truthInput").value = sc.truth;
    document.getElementById("act1Input").value = sc.act1;
    document.getElementById("act2Input").value = sc.act2;
    document.getElementById("act3Input").value = sc.act3;
    document.getElementById("pacingInput").value = sc.pacing;

    loadNPCDropdowns();
    loadLocationDropdowns();
    loadClueInputs();
    loadToneChecks();

    refreshHUD();
}


/* NPC dropdowns */
function loadNPCDropdowns() {
    const ally = document.getElementById("npcAllySelect");
    const ant = document.getElementById("npcAntagSelect");
    const wild = document.getElementById("npcWildSelect");
    [ally, ant, wild].forEach(sel => sel.innerHTML = "");

    function blank(sel) {
        const o = document.createElement("option");
        o.value = "";
        o.textContent = "— None —";
        sel.appendChild(o);
    }

    blank(ally);
    blank(ant);
    blank(wild);

    Object.keys(state.npcs).forEach(id => {
        const npc = state.npcs[id];
        const o = document.createElement("option");
        o.value = id;
        o.textContent = npc.name || "(unnamed)";
        ally.appendChild(o.cloneNode(true));
        ant.appendChild(o.cloneNode(true));
        wild.appendChild(o.cloneNode(true));
    });

    const sc = getCurrentScenario();
    ally.value = sc.npcAlly || "";
    ant.value = sc.npcAntag || "";
    wild.value = sc.npcWild || "";
}


/* Location dropdowns */
function loadLocationDropdowns() {
    for (let i = 0; i < 5; i++) {
        const sel = document.getElementById(`loc_${i}`);
        sel.innerHTML = "";

        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "— None —";
        sel.appendChild(blank);

        Object.keys(state.locations).forEach(id => {
            const loc = state.locations[id];
            const o = document.createElement("option");
            o.value = id;
            o.textContent = loc.name || "(unnamed)";
            sel.appendChild(o);
        });

        sel.value = getCurrentScenario().locations[i] || "";
    }
}


/* Clues */
function loadClueInputs() {
    const sc = getCurrentScenario();
    for (let i = 0; i < 3; i++) {
        document.getElementById(`clue_${i}`).value = sc.clues[i] || "";
    }
}


/* Tone */
function loadToneChecks() {
    const sc = getCurrentScenario();
    document.querySelectorAll(".toneChk").forEach(chk => {
        chk.checked = sc.tones.includes(chk.value);
    });
}


/* =====================================================================
   SAVE SCENARIO
   ===================================================================== */
function saveScenarioFromForm() {
    const sc = getCurrentScenario();

    sc.hook = document.getElementById("hookInput").value;
    sc.truth = document.getElementById("truthInput").value;
    sc.act1 = document.getElementById("act1Input").value;
    sc.act2 = document.getElementById("act2Input").value;
    sc.act3 = document.getElementById("act3Input").value;
    sc.pacing = document.getElementById("pacingInput").value;

    sc.npcAlly = document.getElementById("npcAllySelect").value;
    sc.npcAntag = document.getElementById("npcAntagSelect").value;
    sc.npcWild = document.getElementById("npcWildSelect").value;

    for (let i = 0; i < 5; i++) {
        sc.locations[i] = document.getElementById(`loc_${i}`).value;
    }

    for (let i = 0; i < 3; i++) {
        sc.clues[i] = document.getElementById(`clue_${i}`).value;
    }

    sc.tones = Array.from(document.querySelectorAll(".toneChk"))
        .filter(c => c.checked)
        .map(c => c.value);

    pushUndoState();
    refreshHUD();
    saveAllToStorage();
}


/* =====================================================================
   UNDO / REDO
   ===================================================================== */
function pushUndoState() {
    state.undo.push(JSON.stringify(state));
    if (state.undo.length > 5) state.undo.shift();
    state.redo = [];
}

document.getElementById("btnUndo").onclick = () => {
    if (state.undo.length === 0) return;
    state.redo.push(JSON.stringify(state));
    const prev = state.undo.pop();
    state = JSON.parse(prev);
    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};

document.getElementById("btnRedo").onclick = () => {
    if (state.redo.length === 0) return;
    state.undo.push(JSON.stringify(state));
    const next = state.redo.pop();
    state = JSON.parse(next);
    populateScenarioDropdown();
    loadScenarioIntoForm();
    refreshHUD();
    saveAllToStorage();
};


/* =====================================================================
   HUD (NPC & Location Mini Cards)
   ===================================================================== */
function refreshHUD() {
    const sc = getCurrentScenario();

    document.getElementById("hudHook").textContent =
        sc.hook || "—";
    document.getElementById("hudTruth").textContent =
        sc.truth || "—";

    const npcArea = document.getElementById("hudNPCs");
    npcArea.innerHTML = "";
    ["npcAlly","npcAntag","npcWild"].forEach(key =>
        hudNPCminiCard(sc[key])
    );

    const locArea = document.getElementById("hudLocations");
    locArea.innerHTML = "";
    sc.locations.forEach(id => hudLocationMiniCard(id));

    const clueArea = document.getElementById("hudClues");
    clueArea.innerHTML = "";
    sc.clues.forEach(c => {
        if (c.trim()) {
            const div = document.createElement("div");
            div.className = "hudClueItem";
            div.textContent = c;
            clueArea.appendChild(div);
        }
    });

    document.getElementById("hudTone").textContent =
        sc.tones.length ? sc.tones.join(", ") : "None";
}


/* NPC HUD Card */
function hudNPCminiCard(id) {
    const area = document.getElementById("hudNPCs");
    const div = document.createElement("div");
    div.className = "miniCard";

    if (!id || !state.npcs[id]) {
        div.innerHTML = `
            <div class="miniCardPortrait"></div>
            <div class="miniCardName">Empty NPC</div>`;
        area.appendChild(div);
        return;
    }

    const npc = state.npcs[id];
    const portrait = npcPortraitPath(npc.portrait);

    div.innerHTML = `
        <div class="miniCardPortrait"
             style="background-image:url('${portrait}')"></div>
        <div class="miniCardName">${npc.name}</div>
    `;

    div.onclick = () => openNpcEditor(id);
    area.appendChild(div);
}


/* Location HUD Card */
function hudLocationMiniCard(id) {
    const area = document.getElementById("hudLocations");
    const div = document.createElement("div");
    div.className = "miniCard";

    if (!id || !state.locations[id]) {
        div.innerHTML = `
            <div class="miniCardPortrait"></div>
            <div class="miniCardName">Empty Location</div>`;
        area.appendChild(div);
        return;
    }

    const loc = state.locations[id];
    const portrait = locationPortraitPath(loc.portrait);

    div.innerHTML = `
        <div class="miniCardPortrait"
             style="background-image:url('${portrait}')"></div>
        <div class="miniCardName">${loc.name}</div>
    `;

    div.onclick = () => openLocationEditor(id);
    area.appendChild(div);
}


/* =====================================================================
   NPC EDITOR
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
            <div style="width:150px; flex-shrink:0;">
                <div id="npcPortraitBox"
                     style="width:150px;height:150px;background:#ccc;border-radius:6px;
                     background-image:url('${portrait}');
                     background-size:cover;background-position:center;"></div>

                <button onclick="randomizeNPCPortrait()" style="margin-top:8px;width:100%;">
                    🎲 Random Portrait
                </button>

                <button onclick="uploadNPCPortrait()" style="margin-top:5px;width:100%;">
                    ⬆ Upload Portrait
                </button>

                <button onclick="addNPCToScenario()" style="margin-top:5px;width:100%;">
                    ➕ Add to Scenario
                </button>
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
                <input id="npcTags" class="popupInput" 
                       value="${(npc.tags || []).join(", ")}"/>

                <div class="popupButtons">
                    <button onclick="saveNpc()">Save</button>
                    <button onclick="closeNpcCard()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("npcCard").style.display = "flex";
}


/* Add NPC to scenario */
function addNPCToScenario() {
    const sc = getCurrentScenario();
    if (!sc.npcAlly) sc.npcAlly = currentNPC;
    else if (!sc.npcAntag) sc.npcAntag = currentNPC;
    else sc.npcWild = currentNPC;

    refreshHUD();
    saveAllToStorage();
}


/* Random portrait */
function randomizeNPCPortrait() {
    const list = [];
    for (let i = 1; i <= 15; i++) {
        const num = String(i).padStart(3,"0");
        list.push(`portraits/${num}.jpg`);
    }

    const url = list[Math.floor(Math.random()*list.length)];
    state.npcs[currentNPC].portrait = url;
    document.getElementById("npcPortraitBox").style.backgroundImage = `url('${url}')`;
    saveAllToStorage();
    refreshHUD();
}


/* Upload custom portrait */
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
        };
        reader.readAsDataURL(file);
    };
    input.click();
}


function closeNpcCard() {
    document.getElementById("npcCard").style.display = "none";
}


function saveNpc() {
    const npc = state.npcs[currentNPC];
    npc.name = document.getElementById("npcName").value;
    npc.secret = document.getElementById("npcSecret").value;
    npc.motivation = document.getElementById("npcMotivation").value;
    npc.personality = document.getElementById("npcPersonality").value;
    npc.bio = document.getElementById("npcBio").value;

    const tags = document.getElementById("npcTags").value.trim();
    npc.tags = tags ? tags.split(",").map(t => t.trim()) : [];

    saveAllToStorage();
    loadNPCDropdowns();
    refreshHUD();
    closeNpcCard();
}


/* New NPC */
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
    openNpcEditor(id);
}


/* Random NPC generator */
function randomNPC() {
    const names = ["Draven Holt", "Mira Voss", "Kepler Finch", "Salem Ward", "Ada Byrne"];
    const secrets = ["Owes a cult money", "Is not human", "Knows forbidden lore"];
    const motives = ["Seeking power", "Protecting someone", "Running from guilt"];
    const traits = ["Quiet", "Clever", "Anxious", "Flirty", "Stoic"];

    const portraits = [];
    for (let i = 1; i <= 15; i++) {
        portraits.push(`portraits/${String(i).padStart(3,"0")}.jpg`);
    }

    const id = crypto.randomUUID();
    state.npcs[id] = {
        name: names[Math.floor(Math.random()*names.length)],
        secret: secrets[Math.floor(Math.random()*secrets.length)],
        motivation: motives[Math.floor(Math.random()*motives.length)],
        personality: traits[Math.floor(Math.random()*traits.length)],
        bio: "A mysterious figure of unknown origins.",
        portrait: portraits[Math.floor(Math.random()*portraits.length)],
        tags: [],
        prebuilt: false,
        createdThisSession: true
    };

    currentNPC = id;
    saveAllToStorage();
    openNpcEditor(id);
}


/* Delete NPC */
function deleteNPC(id) {
    if (!confirm("Delete this NPC?")) return;
    delete state.npcs[id];
    saveAllToStorage();
    refreshNPCList();
    loadNPCDropdowns();
    refreshHUD();
}


/* =====================================================================
   LOCATION EDITOR
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
                     style="width:150px;height:150px;background:#ccc;border-radius:6px;
                     background-image:url('${portrait}');
                     background-size:cover;background-position:center;"></div>

                <button onclick="randomizeLocationPortrait()" style="margin-top:8px;width:100%;">
                    🎲 Random Portrait
                </button>

                <button onclick="uploadLocationPortrait()" style="margin-top:5px;width:100%;">
                    ⬆ Upload Portrait
                </button>

                <button onclick="addLocationToScenario()" style="margin-top:5px;width:100%;">
                    ➕ Add to Scenario
                </button>
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
                    <input type="checkbox" id="locCluePresent" 
                        ${loc.cluePresent?"checked":""}/> Clue Present
                </label>

                <label>Description:</label>
                <textarea id="locDescription" class="popupTextarea">${loc.description || ""}</textarea>

                <label>Tags:</label>
                <input id="locTags" class="popupInput" 
                       value="${(loc.tags || []).join(", ")}"/>

                <div class="popupButtons">
                    <button onclick="saveLocation()">Save</button>
                    <button onclick="closeLocationCard()">Close</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("locationCard").style.display = "flex";
}


/* Add location to scenario */
function addLocationToScenario() {
    const sc = getCurrentScenario();
    for (let i = 0; i < 5; i++) {
        if (!sc.locations[i]) {
            sc.locations[i] = currentLocation;
            break;
        }
    }
    refreshHUD();
    saveAllToStorage();
}


/* Random Location Portrait */
function randomizeLocationPortrait() {
    const list = [];
    for (let i = 1; i <= 10; i++) {
        const num = String(i).padStart(3,"0");
        list.push(`locations/${num}.jpg`);
    }

    const url = list[Math.floor(Math.random()*list.length)];
    state.locations[currentLocation].portrait = url;
    document.getElementById("locPortraitBox").style.backgroundImage = `url('${url}')`;
    saveAllToStorage();
    refreshHUD();
}


/* Upload Location Portrait */
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
        };
        reader.readAsDataURL(file);
    };

    input.click();
}


function closeLocationCard() {
    document.getElementById("locationCard").style.display = "none";
}


function saveLocation() {
    const loc = state.locations[currentLocation];
    loc.name = document.getElementById("locName").value;
    loc.sensory = document.getElementById("locSensory").value;
    loc.danger = document.getElementById("locDanger").value;
    loc.cluePresent = document.getElementById("locCluePresent").checked;
    loc.description = document.getElementById("locDescription").value;

    const tagString = document.getElementById("locTags").value.trim();
    loc.tags = tagString ? tagString.split(",").map(s => s.trim()) : [];

    saveAllToStorage();
    loadLocationDropdowns();
    refreshHUD();
    closeLocationCard();
}


/* New Location */
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
    openLocationEditor(id);
}


/* Random Location */
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
        prebuilt: false,
        createdThisSession: true
    };

    currentLocation = id;
    saveAllToStorage();
    openLocationEditor(id);
}


/* Delete Location */
function deleteLocation(id) {
    if (!confirm("Delete this location?")) return;
    delete state.locations[id];
    saveAllToStorage();
    refreshLocationList();
    loadLocationDropdowns();
    refreshHUD();
}


/* =====================================================================
   MANAGER PANELS
   ===================================================================== */
function initSlidePanels() {
    refreshNPCList();
    refreshLocationList();
}

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


/* NPC LIST */
function refreshNPCList() {
    const box = document.getElementById("npcList");
    box.innerHTML = `
        <div style="margin-bottom:10px;">
            <input id="npcSearch" type="text" placeholder="Search NPCs..." 
                   style="width:100%;padding:5px;" oninput="refreshNPCList()" />
        </div>

        <div style="margin-bottom:10px;">
            <select id="npcFilter" style="width:100%;padding:5px;"
                    onchange="refreshNPCList()">
                <option value="all">All NPCs</option>
                <option value="prebuilt">Prebuilt Only</option>
                <option value="created">Created This Game</option>
                <option value="previous">Created Previously</option>
            </select>
        </div>

        <button onclick="newNPC()" style="width:100%;padding:8px;margin-bottom:10px;">
            ➕ New NPC
        </button>

        <button onclick="randomNPC()" style="width:100%;padding:8px;margin-bottom:20px;">
            🎲 Random NPC
        </button>
    `;

    const search = (document.getElementById("npcSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("npcFilter")?.value || "all";

    Object.keys(state.npcs).forEach(id => {
        const npc = state.npcs[id];
        if (!npc) return;

        if (!npc.name.toLowerCase().includes(search)) return;

        if (filter === "prebuilt" && !npc.prebuilt) return;
        if (filter === "created" && !npc.createdThisSession) return;
        if (filter === "previous" && (npc.createdThisSession || npc.prebuilt)) return;

        const row = document.createElement("div");
        row.className = "managerRow";
        row.innerHTML = `
            <div class="managerName">${npc.name}</div>
            <div>
                <button onclick="openNpcEditor('${id}')">Edit</button>
                <button onclick="addNPCToScenarioFromList('${id}')">Add</button>
                <button onclick="deleteNPC('${id}')">Delete</button>
            </div>
        `;
        box.appendChild(row);
    });
}

function addNPCToScenarioFromList(id) {
    currentNPC = id;
    addNPCToScenario();
}


/* LOCATION LIST */
function refreshLocationList() {
    const box = document.getElementById("locList");
    box.innerHTML = `
        <div style="margin-bottom:10px;">
            <input id="locSearch" type="text" placeholder="Search Locations..." 
                   style="width:100%;padding:5px;" oninput="refreshLocationList()" />
        </div>

        <div style="margin-bottom:10px;">
            <select id="locFilter" style="width:100%;padding:5px;"
                    onchange="refreshLocationList()">
                <option value="all">All Locations</option>
                <option value="prebuilt">Prebuilt Only</option>
                <option value="created">Created This Game</option>
                <option value="previous">Created Previously</option>
            </select>
        </div>

        <button onclick="newLocation()" style="width:100%;padding:8px;margin-bottom:10px;">
            ➕ New Location
        </button>

        <button onclick="randomLocation()" style="width:100%;padding:8px;margin-bottom:20px;">
            🎲 Random Location
        </button>
    `;

    const search = (document.getElementById("locSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("locFilter")?.value || "all";

    Object.keys(state.locations).forEach(id => {
        const loc = state.locations[id];
        if (!loc) return;

        if (!loc.name.toLowerCase().includes(search)) return;

        if (filter === "prebuilt" && !loc.prebuilt) return;
        if (filter === "created" && !loc.createdThisSession) return;
        if (filter === "previous" && (loc.createdThisSession || loc.prebuilt)) return;

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
   PLAYER EXPORT (PRINT)
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
   HUD RESIZE + COLLAPSE
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

document.getElementById("hudToggle").onclick = () => {
    document.getElementById("hud").classList.toggle("collapsed");
};


/* =====================================================================
   END
   ===================================================================== */
console.log("ScenarioSmith v3.2 Loaded");
