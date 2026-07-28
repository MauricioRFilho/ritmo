import Link from "next/link";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<footer style={{
    position: "fixed", right: 16, bottom: 12, zIndex: 10, display: "flex",
    gap: 12, fontSize: 8,
  }}><Link href="/termos" style={{ color: "#777" }}>Termos</Link>
    <Link href="/privacidade" style={{ color: "#777" }}>Privacidade</Link></footer></>;
}
