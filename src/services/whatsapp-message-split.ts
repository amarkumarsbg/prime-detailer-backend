/** Twilio WhatsApp session (free-form) message body limit. */
export const WHATSAPP_SESSION_BODY_MAX = 1600;

function partLabel(index: number, total: number): string {
  return `(${index}/${total})`;
}

function splitAtBoundaries(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  let current = "";

  const flush = () => {
    const t = current.trim();
    if (t) parts.push(t);
    current = "";
  };

  const appendUnit = (unit: string) => {
    if (!unit) return;
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length <= maxLen) {
      current = candidate;
      return;
    }
    flush();
    if (unit.length <= maxLen) {
      current = unit;
      return;
    }
    for (const line of unit.split("\n")) {
      const lineCand = current ? `${current}\n${line}` : line;
      if (lineCand.length <= maxLen) {
        current = lineCand;
        continue;
      }
      flush();
      if (line.length <= maxLen) {
        current = line;
        continue;
      }
      for (let i = 0; i < line.length; i += maxLen) {
        parts.push(line.slice(i, i + maxLen));
      }
    }
  };

  for (const para of text.split(/\n\n+/)) {
    appendUnit(para);
  }
  flush();

  return parts.length > 0 ? parts : [text.slice(0, maxLen)];
}

/** Split a long WhatsApp body into Twilio-safe chunks (≤1600 chars). */
export function splitWhatsAppMessage(
  body: string,
  maxLen = WHATSAPP_SESSION_BODY_MAX
): string[] {
  const trimmed = body.trim();
  if (trimmed.length <= maxLen) return [trimmed];

  const labelReserve = 12;
  let contentMax = maxLen - labelReserve;
  let chunks = splitAtBoundaries(trimmed, contentMax);

  const labelLen = (i: number, total: number) => `${partLabel(i, total)}\n`.length;
  const maxLabel = labelLen(chunks.length, chunks.length);
  if (maxLabel > labelReserve) {
    contentMax = maxLen - maxLabel;
    chunks = splitAtBoundaries(trimmed, contentMax);
  }

  if (chunks.length === 1) return chunks;
  return chunks.map((chunk, i) => `${partLabel(i + 1, chunks.length)}\n${chunk}`);
}
