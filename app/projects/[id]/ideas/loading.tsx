import { Bone } from "@/components/studio/bones";

const columns = ["inbox", "shaping", "ready", "planned", "done", "dropped"];

export default function IdeasLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-4" aria-busy="true">
      <p className="sr-only">Loading ideas</p>
      <div className="flex items-end justify-between gap-4">
        <Bone className="h-10 w-40" />
        <Bone className="h-11 w-24" />
      </div>
      <div className="hidden gap-3 md:flex">
        {columns.map((column) => (
          <Bone key={column} className="h-64 w-64 shrink-0" />
        ))}
      </div>
      <div className="space-y-2 md:hidden">
        <Bone className="h-24 w-full" />
        <Bone className="h-24 w-full" />
      </div>
    </div>
  );
}
