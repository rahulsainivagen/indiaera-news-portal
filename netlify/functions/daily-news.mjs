import { getStore } from "@netlify/blobs";
import { XMLParser } from "fast-xml-parser";

const STORE_NAME = "indiaera-news";
const DEFAULT_FEEDS = [
  "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi",
  "https://news.google.com/rss/search?q=India+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=India+technology+OR+science+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=India+business+OR+economy+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=India+education+OR+government+scheme+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=India+sports+when:2d&hl=en-IN&gl=IN&ceid=IN:en"
];
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function cleanText(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
function asArray(value) { return Array.isArray(value) ? value : value ? [value] : []; }

async function fetchFeed(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "IndiaEraNewsBot/1.0 (news aggregation; contact: editor@indiaera.in)" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = asArray(parsed?.rss?.channel?.item ?? parsed?.feed?.entry);
    return items.map((item) => {
      const link = typeof item.link === "string" ? item.link : item.link?.["@_href"] || item.link?.[0]?.["@_href"] || "";
      return {
        title: cleanText(item.title?.["#text"] || item.title || ""),
        description: cleanText(item.description || item.summary || item.content || ""),
        url: link || item.guid?.["#text"] || item.guid || "",
        publishedAt: item.pubDate || item.published || item.updated || new Date().toISOString(),
        source: cleanText(item.source?.["#text"] || item.source || new URL(url).hostname.replace(/^www\./, ""))
      };
    }).filter(x => x.title && /^https?:\/\//i.test(x.url));
  } catch (error) {
    console.error("Feed failed:", url, error.message);
    return [];
  }
}

async function makeHindiDigest(items) {
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const compact = items.slice(0, 65).map((x, i) => ({
    id: i, title: x.title, description: x.description.slice(0, 420),
    source: x.source, url: x.url, publishedAt: x.publishedAt
  }));
  const prompt = `आप IndiaEra.in के जिम्मेदार हिंदी समाचार संपादक हैं। दिए गए फीड आइटम ही आपका एकमात्र तथ्य-स्रोत हैं।
इनमें से अधिकतम 12 सबसे महत्वपूर्ण, भारत-केंद्रित और विविध खबरें चुनें। पुरानी, दोहराई हुई, प्रचारात्मक, अस्पष्ट या केवल अफवाह/सोशल पोस्ट आधारित खबरें छोड़ दें।
कोई तथ्य, तारीख, आंकड़ा, उद्धरण या घटना न गढ़ें। स्रोत के शीर्षक/विवरण से पुष्ट न होने वाली जानकारी न जोड़ें। संदेह हो तो खबर छोड़ दें।
हर खबर के लिए sources में केवल इनपुट में दिए गए exact URL इस्तेमाल करें; कोई URL या प्रकाशक न गढ़ें। सामान्य खबर तभी चुनें जब कम से कम दो अलग प्रकाशकों की रिपोर्ट हों। एक स्रोत वाली खबर केवल स्पष्ट आधिकारिक प्राथमिक स्रोत (जैसे PIB, ISRO, RBI, ECI, MEA) होने पर चुनें।
हर चुनी खबर के लिए: category को इनमें से चुनें: राष्ट्रीय, राजनीति, अर्थव्यवस्था, टेक्नोलॉजी, विज्ञान, शिक्षा, खेल, दुनिया, जीवनशैली। हिंदी में संक्षिप्त और निष्पक्ष headline, 2-3 वाक्यों का summary, 1 वाक्य whyItMatters, importance 1-5 दें।
हर खबर के sourceUrl और sourceName को इनपुट से ज्यों का त्यों रखें। आपस में एक ही घटना की कई खबरों को एक खबर में मिलाएं और सभी मूल URLs sources array में रखें।
केवल JSON लौटाएं, markdown नहीं। Schema: {"articles":[{"headline":"...","summary":"...","whyItMatters":"...","category":"...","importance":5,"publishedAt":"ISO date if known","sources":[{"name":"...","url":"..."}]}]}
फीड डेटा: ${JSON.stringify(compact)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, responseMimeType: "application/json" }
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  const result = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/, "").trim());
  const allowedByUrl = new Map(items.map(item => [item.url, item]));
  const officialPattern = /press information bureau|\bpib\b|isro|reserve bank of india|\brbi\b|election commission of india|\beci\b|ministry of external affairs|india meteorological department|uidai|niti aayog|supreme court of india/i;
  const articles = asArray(result.articles).map((a) => {
    // Only accept source URLs that were actually present in the fetched RSS items.
    const sources = asArray(a.sources)
      .filter(s => allowedByUrl.has(s.url))
      .map(s => {
        const original = allowedByUrl.get(s.url);
        return { name: original.source || cleanText(s.name || "मूल स्रोत"), url: original.url };
      });
    const distinctSources = [...new Set(sources.map(s => s.name.toLowerCase()))];
    const officialOnly = distinctSources.some(name => officialPattern.test(name));
    // Require two distinct publishers, or one recognized primary government/science source.
    if (distinctSources.length < 2 && !officialOnly) return null;
    return {
      id: crypto.randomUUID(),
      headline: cleanText(a.headline).slice(0, 160),
      summary: cleanText(a.summary).slice(0, 700),
      whyItMatters: cleanText(a.whyItMatters).slice(0, 300),
      category: cleanText(a.category || "राष्ट्रीय"),
      importance: Math.max(1, Math.min(5, Number(a.importance) || 3)),
      publishedAt: a.publishedAt || new Date().toISOString(),
      verification: officialOnly ? "आधिकारिक स्रोत" : "दो स्वतंत्र प्रकाशकों से मिलान",
      sources: sources.slice(0, 4)
    };
  }).filter(a => a && a.headline && a.summary && a.sources.length);
  return articles;
}

export default async () => {
  const startedAt = new Date().toISOString();
  const feedUrls = (Netlify.env.get("NEWS_FEED_URLS") || DEFAULT_FEEDS.join("\n")).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const batches = await Promise.all(feedUrls.map(fetchFeed));
  const seen = new Set();
  const items = batches.flat().filter(item => {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 90);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 80);

  if (items.length < 4) throw new Error(`Not enough feed items to build a reliable digest (${items.length})`);
  const articles = await makeHindiDigest(items);
  if (!articles.length) throw new Error("AI returned no publishable articles");

  const store = getStore(STORE_NAME);
  const payload = {
    brand: "IndiaEra.in",
    tagline: "भारत की हर जरूरी खबर, आसान हिंदी में।",
    updatedAt: new Date().toISOString(),
    status: "published",
    articleCount: articles.length,
    articles
  };
  await store.set("latest.json", JSON.stringify(payload), { metadata: { updatedAt: payload.updatedAt } });
  console.log(`Published ${articles.length} articles from ${items.length} feed items. Started ${startedAt}`);
  return new Response(JSON.stringify({ ok: true, articles: articles.length, feedItems: items.length }), {
    headers: { "Content-Type": "application/json" }
  });
};

export const config = { schedule: "30 2 * * *" }; // Daily at 08:00 IST (02:30 UTC)
