import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, GitPullRequest, AlertCircle, ExternalLink, User, Tag,
  ChevronLeft, ChevronRight, Github, Loader2, X, ChevronDown, Check,
} from "lucide-react";

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  labels: GitHubLabel[];
  user: GitHubUser;
  assignee: GitHubUser | null;
  created_at: string;
  updated_at: string;
  comments: number;
}

interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubIssue[];
}

const PER_PAGE = 10;

async function searchGitHubIssues(
  query: string,
  state: string,
  page: number
): Promise<GitHubSearchResult> {
  const stateFilter = state !== "all" ? ` is:${state}` : "";
  const q = `${query} is:issue${stateFilter}`;
  const params = new URLSearchParams({ q, per_page: String(PER_PAGE), page: String(page) });
  const res = await fetch(`/api/github/search/issues?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function fetchRepoLabels(repo: string): Promise<GitHubLabel[]> {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) return [];
  const res = await fetch(`/api/github/repos/${owner}/${repoName}/labels`);
  if (!res.ok) return [];
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getLabelColor(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { fg: luminance > 0.5 ? `#${hex}` : `#${hex}`, dark: luminance > 0.5 };
}

function IssueCard({ issue }: { issue: GitHubIssue }) {
  const bodyPreview = issue.body
    ? issue.body.replace(/```[\s\S]*?```/g, "[code block]").replace(/#{1,6} /g, "").trim().slice(0, 220)
    : null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {issue.state === "open" ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-purple-500/15 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-semibold text-sm leading-snug hover:text-primary transition-colors group-hover:text-primary line-clamp-2"
            >
              {issue.title}
            </a>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              aria-label="Open on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-muted-foreground/70">#{issue.number}</span>
            <span>opened {formatDate(issue.created_at)}</span>
            <span className="flex items-center gap-1">
              <img src={issue.user.avatar_url} alt={issue.user.login} className="w-3.5 h-3.5 rounded-full" />
              {issue.user.login}
            </span>
            {issue.comments > 0 && (
              <span>{issue.comments} comment{issue.comments !== 1 ? "s" : ""}</span>
            )}
          </div>

          {bodyPreview && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {bodyPreview}{bodyPreview.length >= 220 ? "…" : ""}
            </p>
          )}

          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {issue.labels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `#${label.color}33`,
                    color: `#${label.color}`,
                    border: `1px solid #${label.color}55`,
                  }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {issue.assignee && (
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>Assigned to</span>
              <a
                href={issue.assignee.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <img src={issue.assignee.avatar_url} alt={issue.assignee.login} className="w-3.5 h-3.5 rounded-full" />
                {issue.assignee.login}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LabelDropdown({
  repo,
  selectedLabels,
  onChange,
}: {
  repo: string;
  selectedLabels: string[];
  onChange: (labels: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const isValidRepo = /^[^/]+\/[^/]+$/.test(repo.trim());

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["repo-labels", repo],
    queryFn: () => fetchRepoLabels(repo),
    enabled: isValidRepo,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = labels.filter((l) =>
    l.name.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (name: string) => {
    onChange(
      selectedLabels.includes(name)
        ? selectedLabels.filter((l) => l !== name)
        : [...selectedLabels, name]
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (isValidRepo) setOpen((o) => !o); }}
        disabled={!isValidRepo}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all w-full
          ${open ? "border-ring ring-2 ring-ring bg-background" : "border-input bg-background hover:border-primary/50"}
          ${!isValidRepo ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedLabels.length === 0 ? (
            <span className="text-muted-foreground">Filter by label…</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selectedLabels.map((l) => {
                const label = labels.find((lb) => lb.name === l);
                return (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium"
                    style={
                      label
                        ? {
                            backgroundColor: `#${label.color}33`,
                            color: `#${label.color}`,
                            border: `1px solid #${label.color}55`,
                          }
                        : { backgroundColor: "var(--color-muted)" }
                    }
                  >
                    {l}
                  </span>
                );
              })}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {selectedLabels.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1.5 w-full bg-popover border border-popover-border rounded-xl shadow-lg overflow-hidden">
          {/* Search within labels */}
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search labels…"
              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {labels.length === 0 ? "No labels found for this repo" : "No labels match"}
              </div>
            ) : (
              filtered.map((label) => {
                const selected = selectedLabels.includes(label.name);
                const { dark } = getLabelColor(label.color);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggle(label.name)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted transition-colors text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 border"
                      style={{
                        backgroundColor: `#${label.color}`,
                        borderColor: dark ? `#${label.color}` : `#${label.color}99`,
                      }}
                    />
                    <span className="flex-1 text-xs text-foreground">{label.name}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {selectedLabels.length > 0 && (
            <div className="px-3 py-2 border-t border-border">
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all labels
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [repo, setRepo] = useState("OfficeDev/microsoft-365-agents-toolkit");
  const [inputValue, setInputValue] = useState("OfficeDev/microsoft-365-agents-toolkit");
  const [keyword, setKeyword] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(true);

  const labelQuery = selectedLabels.map((l) => `label:"${l}"`).join(" ");
  const searchQuery = repo
    ? `repo:${repo}${keyword ? " " + keyword : ""}${labelQuery ? " " + labelQuery : ""}`
    : keyword || "microsoft-365-agents-toolkit";

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["github-issues", searchQuery, state, page],
    queryFn: () => searchGitHubIssues(searchQuery, state, page),
    enabled: hasSearched && !!searchQuery,
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.min(Math.ceil(data.total_count / PER_PAGE), 100) : 0;

  const handleSearch = useCallback(() => {
    setRepo(inputValue.trim());
    setSelectedLabels([]);
    setPage(1);
    setHasSearched(true);
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleStateChange = (newState: "open" | "closed" | "all") => {
    setState(newState);
    setPage(1);
  };

  const handleLabelChange = (labels: string[]) => {
    setSelectedLabels(labels);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-foreground">
            <Github className="w-5 h-5" />
            <span className="font-semibold text-sm">Rintu</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">GitHub Issues Explorer</span>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-4">
              <GitPullRequest className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">GitHub Issues Search</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Search and explore issues from any public GitHub repository
            </p>
          </div>

          {/* Search controls */}
          <div className="max-w-2xl mx-auto space-y-2.5">
            {/* Repo + Search button */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="owner/repo (e.g. microsoft/vscode)"
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Label dropdown + keyword row */}
            <div className="grid grid-cols-2 gap-2">
              <LabelDropdown
                repo={repo}
                selectedLabels={selectedLabels}
                onChange={handleLabelChange}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Keyword filter…"
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & results */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* State toggle + result count */}
        {hasSearched && (
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(["open", "closed", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStateChange(s)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                    state === s
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "open" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />}
                  {s === "closed" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5 align-middle" />}
                  {s}
                </button>
              ))}
            </div>
            {data && (
              <span className="text-xs text-muted-foreground">
                {isFetching ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
                ) : (
                  <>{data.total_count.toLocaleString()} issue{data.total_count !== 1 ? "s" : ""} found</>
                )}
              </span>
            )}
          </div>
        )}

        {/* Active label chips */}
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 items-center">
            <span className="text-xs text-muted-foreground">Filtered by:</span>
            {selectedLabels.map((l) => (
              <button
                key={l}
                onClick={() => handleLabelChange(selectedLabels.filter((x) => x !== l))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <Tag className="w-2.5 h-2.5" />
                {l}
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Failed to fetch issues</div>
              <div className="mt-0.5 text-destructive/80">{(error as Error).message}</div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-muted shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-4 bg-muted rounded-full w-16" />
                      <div className="h-4 bg-muted rounded-full w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {data && data.items.length > 0 && (
          <div className="space-y-2.5">
            {data.items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {data && data.items.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-2xl mb-4">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">No issues found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search query, labels, or state filter.
            </p>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={isFetching}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {data && (
          <p className="text-center text-xs text-muted-foreground/60 mt-8">
            Data from{" "}
            <a href="https://docs.github.com/en/rest/search/search" target="_blank" rel="noopener noreferrer" className="hover:underline">
              GitHub REST API
            </a>
            {data.incomplete_results && " · Results may be incomplete"}
          </p>
        )}
      </div>
    </div>
  );
}
