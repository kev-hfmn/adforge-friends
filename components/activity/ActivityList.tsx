export function ActivityList({
  lines,
  empty,
}: {
  lines: { id: string; text: string }[];
  empty?: string;
}) {
  if (!lines.length) {
    return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  }
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line.id} className="text-sm">
          {line.text}
        </li>
      ))}
    </ul>
  );
}
