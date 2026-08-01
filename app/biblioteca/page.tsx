import type { Metadata } from "next";
import { MyLibrary } from "./my-library";
import "../blog/blog.css";
import "./my-library.css";

export const metadata: Metadata = { title: "Minha biblioteca | Ritmo", robots: { index: false, follow: false } };

export default function MyLibraryPage() {
  return <main className="library-page"><MyLibrary/></main>;
}
