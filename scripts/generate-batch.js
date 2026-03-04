import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env for standalone usage
try {
  const envContent = fs.readFileSync(path.join(rootDir, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
} catch (e) {}

// --- API Keys ---
const GEMINI_KEYS = [
  'AIzaSyAbRzbs0WRJMb0gcojgyJlrjqOPr3o2Cmk',
  'AIzaSyDZ2TklBMM8TU3FA6aIS8vdUc-2iMyHWaM',
  'AIzaSyBdmChQ0ARDdDAqSMSlDIit_xz5ucrWjkY',
  'AIzaSyAE57AIwobFO4byKbeoa-tVDMV5lMgcAxQ',
  'AIzaSyBskPrKeQvxit_Rmm8PG_NO0ZhMQsrktTE',
  'AIzaSyAkUcQ3YiD9cFiwNh8pkmKVxVFxEKFJl2Q',
  'AIzaSyDnX940N-U-Sa0202-v3_TOjXf42XzoNxE',
  'AIzaSyAMl3ueRPwzT1CklxkylmTXzXkFd0A_MqI',
  'AIzaSyA82h-eIBvHWvaYLoP26zMWI_YqwT78OaI',
  'AIzaSyBRI7pd1H2EdCoBunJkteKaCDSH3vfqKUg',
  'AIzaSyA3IuLmRWyTtygsRJYyzHHvSiTPii-4Dbk',
  'AIzaSyB6RHadv3m1WWTFKb_rB9ev_r4r2fM9fNU',
  'AIzaSyCexyfNhzT2py3FLo3sXftqKh0KUdAT--A',
  'AIzaSyC_SN_RdQ2iXzgpqng5Byr-GU5KC5npiAE',
  'AIzaSyBOV9a_TmVAayjpWemkQNGtcEf_QuiXMG0',
  'AIzaSyCFOafntdykM82jJ8ILUqY2l97gdOmwiGg',
  'AIzaSyACxFhgs3tzeeI5cFzrlKmO2jW0l8poPN4',
  'AIzaSyBhZXBhPJCv9x8jKQljZCS4b5bwF3Ip3pk',
  'AIzaSyDF7_-_lXcAKF81SYpcD-NiA5At4Bi8tp8',
  'AIzaSyAwinD7oQiQnXeB2I5kyQsq_hEyJGhSrNg',
];

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

let geminiKeyIndex = 0;
function getNextGeminiKey() {
  const key = GEMINI_KEYS[geminiKeyIndex % GEMINI_KEYS.length];
  geminiKeyIndex++;
  return key;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[àáâăä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripStrong(str) {
  return str.replace(/<\/?strong>/g, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Gemini Translation ---
async function translateToEnglish(text) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const apiKey = getNextGeminiKey();
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Translate the following Romanian text to English. Return ONLY the English translation, nothing else:\n\n${text}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      }
      console.error(`  Translation attempt ${attempt + 1} failed: no candidates`);
    } catch (error) {
      console.error(`  Translation attempt ${attempt + 1} error: ${error.message}`);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
  }
  return text;
}

// --- Gemini Article Generation ---
async function generateArticleContent(keyword, category, completedArticles = []) {
  const apiKey = getNextGeminiKey();
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;


  // Build interlink list from completed articles
  const currentSlug = keyword.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const interlinkCandidates = completedArticles
    .filter(a => a.keyword !== keyword)
    .map(a => {
      const aSlug = a.keyword.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return { title: a.keyword.charAt(0).toUpperCase() + a.keyword.slice(1), slug: aSlug, category: a.category, categorySlug: a.categorySlug };
    });
  // Prioritize same category, then others, max 15
  const sameCategory = interlinkCandidates.filter(a => a.categorySlug === completedArticles.find(c => c.keyword === keyword)?.categorySlug);
  const otherCategory = interlinkCandidates.filter(a => !sameCategory.includes(a));
  const interlinkList = [...sameCategory, ...otherCategory].slice(0, 15)
    .map(a => `- <a href="/${a.slug}/">${a.title}</a> (categorie: ${a.category})`)
    .join('\n');

const prompt = `Scrii articole pe un site romanesc despre bijuterii, accesorii si cadouri - inele, bratari, coliere, cercei din aur, argint si pietre pretioase. Stilul e informativ dar directionat spre conversie - ajuti cititorul sa ia o decizie de cumparare. NU esti un AI.

Keyword: "${keyword}"
Categorie: "${category}"

GENEREAZA un articol complet in format JSON. Articolul trebuie sa fie informativ, natural, scris de un om care chiar stie domeniul. Fara diacritice. Intre 1500-2500 de cuvinte.

=== TONUL SI STILUL ===

INTRO:
- Prima propozitie = raspunsul direct, concret, fara introducere, fara "bun venit", fara preambul. Userul vrea raspunsul ACUM.
- Intro-ul are 2-3 paragrafe care dau context, recomandarea principala si de ce merita sa citeasca mai departe.

REVIEW-URI PRODUSE:
- Fiecare produs are review individual: paragraf de text natural (nu lista), urmat de pros/cons.
- Mentioneaza specs reale: material, greutate, dimensiuni, certificari, stil.
- Tonul e ca si cum ai povesti unui prieten ce ti-a placut si ce nu la fiecare bijuterie.
- Include anecdote: "am purtat inelul asta o luna intreaga", "o prietena si-a luat colierul si dupa 3 luni..."

CONVERSIE:
- Ghidul de cumparare ajuta cititorul sa ia decizia finala.
- Fiecare sectiune se incheie subtil cu un indemn spre actiune, fara a fi agresiv.

=== ANTI-AI (FOARTE IMPORTANT) ===
Articolul TREBUIE sa para scris de un om real. Reguli concrete:
- INTERZIS TOTAL: "in era actuala", "descopera", "fara indoiala", "ghid complet", "concluzie", "in concluzie", "in acest articol", "hai sa exploram", "sa aprofundam", "merita mentionat", "este esential", "este crucial", "o alegere excelenta", "In primul rand", "De asemenea", "Cu toate acestea", "Nu in ultimul rand"
- INTERZIS: liste de 3 adjective consecutive, inceperea a doua propozitii la rand cu acelasi cuvant
- IMPERFECTIUNI NATURALE: "bon, stai", "cum sa zic", "pana la urma", "na, asta e", "ma rog", "zic si eu"
- Amesteca propozitii FOARTE scurte (3-5 cuvinte) cu propozitii lungi (18-22 cuvinte)
- Limbaj conversational: "na", "uite", "stai putin", "pe bune", "sincer", "daca ma intrebi pe mine"
- Include critici ONESTE: fiecare produs minim 1-2 minusuri reale
- Recunoaste incertitudine: "n-am testat personal, dar din ce am auzit..."
- Vorbeste ca pe un forum romanesc, nu ca o enciclopedie

=== PARAGRAFE CU INTREBARI ===
- MAXIM 3-4 propozitii per paragraf
- Alterna: un paragraf lung (3-4 prop), unul scurt (1-2 prop), unul mediu
- Foloseste bullet points (<ul><li>) pentru liste
- Pune keyword-ul principal si variatiile in <strong> (4-6 ori in tot articolul)
- NICIODATA <strong> in titluri, intrebari FAQ sau TOC

=== STRUCTURA JSON ===
Returneaza DOAR JSON valid, fara markdown, fara \`\`\`:
{
  "intro": "<p>Paragraf introductiv direct, fara preambul. Raspunsul la ce cauta userul.</p><p>Context si recomandare principala.</p>",
  "items": [
    {
      "name": "Numele produsului (ex: Inel de logodna cu diamant 0.5ct aur 14K)",
      "specs": {
        "material": "ex: aur 14K / argint 925 / otel inoxidabil placat cu aur",
        "greutate": "ex: 3.5g",
        "dimensiuni": "ex: diametru 18mm, lungime lant 45cm",
        "certificari": "ex: marcaj 585, certificat de autenticitate",
        "stil": "ex: minimalist / vintage / boho / elegant clasic"
      },
      "review": "HTML cu <p>, review ca un om real. Experienta personala, detalii concrete, la ce sa te astepti.",
      "pros": ["avantaj real 1", "avantaj real 2", "avantaj real 3"],
      "cons": ["dezavantaj real 1", "dezavantaj real 2"]
    }
  ],
  "comparison": {
    "heading": "Titlu comparatie cu keyword integrat",
    "rows": [
      {"model":"...", "material":"...", "greutate":"...", "dimensiuni":"...", "stil":"...", "potrivitPentru":"..."}
    ]
  },
  "guide": {
    "heading": "Titlu ghid cumparare cu keyword",
    "content": "HTML cu <p>, <h4>, <ul>/<li>. Ghid practic de cumparare: pe ce sa te uiti, ce sa eviti, sfaturi de insider."
  },
  "faq": [
    {
      "question": "Intrebare EXACT cum ar tasta-o un roman in Google",
      "answer": "Prima propozitie = raspuns direct. Apoi 1-2 propozitii cu detalii si cifre. 40-70 cuvinte."
    }
  ]
}

=== CERINTE PRODUSE ===
- 5-7 produse cu specs REALE (material, greutate, dimensiuni, certificari, stil)
- Preturi in LEI, realiste pentru piata din Romania
- Review natural, ca o poveste, nu ca o fisa tehnica
- Minim 2 cons per produs (dezavantaje reale, nu false)
- Specs reale: marcaj 585/750 pentru aur, 925 pentru argint, greutati in grame, dimensiuni in mm/cm

=== CERINTE FAQ ===
- 5 intrebari formatate cum le tasteaza oamenii in Google Romania
- Formulari naturale: "cat costa...", "care e diferenta intre...", "merita sa...", "cum sa..."
- Raspunsuri cu structura featured snippet: raspuns direct + detalii cu cifre
- Acoperiti: pret, comparatie, durabilitate, intretinere, autenticitate

=== REGULI ===
- Scrie FARA diacritice (fara ă, î, ș, ț, â)
- Preturile in LEI, realiste
- Comparison: minim 4 randuri, coloane din specs
- Guide: minim 300 cuvinte, sfaturi practice de cumparare bijuterii

${interlinkList.length > 0 ? `
=== INTERLINK-URI INTERNE (SEO) ===
Mentioneaza NATURAL in text 2-4 articole de pe site, cu link-uri <a href="/{slug}/">{titlu}</a>.
Integreaza in propozitii, NU ca lista separata. Max 4 link-uri. Doar unde are sens contextual.
NU forta link-uri daca nu au legatura cu subiectul. Mai bine 0 link-uri decat link-uri fortate.

Articole disponibile:
${interlinkList}` : ''}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      console.log(`  Generating content (attempt ${attempt + 1})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 20000 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.log(`  Gemini API error (${response.status}): ${errText.substring(0, 200)}`);
        await sleep(4000);
        continue;
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        console.log('  Empty response from Gemini');
        await sleep(3000);
        continue;
      }

      // Clean markdown wrappers
      text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      // Extract JSON object if there's extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }

      const content = JSON.parse(text);

      if (!content.intro || !content.items || !content.faq) {
        console.log('  Invalid content structure, retrying...');
        await sleep(2000);
        continue;
      }

      return content;
    } catch (err) {
      console.log(`  Generation error: ${err.message}`);
      await sleep(3000);
    }
  }

  throw new Error(`Failed to generate content for: ${keyword}`);
}

