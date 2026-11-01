const $ = (s) => document.querySelector(s);
let allArticles = [];
let activeCategory = "सभी";
const dateFormat = new Intl.DateTimeFormat("hi-IN", { day:"numeric", month:"long", year:"numeric" });
$("#today").textContent = dateFormat.format(new Date());
$("#year").textContent = new Date().getFullYear();

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "ताज़ा अपडेट" : new Intl.DateTimeFormat("hi-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
}
function escapeHTML(s="") {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function render() {
  const list = activeCategory === "सभी" ? allArticles : allArticles.filter(a => a.category === activeCategory);
  $("#newsGrid").innerHTML = "";
  $("#empty").classList.toggle("hidden", list.length !== 0);
  list.forEach(article => {
    const card = document.createElement("article");
    card.className = "news-card";
    const links = (article.sources || []).map(s => `<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.name || "मूल स्रोत")} ↗</a>`).join("");
    card.innerHTML = `<div class="card-top"><span class="category">${escapeHTML(article.category || "राष्ट्रीय")}</span><span class="importance">महत्व ${"★".repeat(Math.min(5,Math.max(1,Number(article.importance)||3)))}</span></div>
      <h3>${escapeHTML(article.headline)}</h3><p>${escapeHTML(article.summary)}</p>
      ${article.whyItMatters ? `<div class="why"><b>क्यों जरूरी?</b> ${escapeHTML(article.whyItMatters)}</div>` : ""}
      <div class="source-row"><div>${links || '<span>स्रोत उपलब्ध नहीं</span>'}<small class="verification">${escapeHTML(article.verification || "स्रोत लिंक उपलब्ध")}</small></div><small>${safeDate(article.publishedAt)}</small></div>`;
    $("#newsGrid").appendChild(card);
  });
}
async function loadNews() {
  $("#refreshBtn").disabled = true;
  $("#refreshBtn").textContent = "लोड हो रहा है…";
  try {
    const res = await fetch("/api/news", { cache: "no-store" });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    allArticles = data.articles || [];
    $("#updated").textContent = data.updatedAt ? `अंतिम अपडेट: ${safeDate(data.updatedAt)} · ${allArticles.length} खबरें` : (data.message || "पहला अपडेट प्रतीक्षित है");
    render();
  } catch (e) {
    $("#newsGrid").innerHTML = '<div class="loading">खबरें लोड नहीं हो पाईं। कृपया कुछ देर बाद फिर प्रयास करें।</div>';
    $("#updated").textContent = "कनेक्शन उपलब्ध नहीं";
  } finally {
    $("#refreshBtn").disabled = false;
    $("#refreshBtn").textContent = "↻ रिफ्रेश";
  }
}
$("#chips").addEventListener("click", e => {
  const btn = e.target.closest("button[data-cat]");
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === btn));
  render();
});
$("#refreshBtn").addEventListener("click", loadNews);
$("#menuBtn").addEventListener("click", () => $("nav").classList.toggle("open"));
loadNews();