// Deterministic arithmetic and base conversion for unambiguous, bounded requests.
// Do not use eval() or the language model as the arithmetic engine.
export function calculateText(input) {
  const text = String(input).trim().replace(/[?.!]$/, '').trim();
  const base = text.match(/^(?:(?:please\s+)?convert\s+)?(\d{1,100})\s+(?:(?:convert\s+)?to\s+(?:base\s*2|binary)|(?:from\s+decimal\s+)?to\s+binary)$/i);
  if (base) {
    const decimal = BigInt(base[1]);
    return `${decimal.toString()} in binary is ${decimal.toString(2)}.`;
  }
  const expr = text.match(/^(?:(?:what(?:'s| is)|calculate|compute)\s+)?(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/i);
  if (!expr) return null;
  const [, , op] = expr;
  const lhs = Number(expr[1]), rhs = Number(expr[3]);
  if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return 'Cannot calculate: operands are too large.';
  if (op === '/' && rhs === 0) return 'Division by zero is undefined.';
  if (Number.isInteger(lhs) && Number.isInteger(rhs) && Number.isSafeInteger(lhs) && Number.isSafeInteger(rhs) && op !== '/') {
    const a = BigInt(expr[1]);
    const b = BigInt(expr[3]);
    const result = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return `${expr[1]} ${op} ${expr[3]} = ${result.toString()}`;
  }
  const result = op === '+' ? lhs + rhs : op === '-' ? lhs - rhs : op === '*' ? lhs * rhs : lhs / rhs;
  return `${expr[1]} ${op} ${expr[3]} = ${result} (JavaScript floating-point arithmetic)`;
}
