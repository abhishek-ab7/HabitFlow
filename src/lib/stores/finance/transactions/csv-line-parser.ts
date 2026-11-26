export interface CsvColumnIndices {
  dateIdx: number;
  titleIdx: number;
  amountIdx: number;
  typeIdx: number;
  catIdx: number;
}

function handleQuoteChar(line: string, idx: number, inQuotes: boolean) {
  if (inQuotes && line[idx + 1] === '"') {
    return { append: '"', nextIdx: idx + 1, nextInQuotes: inQuotes };
  }
  return { append: '', nextIdx: idx, nextInQuotes: !inQuotes };
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const q = handleQuoteChar(line, i, inQuotes);
      current += q.append;
      i = q.nextIdx;
      inQuotes = q.nextInQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function resolveColumnIndices(headerLine: string): CsvColumnIndices {
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase());
  return {
    dateIdx: headers.findIndex((h) => h.includes('date')),
    titleIdx: headers.findIndex(
      (h) =>
        h.includes('title') ||
        h.includes('description') ||
        h.includes('narration') ||
        h.includes('merchant') ||
        h.includes('particular')
    ),
    amountIdx: headers.findIndex((h) => h.includes('amount') || h.includes('value')),
    typeIdx: headers.findIndex((h) => h.includes('type') || h.includes('cr/dr')),
    catIdx: headers.findIndex((h) => h.includes('category')),
  };
}
