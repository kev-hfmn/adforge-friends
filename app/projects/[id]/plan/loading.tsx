import { Bone } from "@/components/studio/bones";

export default function PlanLoading() {
  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-3 md:h-[calc(100dvh-8rem)]" aria-busy="true">
      <p className="sr-only">Loading the plan</p>
      <Bone className="h-11 w-full max-w-3xl" />
      <Bone className="h-11 w-full" />
      <div className="flex min-h-0 flex-1 gap-3">
        <Bone className="hidden h-full w-64 shrink-0 md:block" />
        <div className="grid min-w-0 flex-1 grid-cols-1 content-start gap-2 md:grid-cols-7">
          {["m", "t", "w", "h", "f", "s", "u"].map((day) => (
            <Bone key={day} className="h-16 md:h-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
