import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main className="min-w-0 md:ml-56">{children}</main>
    </div>
  );
}
