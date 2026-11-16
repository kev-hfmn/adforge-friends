"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// What the owner opens every day.
const daily = [
  { href: "/home", label: "Home", wideOnly: false },
  { href: "/plan", label: "Plan", wideOnly: false },
  { href: "/queue", label: "Posts", wideOnly: false },
  { href: "/ideas", label: "Ideas", wideOnly: true },
  { href: "/hub", label: "Hub", wideOnly: true },
  { href: "/results", label: "Results", wideOnly: false },
  { href: "/library", label: "Library", wideOnly: true },
];
// What gets set up once and opened rarely. All of it lives behind "Setup".
const setup = [
  { href: "/setup", label: "Overview" },
  { href: "/social", label: "Channels" },
  { href: "/autopilot", label: "Rhythm and automation" },
  { href: "/brand-kit", label: "Brand kit and rules" },
  { href: "/generate", label: "Generator" },
];

export function ProjectTabs({
  projectId,
  generator,
}: {
  projectId: string;
  /** False for projects whose copy only comes from a Claude session: no generator link. */
  generator: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const on = (href: string) => pathname.startsWith(`${base}${href}`);
  const inSetup = setup.some((t) => on(t.href));
  const tab = (active: boolean) =>
    cn(
      "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
      active
        ? "border-link text-link"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );
  return (
    <>
      <nav
        aria-label="Project sections"
        className="no-scrollbar flex gap-1 overflow-x-auto px-4 md:px-8"
      >
        {daily.map((t) => (
          <Link
            key={t.href}
            href={`${base}${t.href}`}
            aria-current={on(t.href) ? "page" : undefined}
            className={cn(tab(on(t.href)), t.wideOnly && "hidden md:flex")}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={`${base}/setup`}
          aria-current={inSetup ? "page" : undefined}
          className={cn(tab(inSetup), "ml-auto")}
        >
          <Settings className="size-4" />
          Setup
        </Link>
      </nav>
      {inSetup && (
        <nav
          aria-label="Setup sections"
          className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border bg-muted px-4 md:px-8"
        >
          {setup
            .filter((t) => generator || t.href !== "/generate")
            .map((t) => (
              <Link
                key={t.href}
                href={`${base}${t.href}`}
                aria-current={on(t.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-10 shrink-0 items-center whitespace-nowrap px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  on(t.href)
                    ? "border-b-2 border-link font-medium text-link"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
        </nav>
      )}
    </>
  );
}
