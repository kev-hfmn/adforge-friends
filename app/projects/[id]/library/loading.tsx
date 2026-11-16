import { Bone } from "@/components/studio/bones";

export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6" aria-busy="true">
      <p className="sr-only">Loading the library</p>
      <Bone className="h-8 w-40" />
      <Bone className="h-11 w-28" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {["a", "b", "c", "d", "e", "f"].map((card) => (
          <Bone key={card} className="aspect-[4/5]" />
        ))}
      </div>
    </div>
  );
}
