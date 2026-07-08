const MAX_CHUNK_LENGTH = 3500;

function splitLongParagraph(paragraph: string, maxLen: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current);
      current = sentence;
    } else if (sentence.length > maxLen) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxLen) {
        chunks.push(sentence.slice(i, i + maxLen));
      }
    } else {
      current += sentence;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function splitTextIntoChunks(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLen) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongParagraph(paragraph, maxLen));
    } else if (current.length + paragraph.length + 2 > maxLen) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}
