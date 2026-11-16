"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function PostsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="Posts could not be loaded." reset={reset} />;
}
