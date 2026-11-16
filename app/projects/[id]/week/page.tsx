import { redirect } from "next/navigation";

/** The old Week address. Plan is the calendar now. */
export default async function WeekRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string; post?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  if (search.w) query.set("w", search.w);
  if (search.post) query.set("post", search.post);
  const text = query.toString();
  redirect(`/projects/${id}/plan${text ? `?${text}` : ""}`);
}
