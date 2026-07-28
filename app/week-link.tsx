import Link from "next/link";

export function WeekLink() {
  return <Link href="/semana" style={{
    position: "fixed", left: 14, bottom: 29, zIndex: 35, color: "#8f8f99",
    fontSize: 8, textDecoration: "none",
  }}>Minha semana</Link>;
}

