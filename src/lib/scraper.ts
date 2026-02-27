import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ScrapedPage } from "./types";

/* ────────────────────────── constants ────────────────────────── */

const CTA_REGEX =
  /(add to cart|buy now|checkout|get started|start|subscribe|shop now|order|try|claim|add to bag)/i;
const PRICE_REGEX = /(\$|€|£|¥|₹|CA\$|AU\$|USD|EUR|GBP)\s?\d{1,6}(?:[\d,]*)(?:\.\d{2})?/g;
const CURRENCY_REGEX = /(\$|€|£|¥|₹|CA\$|AU\$|USD|EUR|GBP)/;
const REVIEW_COUNT_REGEX = /(\d{1,6})\s*(?:reviews?|ratings?|verified buyers?)/i;
const ADD_TO_CART_REGEX = /add\s*to\s*(?:cart|bag)|buy\s*now/i;
const SHIPPING_RETURNS_REGEX =
  /(?:free\s+)?shipping|delivery|ship\s+to|returns?\s*(?:policy)?|refund|exchange|warrant|guarant/i;

const MAIN_TEXT_CAP = 12_000;
const ABOVE_FOLD_CAP = 2_000;
const SNIPPET_CAP = 500;

/* ────────────────────────── helpers ────────────────────────── */

const cleanText = (text: string) =>
  text.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

/**
 * Aggressively strip nav/footer/header repetition so the LLM doesn't
 * waste tokens on boilerplate.
 */
const stripBoilerplate = ($: cheerio.CheerioAPI): void => {
  $(
    "nav, footer, header, script, style, noscript, svg, iframe, .site-footer, .site-header, #shopify-section-header, #shopify-section-footer"
  ).remove();
};

/* ────────────────────────── extractor ────────────────────────── */

const extractFromHtml = (html: string, finalUrl: string): ScrapedPage => {
  const $ = cheerio.load(html);

  // Grab meta info BEFORE stripping boilerplate
  const title = cleanText($("title").first().text());
  const metaDescription = cleanText(
    $("meta[name='description']").attr("content") || ""
  );
  const canonicalUrl =
    $("link[rel='canonical']").attr("href") || null;
  const ogTitle =
    $("meta[property='og:title']").attr("content") || null;
  const ogDescription =
    $("meta[property='og:description']").attr("content") || null;
  const viewportMetaPresent = $("meta[name='viewport']").length > 0;

  // Link counts (before boilerplate removal for accuracy)
  let internalLinksCount = 0;
  let externalLinksCount = 0;
  try {
    const baseHost = new URL(finalUrl).hostname.replace(/^www\./, "");
    $("a[href]").each((_, el: Element) => {
      const href = $(el).attr("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      try {
        const linkHost = new URL(href, finalUrl).hostname.replace(/^www\./, "");
        if (linkHost === baseHost) internalLinksCount++;
        else externalLinksCount++;
      } catch {
        internalLinksCount++; // relative links count as internal
      }
    });
  } catch {
    // finalUrl might be malformed – skip link counting
  }

  // Image stats (before boilerplate removal)
  const images = $("img");
  const imagesCount = images.length;
  const missingAltCount = images.filter(
    (_, el: Element) => !$(el).attr("alt")
  ).length;

  const scriptsCount = $("script").length;
  const stylesCount = $("link[rel='stylesheet'], style").length;

  // Platform detection (before boilerplate removal)
  const loweredHtml = html.toLowerCase();
  const detectedPlatform = loweredHtml.includes("cdn.shopify") ||
    loweredHtml.includes("myshopify")
    ? "shopify"
    : loweredHtml.includes("woocommerce") ||
        loweredHtml.includes("wp-content") ||
        loweredHtml.includes("wp-json")
      ? "woocommerce"
      : "unknown";

  // Now strip boilerplate for text extraction
  stripBoilerplate($);

  const textContent = cleanText($("body").text());
  const totalTextLength = textContent.length;
  const mainTextSample = textContent.slice(0, MAIN_TEXT_CAP);

  // Word count
  const wordCountEstimate = textContent
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  // Headings
  const h1 = $("h1")
    .map((_, el: Element) => cleanText($(el).text()))
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, el: Element) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  // CTAs
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

  // Primary CTA (best guess – first CTA-like button text)
  const primaryCtaText = ctas.length > 0 ? ctas[0].text : null;

  // Add to cart detection
  const addToCartPresent = ADD_TO_CART_REGEX.test(textContent) ||
    $("form[action*='cart']").length > 0 ||
    $("[data-action='add-to-cart']").length > 0;

  // Prices
  const priceMatches = Array.from(new Set(textContent.match(PRICE_REGEX) || []));
  const priceTexts = priceMatches.slice(0, 20);
  const pricePresent = priceTexts.length > 0;
  const priceSample = pricePresent ? priceTexts[0] : null;

  // Currency detection
  const currencyMatch = textContent.match(CURRENCY_REGEX);
  const currencyDetected = currencyMatch ? currencyMatch[1] : null;

  // Shipping & returns
  const shippingReturnsMentions = {
    shipping: /shipping|delivery|ship to/i.test(textContent),
    returns: /returns|return policy|refund/i.test(textContent),
    warranty: /warranty|guarantee/i.test(textContent),
  };

  // Shipping/returns text sample
  let shippingReturnsTextSample: string | null = null;
  const srMatch = textContent.match(
    new RegExp(`.{0,120}${SHIPPING_RETURNS_REGEX.source}.{0,120}`, "i")
  );
  if (srMatch) {
    shippingReturnsTextSample = cleanText(srMatch[0]).slice(0, SNIPPET_CAP);
  }

  // Trust signals
  const trustSignals = {
    reviews: /reviews|testimonials/i.test(textContent),
    ratings: /rating|stars/i.test(textContent),
    badges: /secure|ssl|trusted|verified|badge/i.test(textContent),
    guarantee: /money-back|guarantee|risk-free/i.test(textContent),
  };

  // Reviews count hint
  const reviewCountMatch = textContent.match(REVIEW_COUNT_REGEX);
  const reviewsCountHint = reviewCountMatch
    ? parseInt(reviewCountMatch[1], 10)
    : null;

  // Above-fold text sample: first meaningful text blocks from <main> or first body children
  let aboveFoldTextSample = "";
  const mainEl = $("main, [role='main'], #main, .main-content, #MainContent");
  if (mainEl.length > 0) {
    aboveFoldTextSample = cleanText(mainEl.first().text()).slice(
      0,
      ABOVE_FOLD_CAP
    );
  }
  if (!aboveFoldTextSample) {
    // Fallback: first significant text paragraphs
    const paras: string[] = [];
    $("p, h1, h2, h3").each((_, el: Element) => {
      if (paras.join(" ").length >= ABOVE_FOLD_CAP) return false;
      const t = cleanText($(el).text());
      if (t.length > 10) paras.push(t);
    });
    aboveFoldTextSample = paras.join(" ").slice(0, ABOVE_FOLD_CAP);
  }

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
    // v2 signals
    canonicalUrl,
    ogTitle,
    ogDescription,
    viewportMetaPresent,
    wordCountEstimate,
    aboveFoldTextSample,
    primaryCtaText,
    addToCartPresent,
    pricePresent,
    priceSample,
    shippingReturnsTextSample,
    reviewsCountHint,
    currencyDetected,
    internalLinksCount,
    externalLinksCount,
  };
};

/* ────────────────────────── scrape strategies ────────────────────────── */

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
  } catch {
    return await scrapeWithCheerio(url);
  }
};
