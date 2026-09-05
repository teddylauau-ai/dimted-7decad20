import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep the app light: reuse fresh data, never poll a hidden tab,
        // and drop unused data instead of holding it in memory forever.
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
