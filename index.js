const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1500996393383497921/CPtH0xGB67g8TyVlj7b8wdoQFzTwLrtF6d28rda_dUlcvyc40m43OKrQ5Uj_AbJ6y7xD";
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news/archive";

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

    // 🧹 limpiar título
    let title = $("h1").text().trim();
    title = title.replace("La página de la comunidad de Elsword", "").trim();

    // 📄 obtener primer párrafo limpio
    let firstParagraph = "";

    $(".article-content p").each((i, el) => {
      let text = $(el).text().trim();

      if (
        !text ||
        text.includes("cuenta") ||
        text.includes("CGU") ||
        text.length < 10
      ) return;

      firstParagraph = text;
      return false;
    });

    const image = $("img").first().attr("src");

    await axios.post(WEBHOOK_URL, {
      embeds: [{
        title: title,
        url: url,
        description: firstParagraph
          ? `${firstParagraph}\n\n[Ver más en el enlace](${url})`
          : `[Ver más en el enlace](${url})`,
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
