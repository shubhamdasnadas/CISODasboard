const express = require('express');
const router = express.Router();

const NEWS_API_KEY = process.env.NEWS_API_KEY || "981528e4e3a34c8c87b32c95fa0e3edb";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function isStale(pool, queryTerm) {
  const { rows } = await pool.query(
    `SELECT MAX(fetched_at) AS last_fetched FROM news_articles WHERE query_term = $1`,
    [queryTerm]
  );
  const lastFetched = rows[0]?.last_fetched;
  if (!lastFetched) return true;
  return Date.now() - new Date(lastFetched).getTime() > CACHE_TTL_MS;
}

async function fetchAndStore(pool, queryTerm) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', queryTerm);
  url.searchParams.set('from', fromDate.toISOString().split('T')[0]);
  url.searchParams.set('to', today.toISOString().split('T')[0]);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'relevancy');
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('apiKey', NEWS_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.status === 'error') {
    throw new Error(`NewsAPI: ${data.code} — ${data.message}`);
  }

  const articles = data.articles ?? [];
  const now = new Date().toISOString();

  await pool.query(`DELETE FROM news_articles WHERE query_term = $1`, [queryTerm]);

  for (const a of articles) {
    if (!a.url || !a.title) continue;
    await pool.query(
      `INSERT INTO news_articles
         (source_id, source_name, author, title, description, url, url_to_image, published_at, content, query_term, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        a.source?.id ?? null,
        a.source?.name ?? null,
        a.author ?? null,
        a.title,
        a.description ?? null,
        a.url,
        a.urlToImage ?? null,
        a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        a.content ?? null,
        queryTerm,
        now,
      ]
    );
  }

  return articles.length;
}

async function getArticlesFromDB(pool, queryTerm, limit) {
  const { rows } = await pool.query(
    `SELECT source_id, source_name, author, title, description, url, url_to_image, published_at, content
     FROM news_articles
     WHERE query_term = $1
     ORDER BY published_at DESC NULLS LAST
     LIMIT $2`,
    [queryTerm, limit]
  );
  return rows;
}

// GET /api/news  — auto-fetches from NewsAPI when cache is stale (>1 h)
router.get('/', async (req, res) => {
  try {
    const queryTerm = req.query.q || 'cybersecurity';
    const limit = parseInt(req.query.limit || '20', 10);
    const pool = req.orgPool;

    if (await isStale(pool, queryTerm)) {
      await fetchAndStore(pool, queryTerm);
    }

    const articles = await getArticlesFromDB(pool, queryTerm, limit);
    res.json({ status: 'ok', totalResults: articles.length, articles });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/news/sync  — force-refresh from NewsAPI regardless of cache age
router.post('/sync', async (req, res) => {
  try {
    const queryTerm = req.body?.q || 'cybersecurity';
    const pool = req.orgPool;

    const count = await fetchAndStore(pool, queryTerm);
    const articles = await getArticlesFromDB(pool, queryTerm, 20);
    res.json({ status: 'ok', synced: count, totalResults: articles.length, articles });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/news/debug  — raw NewsAPI response, bypasses DB (remove after debugging)
router.get('/debug', async (req, res) => {
  try {
    const queryTerm = req.query.q || 'cybersecurity';
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 7);

    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', queryTerm);
    url.searchParams.set('from', fromDate.toISOString().split('T')[0]);
    url.searchParams.set('to', today.toISOString().split('T')[0]);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'relevancy');
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('apiKey', NEWS_API_KEY);

    const apiRes = await fetch(url.toString());
    const data = await apiRes.json();
    res.json({ httpStatus: apiRes.status, apiKey: NEWS_API_KEY.slice(0, 6) + '...', data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
