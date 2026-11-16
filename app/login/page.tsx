import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · AdForge" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">AdForge</h1>
          <p className="text-sm text-muted-foreground">
            Enter the password to open the queue.
          </p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
