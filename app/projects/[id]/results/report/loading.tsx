import { Bone } from "@/components/studio/bones";

export default function ReportLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <p className="sr-only">Loading the weekly report</p>
      <Bone className="h-10 w-56" />
      <Bone className="h-64 w-full" />
      <Bone className="h-24 w-full" />
    </div>
  );
}
