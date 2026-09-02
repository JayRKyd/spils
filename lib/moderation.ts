// Basic text moderation for Community content.
// Filtering is an additional safeguard — Report + Block + Admin Remove are the
// primary controls. Matching is case-insensitive, tolerates punctuation/spacing
// between words (e.g. "c.h.i.l.d p-o-r-n" family of evasions for multi-word
// terms), and uses word boundaries so short terms don't false-positive inside
// normal words (cp ≠ cpu, fag ≠ fagus).

const AUTO_BLOCK_TERMS = [
  "child porn", "child pornography", "cp", "underage sex", "rape",
  "sexual assault", "terrorist recruitment",
  "nigger", "nigga", "faggot", "fag", "tranny", "kike", "chink", "gook",
  "wetback", "spic",
  "buy cocaine", "sell cocaine", "buy meth", "sell meth",
  "buy fentanyl", "sell fentanyl", "buy gun", "sell gun",
  "phishing", "send your password", "send your credit card",
];

const FLAG_TERMS = [
  "suicide", "suicidal", "self-harm", "self harm", "kill yourself", "kys",
  "nude", "nudes", "naked", "porn", "pornography", "scam",
];

function termToRegex(term: string): RegExp {
  const words = term.toLowerCase().split(/[\s-]+/);
  const escaped = words
    .map((w) => {
      const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Longer single words also tolerate separators between letters
      // ("n i g g e r", "f.a.g.g.o.t"). Short words skip this — per-letter
      // gaps there would false-match innocent phrases ("go ok" vs gook).
      if (words.length === 1 && w.length >= 5) {
        return safe.split("").join("[\\W_]*");
      }
      return safe;
    })
    .join("[\\s\\W_]*");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
}

const AUTO_BLOCK = AUTO_BLOCK_TERMS.map((t) => ({ term: t, re: termToRegex(t) }));
const FLAG = FLAG_TERMS.map((t) => ({ term: t, re: termToRegex(t) }));

export type ModerationVerdict =
  | { verdict: "block"; term: string }
  | { verdict: "flag"; term: string }
  | { verdict: "ok" };

export function checkModeration(text: string): ModerationVerdict {
  const t = ` ${(text ?? "").toLowerCase()} `;
  for (const { term, re } of AUTO_BLOCK) {
    if (re.test(t)) return { verdict: "block", term };
  }
  for (const { term, re } of FLAG) {
    if (re.test(t)) return { verdict: "flag", term };
  }
  return { verdict: "ok" };
}
