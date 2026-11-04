// Philipps Kochbuch — Übersicht, Suche, Filter und Detailansicht.
// Daten kommen aus daten/rezepte.json (generiert von build.js).

"use strict";

const KATEGORIE_SYMBOLE = {
  "Hauptgericht": "🍽️",
  "Klassiker": "⭐",
  "Vorspeise": "🥗",
  "Salat": "🥗",
  "Suppe": "🍲",
  "Knödel": "🥟",
  "Fisch": "🐟",
  "Pizza & Co.": "🍕",
  "Pasta": "🍝",
  "Strudel & Wraps": "🌯",
  "Kartoffel": "🥔",
  "Burger": "🍔",
  "Beilage": "🍚",
  "Gewürzmischung": "🧂",
  "Sauce": "🥫",
  "Teig": "🫓",
  "Gebäck": "🥐",
  "Dessert": "🍮",
  "Kekse": "🍪",
  "Frühstück": "🍳",
  "Kuchen": "🎂",
  "Brot": "🍞",
  "Snack": "🥪",
  "Getränk": "🥤"
};
const SYMBOL_FALLBACK = "🍽️";

let alleRezepte = [];
let suchtext = "";
let aktiveKategorie = null;
const aktiveTags = new Set();

const el = (id) => document.getElementById(id);

// ---------- Hilfsfunktionen ----------

function symbolFuer(kategorie) {
  return KATEGORIE_SYMBOLE[kategorie] || SYMBOL_FALLBACK;
}

function gesamtzeit(rezept) {
  const z = rezept.zeit || {};
  const summe = (z.vorbereitung || 0) + (z.zubereitung || 0);
  return summe > 0 ? `${summe} Min.` : null;
}

