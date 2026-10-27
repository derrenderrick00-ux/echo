const BASE_NAMES = new Map([['binary', 2], ['bin', 2], ['base 2', 2], ['octal', 8], ['oct', 8], ['base 8', 8], ['decimal', 10], ['dec', 10], ['base 10', 10], ['hex', 16], ['hexadecimal', 16], ['base 16', 16]]);
const DIGITS = '0123456789ABCDEF';

function baseOf(value) {
  const cleaned = String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  return BASE_NAMES.get(cleaned) ?? null;
}

function parseValue(raw, base) {
  const literal = String(raw).replace(/_/g, '').toUpperCase();
  const negative = literal.startsWith('-');
  const unsigned = negative ? literal.slice(1) : literal;
  const digits = unsigned.replace(/^0[BXO]/i, '');
  if (!digits || digits.length > 100 || [...digits].some(d => DIGITS.indexOf(d) < 0 || DIGITS.indexOf(d) >= base)) throw new Error(`Invalid base-${base} integer. Valid digits are ${DIGITS.slice(0, base)}.`);
  let value = 0n;
  for (const ch of digits) value = value * BigInt(base) + BigInt(DIGITS.indexOf(ch));
  return negative ? -value : value;
}

export function convertNumber(value, fromBase, toBase, { steps = false } = {}) {
  if (![2, 8, 10, 16].includes(fromBase) || ![2, 8, 10, 16].includes(toBase)) throw new Error('Supported bases: 2, 8, 10, 16.');
  const decimal = parseValue(value, fromBase);
  const sign = decimal < 0n ? '-' : '';
  const abs = decimal < 0n ? -decimal : decimal;
  const output = sign + abs.toString(toBase).toUpperCase();
  const fromValue = sign + abs.toString(fromBase).toUpperCase();
  const description = `${fromValue} (base ${fromBase}) = ${output} (base ${toBase}).`;
  if (!steps || fromBase === toBase) return description;
  const stages = [];
  if (fromBase !== 10) stages.push(`Read ${fromValue} in base ${fromBase}: ${decimal.toString()} in decimal.`);
  if (toBase !== 10) {
    let current = abs;
    if (current === 0n) stages.push('0 converts to 0 in every supported base.');
    while (current > 0n && stages.length < 105) {
      const quotient = current / BigInt(toBase);
      const remainder = current % BigInt(toBase);
      stages.push(`${current} ÷ ${toBase} = ${quotient}, remainder ${DIGITS[Number(remainder)]}.`);
      current = quotient;
    }
    stages.push(`Read remainders bottom to top${sign ? ' and restore the negative sign' : ''}: ${output}.`);
  }
  stages.push(`Verification: ${output} in base ${toBase} equals ${decimal.toString()} in decimal.`);
  return `${description}\n${stages.join('\n')}`;
}

function convertMatch(text) {
  const base = '(binary|bin|octal|oct|decimal|dec|hexadecimal|hex|base\\s*(?:2|8|10|16))';
  const literal = '(-?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|[0-9A-Fa-f_]+))';
  const patterns = [
    new RegExp(`^(?:please\\s+)?(?:convert\\s+)?${literal}\\s+(?:from\\s+${base}\\s+)?(?:to|in|into|as)\\s+${base}(?:\\s+(?:step\\s*by\\s*step|with\\s+steps))?$`, 'i'),
    new RegExp(`^(?:what(?:'s|\\s+is)\\s+)?${literal}\\s+(?:in|to)\\s+${base}(?:\\s+(?:step\\s*by\\s*step|with\\s+steps))?$`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (!found) continue;
    const input = found[1];
    const hasFrom = Boolean(found[2]) && found.length > 3;
    const from = hasFrom ? baseOf(found[2]) : /^-?0x/i.test(input) ? 16 : /^-?0b/i.test(input) ? 2 : /^-?0o/i.test(input) ? 8 : 10;
    const to = baseOf(found[found.length > 3 ? 3 : 2]);
    if (!to || !from) return null;
    return { input, from, to, steps: /step\s*by\s*step|with\s+steps/i.test(text) };
  }
  return null;
}

export function parseBaseConversion(raw) {
  const text = String(raw).trim().replace(/[.!?]+$/, '').trim();
  const match = convertMatch(text);
  if (!match) return null;
  return convertNumber(match.input, match.from, match.to, { steps: match.steps });
}

export function parseBinaryToDecimal(raw) {
  const text = String(raw).trim();
  const found = text.match(/^(?:convert\s+)?([01]{1,100})\s+(?:from\s+binary\s+)?(?:to|in)\s+(?:decimal|base\s*10)[.?!]?$/i);
  return found ? convertNumber(found[1], 2, 10) : null;
}
