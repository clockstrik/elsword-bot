const axios = require("axios");
const cheerio = require("cheerio");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1500979785898131568/uQ21O2iGZsRwL_Lw0dSAtl4q6t8g2FU2OjscJTJ_4YVxYDbsxCNi0ex5ZC1eV7pmNMhX";
const BASE_URL = "https://es.elsword.gameforge.com/news";

let lastLink = "";

async function checkNews() {
  try {
    const res = await axios.get(BASE_URL);
    const $ = cheerio.load(res.data);

    const link = $("a[href*='/news/']").first().attr("href");

    if (!link) return;

    const fullLink = "https://es.elsword.gameforge.com" + link;

    if (fullLink === lastLink) return;

    lastLink = fullLink;

    console.log("Nueva noticia:", fullLink);

    await sendToDiscord(fullLink);

  } catch (e) {
    console.log(e);
  }
}

async function sendToDiscord(url) {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  const title = $("h1").text().trim();

  let content = "";
  $("p, li").each((i, el) => {
    content += "• " + $(el).text().trim() + "\n";
  });

  const image = $("img").first().attr("src");

  await axios.post(WEBHOOK_URL, {
    embeds: [{
      title: title,
      url: url,
      description: content.substring(0, 4000),
      image: { url: image },
      color: 16753920
    }]
  });
}

setInterval(checkNews, 600000);
checkNews();