function mengeAlsText(zutat) {
  if (zutat.menge === null || zutat.menge === undefined) return "";
  const menge = Number.isInteger(zutat.menge)
    ? String(zutat.menge)
    : String(zutat.menge).replace(".", ",");
  return zutat.einheit ? `${menge} ${zutat.einheit}` : menge;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// ---------- Filtern ----------

function passtZurSuche(rezept) {
  if (!suchtext) return true;
  const heuhaufen = [
    rezept.titel,
    rezept.kategorie,
    ...(rezept.tags || []),
    ...(rezept.zutaten || []).map((z) => z.name)
  ].join(" ").toLowerCase();
  return suchtext.toLowerCase().split(/\s+/).every((wort) => heuhaufen.includes(wort));
}

function gefilterteRezepte() {
  return alleRezepte.filter((r) => {
    if (aktiveKategorie && r.kategorie !== aktiveKategorie) return false;
    for (const tag of aktiveTags) {
      if (!(r.tags || []).includes(tag)) return false;
    }
    return passtZurSuche(r);
  });
}

// ---------- Übersicht ----------

function zeichneFilterChips() {
  const kategorien = [...new Set(alleRezepte.map((r) => r.kategorie))].sort((a, b) => a.localeCompare(b, "de"));
  el("filter-kategorien").innerHTML = kategorien.map((k) =>
    `<button class="chip ${k === aktiveKategorie ? "aktiv" : ""}" data-kategorie="${escapeHtml(k)}">${symbolFuer(k)} ${escapeHtml(k)}</button>`
  ).join("");

  const tagZaehler = new Map();
  for (const r of alleRezepte) {
    for (const t of r.tags || []) tagZaehler.set(t, (tagZaehler.get(t) || 0) + 1);
  }
  const tags = [...tagZaehler.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .slice(0, 15)
    .map(([t]) => t);
  el("filter-tags").innerHTML = tags.map((t) =>
    `<button class="chip ${aktiveTags.has(t) ? "aktiv" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join("");
}

function zeichneListe() {
  const rezepte = gefilterteRezepte();
  const liste = el("rezept-liste");

  if (rezepte.length === 0) {
    liste.innerHTML = `<p class="leer-hinweis">Kein Rezept gefunden. Suche oder Filter anpassen.</p>`;
  } else {
    liste.innerHTML = rezepte.map((r) => {
      const zeit = gesamtzeit(r);
      const banner = r.bild
        ? `<img class="karte-bild" src="${escapeHtml(r.bild)}" alt="" loading="lazy">`
        : `<div class="karte-banner">${symbolFuer(r.kategorie)}</div>`;
      return `
        <a class="karte" href="#/rezept/${encodeURIComponent(r.id)}">
          ${banner}
          <div class="karte-inhalt">
            <h2 class="karte-titel">${escapeHtml(r.titel)}</h2>
            <div class="karte-meta">
              <span>${escapeHtml(r.kategorie)}</span>
              ${zeit ? `<span>⏱ ${zeit}</span>` : ""}
            </div>
            ${(r.tags || []).length ? `<div class="karte-tags">${r.tags.map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          </div>
        </a>`;
    }).join("");
  }

  const filterAktiv = suchtext || aktiveKategorie || aktiveTags.size > 0;
  el("treffer-info").textContent = filterAktiv
    ? `${rezepte.length} von ${alleRezepte.length} Rezepten`
    : "";
}

// ---------- Detailansicht ----------

function zeichneDetail(id) {
  const r = alleRezepte.find((x) => x.id === id);
  const ansicht = el("ansicht-detail");

  if (!r) {
    ansicht.innerHTML = `
      <a class="zurueck" href="#/">← Zurück zur Übersicht</a>
      <p class="status-text">Rezept nicht gefunden.</p>`;
    return;
  }

  // Zutaten als Tabelle: Mengen-Spalte richtet sich an der längsten Angabe aus,
  // alle Zutaten beginnen an derselben Kante (Tabstopp-Optik).
  let zutatenHtml = `<table class="zutaten"><tbody>`;
  let aktuelleGruppe = null;
  for (const z of r.zutaten) {
    const gruppe = z.gruppe || null;
    if (gruppe !== aktuelleGruppe) {
      if (gruppe) zutatenHtml += `<tr class="gruppen-zeile"><td colspan="2">${escapeHtml(gruppe)}</td></tr>`;
      aktuelleGruppe = gruppe;
    }
    zutatenHtml += `<tr><td class="zutat-menge">${escapeHtml(mengeAlsText(z))}</td><td>${escapeHtml(z.name)}</td></tr>`;
  }
  zutatenHtml += `</tbody></table>`;

  const zeit = r.zeit || {};
  const metaTeile = [];
  if (r.portionen) metaTeile.push(`👥 ${r.portionen} Portionen`);
  if (zeit.vorbereitung) metaTeile.push(`🔪 ${zeit.vorbereitung} Min. Vorbereitung`);
  if (zeit.zubereitung) metaTeile.push(`🍳 ${zeit.zubereitung} Min. Zubereitung`);

  const quelle = r.quelle || {};
  let quelleHtml = "";
  if (quelle.url) {
    quelleHtml = `<a class="quelle-knopf" href="${escapeHtml(quelle.url)}" target="_blank" rel="noopener">↗ Zum Originalrezept${quelle.name ? ` (${escapeHtml(quelle.name)})` : ""}</a>`;
  }

  ansicht.innerHTML = `
    <a class="zurueck" href="#/">← Zurück zur Übersicht</a>
    <article class="detail">
      ${r.bild ? `<img class="detail-bild" src="${escapeHtml(r.bild)}" alt="${escapeHtml(r.titel)}">` : ""}
      <div class="detail-koerper">
        <header class="detail-kopf">
          <h1 class="detail-titel">${symbolFuer(r.kategorie)} ${escapeHtml(r.titel)}</h1>
          <div class="detail-meta">${metaTeile.map((t) => `<span>${t}</span>`).join("")}</div>
          ${quelleHtml}
        </header>
        <h2 class="detail-abschnitt-titel">Zutaten</h2>
        ${zutatenHtml}
        <h2 class="detail-abschnitt-titel">Zubereitung</h2>
        <ol class="schritte">${r.schritte.map((s) => `<li><span>${escapeHtml(s)}</span></li>`).join("")}</ol>
        ${r.notizen ? `<div class="detail-notizen">💡 ${escapeHtml(r.notizen)}</div>` : ""}
      </div>
    </article>`;
}

// ---------- Routing ----------

function route() {
  const hash = location.hash || "#/";
  const detailTreffer = hash.match(/^#\/rezept\/(.+)$/);

  el("ansicht-status").hidden = true;
  if (detailTreffer) {
    el("ansicht-liste").hidden = true;
    el("ansicht-detail").hidden = false;
    zeichneDetail(decodeURIComponent(detailTreffer[1]));
    window.scrollTo(0, 0);
  } else {
    el("ansicht-detail").hidden = true;
    el("ansicht-liste").hidden = false;
    zeichneFilterChips();
    zeichneListe();
  }
}

// ---------- Ereignisse ----------

el("suchfeld").addEventListener("input", (e) => {
  suchtext = e.target.value.trim();
  zeichneListe();
});

el("filter-kategorien").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-kategorie]");
  if (!chip) return;
  const k = chip.dataset.kategorie;
  aktiveKategorie = aktiveKategorie === k ? null : k;
  zeichneFilterChips();
  zeichneListe();
});

el("filter-tags").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-tag]");
  if (!chip) return;
  const t = chip.dataset.tag;
  if (aktiveTags.has(t)) aktiveTags.delete(t);
  else aktiveTags.add(t);
  zeichneFilterChips();
  zeichneListe();
});

window.addEventListener("hashchange", route);

// ---------- Start ----------

fetch("daten/rezepte.json")
  .then((antwort) => {
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    return antwort.json();
  })
  .then((daten) => {
    alleRezepte = daten.rezepte || [];
    el("anzahl-info").textContent = `${alleRezepte.length} Rezepte im Kochbuch`;
    route();
  })
  .catch((fehler) => {
    el("ansicht-status").innerHTML =
      `<p class="status-text">Rezepte konnten nicht geladen werden (${escapeHtml(fehler.message)}).<br>Wurde <code>node build.js</code> ausgeführt?</p>`;
  });
