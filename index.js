const express = require("express");
const app = express();

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1503501185338970153/Hem6j7b2zsyUspZ8GxcFxjqXa2u53j4Lsim_BKn9ZZyoUFjS6u2OYDdEpnHEdNo0rZir";
const BASE_URL = "https://es.elsword.gameforge.com";
const NEWS_URL = BASE_URL + "/news/archive";

const FILE = "sent.json";

let sentLinks = [];
let checkingNews = false;
let firstRun = true;

// cargar noticias ya enviadas
if (fs.existsSync(FILE)) {
  sentLinks = JSON.parse(fs.readFileSync(FILE));
}

// guardar noticias enviadas
function saveLinks() {
  fs.writeFileSync(FILE, JSON.stringify(sentLinks, null, 2));
}

// revisar noticias
async function checkNews() {

  if (checkingNews) {
    console.log("Ya hay una revisión en proceso");
    return;
  }

  checkingNews = true;

  try {

    console.log("Buscando noticias...");

    const res = await axios.get(NEWS_URL, {
      timeout: 15000
    });

    const $ = cheerio.load(res.data);

    // obtener links únicos
    const links = [...new Set(
      $("a[href*='/news/article/']")
        .map((i, el) => $(el).attr("href"))
        .get()
    )].filter(link =>
      link &&
      !link.includes("archive") &&
      !link.includes("category")
    );

    const recentLinks = links.slice(0, 10);

    let newsData = [];

    // obtener fechas reales
    for (let link of recentLinks) {

      let fullLink = link;

      if (!link.startsWith("http")) {
        fullLink = BASE_URL + link;
      }

      if (sentLinks.includes(fullLink)) continue;

      try {

        const articleRes = await axios.get(fullLink, {
          timeout: 15000
        });

        const article$ = cheerio.load(articleRes.data);

        let rawText = article$("body").text();

        let match = rawText.match(
          /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/
        );

        let timestamp = new Date();

        if (match) {

          const [, day, month, year, hour, minute] = match;

          timestamp = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:00`
          );
        }

        newsData.push({
          url: fullLink,
          timestamp: timestamp
        });

      } catch (e) {

        console.log(
          "Error obteniendo fecha:",
          e.message
        );
      }
    }

    // ordenar por fecha real
    newsData.sort((a, b) => a.timestamp - b.timestamp);

    // enviar noticias
for (const news of newsData) {

  sentLinks.push(news.url);
  saveLinks();

  // evitar reenviar noticias viejas
  if (firstRun) {

    console.log(
      "Saltando noticia antigua:",
      news.url
    );

    continue;
  }

  console.log("Nueva noticia:", news.url);

  await sendToDiscord(news.url);
}

  } catch (e) {

    console.log(
      "Error revisando noticias:",
      e.message
    );

  } finally {

    checkingNews = false;
    firstRun = false;
  }
}

// enviar a discord
async function sendToDiscord(url) {

  try {

    const res = await axios.get(url, {
      timeout: 15000
    });

    const $ = cheerio.load(res.data);

    // título
    let title = $("h1").text().trim();

    title = title.replace(
      "La página de la comunidad de Elsword",
      ""
    ).trim();

    // descripción
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

    const descriptionText = paragraphs
      .slice(0, 3)
      .join("\n\n");

    // imagen
    let image;

const images = $("img")
  .map((i, el) => $(el).attr("src"))
  .get()
  .filter(src =>
    src &&
    src.startsWith("http")
  );

// shopupdate usa segunda imagen
if (
  title.toLowerCase().includes("shopupdate") &&
  images.length > 1
) {

  image = images[1];

} else {

  image = images[0];
}

    // fecha
    let rawText = $("body").text();

    let match = rawText.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/
    );

    let timestamp = new Date();

    if (match) {

      const [, day, month, year, hour, minute] = match;

      timestamp = new Date(
        `${year}-${month}-${day}T${hour}:${minute}:00`
      );
    }

    // enviar embed
    await axios.post(WEBHOOK_URL, {

      embeds: [{

        title: title,
        url: url,

        description: descriptionText
          ? `${descriptionText}\n\n[Ver más en el enlace](${url})`
          : `[Ver más en el enlace](${url})`,

        image: image
          ? { url: image }
          : undefined,

        color: 16753920,

        footer: {
          text: "Elsword EU News"
        },

        timestamp: timestamp

      }]
    });

    console.log("Noticia enviada a Discord");

  } catch (e) {

    console.log(
      "Error enviando a Discord:",
      e.message
    );
  }
}

// revisar cada 2 minutos
setInterval(async () => {

  console.log(
    "Revisando noticias:",
    new Date()
  );

  await checkNews();

}, 120000);

// primera ejecución
checkNews();

// servidor express
app.get("/", (req, res) => {
  res.send("Bot funcionando");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor web activo");
});

// evitar crashes silenciosos
process.on("unhandledRejection", (reason) => {
  console.log("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception:", err);
});
