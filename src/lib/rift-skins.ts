/**
 * Nova Rift cosmetics — runners and trails. These are earned purely by playing
 * the campaign (stars), never bought, and are stored per-device so picking one
 * needs no server round trip.
 */

export type RiftRunner = {
  slug: string;
  name: string;
  blurb: string;
  /** Star requirement across the whole campaign. */
  stars: number;
  body: string;
  limb: string;
  head: string;
  scarf: string;
  /** Silhouette flavour used by the renderer. */
  shape: "runner" | "bulk" | "slim" | "bot";
};

export type RiftTrail = {
  slug: string;
  name: string;
  blurb: string;
  stars: number;
  color: string;
  style: "ghost" | "spark" | "ribbon" | "ember" | "prism";
};

export const RIFT_RUNNERS: RiftRunner[] = [
  {
    slug: "aurora",
    name: "Aurora",
    blurb: "The original rift runner.",
    stars: 0,
    body: "#8ff0e4",
    limb: "#2f6f86",
    head: "#e8fbf8",
    scarf: "#ff6e8c",
    shape: "runner",
  },
  {
    slug: "ember",
    name: "Ember",
    blurb: "Runs hot, lands harder.",
    stars: 6,
    body: "#ffb057",
    limb: "#8c4a1d",
    head: "#fff1de",
    scarf: "#ff5c72",
    shape: "bulk",
  },
  {
    slug: "violet",
    name: "Violet",
    blurb: "Light frame, quick feet.",
    stars: 14,
    body: "#c9a5ff",
    limb: "#5b3f8c",
    head: "#f4ecff",
    scarf: "#7ce7ff",
    shape: "slim",
  },
  {
    slug: "sentinel",
    name: "Sentinel",
    blurb: "Rift maintenance unit.",
    stars: 22,
    body: "#9fb6c9",
    limb: "#3e5468",
    head: "#dbe7f2",
    scarf: "#5ce1b0",
    shape: "bot",
  },
  {
    slug: "nova",
    name: "Nova",
    blurb: "Gold plating for gold times.",
    stars: 30,
    body: "#ffd782",
    limb: "#8a6a2c",
    head: "#fff8e6",
    scarf: "#ffffff",
    shape: "runner",
  },
];

export const RIFT_TRAILS: RiftTrail[] = [
  { slug: "ghost", name: "Ghost", blurb: "Soft afterimage.", stars: 0, color: "#8ff0e4", style: "ghost" },
  { slug: "spark", name: "Spark", blurb: "Snapping motes.", stars: 4, color: "#7ce7ff", style: "spark" },
  { slug: "ribbon", name: "Ribbon", blurb: "One flowing line.", stars: 10, color: "#ff8fb8", style: "ribbon" },
  { slug: "ember", name: "Ember", blurb: "Burning wake.", stars: 18, color: "#ffa martian", style: "ember" },
  { slug: "prism", name: "Prism", blurb: "Shifting spectrum.", stars: 26, color: "#c9a5ff", style: "prism" },
];

const RUNNER_KEY = "lazu.rift.runner";
const TRAIL_KEY = "lazu.rift.trail";

export function loadRiftSkin(): { runner: string; trail: string } {
  if (typeof window === "undefined") return { runner: "aurora", trail: "ghost" };
  return {
    runner: window.localStorage.getItem(RUNNER_KEY) ?? "aurora",
    trail: window.localStorage.getItem(TRAIL_KEY) ?? "ghost",
  };
}

export function saveRiftSkin(runner: string, trail: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUNNER_KEY, runner);
  window.localStorage.setItem(TRAIL_KEY, trail);
}

export function runnerBySlug(slug: string): RiftRunner {
  return RIFT_RUNNERS.find((r) => r.slug === slug) ?? RIFT_RUNNERS[0]!;
}

export function trailBySlug(slug: string): RiftTrail {
  return RIFT_TRAILS.find((t) => t.slug === slug) ?? RIFT_TRAILS[0]!;
}