// --- Image Generation ---

// Strip brand names from image prompt to avoid Cloudflare AI content filter
function stripBrands(text) {
  return text
    .replace(/\b[A-Z][a-z]+[A-Z]\w*/g, '')  // camelCase brands: HyperX, PlayStation
    .replace(/\b[A-Z]{2,}\b/g, '')            // ALL CAPS: ASUS, RGB, LED
    .replace(/\s{2,}/g, ' ')                   // collapse double spaces
    .trim();
}

// Use Gemini to rephrase a title into a generic description without brand names
async function rephraseWithoutBrands(text) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const apiKey = getNextGeminiKey();
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Rephrase the following into a short, generic English description for an image prompt. Remove ALL brand names, trademarks, product names, and game names. Replace them with generic descriptions of what they are. Return ONLY the rephrased text, nothing else.\n\nExample: "Boggle classic word game" -> "classic letter dice word game on a table"\nExample: "Kindle Paperwhite review" -> "slim e-reader device with paper-like screen"\nExample: "Duolingo app for learning languages" -> "colorful language learning mobile app interface"\n\nText: "${text}"` }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 100 }
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const result = data.candidates[0].content.parts[0].text.trim();
        console.log(`  Rephrased prompt (no brands): ${result}`);
        return result;
      }
    } catch (error) {
      console.error(`  Rephrase attempt ${attempt + 1} error: ${error.message}`);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
  }
  // Fallback to basic stripBrands
  return stripBrands(text);
}

// Use Gemini to generate a safe image prompt that avoids content-policy triggers
async function generateSafePrompt(text, categorySlug) {
  const categoryFallbacks = {
    'ceasuri-de-mana': 'elegant wristwatch on dark leather surface, dramatic studio lighting, luxurious mood',
    'bijuterii-din-aur': 'elegant gold jewelry pieces on dark velvet surface, warm golden studio lighting',
    'bijuterii-din-argint': 'elegant silver jewelry pieces on dark velvet surface, cool silver studio lighting',
    'verighete-si-logodna': 'wedding rings on soft fabric, dreamy warm bokeh lighting, romantic mood',
    'accesorii-fashion': 'stylish fashion accessories on marble surface, modern studio lighting, chic mood',
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const apiKey = getNextGeminiKey();
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Create a short, safe English image prompt for a stock photo related to this topic. The prompt must describe ONLY objects, scenery, and atmosphere. NEVER mention people, children, babies, faces, hands, or any human body parts. NEVER use brand names. Focus on products, objects, books, devices, furniture, or abstract scenes. Return ONLY the description.\n\nTopic: "${text}"` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const result = data.candidates[0].content.parts[0].text.trim();
        console.log(`  Safe prompt generated: ${result}`);
        return result;
      }
    } catch (error) {
      console.error(`  Safe prompt attempt ${attempt + 1} error: ${error.message}`);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
  }
  // Fallback to category-specific safe description
  return categoryFallbacks[categorySlug] || 'assorted elegant jewelry and accessories on a dark velvet surface, soft studio lighting';
}

