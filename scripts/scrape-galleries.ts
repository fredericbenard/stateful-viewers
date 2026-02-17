/**
 * Scrape gallery and image data from fredericbenard.com
 * Run: npm run scrape
 *
 * Environment variables (useful while iterating locally):
 * - SCRAPE_BASE=http://localhost:8080
 * - SCRAPE_LOCALE_PREFIX=/en        (set to empty string for legacy no-locale paths)
 * - SCRAPE_LOCALE_PREFIXES=/en,/fr  (comma-separated)
 * - SCRAPE_GALLERY_EXT=.html        (set to empty string for legacy no-extension paths)
 */

const BASE = (process.env.SCRAPE_BASE ?? "https://fredericbenard.com").replace(
  /\/$/,
  ""
);

function normalizeLeadingSlash(value: string): string {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

const LOCALE_PREFIXES = (process.env.SCRAPE_LOCALE_PREFIXES ??
  process.env.SCRAPE_LOCALE_PREFIX ??
  "/en,/fr")
  .split(",")
  .map((s) => normalizeLeadingSlash(s.trim()))
  .filter(Boolean)
  .map((s) => s.replace(/\/$/, ""));

const GALLERY_EXT = process.env.SCRAPE_GALLERY_EXT ?? ".html";

function localeCodeFromPrefix(prefix: string): string {
  const cleaned = prefix.replace(/^\//, "").trim();
  return cleaned || "legacy";
}

function buildGalleryPath(
  localePrefix: string,
  eraSegment: string,
  galleryId: string
): string {
  return `${localePrefix}/${eraSegment}/galleries/${galleryId}${GALLERY_EXT}`;
}

const GALLERY_CONFIG: {
  eraSegment: string;
  imagePrefix: string | string[]; // /images/digital, /images/analog, or both for mixed galleries
  galleries: { id: string }[];
}[] = [
  {
    eraSegment: "film_years",
    imagePrefix: "/images/analog",
    galleries: [
      { id: "portraits" },
      { id: "parties" },
      { id: "experiments" },
      { id: "colour" },
    ],
  },
  {
    eraSegment: "digital_years",
    imagePrefix: "/images/digital",
    galleries: [
      { id: "traces_of_industry" },
      { id: "red_cities" },
      { id: "vivid_spaces" },
      { id: "urban_patterns" },
      { id: "minimal_structures" },
      { id: "vacant_geometries" },
    ],
  },
  {
    eraSegment: "current_projects",
    imagePrefix: ["/images/analog", "/images/digital"],
    galleries: [
      { id: "building_portraits" },
      { id: "rhythm" },
      { id: "minimalism" },
      { id: "night" },
      { id: "backlot_geometry" },
      { id: "walls" },
    ],
  },
];

interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  sensitive?: {
    type: "artistic_nudity";
  };
}

interface Gallery {
  id: string;
  name: string;
  description: string;
  era: string;
  images: GalleryImage[];
}

interface ImageWithCaption {
  url: string;
  caption?: string;
}

const SENSITIVE_IMAGE_IDS_BY_GALLERY: Record<string, Set<string>> = {
  // Curated sensitive-content flags for public demo handling.
  portraits: new Set(["4", "6", "11"]),
};

function isSensitiveImage(galleryId: string, imageId: string): boolean {
  const ids = SENSITIVE_IMAGE_IDS_BY_GALLERY[galleryId];
  return !!ids?.has(imageId);
}

function extractImagesWithCaptions(
  html: string,
  imagePrefix: string | string[]
): ImageWithCaption[] {
  const prefixes = Array.isArray(imagePrefix) ? imagePrefix : [imagePrefix];
  const prefixPattern = prefixes
    .map((p) => p.replace(/\//g, "\\/"))
    .join("|");
  const pathPattern = `(?:(?:${prefixPattern})[^"]+\\.(?:jpg|jpeg|png))`;
  const captionByPath = new Map<string, string>();

  // First pass: build path -> caption map from tags with data-caption
  const withCaptionRegex = new RegExp(
    `<a\\s+[^>]*href="(?:https?:\\/\\/[^"]+)?(${pathPattern})"[^>]*data-caption="([^"]*)"[^>]*>`,
    "gi"
  );
  let m;
  while ((m = withCaptionRegex.exec(html)) !== null) {
    const path = m[1];
    const caption = decodeHtmlEntities((m[2] ?? "").replace(/<[^>]+>/g, "").trim());
    if (path && !path.includes("_thumb") && !path.includes("/thumbs/")) {
      captionByPath.set(path, caption);
    }
  }

  // Second pass: get all paths in document order, attach captions
  const results: ImageWithCaption[] = [];
  const seen = new Set<string>();
  const pathRegex = new RegExp(
    `href="(?:https?:\\/\\/[^"]+)?(${pathPattern})"`,
    "gi"
  );
  while ((m = pathRegex.exec(html)) !== null) {
    const path = m[1];
    if (
      path &&
      !path.includes("_thumb") &&
      !path.includes("/thumbs/") &&
      !seen.has(path)
    ) {
      seen.add(path);
      const caption = captionByPath.get(path);
      results.push({ url: path, caption: caption || undefined });
    }
  }
  return results;
}

function decodeHtmlEntities(input: string): string {
  return (
    input
      // numeric entities: &#123;
      .replace(/&#(\d+);/g, (_, num) => {
        const code = Number(num);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      // hex entities: &#x1F600;
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      // common named entities
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function extractDescription(html: string): string {
  const match = html.match(/<meta name="description" content="([^"]+)"/i);
  if (match) return decodeHtmlEntities(match[1]);

  const pMatch = html.match(
    /<div class="gallery-description">[\s\S]*?<p>([\s\S]*?)<\/p>/i
  );
  if (pMatch)
    return decodeHtmlEntities(pMatch[1].replace(/<[^>]+>/g, "").trim());

  return "";
}

function extractBreadcrumbEraLabel(html: string): string {
  // Example:
  // <nav class="gallery-breadcrumb" ...>
  //   <a href="/fr/digital_years/">Numérique</a>
  const match = html.match(
    /<nav\s+class="gallery-breadcrumb"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i
  );
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractBreadcrumbGalleryName(html: string): string {
  const match = html.match(
    /<span\s+class="gallery-breadcrumb-current"\s*>([^<]+)<\/span>/i
  );
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractGalleryNameFromTitle(html: string): string {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  const title = decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
  // Typical formats:
  // - "Frédéric Bénard : Années numériques — Traces d’industrie"
  // - "Frederic Benard : Digital Years — Traces of Industry"
  const parts = title.split("—").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  const hyphenParts = title.split("-").map((s) => s.trim()).filter(Boolean);
  if (hyphenParts.length >= 2) return hyphenParts[hyphenParts.length - 1];
  return title;
}

function fallbackEraLabel(localePrefix: string, eraSegment: string): string {
  const code = localeCodeFromPrefix(localePrefix);
  if (code === "fr") {
    if (eraSegment === "film_years") return "Film";
    if (eraSegment === "digital_years") return "Numérique";
    if (eraSegment === "current_projects") return "Travaux récents";
  }
  if (eraSegment === "film_years") return "Film";
  if (eraSegment === "digital_years") return "Digital";
  if (eraSegment === "current_projects") return "Current Work";
  return eraSegment;
}

async function fetchGallery(
  config: (typeof GALLERY_CONFIG)[0],
  gallery: { id: string },
  localePrefix: string
): Promise<Gallery> {
  const primaryPath = buildGalleryPath(localePrefix, config.eraSegment, gallery.id);
  const primaryUrl = BASE + primaryPath;
  let res = await fetch(primaryUrl);

  // Backward-compatible fallback for the legacy (no-locale, no-extension) structure.
  // This makes `npm run scrape` work against both the current deployed site and the
  // in-progress localized rebuild without needing env toggles.
  if (!res.ok && res.status === 404 && localePrefix) {
    const legacyPath = `/${config.eraSegment}/galleries/${gallery.id}`;
    const legacyUrl = BASE + legacyPath;
    const legacyRes = await fetch(legacyUrl);
    if (legacyRes.ok) {
      res = legacyRes;
    }
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch ${primaryUrl}: ${res.status}`);
  }

  const html = await res.text();
  const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

  const eraLabel =
    extractBreadcrumbEraLabel(htmlWithoutComments) ||
    fallbackEraLabel(localePrefix, config.eraSegment);
  const galleryName =
    extractBreadcrumbGalleryName(htmlWithoutComments) ||
    extractGalleryNameFromTitle(htmlWithoutComments) ||
    gallery.id;

  const imagesWithCaptions = extractImagesWithCaptions(
    htmlWithoutComments,
    config.imagePrefix
  );
  const description = extractDescription(html) || `${galleryName} — ${eraLabel}`;

  const images: GalleryImage[] = imagesWithCaptions.map((img, i) => {
    const imageId = String(i + 1);
    const image: GalleryImage = {
      id: imageId,
      url: img.url,
      caption: img.caption,
    };
    if (isSensitiveImage(gallery.id, imageId)) {
      image.sensitive = { type: "artistic_nudity" };
    }
    return image;
  });

  return {
    id: gallery.id,
    name: galleryName,
    description,
    era: eraLabel,
    images,
  };
}

async function main() {
  const fs = await import("fs");
  const path = await import("path");

  for (const localePrefix of LOCALE_PREFIXES) {
    const allGalleries: Gallery[] = [];
    const code = localeCodeFromPrefix(localePrefix);

    console.log(`\n--- Scraping locale prefix "${localePrefix || "(none)"}" (${code}) ---\n`);

    for (const config of GALLERY_CONFIG) {
      for (const gallery of config.galleries) {
        try {
          const data = await fetchGallery(config, gallery, localePrefix);
          if (data.images.length > 0) {
            allGalleries.push(data);
            console.log(`✓ ${data.era} / ${data.name}: ${data.images.length} images`);
          } else {
            console.warn(
              `⚠ ${data.era} / ${data.name}: no images found (check imagePrefix)`
            );
          }
        } catch (err) {
          console.error(`✗ ${config.eraSegment} / ${gallery.id}:`, err);
        }
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      galleries: allGalleries,
    };

    const outPath = path.join(
      process.cwd(),
      "src",
      "data",
      `galleries.${code}.json`
    );
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\nWrote ${allGalleries.length} galleries to ${outPath}`);

  }
}

main().catch(console.error);
