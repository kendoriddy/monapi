function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--foreground)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; lang: string; content: string }
  | { type: "table"; rows: string[][] };

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({
        type: "code",
        lang,
        content: codeLines.join("\n").trimEnd(),
      });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i]
          .trim()
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          rows.push(row);
        }
        i += 1;
      }
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const paraLines: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("- ")
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

export function ProductDocs({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <article className="prose-monapi space-y-4 text-sm leading-relaxed text-[var(--foreground)]">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h2":
            return (
              <h2
                key={idx}
                className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--foreground)]"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={idx}
                className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--foreground)]"
              >
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={idx} className="text-[var(--muted)]">
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul
                key={idx}
                className="list-inside list-disc space-y-1 text-[var(--muted)]"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-xs leading-relaxed text-[var(--foreground)]"
              >
                {block.content}
              </pre>
            );
          case "table":
            return (
              <div
                key={idx}
                className="overflow-x-auto rounded-lg border border-[var(--border)]"
              >
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--muted)]">
                    <tr>
                      {block.rows[0]?.map((cell, j) => (
                        <th key={j} className="px-3 py-2 font-medium">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-[var(--border)]">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-2 text-[var(--muted)]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </article>
  );
}
