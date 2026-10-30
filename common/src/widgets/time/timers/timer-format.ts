const DEFAULT_SYNTAX = "HH:mm:ss";
const TOKEN_PATTERN = /HH|mm|ss|H|m|s/g;
const isLetter = (value) => value !== undefined && /[A-Za-z]/.test(value);

const formatSyntax = (syntax, values) => {
  const matches = [...syntax.matchAll(TOKEN_PATTERN)];
  let output = "";
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.index;
    const end = start + match[0].length;
    const previous = matches[index - 1];
    const next = matches[index + 1];
    const adjacentToPreviousToken = previous && previous.index + previous[0].length === start;
    const adjacentToNextToken = next && end === next.index;
    if ((isLetter(syntax[start - 1]) && !adjacentToPreviousToken) || (isLetter(syntax[end]) && !adjacentToNextToken)) return;
    output += syntax.slice(cursor, start) + values[match[0]];
    cursor = end;
  });
  return output + syntax.slice(cursor);
};

export const formatDuration = (milliseconds, syntax = DEFAULT_SYNTAX) => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const values = {
    HH: String(hours).padStart(2, "0"),
    H: String(hours),
    mm: String(minutes).padStart(2, "0"),
    m: String(minutes),
    ss: String(seconds).padStart(2, "0"),
    s: String(seconds),
  };
  return formatSyntax(syntax ?? DEFAULT_SYNTAX, values);
};
