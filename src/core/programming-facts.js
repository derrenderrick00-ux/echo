export function programmingFact(raw, { previousAnswer = '' } = {}) {
  const text = String(raw).trim();
  if (/^(?:teach me|explain|what are|what is|how do (?:javascript|js))\s+(?:(?:javascript|js)\s+)?arrow\s+functions?\??$/i.test(text)) {
    return [
      'JavaScript arrow functions use => between parameters and the body.',
      'Example: const add = (a, b) => a + b;',
      'One parameter can omit parentheses: const square = x => x * x;',
      'For a block body, use return explicitly: const square = x => { return x * x; };',
      'Arrow functions do not create their own this or arguments. They inherit this lexically.',
      'Parameter names are NOT inferred; you must declare them. Arrow functions cannot be constructors.',
      'Try: write an arrow function to check whether a number is even.',
      'These syntax facts are deterministic; behavior of arbitrary generated code still requires testing.',
    ].join('\n');
  }
  if ((/%/.test(text) && /\b(?:what|why|explain)\b/i.test(text) && (previousAnswer.includes('%') || /\b(?:c|program|code|rand|printf)\b/i.test(text))) || /\b(?:what (?:does|is)|explain|why (?:is|use))\b.*(?:percent|modulo|remainder)\b/i.test(text) || /^(?:explain|what does)\s+%\s+(?:mean|do|stand for)(?:\s+in\s+(?:the\s+)?(?:code|program))?\??$/i.test(text)) {
    const context = previousAnswer.includes('rand() %') || previousAnswer.includes('printf(');
    if (!context && !/\b(?:c|program|code|rand|printf|modulo|remainder)\b/i.test(text)) return null;
    return [
      'The % character has two different roles in the C program:',
      '1. In rand() % 100, % is the remainder operator. It produces values 0–99; adding 1 gives 1–100.',
      '2. In printf("%d", number), %d is an integer format specifier, not the remainder operator.',
      'In JavaScript template strings, ${expression} interpolates an expression; in Python, f"{expression}" does something similar.',
      'C rand() is not cryptographically secure; modulo reduction can also introduce distribution bias.',
    ].join('\n');
  }
  return null;
}
