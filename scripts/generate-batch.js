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
async function generateArticleContent(keyword, category) {
  const apiKey = getNextGeminiKey();
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `Esti un expert in bijuterii, ceasuri si accesorii care scrie pe un blog romanesc. Scrii intr-un stil direct, conversational, ca un prieten care se pricepe si iti da sfaturi concrete. NU esti un AI. Esti un om real cu experienta reala.

Keyword: "${keyword}"
Categorie: "${category}"

GENEREAZA un articol complet in format JSON cu structura de mai jos. Articolul trebuie sa fie informativ, natural, scris de un om care chiar stie domeniul. Fara diacritice. Intre 1500-2500 de cuvinte.

=== 1. SEARCH INTENT MAPPING (CRITIC) ===
Structura articolului urmeaza EXACT ce cauta userul cand tasteaza "${keyword}" in Google:
- PRIMA sectiune = raspunsul direct, concret, fara introducere, fara "bun venit", fara preambul. Userul vrea raspunsul ACUM.
- Dupa raspunsul direct, vin detaliile, comparatiile, criteriile de alegere.
- Fiecare sectiune raspunde la o sub-intrebare pe care userul o are in minte.
- NU incepe NICIODATA cu o introducere generica. Prima propozitie = recomandarea ta directa sau raspunsul la intentia de cautare.
- Excerptul = primele 2-3 propozitii din articol care dau raspunsul direct. Asta apare in Google ca snippet.

=== 2. ANTI-AI FOOTPRINT (FOARTE IMPORTANT) ===
Articolul TREBUIE sa para scris de un om real, nu de AI. Reguli concrete:
- FARA tranzitii generice: NU folosi "Asadar", "In primul rand", "De asemenea", "Cu toate acestea", "Este important de mentionat", "Trebuie sa tinem cont", "Nu in ultimul rand"
- FARA structura predictibila: nu toate paragrafele sa aiba aceeasi lungime. Amesteca: un paragraf de 2 propozitii, urmat de unul de 4, apoi unul de 1 propozitie.
- IMPERFECTIUNI NATURALE: include formulari imperfecte dar naturale: "bon, stai", "cum sa zic", "pana la urma", "na, asta e", "ma rog", "zic si eu"
- Amesteca propozitii FOARTE scurte (3-5 cuvinte: "Merita. Punct." / "Nu-i rau." / "Depinde de buget.") cu propozitii lungi (18-22 cuvinte)
- Foloseste MULT limbaj conversational romanesc: "na", "uite", "stai putin", "pe bune", "sincer", "daca ma intrebi pe mine", "am sa fiu direct", "uite care-i treaba"
- INTERZIS TOTAL: "in era actuala", "descopera", "fara indoiala", "ghid complet", "concluzie", "in concluzie", "in acest articol", "hai sa exploram", "sa aprofundam", "merita mentionat", "este esential", "este crucial", "o alegere excelenta"
- INTERZIS: liste de 3 adjective consecutive, inceperea a doua propozitii la rand cu acelasi cuvant, folosirea aceluiasi pattern de inceput de paragraf
- Include anecdote personale CONCRETE: "am avut un Casio care a tinut 4 ani", "un prieten si-a luat un lant de la X si dupa 2 luni...", "am testat personal modelul asta vreo 3 saptamani"
- Include critici ONESTE: fiecare produs sa aiba minim 1-2 minusuri reale, nu critici false gen "singurul minus e ca e prea bun"
- Recunoaste incertitudine: "n-am testat personal, dar din ce am auzit...", "pe asta nu pun mana in foc, dar..."
- Vorbeste ca pe un forum romanesc, nu ca o enciclopedie

=== 3. FAQ OPTIMIZAT PEOPLE ALSO ASK ===
8 intrebari formatate EXACT cum le tasteaza oamenii in Google Romania:
- Foloseste formulari naturale de cautare: "cat costa...", "care e diferenta intre...", "merita sa...", "ce ... e mai bun", "de ce...", "cum sa...", "unde gasesc..."
- FARA intrebari artificiale sau formale. Gandeste-te: ce ar tasta un roman in Google?
- Raspunsurile au structura de FEATURED SNIPPET: prima propozitie = raspunsul direct si clar, apoi 1-2 propozitii cu detalii si cifre concrete
- Raspuns = 40-70 cuvinte, auto-suficient (sa poata fi afisat singur ca snippet fara context)
- Include cifre concrete: preturi in lei, procente, durate, dimensiuni
- Acoperiti: pret, comparatie, durabilitate, alegere, probleme frecvente, intretinere, autenticitate, unde sa cumperi

=== 4. LIZIBILITATE PERFECTA PARAGRAFE ===
- MAXIM 3-4 propozitii per paragraf. Niciodata mai mult.
- Paragrafele lungi sunt INTERZISE. Daca un paragraf are mai mult de 4 propozitii, sparge-l.
- Alterna paragrafele: unul mai lung (3-4 prop), unul scurt (1-2 prop), unul mediu (2-3 prop)
- Intre sectiuni lasa "aer" - nu pune paragraf dupa paragraf fara pauza
- Foloseste bullet points (<ul><li>) pentru liste de criterii, avantaje, dezavantaje - nu le pune in text continuu
- Subtitlurile (H3) sparg monotonia - foloseste-le in cadrul sectiunilor pentru a crea sub-puncte

=== 5. CUVINTE CHEIE IN STRONG ===
- Pune keyword-ul principal si variatiile lui in <strong> tags de fiecare data cand apar natural in text
- Keyword principal: "${keyword}" - trebuie sa apara de 4-6 ori in tot articolul, in <strong>
- Variatii naturale ale keyword-ului: pune si ele in <strong> (ex: daca keyword e "ceasuri barbatesti sub 500 lei", pune si "ceasuri de barbati", "ceas barbatesc ieftin" etc in strong)
- NU pune in strong cuvinte random sau irelevante. Doar keyword-urile si variatiile lor.
- Nu forta keyword density. Trebuie sa sune natural, ca si cum ai sublinia ce e important.
- NICIODATA nu pune <strong> in titluri de sectiuni (heading), in intrebarile FAQ, sau in textul din cuprins/TOC. Strong se foloseste DOAR in paragrafe de text (<p>), nu in <h2>, <h3>, "question", sau "heading".

=== REGULI SUPLIMENTARE ===
- Scrie FARA diacritice (fara ă, î, ș, ț, â - foloseste a, i, s, t)
- Preturile sa fie in LEI si realiste pentru piata din Romania
- Fiecare sectiune minim 250 cuvinte

STRUCTURA JSON (returneaza DOAR JSON valid, fara markdown, fara \`\`\`):
{
  "excerpt": "Primele 2-3 propozitii care dau raspunsul direct la ce cauta userul. Recomandarea concreta + context scurt. FARA introducere.",
  "sections": [
    {
      "title": "Titlu sectiune cu keyword integrat natural",
      "content": "HTML formatat cu <p>, <strong>, <ul>/<li>. Minim 250 cuvinte per sectiune. Paragrafele separate cu </p><p>. Maxim 3-4 propozitii per paragraf."
    }
  ],
  "faq": [
    {
      "question": "Intrebare EXACT cum ar tasta-o un roman in Google",
      "answer": "Prima propozitie = raspuns direct (featured snippet). Apoi 1-2 propozitii cu detalii si cifre. Total 40-70 cuvinte."
    }
  ]
}

SECTIUNI OBLIGATORII (6 sectiuni, titluri creative, NU generice):
1. [Raspuns direct] - recomandarea ta principala cu explicatie, fara preambul (titlu creativ legat de keyword, NU "raspunsul direct")
2. [Top recomandari] - 4-5 produse cu preturi reale in lei, avantaje si dezavantaje oneste (cu minusuri reale)
3. [Criterii de alegere] - pe ce sa te uiti cand alegi, explicat pe intelesul tuturor, cu exemple concrete
4. [Comparatie] - head-to-head intre 2-3 optiuni populare, cu preturi si diferente clare
5. [Greseli si tips] - ce sa eviti, sfaturi de insider, greseli pe care le fac toti
6. [Verdict pe buget] - recomandare finala pe 3 categorii de buget: mic, mediu, mare (NU folosi cuvantul "concluzie")

FAQ: 8 intrebari naturale, formulari de cautare Google reale, raspunsuri cu structura featured snippet.`;

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

      if (!content.excerpt || !content.sections || !content.faq) {
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

async function generateImage(titleRo, slug, categorySlug) {
  const categoryPrompts = {
    'ceasuri-de-mana': 'elegant watch photography on dark leather surface, dramatic studio lighting with soft reflections, luxurious mood',
    'bijuterii-din-aur': 'elegant gold jewelry photography on dark velvet surface, dramatic studio lighting with warm golden reflections, luxurious mood',
    'bijuterii-din-argint': 'elegant silver jewelry photography on dark velvet surface, dramatic studio lighting with cool silver reflections, sophisticated mood',
    'verighete-si-logodna': 'romantic wedding ring photography on soft fabric, dreamy warm lighting with bokeh, elegant and romantic mood',
    'accesorii-fashion': 'stylish fashion accessory photography on marble surface, modern studio lighting, chic and trendy mood',
  };

  console.log(`  Generating image for: ${titleRo}`);

  const MAX_IMAGE_RETRIES = 3;
  let promptFlagged = false;

  for (let attempt = 1; attempt <= MAX_IMAGE_RETRIES; attempt++) {

    if (attempt > 1) {

      console.log(`  Image retry attempt ${attempt}/${MAX_IMAGE_RETRIES}...`);

      await new Promise(r => setTimeout(r, 3000 * attempt));

    }


  try {
    const titleEn = await translateToEnglish(titleRo);
    console.log(`  Translated title: ${titleEn}`);

    const setting = categoryPrompts[categorySlug] || 'in a modern home setting, soft natural lighting, clean contemporary background';
    const subject = promptFlagged ? await rephraseWithoutBrands(titleEn) : titleEn;
    const prompt = `Realistic photograph of ${subject} ${setting}, no text, no brand name, no writing, no words, no letters, no numbers. Photorealistic, high quality, professional product photography.`;

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

  // Build TOC
  const toc = content.sections.map((s, i) => ({
    id: `sectiune-${i + 1}`,
    title: stripStrong(s.title),
  }));
  toc.push({ id: 'faq', title: 'Intrebari frecvente' });

  // Process sections HTML
  const sectionsHtml = content.sections.map((s, i) => {
    let sectionContent = processContent(s.content);

    // Normalize: if content already has <p> tags, strip them first
    if (sectionContent.includes('<p>') || sectionContent.includes('<p ')) {
      sectionContent = sectionContent
        .replace(/<\/p>\s*<p>/g, '\n')
        .replace(/<p[^>]*>/g, '')
        .replace(/<\/p>/g, '\n');
    }

    // Insert breaks around block-level elements so they get properly separated
    sectionContent = sectionContent
      .replace(/(<(?:h[1-6]|ul|ol|blockquote|table|div)[\s>])/gi, '\n\n$1')
      .replace(/(<\/(?:h[1-6]|ul|ol|blockquote|table|div)>)/gi, '$1\n\n');

    // Split into blocks and wrap text in <p>, leave block elements as-is
    let blocks = sectionContent.split(/\n\n+/).map(p => p.trim()).filter(p => p);
    // Fallback: if \n\n split produced a single large block, try splitting on \n
    if (blocks.length <= 1 && sectionContent.includes('\n')) {
      blocks = sectionContent.split(/\n/).map(p => p.trim()).filter(p => p);
    }
    sectionContent = blocks.map(p => {
      if (p.match(/^<(?:ul|ol|h[1-6]|table|blockquote|div|section)/i)) {
        return p;
      }
      return `<p>${p}</p>`;
    }).join('\n        ');

    // Split overly long paragraphs for better readability
    sectionContent = sectionContent.replace(/<p>([\s\S]*?)<\/p>/g, (match, inner) => {
      if (inner.length < 500) return match;
      // Split on sentence boundaries (. followed by space and uppercase letter)
      const sentences = inner.split(/(?<=\.)\s+(?=[A-Z])/);
      if (sentences.length <= 3) return match;
      // Group sentences into paragraphs of 2-4 sentences
      const paragraphs = [];
      let current = [];
      let currentLen = 0;
      for (const s of sentences) {
        current.push(s);
        currentLen += s.length;
        if (current.length >= 3 || currentLen > 400) {
          paragraphs.push(current.join(' '));
          current = [];
          currentLen = 0;
        }
      }
      if (current.length > 0) paragraphs.push(current.join(' '));
      if (paragraphs.length <= 1) return match;
      return paragraphs.map(p => `<p>${p}</p>`).join('\n        ');
    });

    return `<h2 id="sectiune-${i + 1}">${stripStrong(s.title)}</h2>\n${sectionContent}`;
  }).join('\n\n');

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
    "description": content.excerpt,
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
  const sameCategory = kwData.completed.filter(a => a.categorySlug === categorySlug && a.slug !== slug);
  const otherArticles = kwData.completed.filter(a => a.slug !== slug);
  const similarList = sameCategory.length > 0 ? sameCategory.slice(0, 4) : otherArticles.slice(0, 4);

  const similarDataStr = JSON.stringify(similarList.map(a => ({
    title: a.keyword,
    slug: a.slug,
    excerpt: a.excerpt || '',
    category: a.category,
    categorySlug: a.categorySlug,
    date: a.pubDate,
    author: a.author || kwData.categories.find(c => c.slug === a.categorySlug)?.author?.name || 'Redactia',
  })));

  const excerptEscaped = escapeForFrontmatter(content.excerpt);
  const authorInitials = author.name.split(' ').map(w => w[0]).join('');

  const pageContent = `---
import Layout from '../components/Layout.astro';
import SimilarArticles from '../components/SimilarArticles.astro';

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
      ${sectionsHtml}
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
  </article>
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
      const content = await generateArticleContent(article.keyword, article.category);
      console.log(`  Content generated (${content.sections.length} sections, ${content.faq.length} FAQs)`);

      // 2. Generate image
      const imageOk = await generateImage(article.keyword, slug, article.categorySlug);
      if (!imageOk) {
        console.log('  Warning: Image generation failed, continuing without image');
      }

      // 3. Set dates
      article.modifiedDate = new Date().toISOString();

      // 4. Create page
      createArticlePage(article, content, kwData);

      // 5. Update keywords.json
      article.excerpt = stripHtml(content.excerpt);
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

      console.log(`  ✓ Done: "${article.keyword}"`);

      // Wait between articles to avoid rate limits
      if (i < articlesToGenerate.length - 1) {
        console.log('  Waiting 5s before next article...');
        await sleep(5000);
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
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
