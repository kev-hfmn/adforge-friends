"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function SetupError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="Setup could not be loaded." reset={reset} />;
}
