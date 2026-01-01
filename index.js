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

/* CAST & CREW */
app.get("/api/movies/:id/credits", async (req, res) => {
  try {
    const data = await tmdbFetch(
      `/movie/${req.params.id}/credits?language=en-US`
    );

    const cast = (data.cast || []).map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profile_path: person.profile_path,
    }));

    res.json({ cast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* META INFO ROW */
app.get("/api/movies/:id/meta", async (req, res) => {
  try {
    const data = await tmdbFetch(
      `/movie/${req.params.id}?language=en-US`
    );

    res.json({
      runtime: data.runtime,
      release_date: data.release_date,
      vote_average: data.vote_average,
      adult: data.adult,
      genres: data.genres?.map((g) => g.name) || [],
    });
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
   OPENROUTER (GPT) ROUTE – MOVIES + TV
-------------------------------------------------- */

app.post("/api/gpt/search", async (req, res) => {
  try {
    const { query, type = "both" } = req.body;

    if (!query) return res.json([]);

    // 🔒 Safety
    if (!["movie", "tv", "both"].includes(type)) {
      return res.json([]);
    }

    const typeText =
      type === "movie"
        ? "movies"
        : type === "tv"
        ? "TV shows"
        : "movies and TV shows";

    const prompt = `
Return ONLY a comma-separated list of valid English ${typeText} titles.
Rules:
- No numbering
- No explanations
- No extra text
- Minimum 25 titles
User query: "${query}"
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nex-agi/deepseek-v3.1-nex-n1:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4
        })
      }
    );

    const json = await response.json();

    const text = json?.choices?.[0]?.message?.content || "";

    const results = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* --------------------------------------------------
   FANART ROUTE (MOVIE + TV)
-------------------------------------------------- */

app.get("/api/fanart/:type/:tmdbId", async (req, res) => {
  try {
    const { type, tmdbId } = req.params;

    // 🔒 Validate type
    if (!["movie", "tv"].includes(type)) {
      return res.status(400).json({ logos: [] });
    }

    const endpoint =
      type === "movie"
        ? `https://webservice.fanart.tv/v3/movies/${tmdbId}`
        : `https://webservice.fanart.tv/v3/tv/${tmdbId}`;

    const response = await fetch(
      `${endpoint}?api_key=${process.env.FANART_API_KEY}`
    );

    if (!response.ok) {
      return res.json({ logos: [] });
    }

    const data = await response.json();

    // 🔹 Collect logos based on type
    let allLogos = [];

    if (type === "movie") {
      allLogos = [
        ...(data?.hdmovielogo || []),
        ...(data?.movielogo || []),
      ];
    }

    if (type === "tv") {
      allLogos = [
        ...(data?.hdtvlogo || []),
        ...(data?.tvlogo || []),
      ];
    }

    // 🔹 Filter ONLY English logos
    const englishLogos = allLogos.filter(
      (logo) => logo.lang === "en"
    );

    res.json({
      logos: englishLogos,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* --------------------------------------------------
   TV SHOW ROUTES
-------------------------------------------------- */

/* POPULAR TV */
app.get("/api/tv/popular", async (_, res) => {
  try {
    const data = await tmdbFetch("/tv/popular?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TOP RATED TV */
app.get("/api/tv/top-rated", async (_, res) => {
  try {
    const data = await tmdbFetch("/tv/top_rated?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ON THE AIR */
app.get("/api/tv/on-the-air", async (_, res) => {
  try {
    const data = await tmdbFetch("/tv/on_the_air?page=1");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TV DETAILS */
app.get("/api/tv/:id/details", async (req, res) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.id}?language=en-US`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TV SEASON EPISODES */
app.get("/api/tv/:id/season/:season", async (req, res) => {
  try {
    const { id, season } = req.params;
    const data = await tmdbFetch(`/tv/${id}/season/${season}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TV TRAILER */
app.get("/api/tv/:id/trailer", async (req, res) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.id}/videos`);
    const trailer = data.results.find(
      (v) => v.type === "Trailer" && v.site === "YouTube"
    );
    res.json(trailer || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TV CREDITS */
app.get("/api/tv/:id/credits", async (req, res) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.id}/credits`);
    res.json({ cast: data.cast || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tv/:id/similar", async (req, res) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.id}/similar?page=1`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------
   TV SEARCH
-------------------------------------------------- */

app.get("/api/tv/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json({ results: [] });

    const data = await tmdbFetch(
      `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1`
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* TV META INFO */
app.get("/api/tv/:id/meta", async (req, res) => {
  try {
    const data = await tmdbFetch(
      `/tv/${req.params.id}?language=en-US`
    );

    res.json({
      episode_runtime: data.episode_run_time?.[0] || null,
      first_air_date: data.first_air_date,
      last_air_date: data.last_air_date,
      seasons: data.number_of_seasons,
      episodes: data.number_of_episodes,
      vote_average: data.vote_average,
      adult: data.adult,
      genres: data.genres?.map((g) => g.name) || [],
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
