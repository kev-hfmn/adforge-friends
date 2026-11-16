import { Bone } from "@/components/studio/bones";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-8" aria-busy="true">
      <p className="sr-only">Loading home</p>
      <Bone className="h-4 w-24" />
      <Bone className="h-28 w-full" />
      <Bone className="h-4 w-28" />
      <div className="grid grid-cols-7 gap-1">
        {["m", "t", "w", "h", "f", "s", "u"].map((day) => (
          <Bone key={day} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Bone className="h-28" />
        <Bone className="h-28" />
        <Bone className="h-28" />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Bone className="h-40" />
        <Bone className="h-40" />
      </div>
    </div>
  );
}
