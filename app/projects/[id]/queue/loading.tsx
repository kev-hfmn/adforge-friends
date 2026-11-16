import { Bone } from "@/components/studio/bones";

export default function PostsLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6" aria-busy="true">
      <p className="sr-only">Loading posts</p>
      <Bone className="h-8 w-64" />
      <Bone className="h-4 w-full max-w-xl" />
      <Bone className="h-11 w-full max-w-lg" />
      <div className="space-y-2">
        {["a", "b", "c", "d"].map((row) => (
          <Bone key={row} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
