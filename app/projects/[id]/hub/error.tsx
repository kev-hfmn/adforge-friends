"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function HubError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="The hub could not be loaded." reset={reset} />;
}
