import { Router } from "express";

const router = Router();

function githubHeaders(): Record<string, string> {
  const token = process.env["GITHUB_TOKEN"];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

router.get("/github/search/issues", async (req, res) => {
  const { q, per_page = "10", page = "1" } = req.query as Record<string, string>;

  if (!q) {
    res.status(400).json({ error: "Missing required query param: q" });
    return;
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`;

  try {
    const upstream = await fetch(url, { headers: githubHeaders() });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    req.log.error({ err }, "GitHub proxy error");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

router.get("/github/repos/:owner/:repo/labels", async (req, res) => {
  const { owner, repo } = req.params;
  const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`;

  try {
    const upstream = await fetch(url, { headers: githubHeaders() });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    req.log.error({ err }, "GitHub labels proxy error");
    res.status(502).json({ error: "Failed to reach GitHub API" });
  }
});

export default router;
