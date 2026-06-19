// updater.js – Eigenbau-OTA-Updater (wie Capgo, aber selbstgebaut)
//
// So funktioniert es – genau wie Capgo:
//  - Capacitor lädt die App aus einem Ordner. Standard: der eingebaute "www"-Ordner.
//  - Wir laden ein KOMPLETTES neues Bundle (inkl. index.html!) vom Webserver in einen
//    Ordner auf dem Gerät und sagen dem WebView per nativem Befehl: "lade ab jetzt von dort".
//  - Capacitor 8 bringt dafür das eingebaute Plugin "WebView" mit:
//      WebView.setServerBasePath({path})  -> sofort umschalten + neu laden
//      WebView.persistServerBasePath()    -> für die nächsten App-Starts merken
//  - Bei einem echten App-Store-Update setzt Capacitor das automatisch zurück.
//
// WICHTIG: Der ganze Code steckt in einer IIFE — einer "(function(){ … })()". Dadurch sind
// seine Variablen PRIVAT und kollidieren nicht mit denen aus function.js (z. B. "Network",
// das beide nutzen). Ohne diese Kapselung bricht das zweite Skript mit
// "Identifier 'Network' has already been declared" ab und läuft gar nicht.

(function () {
  "use strict";

  // ==========================================================
  //  EINSTELLUNGEN
  // ==========================================================
  const SERVER_URL = "https://kilianberg.github.io/einkaufsliste"; // Bundle + version.json
  const MEINE_VERSION = "1.0";   // Version DIESES Bundles (im Server-Bundle hochzählen!)
  // ==========================================================

  const Network    = window.Capacitor?.Plugins?.Network;
  const Filesystem = window.Capacitor?.Plugins?.Filesystem; // @capacitor/filesystem
  const WebView    = window.Capacitor?.Plugins?.WebView;    // eingebaut in Capacitor 8

  // Versionsvergleich: ist "a" neuer als "b"? z.B. "1.1" > "1.0", "1.10" > "1.2"
  function istNeuer(a, b) {
    const teileA = a.split(".").map(Number);
    const teileB = b.split(".").map(Number);
    for (let i = 0; i < Math.max(teileA.length, teileB.length); i++) {
      if ((teileA[i] || 0) > (teileB[i] || 0)) return true;
      if ((teileA[i] || 0) < (teileB[i] || 0)) return false;
    }
    return false; // gleich
  }

  async function nachUpdatesSuchen() {
    // Nur in der echten App möglich (im Browser fehlen Filesystem/WebView)
    if (!Filesystem || !WebView) {
      console.log("Updater: kein Filesystem/WebView (Browser?) – übersprungen");
      return;
    }

    // "Online?" – Nein -> aufhören, die lokale Version läuft weiter.
    const online = Network ? (await Network.getStatus()).connected : navigator.onLine;
    if (!online) {
      console.log("Updater: offline – keine Update-Prüfung");
      return;
    }

    try {
      // 1) Beim Webserver fragen, welche Version es gibt
      const info = await (await fetch(`${SERVER_URL}/version.json`, { cache: "no-store" })).json();

      if (!istNeuer(info.version, MEINE_VERSION)) {
        console.log("Updater: bereits aktuell (", MEINE_VERSION, ")");
        return;
      }
      console.log("Updater: neue Version", info.version, "wird geladen…");

      // 2) Zielordner – MUSS hier liegen, sonst findet Capacitor ihn beim Start nicht:
      //    Library/NoCloud/ionic_built_snapshots/<version>/
      const ordner = `NoCloud/ionic_built_snapshots/${info.version}`;

      // 3) Alle Dateien des neuen Bundles herunterladen und schreiben
      for (const datei of info.files) {
        const inhalt = await (await fetch(`${SERVER_URL}/${datei}`, { cache: "no-store" })).text();
        await Filesystem.writeFile({
          directory: "LIBRARY",
          path: `${ordner}/${datei}`,
          data: inhalt,
          encoding: "utf8",
          recursive: true        // fehlende Unterordner automatisch anlegen
        });
        console.log("Updater: gespeichert", datei);
      }

      // 4) Absoluten Pfad des Ordners holen (file://… -> reiner Pfad)
      const { uri } = await Filesystem.getUri({ directory: "LIBRARY", path: ordner });
      const pfad = uri.replace("file://", "");

      // 5) WebView nativ auf das neue Bundle umschalten + für nächste Starts merken
      await WebView.setServerBasePath({ path: pfad });
      await WebView.persistServerBasePath();

      console.log("Updater: Version", info.version, "aktiv. Fertig.");
    } catch (e) {
      console.log("Updater: Update fehlgeschlagen:", e);
    }
  }

  nachUpdatesSuchen();
})();
