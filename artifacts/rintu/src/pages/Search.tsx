import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, GitPullRequest, AlertCircle, ExternalLink, User, Tag,
  ChevronLeft, ChevronRight, Github, Loader2, X, ChevronDown, Check,
  ArrowUpDown, Link, Sun, Moon, MessageSquare, Star,
} from "lucide-react";

interface GitHubLabel { id: number; name: string; color: string; }
interface GitHubUser { login: string; avatar_url: string; html_url: string; }
interface GitHubIssue {
  id: number; number: number; title: string; body: string | null;
  html_url: string; state: "open" | "closed"; labels: GitHubLabel[];
  user: GitHubUser; assignee: GitHubUser | null;
  created_at: string; updated_at: string; comments: number;
  reactions?: { total_count: number };
}
interface GitHubSearchResult {
  total_count: number; incomplete_results: boolean; items: GitHubIssue[];
}

const PER_PAGE = 10;

type SortOption = { sort: string; order: "asc" | "desc"; label: string };
const SORT_OPTIONS: SortOption[] = [
  { sort: "",          order: "desc", label: "Best match"       },
  { sort: "created",   order: "desc", label: "Newest"           },
  { sort: "created",   order: "asc",  label: "Oldest"           },
  { sort: "updated",   order: "desc", label: "Recently updated" },
  { sort: "comments",  order: "desc", label: "Most commented"   },
  { sort: "reactions", order: "desc", label: "Most reactions"   },
];

function parseUrlState() {
  const p = new URLSearchParams(window.location.search);
  const sortLabel = p.get("sort") ?? "";
  const sortIdx = SORT_OPTIONS.findIndex((o) => o.label === sortLabel);
  return {
    repo:    p.get("repo")   ?? "OfficeDev/microsoft-365-agents-toolkit",
    keyword: p.get("q")     ?? "",
    labels:  p.get("labels") ? p.get("labels")!.split(",").filter(Boolean) : [],
    state:   (p.get("state") ?? "open") as "open" | "closed" | "all",
    sortIdx: sortIdx >= 0 ? sortIdx : 0,
    page:    Number(p.get("page") ?? 1),
  };
}

function buildShareUrl(repo: string, keyword: string, labels: string[], state: string, sortIdx: number, page: number) {
  const p = new URLSearchParams();
  p.set("repo", repo);
  if (keyword) p.set("q", keyword);
  if (labels.length) p.set("labels", labels.join(","));
  if (state !== "open") p.set("state", state);
  if (sortIdx !== 0) p.set("sort", SORT_OPTIONS[sortIdx].label);
  if (page > 1) p.set("page", String(page));
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}

