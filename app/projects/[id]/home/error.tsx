"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function HomeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="Home could not be loaded." reset={reset} />;
}
