"use client";

import { ScreenError } from "@/components/studio/ScreenError";

export default function ReportError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ScreenError title="The weekly report could not be loaded." reset={reset} />;
}
