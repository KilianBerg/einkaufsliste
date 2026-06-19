// function.js – Einkaufsliste

// --- Elemente holen ---
const feld           = document.getElementById("eingabefeld");
const knopf          = document.getElementById("hinzufuegen");
const liste          = document.getElementById("liste");
const fertig         = document.getElementById("Fertig");
const kamera         = document.getElementById("kamera");
const barcode_button = document.getElementById("barcode");

// --- Barcode-Plugin anmelden (nur in der App vorhanden) ---
let barcode_function = null;
if (window.Capacitor) {
  if (typeof Capacitor.registerPlugin === "function") {
    barcode_function = Capacitor.registerPlugin("Barcode");
  } else if (Capacitor.Plugins) {
    barcode_function = Capacitor.Plugins.Barcode;
  }
}

// --- Nativer Speicher (lokal, app-weit) ---
const Preferences = window.Capacitor?.Plugins?.Preferences;

// --- Online/Offline-Look über @capacitor/network ---
const Network = window.Capacitor?.Plugins?.Network;

function ansichtAktualisieren(online) {
  document.body.classList.toggle("offline", !online);
}

if (Network) {
  // aktuellen Status holen …
  Network.getStatus().then((s) => ansichtAktualisieren(s.connected));
  // … und live auf Änderungen reagieren:
  Network.addListener("networkStatusChange", (s) => ansichtAktualisieren(s.connected));
} else {
  ansichtAktualisieren(true); // Fallback (z. B. Browser): als online behandeln
}

// --- Hilfsfunktion: Produktname online nachschlagen ---
async function produktnameHolen(barcode) {
  try {
    const antwort = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    );
    const daten = await antwort.json();
    if (daten.product && daten.product.product_name) {
      return daten.product.product_name;
    }
  } catch (e) {
    console.log("Nachschlagen fehlgeschlagen:", e);
  }
  return barcode; // Fallback: nichts gefunden -> Nummer behalten
}

// --- Hilfsfunktion: einen Listeneintrag bauen und anzeigen ---
function eintragHinzufuegen(inhalt, istBild, erledigt = false) {
  const li = document.createElement("li");

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = erledigt;

  let anzeige;
  if (istBild) {
    anzeige = document.createElement("img");
    anzeige.src = inhalt;
  } else {
    anzeige = document.createElement("span");
    anzeige.textContent = inhalt;
  }

  function stilAktualisieren() {
    if (istBild) {
      anzeige.style.opacity = box.checked ? "0.4" : "1";
    } else {
      anzeige.style.color = box.checked ? "gray" : "";
      anzeige.style.textDecoration = box.checked ? "line-through" : "";
    }
  }

  box.addEventListener("change", () => {
    stilAktualisieren();
    speichern();
  });
  stilAktualisieren(); // wichtig für bereits erledigte Einträge beim Laden

  li.appendChild(box);
  li.appendChild(anzeige);
  liste.appendChild(li);
}

// --- Speichern & Laden (nativer, geteilter Speicher) ---
async function speichern() {
  const daten = [];
  liste.querySelectorAll("li").forEach((li) => {
    const box  = li.querySelector("input");
    const bild = li.querySelector("img");
    const span = li.querySelector("span");
    daten.push({
      erledigt: box.checked,
      istBild: !!bild,
      inhalt: bild ? bild.src : span.textContent
    });
  });
  const text = JSON.stringify(daten);
  if (Preferences) {
    await Preferences.set({ key: "einkaufsliste", value: text });
  } else {
    localStorage.setItem("einkaufsliste", text);   // Fallback (Browser)
  }
}

async function laden() {
  let text;
  if (Preferences) {
    const ergebnis = await Preferences.get({ key: "einkaufsliste" });
    text = ergebnis.value;
  } else {
    text = localStorage.getItem("einkaufsliste");
  }
  if (!text) return;
  JSON.parse(text).forEach((e) => {
    eintragHinzufuegen(e.inhalt, e.istBild, e.erledigt);
  });
}

// --- Knopf: Artikel tippen ---
knopf.addEventListener("click", () => {
  const zutat = feld.value.trim();
  if (zutat !== "") {
    eintragHinzufuegen(zutat, false);
    feld.value = "";
    speichern();
  }
});

// --- Knopf: erledigte Artikel entfernen ---
fertig.addEventListener("click", () => {
  liste.querySelectorAll("li").forEach((li) => {
    const box = li.querySelector("input");
    if (box.checked) {
      li.remove();
    }
  });
  speichern();
});

// --- Knopf: Foto aufnehmen ---
kamera.addEventListener("click", async () => {
  try {
    const foto = await Capacitor.Plugins.Camera.getPhoto({
      quality: 80,
      resultType: "dataUrl",
      source: "PROMPT"
    });
    eintragHinzufuegen(foto.dataUrl, true);
    speichern();
  } catch (e) {
    console.log("Foto abgebrochen:", e);
  }
});

// --- Knopf: Barcode scannen ---
barcode_button.addEventListener("click", async () => {
  try {
    if (!barcode_function) {
      console.log("Barcode-Plugin nur in der App verfügbar.");
      return;
    }
    const ergebnis = await barcode_function.scan();
    const name = await produktnameHolen(ergebnis.value); // online nachschlagen
    eintragHinzufuegen(name, false);
    speichern();
  } catch (e) {
    console.log("Scan abgebrochen:", e);
  }
});

// --- Beim Start: gespeicherte Liste laden ---
laden();