async function generateImage(titleRo, slug, categorySlug) {
  const categoryPrompts = {
    'ceasuri-de-mana': 'elegant watch photography on dark leather surface, dramatic studio lighting with soft reflections, luxurious mood',
    'bijuterii-din-aur': 'elegant gold jewelry photography on dark velvet surface, dramatic studio lighting with warm golden reflections, luxurious mood',
    'bijuterii-din-argint': 'elegant silver jewelry photography on dark velvet surface, dramatic studio lighting with cool silver reflections, sophisticated mood',
    'verighete-si-logodna': 'romantic wedding ring photography on soft fabric, dreamy warm lighting with bokeh, elegant and romantic mood',
    'accesorii-fashion': 'stylish fashion accessory photography on marble surface, modern studio lighting, chic and trendy mood',
  };

  console.log(`  Generating image for: ${titleRo}`);

  const MAX_IMAGE_RETRIES = 4;
  let promptFlagged = false;

  for (let attempt = 1; attempt <= MAX_IMAGE_RETRIES; attempt++) {

    if (attempt > 1) {

      console.log(`  Image retry attempt ${attempt}/${MAX_IMAGE_RETRIES}...`);

      await new Promise(r => setTimeout(r, 3000 * attempt));

    }


  try {
    const titleEn = await translateToEnglish(titleRo);
    console.log(`  Translated title: ${titleEn}`);

    let prompt;
    if (attempt >= 3) {
      const safeSubject = await generateSafePrompt(titleEn, categorySlug);
      prompt = `Realistic photograph of ${safeSubject}, no text, no writing, no words, no letters, no numbers. Photorealistic, high quality, professional photography.`;
      console.log(`  Using safe prompt (attempt ${attempt}): ${prompt}`);
    } else {
      const setting = categoryPrompts[categorySlug] || 'in a modern home setting, soft natural lighting, clean contemporary background';
      const subject = promptFlagged ? await rephraseWithoutBrands(titleEn) : titleEn;
      prompt = `Realistic photograph of ${subject} ${setting}, no text, no brand name, no writing, no words, no letters, no numbers. Photorealistic, high quality, professional product photography.`;
    }

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('steps', '20');
    formData.append('width', '1024');
    formData.append('height', '768');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-dev`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  Image API error: ${response.status} - ${errorText.slice(0, 200)}`);
      if (errorText.includes('flagged')) promptFlagged = true;
      continue;
    }

    const data = await response.json();
    if (!data.result?.image) {
      console.error('  No image in response');
      continue;
    }

    const imageBuffer = Buffer.from(data.result.image, 'base64');

    // Compress with Sharp
    const sharp = (await import('sharp')).default;
    const outputPath = path.join(rootDir, 'public', 'images', 'articles', `${slug}.webp`);
    await sharp(imageBuffer)
      .resize(800, 600, { fit: 'cover' })
      .webp({ quality: 82, effort: 6 })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`  Image saved: ${slug}.webp (${(stats.size / 1024).toFixed(1)}KB)`);
    return true;
  } catch (error) {
    console.error(`  Image generation error: ${error.message}`);
    continue;
  }


  }

  console.error('  Image generation failed after all retries');

  return null;
}

