"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  PanelTop,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/generate", label: "Quick generate", icon: PanelTop },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigation = (
    <nav aria-label="Main navigation" className="space-y-1 p-4">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-sidebar md:flex">
        <Link
          href="/"
          className="flex h-16 items-center px-7 text-sm font-semibold tracking-tight"
        >
          AdForge
        </Link>
        <div className="min-h-0 flex-1 overflow-auto">{navigation}</div>
        <ThemeToggle />
      </aside>
      <header className="flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <Link
          href="/"
          className="flex min-h-10 items-center text-sm font-semibold tracking-tight"
        >
          AdForge
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="data-[side=left]:w-72">
          <SheetHeader className="px-7 py-5">
            <SheetTitle className="text-sm font-semibold">AdForge</SheetTitle>
            <SheetDescription className="sr-only">
              Main navigation
            </SheetDescription>
          </SheetHeader>
          {navigation}
          <ThemeToggle />
        </SheetContent>
      </Sheet>
    </>
  );
}
