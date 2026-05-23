import { Router } from "express";

const router = Router();

router.get("/github/search/issues", async (req, res) => {
  const { q, per_page = "10", page = "1" } = req.query as Record<string, string>;

  if (!q) {
    res.status(400).json({ error: "Missing required query param: q" });
    return;
  }

  const token = process.env["GITHUB_TOKEN"];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`;

  try {
    const upstream = await fetch(url, { headers });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    req.log.error({ err }, "GitHub proxy error");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

export default router;
