import { stableClusterId, type Cluster } from "./feeds.ts";
import { tokens } from "./cluster.ts";

export interface StoryMember {
  title: string;
  link: string;
  snippet: string;
  ts: number;
  source: string;
}

export interface StoryFile {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  image: string | null;
  ts: number;
  snippet: string;
  outlets: number;
  breaking: boolean;
  satire: boolean;
  tag: string | null;
  members: StoryMember[];
}

export interface StoryIndex {
  fetchedAt: number;
  stories: StoryFile[];
  alias: Record<string, string>;
}

export function storyFromCluster(cluster: Cluster): StoryFile {
  return {
    id: cluster.id,
    title: cluster.lead.title,
    link: cluster.lead.link,
    source: cluster.lead.source.name,
    category: cluster.lead.source.category,
    image: cluster.image,
    ts: cluster.lead.ts,
    snippet: (cluster.lead.snippet || "").slice(0, 160),
    outlets: cluster.outlets,
    breaking: cluster.breaking,
    satire: cluster.satire,
    tag: cluster.tag?.name ?? null,
    members: cluster.members.map((member) => ({
      title: member.title,
      link: member.link,
      snippet: (member.snippet || "").slice(0, 160),
      ts: member.ts,
      source: member.source,
    })),
  };
}

export function storyIndex(clusters: Cluster[], fetchedAt: number): StoryIndex {
  const stories = clusters.map(storyFromCluster);
  const alias: Record<string, string> = {};
  for (const story of stories) {
    alias[story.id] = story.id;
    for (const member of story.members) {
      const memberId = stableClusterId(member.link);
      if (memberId) alias[memberId] = story.id;
    }
  }
  return { fetchedAt, stories, alias };
}

export function resolveStory(index: StoryIndex, id: string): { story: StoryFile; redirectTo?: string } | null {
  const canonical = index.alias[id];
  if (!canonical) return null;
  const story = index.stories.find((item) => item.id === canonical);
  if (!story) return null;
  return canonical === id ? { story } : { story, redirectTo: canonical };
}

export function relatedStories(index: StoryIndex, current: StoryFile, limit = 4): StoryFile[] {
  const mine = new Set(tokens(current.title));
  return index.stories
    .filter((story) => story.id !== current.id && story.satire === current.satire)
    .map((story) => ({ story, n: tokens(story.title).filter((token) => mine.has(token)).length }))
    .filter((row) => row.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((row) => row.story);
}