async function searchGitHubIssues(query: string, state: string, page: number, sort: string, order: "asc" | "desc"): Promise<GitHubSearchResult> {
  const stateFilter = state !== "all" ? ` is:${state}` : "";
  const q = `${query} is:issue${stateFilter}`;
  const params = new URLSearchParams({ q, per_page: String(PER_PAGE), page: String(page), order });
  if (sort) params.set("sort", sort);
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
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getLabelColor(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

// ── Issue Card ──────────────────────────────────────────────────────────────
function IssueCard({ issue }: { issue: GitHubIssue }) {
  const bodyPreview = issue.body
    ? issue.body.replace(/```[\s\S]*?```/g, "").replace(/#{1,6} /g, "").replace(/\*\*/g, "").trim().slice(0, 200)
    : null;

  return (
    <article className="group relative bg-card border border-card-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-lg hover:-translate-y-[1px] transition-all duration-200">
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="flex items-start gap-3.5">
        {/* State dot */}
        <div className="mt-1 shrink-0">
          {issue.state === "open" ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2"
            >
              {issue.title}
            </a>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">#{issue.number}</span>
            <span>opened {formatDate(issue.created_at)}</span>
            <a href={issue.user.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
              <img src={issue.user.avatar_url} alt={issue.user.login} className="w-4 h-4 rounded-full ring-1 ring-border" />
              {issue.user.login}
            </a>
          </div>

          {/* Body preview */}
          {bodyPreview && (
            <p className="mt-2.5 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
              {bodyPreview}{bodyPreview.length >= 200 ? "…" : ""}
            </p>
          )}

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-3">
            {/* Labels */}
            <div className="flex flex-wrap gap-1.5">
              {issue.labels.slice(0, 4).map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `#${label.color}22`,
                    color: getLabelColor(label.color) ? `#${label.color}` : `#${label.color}`,
                    border: `1px solid #${label.color}44`,
                  }}
                >
                  {label.name}
                </span>
              ))}
              {issue.labels.length > 4 && (
                <span className="text-[11px] text-muted-foreground px-1.5">+{issue.labels.length - 4}</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              {issue.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {issue.comments}
                </span>
              )}
              {(issue.reactions?.total_count ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {issue.reactions!.total_count}
                </span>
              )}
              {issue.assignee && (
                <a href={issue.assignee.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <User className="w-3 h-3" />
                  <img src={issue.assignee.avatar_url} alt={issue.assignee.login} className="w-4 h-4 rounded-full ring-1 ring-border" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Label Dropdown ──────────────────────────────────────────────────────────
function LabelDropdown({ repo, selectedLabels, onChange }: { repo: string; selectedLabels: string[]; onChange: (l: string[]) => void }) {
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
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setFilter(""); } };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = labels.filter((l) => l.name.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (name: string) => onChange(selectedLabels.includes(name) ? selectedLabels.filter((l) => l !== name) : [...selectedLabels, name]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (isValidRepo) setOpen((o) => !o); }}
        disabled={!isValidRepo}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all w-full min-h-[38px]
          ${open ? "border-primary/60 ring-2 ring-primary/20 bg-background" : "border-input bg-background/80 hover:border-primary/40"}
          ${!isValidRepo ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedLabels.length === 0 ? (
            <span className="text-muted-foreground text-xs">Filter by label…</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selectedLabels.map((l) => {
                const lbl = labels.find((x) => x.name === l);
                return (
                  <span key={l} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium"
                    style={lbl ? { backgroundColor: `#${lbl.color}22`, color: `#${lbl.color}`, border: `1px solid #${lbl.color}44` } : { backgroundColor: "var(--color-muted)" }}>
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
            <button onClick={(e) => { e.stopPropagation(); onChange([]); }} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted">
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1.5 w-full bg-popover border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="p-2 border-b border-border">
            <input autoFocus type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Search labels…"
              className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-muted-foreground">
                {labels.length === 0 ? "No labels found" : "No matches"}
              </div>
            ) : filtered.map((label) => {
              const sel = selectedLabels.includes(label.name);
              return (
                <button key={label.id} type="button" onClick={() => toggle(label.name)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 hover:bg-muted transition-colors ${sel ? "bg-muted/50" : ""}`}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `#${label.color}` }} />
                  <span className="flex-1 text-xs text-foreground text-left">{label.name}</span>
                  {sel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          {selectedLabels.length > 0 && (
            <div className="px-3 py-2 border-t border-border">
              <button onClick={() => { onChange([]); setOpen(false); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sort Dropdown ───────────────────────────────────────────────────────────
function SortDropdown({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all
          ${open ? "border-primary/60 ring-2 ring-primary/20 bg-background text-foreground" : "border-border bg-background/80 text-muted-foreground hover:text-foreground hover:border-primary/40"}`}>
        <ArrowUpDown className="w-3.5 h-3.5" />
        {SORT_OPTIONS[value].label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1.5 left-0 w-48 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {SORT_OPTIONS.map((opt, idx) => (
            <button key={idx} type="button" onClick={() => { onChange(idx); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3 py-2.5 text-xs hover:bg-muted transition-colors ${idx === value ? "text-foreground font-medium bg-muted/50" : "text-muted-foreground"}`}>
              {opt.label}
              {idx === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dark Mode Toggle ────────────────────────────────────────────────────────
function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle dark mode"
      className="relative w-[52px] h-7 rounded-full border border-border bg-muted transition-all duration-300 hover:border-primary/50 hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      <div className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${theme === "dark" ? "translate-x-[24px] bg-primary border-primary" : ""}`}>
        {theme === "dark"
          ? <Moon className="w-3.5 h-3.5 text-primary-foreground" />
          : <Sun className="w-3.5 h-3.5 text-amber-500" />
        }
      </div>
    </button>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function SearchPage({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
  const initial = parseUrlState();
  const [repo, setRepo] = useState(initial.repo);
  const [inputValue, setInputValue] = useState(initial.repo);
  const [keyword, setKeyword] = useState(initial.keyword);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(initial.labels);
  const [state, setState] = useState<"open" | "closed" | "all">(initial.state);
  const [page, setPage] = useState(initial.page);
  const [sortIdx, setSortIdx] = useState(initial.sortIdx);
  const [copied, setCopied] = useState(false);

  const activeSort = SORT_OPTIONS[sortIdx];
  const labelQuery = selectedLabels.map((l) => `label:"${l}"`).join(" ");
  const searchQuery = repo
    ? `repo:${repo}${keyword ? " " + keyword : ""}${labelQuery ? " " + labelQuery : ""}`
    : keyword || "microsoft-365-agents-toolkit";

  useEffect(() => {
    window.history.replaceState(null, "", buildShareUrl(repo, keyword, selectedLabels, state, sortIdx, page));
  }, [repo, keyword, selectedLabels, state, sortIdx, page]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["github-issues", searchQuery, state, page, activeSort.sort, activeSort.order],
    queryFn: () => searchGitHubIssues(searchQuery, state, page, activeSort.sort, activeSort.order),
    enabled: !!searchQuery,
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.min(Math.ceil(data.total_count / PER_PAGE), 100) : 0;

  const handleSearch = useCallback(() => { setRepo(inputValue.trim()); setSelectedLabels([]); setPage(1); }, [inputValue]);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };
  const handleStateChange = (s: "open" | "closed" | "all") => { setState(s); setPage(1); };
  const handleSortChange = (i: number) => { setSortIdx(i); setPage(1); };
  const handleLabelChange = (l: string[]) => { setSelectedLabels(l); setPage(1); };
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(buildShareUrl(repo, keyword, selectedLabels, state, sortIdx, page)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Github className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">Rintu</span>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <span className="hidden sm:block text-xs text-muted-foreground">GitHub Issues Explorer</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                copied
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
            </button>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </header>

      {/* ── Hero / Search ── */}
      <div className="relative overflow-hidden border-b border-border/60">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-primary/[0.04] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-5 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl mb-5 shadow-lg shadow-primary/10">
              <GitPullRequest className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              GitHub Issues Search
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Search, filter, and explore issues from any public GitHub repository in real time
            </p>
          </div>

          {/* Search controls */}
          <div className="max-w-2xl mx-auto space-y-2.5">
            {/* Repo input */}
            <div className="flex gap-2.5">
              <div className="flex-1 relative group">
                <Github className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="owner/repo — e.g. microsoft/vscode"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-input bg-background/80 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all shadow-sm"
                />
                {inputValue && (
                  <button onClick={() => setInputValue("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/20"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Label + keyword row */}
            <div className="grid grid-cols-2 gap-2.5">
              <LabelDropdown repo={repo} selectedLabels={selectedLabels} onChange={handleLabelChange} />
              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text" value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Keyword filter…"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background/80 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-6">

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* State pills */}
            <div className="flex items-center gap-0.5 bg-muted/60 rounded-xl p-1 border border-border/50">
              {(["open", "closed", "all"] as const).map((s) => (
                <button key={s} onClick={() => handleStateChange(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    state === s ? "bg-background text-foreground shadow-sm border border-border/80" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {s === "open" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />}
                  {s === "closed" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5 align-middle" />}
                  {s}
                </button>
              ))}
            </div>
            <SortDropdown value={sortIdx} onChange={handleSortChange} />
          </div>

          {data && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isFetching
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Refreshing…</>
                : <><span className="font-semibold text-foreground">{data.total_count.toLocaleString()}</span> issue{data.total_count !== 1 ? "s" : ""}</>
              }
            </div>
          )}
        </div>

        {/* Active label chips */}
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 items-center">
            <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
            {selectedLabels.map((l) => (
              <button key={l} onClick={() => handleLabelChange(selectedLabels.filter((x) => x !== l))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all">
                <Tag className="w-2.5 h-2.5" />
                {l}
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
            {selectedLabels.length > 1 && (
              <button onClick={() => handleLabelChange([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-1">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/8 border border-destructive/20 text-sm text-destructive mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Failed to fetch issues</div>
              <div className="mt-0.5 opacity-80 text-xs">{(error as Error).message}</div>
            </div>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && !data && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl p-5 animate-pulse">
                <div className="flex gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-muted shrink-0 mt-1" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-muted rounded-lg w-3/4" />
                    <div className="h-3 bg-muted rounded-lg w-1/2" />
                    <div className="h-8 bg-muted rounded-lg w-full" />
                    <div className="flex gap-2">
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
            {data.items.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
          </div>
        )}

        {/* Empty */}
        {data && data.items.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-muted rounded-2xl mb-4 border border-border">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">No issues found</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Try a different repo, adjust your filters, or change the state toggle.
            </p>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)} disabled={isFetching}
                    className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all ${
                      p === page ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                    }`}>
                    {p}
                  </button>
                );
              })}
            </div>

            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {data && (
          <p className="text-center text-xs text-muted-foreground/50 mt-10">
            Powered by the{" "}
            <a href="https://docs.github.com/en/rest/search/search" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors underline underline-offset-2">
              GitHub REST API
            </a>
            {data.incomplete_results && " · Results may be incomplete"}
          </p>
        )}
      </div>
    </div>
  );
}
