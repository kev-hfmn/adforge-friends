import { Bone } from "@/components/studio/bones";

export default function HubLoading() {
  return (
    <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]" aria-busy="true">
      <p className="sr-only">Loading the hub</p>
      <div className="space-y-2">
        <Bone className="h-11 w-full" />
        {["a", "b", "c", "d", "e", "f"].map((row) => (
          <Bone key={row} className="h-11 w-full" />
        ))}
      </div>
      <div className="space-y-2">
        {["a", "b", "c", "d", "e", "f", "g"].map((row) => (
          <Bone key={row} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
