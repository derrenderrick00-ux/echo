import { randomInt } from 'node:crypto';

const QUESTIONS = Object.freeze([
  { q: 'Which part of a computer executes machine instructions?', options: ['RAM', 'CPU', 'SSD', 'Monitor'], a: 1, category: 'technology' },
  { q: 'Which protocol is commonly used to resolve domain names?', options: ['DNS', 'HDMI', 'USB', 'PNG'], a: 0, category: 'technology' },
  { q: 'Which number system uses only digits 0 and 1?', options: ['Octal', 'Decimal', 'Hexadecimal', 'Binary'], a: 3, category: 'technology' },
  { q: 'Which SQL clause filters rows?', options: ['FROM', 'WHERE', 'INSERT', 'ORDER'], a: 1, category: 'technology' },
  { q: 'Which planet is the largest in our solar system?', options: ['Earth', 'Jupiter', 'Mars', 'Venus'], a: 1, category: 'general' },
  { q: 'Which continent is Kenya in?', options: ['Asia', 'Africa', 'Europe', 'South America'], a: 1, category: 'general' },
  { q: 'Who wrote To Kill a Mockingbird?', options: ['Harper Lee', 'George Orwell', 'Jane Austen', 'Mark Twain'], a: 0, category: 'general' },
]);

const CHAIN_WORDS = ['river', 'rabbit', 'tiger', 'rose', 'elephant', 'table', 'eagle', 'energy', 'yellow', 'window', 'water', 'rocket', 'tree', 'engine', 'night', 'train', 'nature', 'earth', 'house', 'emerald', 'dog', 'garden', 'network'];

export class Games {
  constructor() { this.state = null; }
  start(type, category = 'technology') {
    if (type === 'trivia') {
      const bank = QUESTIONS.filter(q => category === 'general' || q.category === category);
      if (!bank.length) return 'Supported trivia categories: technology, general.';
      this.state = { type, category, bank, index: 0, score: 0 };
      return this.question();
    }
    if (type === 'wordchain') {
      this.state = { type, last: 'frog', used: new Set(['frog']) };
      return 'Word chain started. First word: FROG. Reply with a word starting with G. Type q to quit.';
    }
    if (type === 'guess') {
      this.state = { type, number: randomInt(1, 101), attempts: 0 };
      return 'I have chosen a number between 1 and 100. Guess it, or type q to quit.';
    }
    return 'Use /game trivia technology, /game trivia general, /game wordchain, or /game guess.';
  }
  question() {
    const s = this.state;
    if (!s || s.type !== 'trivia') return 'No trivia game is running.';
    if (s.index >= s.bank.length) { const out = `Game complete. Score: ${s.score}/${s.bank.length}.`; this.state = null; return out; }
    const item = s.bank[s.index];
    return `Question ${s.index + 1}/${s.bank.length}: ${item.q}\n${item.options.map((v,i) => `${'ABCD'[i]}) ${v}`).join('\n')}\nAnswer A–D, or q to quit.`;
  }
  respond(input) {
    if (!this.state) return null;
    const text = String(input).trim();
    if (/^(?:q|quit|exit game|stop game|stop playing|\/game quit)$/i.test(text)) { this.state = null; return 'Game ended.'; }
    if (this.state.type === 'trivia') {
      const item = this.state.bank[this.state.index];
      const chosen = /^[a-d]$/i.test(text) ? 'ABCD'.indexOf(text.toUpperCase()) : item.options.findIndex(o => o.toLowerCase() === text.toLowerCase());
      if (chosen < 0) return 'Reply A, B, C, D, or q to quit.\n' + this.question();
      const correct = chosen === item.a;
      if (correct) this.state.score++;
      this.state.index++;
      return `${correct ? 'Correct!' : `Not quite. Correct answer: ${'ABCD'[item.a]}) ${item.options[item.a]}.`} Score: ${this.state.score}/${this.state.index}.\n${this.question()}`;
    }
    if (this.state.type === 'guess') {
      if (!/^\d+$/.test(text)) return 'Enter an integer from 1 to 100, or q to quit.';
      const value = Number(text);
      if (!Number.isInteger(value) || value < 1 || value > 100) return 'Enter an integer from 1 to 100.';
      this.state.attempts++;
      if (value === this.state.number) { const tries = this.state.attempts; this.state = null; return `Correct! You guessed the number in ${tries} attempt(s).`; }
      return `${value < this.state.number ? 'Higher.' : 'Lower.'} Try again or q to quit.`;
    }
    if (this.state.type === 'wordchain') {
      const word = text.toLowerCase();
      if (!/^[a-z]{2,25}$/.test(word)) return 'Use one alphabetic word (at least 2 letters), or q to quit.';
      const last = this.state.last.slice(-1);
      if (!word.startsWith(last)) return `Your word must begin with ${last.toUpperCase()}.`;
      if (this.state.used.has(word)) return 'That word was already used. Try another.';
      this.state.used.add(word);
      const next = CHAIN_WORDS.find(w => w.startsWith(word.slice(-1)) && !this.state.used.has(w));
      if (!next) { this.state = null; return 'No unused reply in the local word bank. Game ended.'; }
      this.state.last = next;
      this.state.used.add(next);
      return `My word: ${next.toUpperCase()}. Your word must begin with ${next.slice(-1).toUpperCase()}. (q quits)`;
    }
    return null;
  }
}
