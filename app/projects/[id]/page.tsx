import { redirect } from "next/navigation";

// A project opens on Home: what needs you, what goes out next, how the last posts did.
export default async function ProjectRoot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/projects/${(await params).id}/home`);
}
