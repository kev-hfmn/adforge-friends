"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function LibraryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="The library could not be loaded." reset={reset} />;
}
