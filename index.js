const axios = require("axios");
const cheerio = require("cheerio");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1500984023315382273/k5vGGzVf1qb-P-jdLKeG3F8kdQLq61RS--cU6TEjZftbv40z1XLqCyX6GZpfgjg6QFTt"; // ⚠️ pon tu webhook nuevo aquí
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news";

let lastLink = "";

async function checkNews() {
  try {
    const res = await axios.get(NEWS_URL);
    const $ = cheerio.load(res.data);

    // 🔍 Buscar links de noticias válidos (evita archive)
    const link = $("a[href*='/news/']")
      .map((i, el) => $(el).attr("href"))
      .get()
      .find(href => href && !href.includes("archive"));

    if (!link) return;

    // 🔧 Arregla links relativos vs completos
    let fullLink = link;
    if (!link.startsWith("http")) {
      fullLink = BASE_URL + link;
    }

    // ❌ evitar repetir
    if (fullLink === lastLink) return;

    lastLink = fullLink;

    console.log("Nueva noticia:", fullLink);

    await sendToDiscord(fullLink);

  } catch (e) {
    console.log("Error revisando noticias:", e.message);
  }
}

async function sendToDiscord(url) {
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    const title = $("h1").text().trim();

    let content = "";
    $(".article-content p, .article-content li").each((i, el) => {
      const text = $(el).text().trim();
      if (text) content += "• " + text + "\n";
    });

    // fallback si no encuentra esa clase
    if (!content) {
      $("p").each((i, el) => {
        const text = $(el).text().trim();
        if (text) content += text + "\n";
      });
    }

    const image = $("img").first().attr("src");

    await axios.post(WEBHOOK_URL, {
      embeds: [{
        title: title,
        url: url,
        description: content.substring(0, 4000),
        image: image ? { url: image } : undefined,
        color: 16753920,
        footer: { text: "Elsword EU News" },
        timestamp: new Date()
      }]
    });

    console.log("Noticia enviada a Discord");

  } catch (e) {
    console.log("Error enviando a Discord:", e.message);
  }
}

// ⏱️ cada 10 minutos
setInterval(checkNews, 600000);

// ejecutar al iniciar
checkNews();
