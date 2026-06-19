# Einkaufsliste – OTA-Update-Bundle

Dieses Repo ist **kein** App-Quellcode im klassischen Sinn, sondern der **Live-Update-Server** für die
Capacitor-App „Einkaufsliste" (`appId: de.kilian.einkaufsliste`).

Die Dateien hier werden über **GitHub Pages** ausgeliefert und von der App beim Start abgerufen.
Damit können wir das Aussehen und die Logik der App **ohne neues App-Store-Release** aktualisieren –
ein selbstgebauter Ersatz für Dienste wie [Capgo](https://capgo.app).

**Live-Adresse (= `SERVER_URL` in der App):**
```
https://kilianberg.github.io/einkaufsliste
```

---

## Wie funktioniert das? (Kurzfassung)

Eine Capacitor-App lädt ihre Web-Dateien aus einem Ordner. Standardmäßig ist das der **eingebaute**
`www`-Ordner (kommt aus dem App Store). Unser `updater.js` macht Folgendes:

1. Beim App-Start online `version.json` von hier abfragen.
2. Ist die Server-Version **neuer** als die laufende? → das **komplette Bundle** herunterladen.
3. Die Dateien nach `Library/NoCloud/ionic_built_snapshots/<version>/` schreiben
   (per `@capacitor/filesystem`).
4. Dem WebView nativ sagen: „lade ab jetzt von dort" – über das in Capacitor 8 **eingebaute**
   Plugin `WebView`:
   - `WebView.setServerBasePath({ path })` → sofort umschalten + neu laden
   - `WebView.persistServerBasePath()` → für die nächsten App-Starts merken

Bei einem echten **App-Store-Update** (neue Binär-Version) setzt Capacitor den Pfad automatisch
zurück auf den eingebauten `www`-Ordner. Kein eigener Swift-Code nötig.

> **Wichtig:** Es wird das *ganze Verzeichnis* getauscht – inklusive `index.html`. Es gibt also
> keine Einschränkung „HTML kann nicht aktualisiert werden". Nur der **native** Teil (Swift/Plugins,
> App-Icon) braucht weiterhin ein App-Store-Release.

---

## Inhalt dieses Repos

| Datei          | Zweck |
|----------------|-------|
| `version.json` | Manifest: aktuelle Version + Liste aller Bundle-Dateien |
| `index.html`   | Grundgerüst der App |
| `style.css`    | Aussehen |
| `function.js`  | App-Logik (Liste, Kamera, Barcode …) |
| `updater.js`   | Der Updater selbst – **muss mit dabei sein**, sonst kann ein aktualisiertes Bundle keine *weiteren* Updates mehr holen |

`version.json`:
```json
{
  "version": "1.1",
  "files": ["index.html", "style.css", "function.js", "updater.js"]
}
```

---

## Ein Update veröffentlichen

```
bearbeiten  →  Version hochzählen  →  git push  →  Handys updaten sich beim nächsten Start
```

Schritt für Schritt:

1. Die gewünschten Dateien bearbeiten (`index.html`, `style.css`, `function.js`).
2. **Version an ZWEI Stellen hochzählen** – beide auf dieselbe neue Nummer:
   - in `version.json`:  `"version": "1.2"`
   - in `updater.js`:    `const MEINE_VERSION = "1.2";`
3. Committen & pushen:
   ```bash
   git add .
   git commit -m "Version 1.2"
   git push
   ```

Beim nächsten App-Start (mit Internet) zieht jedes Handy automatisch nach. Offline-Geräte holen
das Update, sobald sie wieder online sind.

> ⚠️ **Häufigster Fehler:** Version vergessen hochzuzählen. Dann findet kein Handy das Update.
> Die Nummer in `version.json` muss **größer** sein als die, die auf den Geräten läuft.

### Eine neue Datei hinzufügen

Legst du eine **neue** Web-Datei an (z. B. `extra.js` oder ein Bild `logo.png`):

1. Datei in dieses Repo legen.
2. In die `files`-Liste der `version.json` eintragen – sonst lädt das Handy sie nicht mit.
3. In `index.html` einbinden.

---

## Web vs. Nativ – was geht per OTA, was nicht?

| Änderung | Weg |
|----------|-----|
| HTML / CSS / JS | ✅ nur Push hierher |
| Neue Web-Datei | ✅ Push + `files`-Liste ergänzen |
| Swift-Plugin, App-Icon, neues Capacitor-Plugin, `capacitor.config.json` | ❌ App-Store-Release nötig (`npx cap sync` + Xcode-Build) |

---

## Verhältnis zum App-Projekt

Der eigentliche App-Quellcode (Capacitor + iOS) liegt **woanders** (`~/Documents/Webanwendung`,
nicht in diesem Repo). Dort gibt es einen eingebauten `www/`-Ordner mit derselben Datei-Struktur.

- **Dieses Repo** = die Update-Quelle. Hier wird im Alltag bearbeitet und gepusht.
- **`www/` im App-Projekt** = die Version, die fest in der App-Store-Build steckt. Darf veralten,
  weil die OTA-Updates sie einholen. Sollte aber vor einem neuen Store-Release auf den aktuellen
  Stand gebracht werden, damit Neu-Installierer nicht bei einer alten Version starten.

Wichtig: Die Konstante `SERVER_URL` in `updater.js` muss **sowohl hier als auch im App-`www/`**
auf die GitHub-Pages-Adresse zeigen.

---

## Gut zu wissen / Stolperfallen

- **HTTPS Pflicht.** GitHub Pages liefert automatisch per HTTPS – passt.
- **CDN-Cache:** Ein frisch gepushtes Update kann ein paar Minuten brauchen, bis es überall
  ankommt (GitHub cached die Dateien kurz).
- **Fehler-Toleranz:** Schlägt ein Update fehl (Server nicht erreichbar, kaputtes Bundle), läuft
  die App einfach mit der bisherigen Version weiter und versucht es beim nächsten Start erneut.
- **Debugging:** Der Updater schreibt jeden Schritt in die Konsole (Präfix `Updater:`). In Xcode /
  Safari-Web-Inspector kann man den Ablauf live mitlesen.
