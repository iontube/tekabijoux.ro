import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const SITE_URL = 'https://tekabijoux.ro';

function main() {
  console.log('=== Generating Sitemaps ===\n');

  const kwData = JSON.parse(fs.readFileSync(path.join(rootDir, 'keywords.json'), 'utf-8'));
  const categories = kwData.categories || [];
  const completed = kwData.completed || [];
  const now = new Date().toISOString();

  // Find latest date
  let latestDate = now;
  for (const a of completed) {
    const d = a.modifiedDate || a.pubDate;
    if (d && d > latestDate) latestDate = d;
  }

  // --- post-sitemap.xml ---
  let postSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  const sortedArticles = [...completed].sort((a, b) =>
    new Date(b.modifiedDate || b.pubDate).getTime() - new Date(a.modifiedDate || a.pubDate).getTime()
  );

  for (const article of sortedArticles) {
    const slug = article.slug || article.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const lastmod = article.modifiedDate || article.pubDate;
    const pubDate = article.pubDate;
    postSitemap += `  <url>
    <loc>${SITE_URL}/${slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${SITE_URL}/images/articles/${slug}.webp</image:loc>
      <image:title>${escapeXml(article.keyword)}</image:title>
    </image:image>
  </url>\n`;
  }

  postSitemap += `</urlset>`;

  // --- category-sitemap.xml ---
  let categorySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/blog/', priority: '0.9', changefreq: 'daily' },
    { url: '/contact/', priority: '0.3', changefreq: 'yearly' },
    { url: '/sitemap/', priority: '0.3', changefreq: 'weekly' },
  ];

  for (const page of staticPages) {
    categorySitemap += `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  }

  for (const cat of categories) {
    categorySitemap += `  <url>
    <loc>${SITE_URL}/${cat.slug}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  categorySitemap += `</urlset>`;

  // --- sitemap_index.xml ---
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/post-sitemap.xml</loc>
    <lastmod>${latestDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/category-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  // --- sitemap.xsl ---
  const sitemapXsl = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html>
<head>
  <title>XML Sitemap - TekaBijoux</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; background: #FDFBF8; color: #2A2438; }
    h1 { color: #6D2B4F; font-size: 1.6rem; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; }
    .info { color: #7A7490; font-size: 0.9rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    th { background: #6D2B4F; color: white; padding: 12px 16px; text-align: left; font-size: 0.85rem; }
    td { padding: 10px 16px; border-bottom: 1px solid #E8E4DF; font-size: 0.88rem; }
    tr:hover td { background: #FDF2F6; }
    a { color: #6D2B4F; text-decoration: none; }
    a:hover { color: #C9A84C; }
    .count { font-weight: 600; color: #C9A84C; }
  </style>
</head>
<body>
  <h1>XML Sitemap</h1>
  <xsl:choose>
    <xsl:when test="sitemap:sitemapindex">
      <p class="info">Sitemap index cu <span class="count"><xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/></span> sitemaps.</p>
      <table>
        <tr><th>Sitemap</th><th>Ultima modificare</th></tr>
        <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
          <tr>
            <td><a><xsl:attribute name="href"><xsl:value-of select="sitemap:loc"/></xsl:attribute><xsl:value-of select="sitemap:loc"/></a></td>
            <td><xsl:value-of select="substring(sitemap:lastmod,1,10)"/></td>
          </tr>
        </xsl:for-each>
      </table>
    </xsl:when>
    <xsl:otherwise>
      <p class="info"><span class="count"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URL-uri in acest sitemap.</p>
      <table>
        <tr><th>URL</th><th>Prioritate</th><th>Imagini</th><th>Ultima modificare</th></tr>
        <xsl:for-each select="sitemap:urlset/sitemap:url">
          <tr>
            <td><a><xsl:attribute name="href"><xsl:value-of select="sitemap:loc"/></xsl:attribute><xsl:value-of select="sitemap:loc"/></a></td>
            <td><xsl:value-of select="sitemap:priority"/></td>
            <td><xsl:value-of select="count(image:image)"/></td>
            <td><xsl:value-of select="substring(sitemap:lastmod,1,10)"/></td>
          </tr>
        </xsl:for-each>
      </table>
    </xsl:otherwise>
  </xsl:choose>
</body>
</html>
</xsl:template>
</xsl:stylesheet>`;

  // Write files
  fs.writeFileSync(path.join(distDir, 'sitemap_index.xml'), sitemapIndex, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'post-sitemap.xml'), postSitemap, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'category-sitemap.xml'), categorySitemap, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'sitemap.xsl'), sitemapXsl, 'utf-8');
  injectImagesIntoAstroSitemap();

  console.log(`sitemap_index.xml - 2 sitemaps`);
  console.log(`post-sitemap.xml - ${sortedArticles.length} articles`);
  console.log(`category-sitemap.xml - ${staticPages.length + categories.length} pages`);
  console.log(`sitemap.xsl - stylesheet`);
  console.log('\n=== Sitemaps generated ===');
}

// Inject images into Astro's sitemap-0.xml
function injectImagesIntoAstroSitemap() {
  const sitemapPath = path.join(distDir, 'sitemap-0.xml');
  if (!fs.existsSync(sitemapPath)) return;

  let xml = fs.readFileSync(sitemapPath, 'utf-8');

  if (!xml.includes('xmlns:image')) {
    xml = xml.replace(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    );
  }

  let injected = 0;
  xml = xml.replace(/<url><loc>(https?:\/\/[^<]+)<\/loc><\/url>/g, (match, loc) => {
    const urlPath = new URL(loc).pathname.replace(/^\/|\/$/g, '');
    if (!urlPath || urlPath.includes('/')) return match;
    const imagePath = path.join(distDir, 'images', 'articles', `${urlPath}.webp`);
    if (fs.existsSync(imagePath)) {
      injected++;
      const origin = new URL(loc).origin;
      return `<url><loc>${loc}</loc><image:image><image:loc>${origin}/images/articles/${urlPath}.webp</image:loc></image:image></url>`;
    }
    return match;
  });

  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`Injected images into sitemap-0.xml: ${injected} articles`);
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

main();
