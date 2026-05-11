const express = require("express");
const app = express();

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const WEBHOOK_URL = "TU_WEBHOOK";
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news/archive";

const FILE = "sent.json";

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

    // 📄 obtener párrafos reales
    let paragraphs = [];

    $("p").each((i, el) => {
      let text = $(el).text().trim();

      if (
        !text ||
        text.includes("cuenta") ||
        text.includes("CGU") ||
        text.length < 20
      ) return;

      paragraphs.push(text);
    });

    const descriptionText = paragraphs.slice(0, 3).join("\n\n");

    // 🖼️ imagen
    const image = $("img").first().attr("src");

    // 📅 EXTRAER FECHA
    let rawText = $("body").text();

    let match = rawText.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/);

    let timestamp = new Date();

    if (match) {
      const [, day, month, year, hour, minute] = match;
      timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    }

    await axios.post(WEBHOOK_URL, {
      embeds: [{
        title: title,
        url: url,
        description: descriptionText
          ? `${descriptionText}\n\n[Ver más en el enlace](${url})`
          : `[Ver más en el enlace](${url})`,
        image: image ? { url: image } : undefined,
        color: 16753920,
        footer: { text: "Elsword EU News" },
        timestamp: timestamp
      }]
    });

    console.log("Noticia enviada a Discord");

  } catch (e) {
    console.log("Error enviando a Discord:", e.message);
  }
}

// ⏱️ Revisar cada 10 minutos
setInterval(checkNews, 600000);

checkNews();

// 🌐 Servidor web para Render
app.get("/", (req, res) => {
  res.send("Bot funcionando");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor web activo");
});
```
