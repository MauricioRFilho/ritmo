export type CommunityPost = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  creative_type: string;
  format: string;
  platform: string;
  objective: string;
  niches: string[];
  tags: string[];
  duration_seconds?: number | null;
  content: Record<string, unknown>;
  origin: "official" | "community";
  author_name: string;
  author_handle: string | null;
  template_id: string;
  template_version: number;
  likes_count: number;
  reuse_count: number;
  published_at: string;
  community_post_id: string | null;
};

const publicFlag = (name: string, fallback = false) => {
  const value = process.env[name];
  return value === undefined ? fallback : value === "true" || value === "1";
};

export const communityFlags = {
  read: publicFlag("NEXT_PUBLIC_COMMUNITY_READ_ENABLED", false),
  submissions: publicFlag("NEXT_PUBLIC_COMMUNITY_SUBMISSIONS_ENABLED"),
  interactions: publicFlag("NEXT_PUBLIC_COMMUNITY_INTERACTIONS_ENABLED"),
  adaptation: publicFlag("NEXT_PUBLIC_COMMUNITY_ADAPTATION_ENABLED"),
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

async function publicQuery<T>(path: string): Promise<T[]> {
  const settings = config();
  if (!settings || !communityFlags.read) return [];
  const response = await fetch(`${settings.url}/rest/v1/${path}`, {
    headers: { apikey: settings.key, Authorization: `Bearer ${settings.key}` },
    next: { revalidate: 120 },
  });
  if (!response.ok) return [];
  return response.json() as Promise<T[]>;
}

type CommunityRow = {
  id: string; slug: string; title: string; summary: string; creative_type: string; format: string;
  platform: string; objective: string; niches: string[]; tags: string[]; snapshot: Record<string, unknown>;
  version: number; author_handle: string | null; author_display_name: string; like_count: number; reuse_count: number;
  published_at: string;
};
type TemplateRow = {
  id: string; template_key: string; version: number; origin: "official" | "community"; community_post_id: string | null;
  title: string; summary: string; creative_type: string; format: string; platform: string; objective: string;
  niches: string[]; tags: string[]; template_json: Record<string, unknown>; created_at: string;
};

function communityPost(row: CommunityRow, template?: TemplateRow): CommunityPost {
  return { id: row.id, slug: row.slug, title: row.title, summary: row.summary, creative_type: row.creative_type,
    format: row.format, platform: row.platform, objective: row.objective, niches: row.niches ?? [], tags: row.tags ?? [],
    content: row.snapshot, origin: "community", author_name: row.author_display_name, author_handle: row.author_handle,
    template_id: template?.id ?? "", template_version: template?.version ?? row.version,
    likes_count: Number(row.like_count), reuse_count: Number(row.reuse_count), published_at: row.published_at,
    community_post_id: row.id };
}
function officialPost(row: TemplateRow): CommunityPost {
  return { id: row.id, slug: row.template_key, title: row.title, summary: row.summary, creative_type: row.creative_type,
    format: row.format, platform: row.platform, objective: row.objective, niches: row.niches ?? [], tags: row.tags ?? [],
    content: row.template_json, origin: "official", author_name: "Ritmo", author_handle: "ritmo",
    template_id: row.id, template_version: row.version, likes_count: 0, reuse_count: 0, published_at: row.created_at,
    community_post_id: null };
}

export async function listCommunityPosts() {
  const [community, templates] = await Promise.all([
    publicQuery<CommunityRow>("community_library?select=*&order=published_at.desc&limit=100"),
    publicQuery<TemplateRow>("public_template_catalog?select=*&order=created_at.desc&limit=100"),
  ]);
  const communityTemplates = new Map(templates.filter((row) => row.community_post_id).map((row) => [row.community_post_id, row]));
  return [...templates.filter((row) => row.origin === "official").map(officialPost),
    ...community.map((row) => communityPost(row, communityTemplates.get(row.id)))];
}

export async function getCommunityPost(slug: string) {
  const [community, official, templates] = await Promise.all([
    publicQuery<CommunityRow>(`community_library?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`),
    publicQuery<TemplateRow>(`public_template_catalog?select=*&origin=eq.official&template_key=eq.${encodeURIComponent(slug)}&limit=1`),
    publicQuery<TemplateRow>("public_template_catalog?select=*&origin=eq.community&limit=100"),
  ]);
  if (community[0]) return communityPost(community[0], templates.find((row) => row.community_post_id === community[0].id));
  return official[0] ? officialPost(official[0]) : null;
}

export function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ritmo-criador.mauricio-srfh.chatgpt.site";
  return new URL(path, base).toString();
}

export function plainTextBlocks(content: Record<string, unknown>): string[] {
  const blocks: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") { const text = value.trim(); if (text) blocks.push(text); }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(content);
  return blocks.slice(0, 30);
}