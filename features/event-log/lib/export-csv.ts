/** A table as CSV text: values quoted when they hold a comma, a quote or a line break. */
export function toCsv(header: string[], rows: (string | number | undefined | null)[][]) {
  const cell = (value: string | number | undefined | null) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}

/** Saves text as a file in the browser's downloads. */
export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
