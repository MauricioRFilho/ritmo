import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL("https://ritmo-criador.mauricio-srfh.chatgpt.site"),
  title: "Ritmo — seu copiloto de conteúdo",
  description: "Planeje, crie e evolua seu conteúdo com um especialista que conhece a sua rotina.",
  openGraph: {
    title: "Ritmo — seu copiloto de conteúdo",
    description: "Seu conteúdo. No seu ritmo.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ritmo, copiloto inteligente para criadores" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ritmo — seu copiloto de conteúdo",
    description: "Seu conteúdo. No seu ritmo.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
