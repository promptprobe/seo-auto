const MARKDOWN_PUNCTUATION = /[#>*_`~\[\](){}|:]+/g;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(MARKDOWN_PUNCTUATION, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompact(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, '');
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function markdownH2Headings(markdown: string): string[] {
  return [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]!.trim());
}

export function promisedListCount(value: string): number | null {
  const match = value.match(/(\d+)\s*(?:ways?|steps?|tips?|ideas?|items?|reasons?|가지|단계|방법|항목|팁)/i);
  return match ? Number(match[1]) : null;
}
