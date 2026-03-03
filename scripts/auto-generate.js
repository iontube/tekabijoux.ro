import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Ensure node/npm/npx are in PATH for cron
const nodeBinDir = path.dirname(process.execPath);
process.env.PATH = `${nodeBinDir}:${process.env.PATH || '/usr/bin:/bin'}`;

// Load .env
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      process.env[key.trim()] = valParts.join('=').trim();
    }
  }
}

const ARTICLES_PER_RUN = parseInt(process.env.ARTICLES_PER_RUN || '1', 10);
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'tekabijoux-ro';

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(rootDir, 'generation.log'), line + '\n');
}

// Check if enough time has passed since last article (minimum 12 hours)
function shouldRunToday(keywordsPath) {
  try {
    const keywordsData = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
    const completed = keywordsData.completed || [];
    if (completed.length === 0) return true;

    // Find the most recent article date
    let lastDate = null;
    for (const item of completed) {
      const d = item.date || item.pubDate;
      if (d) {
        const parsed = new Date(d);
        if (!lastDate || parsed > lastDate) lastDate = parsed;
      }
    }

    if (!lastDate) return true;

    const daysSinceLast = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    // Skip only if already posted today (use 0.5 days to avoid timing issues with daily cron)
    if (daysSinceLast < 0.5) return false;
    return true;
  } catch (e) {
    return true; // If can't read, run anyway
  }
}

// Generate stats.json with article count for the panou sync
function generateStats() {
  const pagesDir = path.join(rootDir, 'src', 'pages');
  const publicDir = path.join(rootDir, 'public');
  const excludePages = new Set(['index', 'contact', 'cookies', 'privacy-policy', 'privacy', 'gdpr', 'sitemap', '404', 'about', 'terms']);

  const files = fs.readdirSync(pagesDir);
  const articles = files.filter(f => {
    if (!f.endsWith('.astro')) return false;
    const name = f.replace('.astro', '');
    if (name.startsWith('[')) return false;
    if (excludePages.has(name)) return false;
    return true;
  });

  const stats = { articlesCount: articles.length, lastUpdated: new Date().toISOString() };
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'stats.json'), JSON.stringify(stats, null, 2));
  log(`Stats generated: ${articles.length} articles`);
}

async function main() {
  log('=== Auto-generate started ===');

  // Check if we should run today (minimum 12 hours since last article)
  if (!shouldRunToday(path.join(rootDir, 'keywords.json'))) {
    log('Last article was less than 12 hours ago. Skipping.');
    return;
  }

  // Random delay 0-45 minutes to avoid patterns
  const delayMs = Math.floor(Math.random() * 20 * 60 * 1000);
  const delayMin = Math.round(delayMs / 60000);
  log(`Random delay: ${delayMin} minutes`);
  await new Promise(r => setTimeout(r, delayMs));

  const kwPath = path.join(rootDir, 'keywords.json');
  const kwData = JSON.parse(fs.readFileSync(kwPath, 'utf-8'));
  const pending = kwData.pending || [];
  const categories = kwData.categories || [];

  if (pending.length === 0) {
    log('No pending articles. Exiting.');
    return;
  }

  // Round-robin category selection
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const catIndex = dayOfYear % categories.length;
  const targetCat = categories[catIndex];
  log(`Today's category rotation: ${targetCat.name} (index ${catIndex})`);

  // Select articles from target category first, fallback to any
  const catPending = pending.filter(a => a.categorySlug === targetCat.slug);
  const selected = catPending.length > 0
    ? catPending.slice(0, ARTICLES_PER_RUN)
    : pending.slice(0, ARTICLES_PER_RUN);

  log(`Selected ${selected.length} articles for generation`);

  // Write temp file
  const tempPath = path.join(rootDir, 'temp-articles.json');
  fs.writeFileSync(tempPath, JSON.stringify(selected, null, 2));

  try {
    // Generate articles
    log('Running generate-batch.js...');
    execSync('node scripts/generate-batch.js', {
      cwd: rootDir,
      stdio: 'inherit',
      timeout: 300000,
    });

    // Generate stats.json before build
    generateStats();

    // Build site
    log('Building site...');
    execSync('npm run build', {
      cwd: rootDir,
      stdio: 'inherit',
      timeout: 120000,
    });

    // Deploy with retry
    let deployed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        log(`Deploy attempt ${attempt}...`);
        execSync(`npx wrangler pages deploy dist --project-name ${PROJECT_NAME}`, {
          cwd: rootDir,
          stdio: 'inherit',
          timeout: 120000,
        });
        deployed = true;
        log('Deploy successful!');
        break;
      } catch (deployErr) {
        log(`Deploy attempt ${attempt} failed: ${deployErr.message}`);
        if (attempt < 3) {
          const waitMs = attempt * 30000;
          log(`Waiting ${waitMs / 1000}s before retry...`);
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }

    if (!deployed) {
      log('ERROR: All deploy attempts failed');
    }
  } catch (err) {
    log(`ERROR: ${err.message}`);
  }

  // Cleanup
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  log('=== Auto-generate finished ===\n');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
