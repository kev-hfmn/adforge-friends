import { redirect } from "next/navigation";

// The old "Assets Library" was a second list of posts. Posts live under Posts now;
// reusable screenshots and photos live in the Library.
export default async function OldAssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/projects/${(await params).id}/library`);
}
