import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { ModerationQueue } from "./moderation-queue";
import "./moderation.css";

export const metadata: Metadata = { title: "Moderação | Ritmo", robots: { index: false, follow: false, noarchive: true } };

export default async function ModerationPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) redirect("/");
  const cookieStore = await cookies();
  const client = createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } });
  const { data: claims } = await client.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login?return_to=/admin/moderacao");
  const { data: moderator, error } = await client.rpc("is_community_moderator");
  if (error || !moderator) redirect("/");
  return <main className="moderation-page"><ModerationQueue/></main>;
}