// --- Markdown/HTML Processing ---
function processContent(html) {
  // Strip years for evergreen content
  html = html.replace(/\s+in\s+(2024|2025|2026)/gi, ' acum');
  html = html.replace(/\s+din\s+(2024|2025|2026)/gi, ' actuale');

  // Convert markdown bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert markdown lists
  html = html.replace(/^[\s]*[-*]\s+(.+)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Split long paragraphs
  html = html.replace(/<p>([\s\S]*?)<\/p>/g, (match, content) => {
    if (content.length > 800) {
      const sentences = content.split(/(?<=[.!?])\s+/);
      const mid = Math.ceil(sentences.length / 2);
      return `<p>${sentences.slice(0, mid).join(' ')}</p>\n<p>${sentences.slice(mid).join(' ')}</p>`;
    }
    return match;
  });

  return html;
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '');
}

function escapeForFrontmatter(str) {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// --- Create Astro Article Page ---
function createArticlePage(article, content, kwData) {
  const slug = article.slug;
  const keyword = article.keyword;
  const category = article.category;
  const categorySlug = article.categorySlug;
  const catInfo = kwData.categories.find(c => c.slug === categorySlug);
  const author = catInfo?.author || { name: 'Redactia', role: 'Editor', bio: '' };
  const pubDate = article.pubDate;
  const modifiedDate = article.modifiedDate;

  // Extract excerpt from first <p> tag of intro
  const excerptMatch = content.intro.match(/<p>([\s\S]*?)<\/p>/);
  const excerpt = excerptMatch ? stripHtml(excerptMatch[1]) : stripHtml(content.intro).substring(0, 200);

  // Process intro HTML
  const introHtml = processContent(content.intro);

  // Build items HTML
  const itemsHtml = content.items.map((item, i) => {
    const specsGrid = Object.entries(item.specs || {}).map(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return `<div class="product-review__spec"><strong>${label}</strong>${val}</div>`;
    }).join('\n            ');

    const reviewContent = processContent(item.review);

    const prosList = (item.pros || []).map(p => `<li>${p}</li>`).join('\n              ');
    const consList = (item.cons || []).map(c => `<li>${c}</li>`).join('\n              ');

    return `<div class="product-review" id="produs-${i + 1}">
          <div class="product-review__header">
            <span class="section-tag">Produs #${i + 1}</span>
            <h3>${stripStrong(item.name)}</h3>
            <div class="product-review__specs-grid">
            ${specsGrid}
            </div>
          </div>
          <div class="product-review__content">
            ${reviewContent}
            <div class="product-review__lists">
              <div>
                <h4>Avantaje</h4>
                <ul class="product-review__pros">
              ${prosList}
                </ul>
              </div>
              <div>
                <h4>Dezavantaje</h4>
                <ul class="product-review__cons">
              ${consList}
                </ul>
              </div>
            </div>
          </div>
        </div>`;
  }).join('\n\n        ');

  // Build comparison table
  const compHeading = content.comparison?.heading || 'Comparatie rapida';
  const compRows = content.comparison?.rows || [];
  const compColumns = compRows.length > 0 ? Object.keys(compRows[0]) : [];
  const compColLabels = {
    model: 'Model', material: 'Material', greutate: 'Greutate',
    dimensiuni: 'Dimensiuni', stil: 'Stil', potrivitPentru: 'Potrivit pentru'
  };
  const compTh = compColumns.map(c => `<th>${compColLabels[c] || c}</th>`).join('');
  const compTbody = compRows.map(row => {
    const tds = compColumns.map(c => `<td>${row[c] || ''}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('\n            ');

  // Build guide HTML
  const guideHeading = content.guide?.heading || 'Ghid de cumparare';
  const guideContent = processContent(content.guide?.content || '');

  // Build TOC
  const toc = [];
  content.items.forEach((item, i) => {
    toc.push({ id: `produs-${i + 1}`, title: stripStrong(item.name) });
  });
  toc.push({ id: 'comparatie', title: stripStrong(compHeading) });
  toc.push({ id: 'ghid', title: stripStrong(guideHeading) });
  toc.push({ id: 'faq', title: 'Intrebari frecvente' });

  // FAQ HTML
  const faqHtml = content.faq.map(f =>
    `<details class="faq-q">\n  <summary>${stripStrong(f.question)}</summary>\n  <div class="ans"><p>${stripStrong(f.answer)}</p></div>\n</details>`
  ).join('\n');

  // FAQ Schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": content.faq.map(f => ({
      "@type": "Question",
      "name": stripStrong(f.question),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": stripStrong(f.answer),
      },
    })),
  };

  // Breadcrumb Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Acasa", "item": "https://tekabijoux.ro/" },
      { "@type": "ListItem", "position": 2, "name": category, "item": `https://tekabijoux.ro/${categorySlug}/` },
      { "@type": "ListItem", "position": 3, "name": keyword, "item": `https://tekabijoux.ro/${slug}/` },
    ],
  };

  // Article Schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": keyword,
    "description": excerpt,
    "image": `https://tekabijoux.ro/images/articles/${slug}.webp`,
    "datePublished": pubDate,
    "dateModified": modifiedDate,
    "author": {
      "@type": "Person",
      "name": author.name,
    },
    "publisher": {
      "@type": "Organization",
      "name": "TekaBijoux",
      "url": "https://tekabijoux.ro",
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://tekabijoux.ro/${slug}/`,
    },
  };

  const combinedSchema = JSON.stringify([faqSchema, breadcrumbSchema, articleSchema]);

  // Get similar articles for the component
  const sameCategoryArticles = kwData.completed.filter(a => a.categorySlug === categorySlug && a.slug !== slug);
  const otherArticles = kwData.completed.filter(a => a.slug !== slug);
  const similarList = sameCategoryArticles.length > 0 ? sameCategoryArticles.slice(0, 4) : otherArticles.slice(0, 4);

  const similarDataStr = JSON.stringify(similarList.map(a => ({
    title: a.keyword,
    slug: a.slug,
    excerpt: a.excerpt || '',
    category: a.category,
    categorySlug: a.categorySlug,
    date: a.pubDate,
    author: a.author || kwData.categories.find(c => c.slug === a.categorySlug)?.author?.name || 'Redactia',
  })));

  const allArticlesDataStr = JSON.stringify((kwData.completed || []).map(a => ({
    title: a.keyword,
    slug: a.slug,
    category: a.category,
    categorySlug: a.categorySlug,
    date: a.pubDate || new Date().toISOString(),
  })));

  const excerptEscaped = escapeForFrontmatter(excerpt);
  const authorInitials = author.name.split(' ').map(w => w[0]).join('');

  const pageContent = `---
import Layout from '../components/Layout.astro';
import SimilarArticles from '../components/SimilarArticles.astro';
import PrevNextNav from '../components/PrevNextNav.astro';

const title = "${escapeForFrontmatter(keyword)}";
const description = "${excerptEscaped}";
const pubDate = "${pubDate}";
const modifiedDate = "${modifiedDate}";
const category = "${escapeForFrontmatter(category)}";
const categorySlug = "${categorySlug}";
const slug = "${slug}";
const authorName = "${escapeForFrontmatter(author.name)}";
const authorRole = "${escapeForFrontmatter(author.role)}";
const authorBio = "${escapeForFrontmatter(author.bio)}";
const authorInitials = "${authorInitials}";
const schema = ${JSON.stringify(combinedSchema)};
const similarArticles = ${similarDataStr};
const allArticles = ${allArticlesDataStr};
---
<Layout
  title={title + " - TekaBijoux"}
  description={description}
  canonical={"https://tekabijoux.ro/" + slug + "/"}
  ogImage={"/images/articles/" + slug + ".webp"}
  schema={schema}
  article={true}
  pubDate={pubDate}
  modifiedDate={modifiedDate}
>
  <article>
    <div class="art-hero">
      <img src={"/images/articles/" + slug + ".webp"} alt={title} width="1200" height="514" loading="eager" />
      <div class="art-hero-over">
        <nav class="art-hero-bc" aria-label="breadcrumb">
          <a href="/">Acasa</a>
          <span class="sep">/</span>
          <a href={"/" + categorySlug + "/"}>{category}</a>
          <span class="sep">/</span>
          <span>{title}</span>
        </nav>
        <h1>{title}</h1>
        <div class="art-hero-meta">
          <span>{authorName}</span>
          <span class="dot"></span>
          <time datetime={pubDate}>${new Date(pubDate).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          <span class="dot"></span>
          <span>Actualizat: ${new Date(modifiedDate).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>
    </div>

    <div class="toc">
      <div class="toc-head">Cuprins</div>
      <ol>
        ${toc.map(t => `<li><a href="#${t.id}">${t.title}</a></li>`).join('\n        ')}
      </ol>
    </div>

    <div class="art-body">
      ${introHtml}

      ${itemsHtml}

      <div class="comparison-outer" id="comparatie">
        <h2>${stripStrong(compHeading)}</h2>
        <div class="comparison-hint"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg> Scroll orizontal pentru a vedea toate coloanele</div>
        <div class="comparison-wrap">
          <table class="comparison-table">
            <thead><tr>${compTh}</tr></thead>
            <tbody>
            ${compTbody}
            </tbody>
          </table>
        </div>
      </div>

      <div class="guide" id="ghid">
        <h2>${stripStrong(guideHeading)}</h2>
        ${guideContent}
      </div>
    </div>

    <div class="faq" id="faq">
      <h2 class="faq-head">Intrebari frecvente</h2>
      ${faqHtml}
    </div>

    <div class="author">
      <div class="author-av">{authorInitials}</div>
      <div>
        <div class="author-role">{authorRole}</div>
        <div class="author-name">{authorName}</div>
        <p class="author-bio">{authorBio}</p>
      </div>
    </div>

    <SimilarArticles articles={similarArticles} currentSlug={slug} />

    <PrevNextNav
      currentSlug={slug}
      currentCategory={categorySlug}
      articles={allArticles}
    />
  </article>

  <script>
    // Comparison table scroll hint
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.comparison-outer').forEach(outer => {
        const wrap = outer.querySelector('.comparison-wrap');
        if (!wrap) return;
        const check = () => {
          if (wrap.scrollWidth > wrap.clientWidth + 2) {
            outer.classList.add('can-scroll');
          } else {
            outer.classList.remove('can-scroll');
          }
        };
        check();
        window.addEventListener('resize', check);
      });

      // TOC active tracking
      const tocLinks = document.querySelectorAll('.toc a');
      const sections = [];
      tocLinks.forEach(link => {
        const id = link.getAttribute('href')?.replace('#', '');
        const el = id && document.getElementById(id);
        if (el) sections.push({ el, link });
      });
      if (sections.length > 0) {
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const match = sections.find(s => s.el === entry.target);
            if (match) {
              if (entry.isIntersecting) {
                tocLinks.forEach(l => l.classList.remove('on'));
                match.link.classList.add('on');
              }
            }
          });
        }, { rootMargin: '-20% 0px -60% 0px' });
        sections.forEach(s => observer.observe(s.el));
      }
    });
  </script>
</Layout>
`;

  const filePath = path.join(rootDir, 'src', 'pages', `${slug}.astro`);
  fs.writeFileSync(filePath, pageContent, 'utf-8');
  console.log(`  Page created: src/pages/${slug}.astro`);
}

