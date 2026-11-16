// Small markdown helpers for the hub sync. Headings, tables, lists.
// A file that does not match these is imported as one note by the parser.

export type MdSection = { heading: string; body: string };

export function splitSections(
  markdown: string,
  level: 2 | 3,
): { preamble: string; sections: MdSection[] } {
  const re = new RegExp(`^#{${level}} (?!#)(.*)$`);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: MdSection[] = [];
  const pre: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const match = re.exec(line);
    if (match) {
      if (current)
        sections.push({
          heading: current.heading.trim(),
          body: current.lines.join("\n").trim(),
        });
      current = { heading: match[1].trim(), lines: [] };
    } else if (current) current.lines.push(line);
    else pre.push(line);
  }
  if (current)
    sections.push({
      heading: current.heading.trim(),
      body: current.lines.join("\n").trim(),
    });
  return { preamble: pre.join("\n").trim(), sections };
}

export function h1(markdown: string): string {
  const line = markdown.split("\n").find((row) => /^# (?!#)/.test(row));
  return line ? line.replace(/^# /, "").trim() : "Note";
}

export type MdTable = { headers: string[]; rows: string[][] };

function cells(line: string): string[] {
  const raw = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return raw.split("|").map((cell) =>
    cell
      .trim()
      .replace(/\*\*/g, "")
      .replace(/^["']+|["']+$/g, "")
      .trim(),
  );
}

export function firstTable(body: string): MdTable | null {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    if (!/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const headers = cells(lines[i]);
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j++) {
      if (!lines[j].trim().startsWith("|")) break;
      const row = cells(lines[j]);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
    }
    if (headers.length && rows.length) return { headers, rows };
  }
  return null;
}

export function column(table: MdTable, name: RegExp): number {
  return table.headers.findIndex((header) => name.test(header));
}

export function bullets(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => /^\s*- /.test(line))
    .map((line) => line.replace(/^\s*-\s+(\[[ x]\]\s*)?/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

export function checks(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => /^\s*- \[[ x]\]/.test(line))
    .map((line) => line.replace(/^\s*- \[[ x]\]\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

export function numberedItems(body: string): { n: string; text: string }[] {
  return body
    .split(/^(?=\d+[a-z]?\.\s+)/m)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = /^(\d+[a-z]?)\.\s+([\s\S]+)/.exec(part);
      return match ? [{ n: match[1], text: match[2].trim() }] : [];
    });
}

export function boldParas(body: string): { title: string; text: string }[] {
  return body
    .split(/\n(?=\*\*)/)
    .map((chunk) => chunk.trim())
    .flatMap((chunk) => {
      const match = /^\*\*([^*]+)\*\*\.?\s*([\s\S]*)$/.exec(chunk);
      if (!match) return [];
      const title = match[1].replace(/\.$/, "").trim();
      const text = [title, match[2].trim()].filter(Boolean).join(". ").replace(/\.\./g, ".");
      return title ? [{ title, text }] : [];
    });
}

export function bareHeading(heading: string): string {
  return heading
    .replace(/^\d+[a-z]?\.\s*/, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function lineField(body: string, label: string): string {
  const match = new RegExp(`^- ${label}:\\s*(.+)$`, "m").exec(body);
  return match?.[1]?.replace(/\*\*/g, "").trim() ?? "";
}
