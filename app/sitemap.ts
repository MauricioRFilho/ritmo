import type { MetadataRoute } from "next";
import { absoluteUrl, listCommunityPosts } from "../lib/community";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listCommunityPosts();
  return [
    { url: absoluteUrl("/blog"), changeFrequency: "daily", priority: 0.9 },
    ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: post.published_at, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