// --- Main ---
async function main() {
  console.log('=== TekaBijoux Article Generator ===\n');

  // Load articles to generate
  let articlesToGenerate;
  const tempPath = path.join(rootDir, 'temp-articles.json');

  if (fs.existsSync(tempPath)) {
    articlesToGenerate = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    console.log(`Loaded ${articlesToGenerate.length} articles from temp-articles.json`);
  } else {
    const kwData = JSON.parse(fs.readFileSync(path.join(rootDir, 'keywords.json'), 'utf-8'));
    articlesToGenerate = kwData.pending || [];
    console.log(`Loaded ${articlesToGenerate.length} pending articles from keywords.json`);
  }

  if (articlesToGenerate.length === 0) {
    console.log('No articles to generate.');
    return;
  }

  const kwData = JSON.parse(fs.readFileSync(path.join(rootDir, 'keywords.json'), 'utf-8'));
  const successfulKeywords = [];

  for (let i = 0; i < articlesToGenerate.length; i++) {
    const article = articlesToGenerate[i];
    const slug = slugify(article.keyword);
    article.slug = slug;

    console.log(`\n[${i + 1}/${articlesToGenerate.length}] Generating: "${article.keyword}"`);
    console.log(`  Category: ${article.category} | Slug: ${slug}`);

    try {
      // 1. Generate content
      const content = await generateArticleContent(article.keyword, article.category, kwData?.completed || []);
      console.log(`  Content generated (${content.items.length} items, ${content.faq.length} FAQs)`);

      // 2. Generate image
      const imageOk = await generateImage(article.keyword, slug, article.categorySlug);
      if (!imageOk) {
        console.log('  Warning: Image generation failed, continuing without image');
      }

      // 3. Set dates
      article.modifiedDate = new Date().toISOString();

      // 4. Create page
      createArticlePage(article, content, kwData);

      // 5. Update keywords.json - extract excerpt from intro first <p>
      const excerptMatch = content.intro.match(/<p>([\s\S]*?)<\/p>/);
      const articleExcerpt = excerptMatch ? stripHtml(excerptMatch[1]) : stripHtml(content.intro).substring(0, 200);
      article.excerpt = articleExcerpt;
      article.author = kwData.categories.find(c => c.slug === article.categorySlug)?.author?.name || 'Redactia';
      article.date = article.pubDate;

      // Move from pending to completed
      kwData.pending = (kwData.pending || []).filter(p =>
        p.keyword.toLowerCase() !== article.keyword.toLowerCase()
      );
      kwData.completed = kwData.completed || [];
      kwData.completed.push(article);

      fs.writeFileSync(path.join(rootDir, 'keywords.json'), JSON.stringify(kwData, null, 2), 'utf-8');
      successfulKeywords.push(article.keyword);

      console.log(`  Done: "${article.keyword}"`);

      // Wait between articles to avoid rate limits
      if (i < articlesToGenerate.length - 1) {
        console.log('  Waiting 5s before next article...');
        await sleep(5000);
      }
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  // Save successful keywords log
  if (successfulKeywords.length > 0) {
    fs.writeFileSync(
      path.join(rootDir, 'successful-keywords.json'),
      JSON.stringify(successfulKeywords, null, 2),
      'utf-8'
    );
  }

  console.log(`\n=== Generation complete: ${successfulKeywords.length}/${articlesToGenerate.length} articles ===`);
}

main().catch(console.error);
