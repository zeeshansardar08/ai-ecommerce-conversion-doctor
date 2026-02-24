import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ScrapedPage } from "./types";

const CTA_REGEX =
  /(add to cart|buy now|checkout|get started|start|subscribe|shop now|order|try|claim|add to bag)/i;
const PRICE_REGEX = /(\$|€|£)\s?\d{1,3}(?:[\d,]*)(?:\.\d{2})?/g;

const cleanText = (text: string) =>
  text.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

const extractFromHtml = (html: string, finalUrl: string): ScrapedPage => {
  const $ = cheerio.load(html);
  const textContent = cleanText($("body").text());

  const title = cleanText($("title").first().text());
  const metaDescription = cleanText(
    $("meta[name='description']").attr("content") || ""
  );

  const h1 = $("h1")
    .map((_, el: Element) => cleanText($(el).text()))
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, el: Element) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const ctas = $(
    "a, button, [role='button'], input[type='submit'], input[type='button']"
  )
    .map((_, el: Element) => {
      const tag = $(el);
      const text = cleanText(
        tag.is("input") ? tag.attr("value") || "" : tag.text()
      );
      const href = tag.attr("href") || null;
      return { text, href };
    })
    .get()
    .filter(
      (item: { text: string; href: string | null }) =>
        item.text && CTA_REGEX.test(item.text)
    )
    .slice(0, 20);

  const priceTexts = Array.from(new Set(textContent.match(PRICE_REGEX) || [])).slice(
    0,
    20
  );

  const shippingReturnsMentions = {
    shipping: /shipping|delivery|ship to/i.test(textContent),
    returns: /returns|return policy|refund/i.test(textContent),
    warranty: /warranty|guarantee/i.test(textContent),
  };

  const trustSignals = {
    reviews: /reviews|testimonials/i.test(textContent),
    ratings: /rating|stars/i.test(textContent),
    badges: /secure|ssl|trusted|verified|badge/i.test(textContent),
    guarantee: /money-back|guarantee|risk-free/i.test(textContent),
  };

  const images = $("img");
  const imagesCount = images.length;
  const missingAltCount = images.filter(
    (_, el: Element) => !$(el).attr("alt")
  ).length;

  const scriptsCount = $("script").length;
  const stylesCount = $("link[rel='stylesheet'], style").length;

  const totalTextLength = textContent.length;
  const mainTextSample = textContent.slice(0, 12000);

  const loweredHtml = html.toLowerCase();
  const detectedPlatform = loweredHtml.includes("cdn.shopify") ||
    loweredHtml.includes("myshopify")
    ? "shopify"
    : loweredHtml.includes("woocommerce") ||
        loweredHtml.includes("wp-content") ||
        loweredHtml.includes("wp-json")
      ? "woocommerce"
      : "unknown";

  return {
    finalUrl,
    title,
    metaDescription,
    h1,
    h2,
    ctas,
    priceTexts,
    shippingReturnsMentions,
    trustSignals,
    imagesCount,
    missingAltCount,
    scriptsCount,
    stylesCount,
    totalTextLength,
    mainTextSample,
    detectedPlatform,
  };
};

const scrapeWithPlaywright = async (url: string): Promise<ScrapedPage> => {
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(20000);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    const finalUrl = page.url();
    const html = await page.content();
    return extractFromHtml(html, finalUrl);
  } finally {
    await browser.close();
  }
};

const scrapeWithCheerio = async (url: string): Promise<ScrapedPage> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }

  const html = await response.text();
  return extractFromHtml(html, response.url);
};

export const scrapePage = async (url: string): Promise<ScrapedPage> => {
  try {
    return await scrapeWithPlaywright(url);
  } catch (error) {
    return await scrapeWithCheerio(url);
  }
};
