"use client";

/** Plain words and one action. The exception text stays in the console. */
export function ScreenError({
  title,
  reset,
}: {
  title: string;
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-6" role="alert">
      <p className="text-sm">{title}</p>
      <p className="text-sm text-muted-foreground">
        Nothing was changed. Try again, or reload the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Try again
      </button>
    </div>
  );
}
