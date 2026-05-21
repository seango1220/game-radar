const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "GameRadarLocalWidget/1.0"
      }
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Request failed with ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#8211;/g, "-")
    .replace(/&#8220;|&#8221;/g, "\"")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"");
}

function tag(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateText(text, published) {
  const fullDate = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (fullDate) {
    return new Date(Number(fullDate[3]), MONTHS[fullDate[1].toLowerCase()], Number(fullDate[2]));
  }

  const monthDay = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i);
  if (!monthDay) return null;

  const now = new Date();
  const publishedYear = published && Number.isFinite(published.valueOf()) ? published.getFullYear() : now.getFullYear();
  return new Date(publishedYear, MONTHS[monthDay[1].toLowerCase()], Number(monthDay[2]));
}

function parseDottedDate(text) {
  const match = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
}

function event(id, title, date, url, sourceName, score = 1000) {
  return {
    id,
    title,
    date: date.toISOString(),
    type: "event",
    platforms: [],
    score,
    url,
    sourceName
  };
}

function parseRssItems(rss) {
  return [...rss.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

async function rssEvents({ url, sourceName, keywords, titleKeywords = null, limit = 20 }) {
  const rss = await fetchText(url);
  const events = [];

  for (const item of parseRssItems(rss).slice(0, limit)) {
    const title = stripTags(tag(item, "title")).trim();
    const link = tag(item, "link");
    const published = new Date(tag(item, "pubDate"));
    const body = stripTags(`${title} ${tag(item, "description")} ${tag(item, "content:encoded")}`);
    const haystack = `${title} ${body}`;
    const date = parseDateText(haystack, published);

    if (!title || !date || date < startOfToday()) continue;
    if (!keywords.some((keyword) => keyword.test(haystack))) continue;
    if (titleKeywords && !titleKeywords.some((keyword) => keyword.test(title))) continue;

    events.push(event(link || title, title, date, link, sourceName));
  }

  return events;
}

async function pageEvent({ url, titlePattern, datePattern, title, sourceName, score = 1200 }) {
  const html = decodeXml(stripTags(await fetchText(url)));
  const titleMatch = titlePattern ? html.match(titlePattern) : null;
  const dateMatch = html.match(datePattern);
  const date = dateMatch ? parseDateText(dateMatch[0]) : null;

  if (!date || date < startOfToday()) return [];

  return [event(url, titleMatch?.[0]?.trim() || title, date, url, sourceName, score)];
}

async function nintendoDirectEvents() {
  const html = decodeXml(await fetchText("https://www.nintendo.com/us/nintendo-direct/archive/"));
  const matches = [...html.matchAll(/<h1[^>]*>([^<]*Direct\s+\d{1,2}\.\d{1,2}\.20\d{2})<\/h1>/gi)];
  const events = [];

  for (const match of matches) {
    const title = stripTags(match[1]).trim();
    const date = parseDottedDate(title);
    if (!date || date < startOfToday()) continue;

    events.push(event(
      `nintendo-direct-${title}`,
      title,
      date,
      "https://www.nintendo.com/us/nintendo-direct/archive/",
      "Nintendo"
    ));
  }

  return events;
}

async function xboxArchiveEvents() {
  const html = decodeXml(await fetchText("https://news.xbox.com/en-us/xbox-games-showcase/feed/"));
  const matches = [...html.matchAll(/<a href="([^"]+)"[^>]+aria-label="Read the story titled ([^"]*Xbox Games Showcase[^"]*)"/gi)];
  const events = [];

  for (const match of matches) {
    const url = match[1];
    const title = stripTags(decodeXml(match[2])).trim();
    const date = parseDateText(title);
    if (!date || date < startOfToday()) continue;

    events.push(event(url, title, date, url, "Xbox Wire"));
  }

  return events;
}

async function officialEvents() {
  const results = await Promise.allSettled([
    rssEvents({
      url: "https://blog.playstation.com/feed/",
      sourceName: "PlayStation Blog",
      keywords: [/state of play/i, /playstation showcase/i]
    }),
    rssEvents({
      url: "https://news.xbox.com/en-us/feed/",
      sourceName: "Xbox Wire",
      keywords: [/xbox games showcase/i, /developer direct/i, /partner preview/i],
      titleKeywords: [/xbox games showcase/i, /developer direct/i, /partner preview/i]
    }),
    rssEvents({
      url: "https://news.xbox.com/en-us/xbox-games-showcase/feed/",
      sourceName: "Xbox Wire",
      keywords: [/xbox games showcase/i, /developer direct/i, /direct airs/i],
      titleKeywords: [/xbox games showcase/i, /developer direct/i, /partner preview/i]
    }),
    xboxArchiveEvents(),
    pageEvent({
      url: "https://www.summergamefest.com/",
      titlePattern: /Summer Game Fest\s+20\d{2}/i,
      datePattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i,
      title: "Summer Game Fest",
      sourceName: "Summer Game Fest"
    }),
    pageEvent({
      url: "https://thegameawards.com/",
      titlePattern: /The Game Awards\s+-\s+[A-Za-z]+\s+\d{1,2},?\s+20\d{2}/i,
      datePattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i,
      title: "The Game Awards",
      sourceName: "The Game Awards"
    }),
    nintendoDirectEvents()
  ]);

  const seen = new Set();
  return results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item) => {
      const key = `${item.title}-${item.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function serveFile(req, res) {
  const requested = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = requested.pathname === "/" ? "/index.html" : requested.pathname;
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const type = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/events")) {
    try {
      send(res, 200, JSON.stringify(await officialEvents()), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 502, JSON.stringify({ error: error.message || error.code || "Request failed" }), "application/json; charset=utf-8");
    }
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  console.log(`Game Radar is running at http://localhost:${PORT}/`);
});
