import Link from "next/link";

export function PrivacyLink() {
  return <Link href="/dados" style={{
    position: "fixed", left: 14, bottom: 12, zIndex: 35, color: "#74747e",
    fontSize: 8, textDecoration: "none",
  }}>Privacidade e dados</Link>;
}

