const axios = require("axios");
const cheerio = require("cheerio");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1500987759089946686/mJgqO929gQH7O84uaJoo7QY6F7KVPvUzKlWR3FMIqCN9Crf1UyToHoasi4qwHalm7j0w"; // ⚠️ cambia por tu webhook
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news/archive";

// 🔥 guardamos varias noticias ya enviadas
let sentLinks = [];

async function checkNews() {
  try {
    const res = await axios.get(NEWS_URL);
    const $ = cheerio.load(res.data);

    // 🔍 sacar links reales de noticias
    const links = $("a[href*='/news/']")
      .map((i, el) => $(el).attr("href"))
      .get()
      .filter(link =>
        link &&
        !link.includes("archive") &&
        !link.includes("category")
      );

    // tomar las 5 más recientes
    const recentLinks = links.slice(0, 5);

    for (let link of recentLinks) {

      // 🔧 arreglar link relativo
      let fullLink = link;
      if (!link.startsWith("http")) {
        fullLink = BASE_URL + link;
      }

      // ❌ evitar repetir
      if (sentLinks.includes(fullLink)) continue;

      sentLinks.push(fullLink);

      console.log("Nueva noticia:", fullLink);

      await sendToDiscord(fullLink);
    }

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

    // fallback
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
