import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* --------------------------------------------------
   TMDB CONFIG
-------------------------------------------------- */

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const TMDB_HEADERS = {
  Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
  accept: "application/json"
};

const tmdbFetch = async (endpoint) => {
  const res = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: TMDB_HEADERS
  });

  if (!res.ok) throw new Error("TMDB API Error");

  return res.json();
};

/* --------------------------------------------------
   TMDB ROUTES
-------------------------------------------------- */

app.get("/api/movies/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json({ results: [] });

    const data = await tmdbFetch(
      `/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/movies/:id/details", async (req, res) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.id}?language=en-US`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/movies/:id/similar", async (req, res) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.id}/similar?page=1`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* POPULAR */
app.get("/api/movies/popular", async (_, res) => {
  try {
    const data = await tmdbFetch("/movie/popular?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* NOW PLAYING */
app.get("/api/movies/now-playing", async (_, res) => {
  try {
    const data = await tmdbFetch("/movie/now_playing?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TOP RATED */
app.get("/api/movies/top-rated", async (_, res) => {
  try {
    const data = await tmdbFetch("/movie/top_rated?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* UPCOMING */
app.get("/api/movies/upcoming", async (_, res) => {
  try {
    const data = await tmdbFetch("/movie/upcoming?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/movies/classic", async (_, res) => {
  try {
    const data = await tmdbFetch(
      `/discover/movie?language=en-US&page=1&vote_count.gte=1000&vote_average.gte=7.5&sort_by=vote_count.desc`
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* GENRE ROUTES */
const GENRES = {
  crime: "80",
  romance: "10749",
  documentary: "99",
  comedy: "35",
  fantasy: "14,16",
  horror: "27,9648",
};

Object.entries(GENRES).forEach(([name, id]) => {
  app.get(`/api/movies/${name}`, async (_, res) => {
    try {
      const data = await tmdbFetch(
        `/discover/movie?with_genres=${id}&language=en-US&page=1`
      );
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

/* TRAILER */
app.get("/api/movies/:id/trailer", async (req, res) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.id}/videos`);
    const trailer = data.results.find(
      (v) => v.type === "Trailer" && v.site === "YouTube"
    );
    res.json(trailer || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------
   OPENROUTER (GPT) ROUTE
-------------------------------------------------- */

app.post("/api/gpt/movies", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json([]);

    const prompt = `Return ONLY a comma-separated list of valid movie titles.
No numbering.
No explanations.
No extra text.
Give atleast 25 Movies.
User query: "${query}"`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "nex-agi/deepseek-v3.1-nex-n1:free",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const json = await response.json();

    const text = json?.choices?.[0]?.message?.content || "";

    const movies = text
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------
   FANART ROUTE (TMDB ID)
-------------------------------------------------- */

app.get("/api/fanart/movie/:tmdbId", async (req, res) => {
  try {
    const response = await fetch(
      `https://webservice.fanart.tv/v3/movies/${req.params.tmdbId}?api_key=${process.env.FANART_API_KEY}`
    );

    if (!response.ok) return res.json({ logos: [] });

    const data = await response.json();

    res.json({
      logos: data?.hdmovielogo || data?.movielogo || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------
   HEALTH CHECK
-------------------------------------------------- */

app.get("/", (_, res) => {
  res.send("Netflix GPT Backend is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
