import { Bone } from "@/components/studio/bones";

export default function ResultsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8" aria-busy="true">
      <p className="sr-only">Loading results</p>
      <div className="flex items-end justify-between gap-4">
        <Bone className="h-10 w-48" />
        <Bone className="h-11 w-36" />
      </div>
      <div className="space-y-2">
        <Bone className="h-4 w-40" />
        <Bone className="h-4 w-full max-w-md" />
        <Bone className="h-4 w-full max-w-sm" />
      </div>
      <Bone className="h-11 w-full" />
      <div className="space-y-2">
        {["a", "b", "c", "d", "e"].map((row) => (
          <Bone key={row} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
