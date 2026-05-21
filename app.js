const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const CACHE_KEY = "game-radar-cache-v11";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

["game-radar-cache-v1", "game-radar-cache-v2", "game-radar-cache-v3", "game-radar-cache-v4", "game-radar-cache-v5", "game-radar-cache-v6", "game-radar-cache-v7", "game-radar-cache-v8", "game-radar-cache-v9", "game-radar-cache-v10"].forEach((key) => localStorage.removeItem(key));

const state = {
  view: "all",
  items: [],
  calendarMonth: new Date(),
  selectedDateKey: null
};

const timeline = document.querySelector("#timeline");
const calendarView = document.querySelector("#calendarView");
const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const selectedDayTitle = document.querySelector("#selectedDayTitle");
const selectedDayItems = document.querySelector("#selectedDayItems");
const itemTemplate = document.querySelector("#itemTemplate");
const statusText = document.querySelector("#statusText");
const statusDot = document.querySelector("#statusDot");
const refreshButton = document.querySelector("#refreshButton");
const prevMonth = document.querySelector("#prevMonth");
const nextMonth = document.querySelector("#nextMonth");
const tabs = [...document.querySelectorAll(".tab")];

const gameQuery = `
SELECT ?item ?itemLabel ?date ?platformLabel ?sitelinks WHERE {
  ?item wdt:P31/wdt:P279* wd:Q7889;
        wdt:P577 ?date.
  ?item rdfs:label ?itemLabel.
  FILTER(LANG(?itemLabel) = "en")
  FILTER(?date >= NOW() && ?date < NOW() + "P365D"^^xsd:duration)
  OPTIONAL {
    ?item wdt:P400 ?platform.
    ?platform rdfs:label ?platformLabel.
    FILTER(LANG(?platformLabel) = "en")
  }
  ?item wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 4)
}
ORDER BY ?date DESC(?sitelinks)
LIMIT 140`;

const eventQuery = `
SELECT ?item ?itemLabel ?date ?sitelinks WHERE {
  VALUES ?root {
    wd:Q113630354
    wd:Q1190246
    wd:Q18642757
    wd:Q683877
    wd:Q265567
  }
  {
    ?item wdt:P179 ?root.
  }
  UNION
  {
    ?item wdt:P361 ?root.
  }
  UNION
  {
    ?item wdt:P31 ?root.
  }
  ?item rdfs:label ?itemLabel.
  FILTER(LANG(?itemLabel) = "en")
  ?item ?dateProperty ?date.
  VALUES ?dateProperty { wdt:P585 wdt:P580 wdt:P577 }
  ?item wikibase:sitelinks ?sitelinks.
  FILTER(?date >= NOW() && ?date < NOW() + "P365D"^^xsd:duration)
}
ORDER BY ?date DESC(?sitelinks)
LIMIT 30`;

function setStatus(message, mode = "ok") {
  statusText.textContent = message;
  statusDot.classList.toggle("error", mode === "error");
}

function toDate(value) {
  return new Date(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function month(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}

function calendarMonthTitle(date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function dateKey(date) {
  const year = date.getFullYear();
  const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
  const dayNumber = String(date.getDate()).padStart(2, "0");
  return `${year}-${monthNumber}-${dayNumber}`;
}

async function queryWikidata(query) {
  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikidata returned ${response.status}`);
  }

  return response.json();
}

async function queryOfficialEvents() {
  const response = await fetch("/api/events", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Official events returned ${response.status}`);
  }

  return response.json();
}

function normalizeGames(results) {
  const byId = new Map();

  for (const row of results.results.bindings) {
    const id = row.item.value;
    const title = cleanLabel(row.itemLabel?.value);
    if (!title) continue;

    const existing = byId.get(id);
    const platform = cleanLabel(row.platformLabel?.value);

    if (existing) {
      if (platform && !existing.platforms.includes(platform)) {
        existing.platforms.push(platform);
      }
      continue;
    }

    byId.set(id, {
      id,
      title,
      date: toDate(row.date.value),
      type: "game",
      platforms: platform ? [platform] : [],
      score: Number(row.sitelinks?.value ?? 0),
      url: id.replace("http://", "https://")
    });
  }

  return [...byId.values()];
}

function normalizeEvents(results) {
  const seen = new Set();

  return results.results.bindings
    .map((row) => ({
      id: row.item.value,
      title: cleanLabel(row.itemLabel?.value),
      date: toDate(row.date.value),
      type: "event",
      platforms: [],
      score: Number(row.sitelinks?.value ?? 0),
      url: row.item.value.replace("http://", "https://")
    }))
    .filter((item) => {
      if (!item.title) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeOfficialEvents(results) {
  return results
    .map((item) => ({
      ...item,
      date: toDate(item.date),
      title: cleanLabel(item.title),
      sourceName: item.sourceName || "Official source"
    }))
    .filter((item) => item.title && Number.isFinite(item.date.valueOf()));
}

function cleanLabel(value) {
  if (!value || /^Q\d+$/.test(value)) return "";
  return value;
}

function loadCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
    return cached.items.map((item) => ({ ...item, date: new Date(item.date) }));
  } catch {
    return null;
  }
}

function saveCache(items) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    savedAt: Date.now(),
    items
  }));
}

