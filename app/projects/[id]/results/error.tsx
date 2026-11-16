"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function ResultsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="Results could not be loaded." reset={reset} />;
}
