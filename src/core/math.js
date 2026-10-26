export function binaryAddition(left, right) {
  const a = BigInt(left);
  const b = BigInt(right);
  if (a < 0n || b < 0n || a > 1000000000000000000n || b > 1000000000000000000n) throw new Error('Binary demonstration accepts non-negative integers up to 10^18.');
  const sum = a + b;
  const lhs = a.toString(2);
  const rhs = b.toString(2);
  const result = sum.toString(2);
  const width = Math.max(lhs.length, rhs.length, result.length);
  const steps = [];
  let carry = 0;
  for (let i = 0; i < width; i++) {
    const bitA = Number((a >> BigInt(i)) & 1n);
    const bitB = Number((b >> BigInt(i)) & 1n);
    const total = bitA + bitB + carry;
    const output = total % 2;
    const nextCarry = Math.floor(total / 2);
    steps.push(`Column ${i} (2^${i}): ${bitA} + ${bitB} + carry ${carry} = ${total}; write ${output}, carry ${nextCarry}.`);
    carry = nextCarry;
  }
  return [
    `${left} + ${right} = ${sum} (decimal)`,
    `${left} = ${lhs} (binary)`,
    `${right} = ${rhs} (binary)`,
    'Binary column addition (right to left; carry 1 when a column totals 2 or 3):',
    `  ${lhs.padStart(width)}`,
    `+ ${rhs.padStart(width)}`,
    `  ${'-'.repeat(width)}`,
    `  ${result.padStart(width)}`,
    ...steps,
    `Verification: ${result}₂ = ${sum}₁₀.`,
  ].join('\n');
}

export function binaryAdditionMany(numbers) {
  if (!Array.isArray(numbers) || numbers.length < 3 || numbers.length > 10) throw new Error('Provide between 3 and 10 integers.');
  const values = numbers.map(value => BigInt(value));
  if (values.some(value => value < 0n || value > 1000000000000000000n)) throw new Error('Binary demonstration accepts non-negative integers up to 10^18.');
  const sum = values.reduce((a, b) => a + b, 0n);
  const width = sum.toString(2).length;
  const steps = [];
  let carry = 0;
  for (let i = 0; i < width; i++) {
    const bits = values.map(value => Number((value >> BigInt(i)) & 1n));
    const total = bits.reduce((a,b) => a + b, carry);
    steps.push(`Column ${i} (2^${i}): ${bits.join(' + ')} + carry ${carry} = ${total}; write ${total % 2}, carry ${Math.floor(total / 2)}.`);
    carry = Math.floor(total / 2);
  }
  return [
    `${numbers.join(' + ')} = ${sum} (decimal)`,
    ...values.map((value, index) => `${numbers[index]} = ${value.toString(2)} (binary)`),
    'Binary column addition (right to left):',
    ...values.map((value, index) => `${index === values.length - 1 ? '+ ' : '  '}${value.toString(2).padStart(width)}`),
    `  ${'-'.repeat(width)}`,
    `  ${sum.toString(2)}`,
    ...steps,
    `Verification: ${sum.toString(2)}₂ = ${sum}₁₀.`,
  ].join('\n');
}

export function calculateText(input) {
  const text = String(input).trim().replace(/[?.!]$/, '').trim();
  const sequence = text.match(/^(?:(?:please\s+)?(?:show\s+(?:me\s+)?the\s+(?:step[ -]by[ -]step\s+)?(?:calculation\s+)?process\s+for|calculate|compute)\s+)?(\d{1,19}(?:\s*\+\s*\d{1,19}){2,9})\s+(?:(?:step[ -]by[ -]step\s+)?(?:calculation\s+)?in\s+binary|(?:step[ -]by[ -]step\s+)?binary\s+(?:addition|calculation)|in\s+base\s*2)$/i);
  if (sequence) return binaryAdditionMany(sequence[1].split('\+').map(x => x.trim()));
  const claim = text.match(/^(?:i (?:think|believe) )?(-?\d{1,19})\s*([+*-])\s*(-?\d{1,19})\s*(?:=|is|equals)\s*(-?\d{1,30})$/i);
  if (claim) {
    const a = BigInt(claim[1]), b = BigInt(claim[3]), stated = BigInt(claim[4]);
    const correct = claim[2] === '+' ? a + b : claim[2] === '-' ? a - b : a * b;
    return correct === stated ? `Verified: ${claim[1]} ${claim[2]} ${claim[3]} = ${correct}.` : `Correction: ${claim[1]} ${claim[2]} ${claim[3]} = ${correct}, not ${stated}.`;
  }
  let found = text.match(/^(?:(?:please\s+)?(?:show\s+(?:me\s+)?the\s+(?:calculation\s+)?process\s+for|calculate|compute|show|i (?:need|want) (?:a )?direct answer (?:on|for|to)|(?:just )?give me (?:the )?(?:direct )?answer (?:for|to))\s+)?(\d{1,19})\s*\+\s*(\d{1,19})\s+(?:in\s+binary|in\s+base\s*2|using\s+binary)$/i);
  if (found) {
    const sum = BigInt(found[1]) + BigInt(found[2]);
    if (/\bdirect answer\b/i.test(text)) return `${found[1]} + ${found[2]} = ${sum}₁₀ = ${sum.toString(2)}₂.`;
    return binaryAddition(found[1], found[2]);
  }
  found = text.match(/^(?:(?:please\s+)?convert\s+)?(\d{1,100})\s+(?:(?:convert\s+)?to\s+(?:base\s*2|binary)|(?:from\s+decimal\s+)?to\s+binary)$/i);
  if (found) {
    const decimal = BigInt(found[1]);
    return `${decimal.toString()} in binary is ${decimal.toString(2)}.`;
  }
  found = text.match(/^(?:(?:what(?:'s| is)|calculate|compute)\s+)?(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/i);
  if (!found) return null;
  const [, left, op, right] = found;
  const lhs = Number(left);
  const rhs = Number(right);
  if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return 'Cannot calculate: operands are too large.';
  if (op === '/' && rhs === 0) return 'Division by zero is undefined.';
  if (/^-?\d+$/.test(left) && /^-?\d+$/.test(right) && op !== '/') {
    const a = BigInt(left);
    const b = BigInt(right);
    const result = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return `${left} ${op} ${right} = ${result}`;
  }
  const result = op === '+' ? lhs + rhs : op === '-' ? lhs - rhs : op === '*' ? lhs * rhs : lhs / rhs;
  return `${left} ${op} ${right} = ${result} (JavaScript floating-point arithmetic)`;
}
