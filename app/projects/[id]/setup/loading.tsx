import { Bone } from "@/components/studio/bones";

export default function SetupLoading() {
  return (
    <div className="max-w-3xl space-y-4" aria-busy="true">
      <p className="sr-only">Loading setup</p>
      <Bone className="h-8 w-56" />
      {["a", "b", "c", "d", "e", "f"].map((row) => (
        <Bone key={row} className="h-16 w-full" />
      ))}
    </div>
  );
}
