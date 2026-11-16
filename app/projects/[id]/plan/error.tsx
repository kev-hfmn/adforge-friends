"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function PlanError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="The plan could not be loaded." reset={reset} />;
}
