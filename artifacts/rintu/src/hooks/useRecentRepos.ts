import { useState, useCallback } from "react";

const KEY = "rintu-recent-repos";
const MAX = 5;

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(repos: string[]) {
  localStorage.setItem(KEY, JSON.stringify(repos));
}

export function useRecentRepos() {
  const [recents, setRecents] = useState<string[]>(load);

  const push = useCallback((repo: string) => {
    setRecents((prev) => {
      const next = [repo, ...prev.filter((r) => r !== repo)].slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((repo: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r !== repo);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    save([]);
    setRecents([]);
  }, []);

  return { recents, push, remove, clear };
}
