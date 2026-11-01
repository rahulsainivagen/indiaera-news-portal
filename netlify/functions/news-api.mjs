import { getStore } from "@netlify/blobs";

export default async () => {
  try {
    const store = getStore("indiaera-news");
    const saved = await store.get("latest.json", { type: "json" });
    if (!saved) {
      return Response.json({
        brand: "IndiaEra.in", status: "waiting",
        updatedAt: null, articleCount: 0, articles: [],
        message: "पहला समाचार अपडेट अभी प्रकाशित नहीं हुआ है।"
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(saved, {
      headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "समाचार अभी उपलब्ध नहीं हैं।" }, { status: 500 });
  }
};

export const config = { path: "/api/news" };
