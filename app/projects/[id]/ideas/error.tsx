"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function IdeasError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="Ideas could not be loaded." reset={reset} />;
}