async function loadSchedule(force = false) {
  const cached = !force ? loadCache() : null;

  if (cached) {
    state.items = cached;
    render();
    setStatus(`Updated from cache. Last live sync checks every 6 hours.`);
    return;
  }

  setStatus("Syncing release dates and event listings...");

  try {
    const [gameResult, wikidataEventResult, officialEventResult] = await Promise.allSettled([
      queryWikidata(gameQuery),
      queryWikidata(eventQuery),
      queryOfficialEvents()
    ]);

    const games = gameResult.status === "fulfilled" ? normalizeGames(gameResult.value) : [];
    const wikidataEvents = wikidataEventResult.status === "fulfilled" ? normalizeEvents(wikidataEventResult.value) : [];
    const officialEvents = officialEventResult.status === "fulfilled" ? normalizeOfficialEvents(officialEventResult.value) : [];
    const events = [...wikidataEvents, ...officialEvents];

    if (!games.length && gameResult.status === "rejected") {
      throw gameResult.reason;
    }

    state.items = [...games, ...events]
      .filter((item) => Number.isFinite(item.date.valueOf()))
      .sort((a, b) => a.date - b.date || b.score - a.score)
      .slice(0, 80);

    saveCache(state.items);
    syncCalendarMonth();
    render();
    setStatus(events.length
      ? `Live sync complete. ${games.length} releases and ${events.length} events found.`
      : `Live sync complete. ${games.length} releases found; event source had no fast updates.`);
  } catch (error) {
    const fallback = loadCache();
    if (fallback) {
      state.items = fallback;
      render();
      setStatus(`Live sync failed, showing cached data. ${error.message}`, "error");
      return;
    }

    state.items = [];
    render();
    setStatus(`Live sync failed. ${error.message}`, "error");
  }
}

function render() {
  timeline.hidden = state.view === "calendar";
  calendarView.hidden = state.view !== "calendar";

  if (state.view === "calendar") {
    renderCalendar();
    return;
  }

  const visible = state.items.filter((item) => state.view === "all" || item.type === state.view.slice(0, -1));
  timeline.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No matching releases or events found in the next year.";
    timeline.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of visible) {
    const card = itemTemplate.content.firstElementChild.cloneNode(true);
    const date = item.date;
    card.querySelector(".month").textContent = month(date);
    card.querySelector(".day").textContent = String(date.getDate());
    card.querySelector("h2").textContent = item.title;
    card.querySelector(".kind").textContent = item.type;
    card.querySelector(".meta").textContent = item.type === "game"
      ? `${formatDate(date)}${item.platforms.length ? ` - ${item.platforms.slice(0, 4).join(", ")}` : ""}`
      : `${formatDate(date)} - Showcase or industry event`;
    card.querySelector(".source").href = item.url;
    card.querySelector(".source").textContent = item.sourceName || "Wikidata source";
    fragment.append(card);
  }

  timeline.append(fragment);
}

function syncCalendarMonth() {
  if (!state.items.length) return;

  const selected = state.items.find((item) => dateKey(item.date) === state.selectedDateKey);
  const firstUpcoming = state.items.find((item) => item.date >= new Date()) || state.items[0];
  const anchor = selected || firstUpcoming;

  state.calendarMonth = new Date(anchor.date.getFullYear(), anchor.date.getMonth(), 1);
  state.selectedDateKey = dateKey(anchor.date);
}

function itemsForDate(key) {
  return state.items.filter((item) => dateKey(item.date) === key);
}

function renderCalendar() {
  calendarTitle.textContent = calendarMonthTitle(state.calendarMonth);
  calendarGrid.replaceChildren();

  const monthStart = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - monthStart.getDay());

  const todayKey = dateKey(new Date());
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const key = dateKey(cellDate);
    const dayItems = itemsForDate(key);
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.dataset.date = key;
    button.classList.toggle("outside-month", cellDate.getMonth() !== state.calendarMonth.getMonth());
    button.classList.toggle("today", key === todayKey);
    button.classList.toggle("selected", key === state.selectedDateKey);
    button.classList.toggle("has-items", dayItems.length > 0);
    button.innerHTML = `
      <span class="calendar-number">${cellDate.getDate()}</span>
      <span class="calendar-dots">${dayItems.slice(0, 3).map((item) => `<i class="${item.type}"></i>`).join("")}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedDateKey = key;
      renderCalendar();
    });
    fragment.append(button);
  }

  calendarGrid.append(fragment);
  renderSelectedDay();
}

function renderSelectedDay() {
  const selectedDate = state.selectedDateKey ? new Date(`${state.selectedDateKey}T12:00:00`) : new Date();
  const dayItems = state.selectedDateKey ? itemsForDate(state.selectedDateKey) : [];
  selectedDayTitle.textContent = formatDate(selectedDate);
  selectedDayItems.replaceChildren();

  if (!dayItems.length) {
    const empty = document.createElement("p");
    empty.className = "day-empty";
    empty.textContent = "No releases or events.";
    selectedDayItems.append(empty);
    return;
  }

  for (const item of dayItems) {
    const link = document.createElement("a");
    link.className = `day-item ${item.type}`;
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<span>${item.type}</span><strong>${item.title}</strong>`;
    selectedDayItems.append(link);
  }
}

function setView(view) {
  state.view = view;
  if (view === "calendar" && !state.selectedDateKey) {
    syncCalendarMonth();
  }
  for (const tab of tabs) {
    tab.classList.toggle("active", tab.dataset.view === view);
  }
  render();
}

refreshButton.addEventListener("click", () => loadSchedule(true));
prevMonth.addEventListener("click", () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
  state.selectedDateKey = null;
  renderCalendar();
});
nextMonth.addEventListener("click", () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
  state.selectedDateKey = null;
  renderCalendar();
});
tabs.forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => {});
}

loadSchedule();
