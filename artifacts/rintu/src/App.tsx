import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import SearchPage from "@/pages/Search";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function App() {
  const { theme, toggle } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SearchPage theme={theme} onToggleTheme={toggle} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
