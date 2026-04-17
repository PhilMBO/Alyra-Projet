"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-background border-b border-border px-6 py-4 shadow-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logoverivo.png"
              alt="Verivo"
              width={40}
              height={40}
              className="rounded"
            />
            <h1 className="text-xl font-bold text-primary">Verivo</h1>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <NavLink href="/dashboard" active={pathname === "/dashboard"}>
              Dashboard
            </NavLink>
            <NavLink
              href="/me/elections"
              active={pathname.startsWith("/me/elections")}
            >
              Mes scrutins
            </NavLink>
          </nav>
        </div>

        <ConnectButton />
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "font-semibold text-primary border-b-2 border-primary pb-0.5"
          : "text-text-secondary hover:text-primary"
      }
    >
      {children}
    </Link>
  );
}
