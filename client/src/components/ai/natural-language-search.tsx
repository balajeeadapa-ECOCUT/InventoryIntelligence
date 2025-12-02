import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Loader2, TrendingUp, Package, BarChart3, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface NLQueryResult {
  query: string;
  intent: "search" | "analytics" | "recommendation" | "general";
  response: string;
  data?: any;
  provider: string;
  confidence: number;
}

export function NaturalLanguageSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NLQueryResult | null>(null);

  const queryMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await apiRequest("POST", "/api/ai/query", { query: searchQuery });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    }
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || queryMutation.isPending) return;
    queryMutation.mutate(query);
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case "search": return Package;
      case "analytics": return BarChart3;
      case "recommendation": return TrendingUp;
      default: return HelpCircle;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case "search": return "bg-blue-500";
      case "analytics": return "bg-purple-500";
      case "recommendation": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const exampleQueries = [
    "What products are running low?",
    "Show me best selling items this month",
    "Which category has highest stock value?",
    "Suggest products to reorder",
  ];

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">AI-Powered Search</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions in natural language</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about inventory, e.g., 'Show low stock items'..."
              className="pl-12 pr-24 h-12 text-base bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm"
              data-testid="nl-search-input"
            />
            <Button
              type="submit"
              disabled={!query.trim() || queryMutation.isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg"
              data-testid="nl-search-btn"
            >
              {queryMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Ask AI
                </>
              )}
            </Button>
          </div>
        </form>

        {!result && !queryMutation.isPending && (
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(q);
                  queryMutation.mutate(q);
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-300 transition-all"
                data-testid={`example-query-${i}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              data-testid="nl-search-result"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg ${getIntentColor(result.intent)} flex items-center justify-center flex-shrink-0`}>
                  {(() => {
                    const Icon = getIntentIcon(result.intent);
                    return <Icon className="w-4 h-4 text-white" />;
                  })()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {result.intent}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(result.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      via {result.provider}
                    </Badge>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {result.response}
                  </p>
                </div>
              </div>
              {result.data && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
