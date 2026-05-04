const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1500992514646212610/__PM2iE7sULRRrtDCgAv0VM4l7HCghW-uysJOBKQGrrCKAPWLKpdEzdaAMcMB823r7FaK";
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news/archive";

// 📁 archivo donde guardamos historial
const FILE = "sent.json";

// cargar historial
let sentLinks = [];
if (fs.existsSync(FILE)) {
  sentLinks = JSON.parse(fs.readFileSync(FILE));
}

function saveLinks() {
  fs.writeFileSync(FILE, JSON.stringify(sentLinks, null, 2));
}

async function checkNews() {
  try {
    const res = await axios.get(NEWS_URL);
    const $ = cheerio.load(res.data);

    const links = $("a[href*='/news/']")
      .map((i, el) => $(el).attr("href"))
      .get()
      .filter(link =>
        link &&
        !link.includes("archive") &&
        !link.includes("category")
      );

    const recentLinks = links.slice(0, 5);

    for (let link of recentLinks) {

      let fullLink = link;
      if (!link.startsWith("http")) {
        fullLink = BASE_URL + link;
      }

      if (sentLinks.includes(fullLink)) continue;

      sentLinks.push(fullLink);
      saveLinks();

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

    let lines = [];

    $(".article-content p, .article-content li").each((i, el) => {
      let text = $(el).text().trim();

      // ❌ eliminar basura
      if (
        !text ||
        text.includes("cuenta") ||
        text.includes("CGU") ||
        text.length < 5
      ) return;

      lines.push("• " + text);
    });

    // ✂️ limitar contenido (máx 10 líneas)
    const content = lines.slice(0, 10).join("\n");

    const image = $("img").first().attr("src");

    await axios.post(WEBHOOK_URL, {
      embeds: [{
        title: title,
        url: url,
        description: content || "Ver más en el enlace",
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

checkNews();
