import { checkJavascriptSyntax } from './code-syntax.js';
import { ideaScore, parseIdeaLine } from './phase2-workspace.js';

const IDEA_USAGE = 'Ideas: /idea add Name | impact=1..5 | learning=1..5 | feasibility=1..5 | effort=1..5; /idea list; /idea rank; /idea brainstorm <problem>';
const DECISION_USAGE = 'Decisions: /decision add Question | Choice | Reason; /decision list; /decision find <query>; /decision outcome <id> | Result';
const PREF_USAGE = 'Preferences: /preference list; /preference set <response_style|study_method|accuracy_priority|current_focus> | <value>; /preference clear <key>';
const CODE_USAGE = 'Code: /code check; /code syntax <name.js>; /code files; /code run <name.js>; /code explain <name.js>; /code review <name.js>; /code generate <requirement>. Only files inside data/code-workspace are accessible.';

function formatIdeas(values) {
  if (!values.length) return 'No saved ideas.';
  return values.map(item => `[${item.id}] ${item.name}: ${item.score}/100 (impact ${item.impact}, learning ${item.learning}, feasibility ${item.feasibility}, effort ${item.effort})`).join('\n');
}

function formatDecisions(values) {
  if (!values.length) return 'No saved decisions.';
  return values.map(item => `[${item.id}] ${item.question}\n  Chosen: ${item.choice}\n  Reason: ${item.reason}\n  Outcome: ${item.outcome || 'not reported'}`).join('\n');
}

function prompt(kind, content) {
  if (kind === 'generate') return `Generate a small JavaScript program for this requirement: ${content}\nWrite clear Node.js ES module code with no comments. Include input validation and a brief usage example. Do not claim it has been tested. Never execute generated code or claim access to local files.`;
  if (kind === 'brainstorm') return `Brainstorm three distinct realistic software-project ideas about: ${content}. Give the main use case, prerequisites, complexity, and a verification plan for each. Distinguish assumptions from validated facts. Do not save or execute anything.`;
  if (kind === 'explain') return `Explain this user-provided JavaScript source step by step. Do not execute it. Clearly distinguish what is certain from what requires runtime testing.\n\n${content}`;
  if (kind === 'review') return `Perform a cautious static review of the following user-provided JavaScript. Identify errors, security concerns, and test cases. Do not claim tests were run or that the code is safe.\n\n${content}`;
  throw new Error('Unsupported prompt type.');
}

export class Phase2Commands {
  constructor({ workspace, sandbox }) {
    this.workspace = workspace;
    this.sandbox = sandbox;
  }
  async handle(line) {
    const lower = line.toLowerCase();
    if (lower === '/phase2' || lower === '/phase2 help') return { text: [IDEA_USAGE, DECISION_USAGE, PREF_USAGE, CODE_USAGE].join('\n') };
    if (lower === '/phase2 status') {
      const report = this.sandbox.inspect();
      return { text: `Phase 2 in development. ${this.workspace.listIdeas().length} ideas, ${this.workspace.listDecisions().length} decisions, ${Object.keys(this.workspace.getPreferences()).length} explicit preferences. Sandbox: ${report.detail}` };
    }
    if (lower === '/idea') return { text: IDEA_USAGE };
    if (lower === '/idea list') return { text: formatIdeas(this.workspace.listIdeas()) };
    if (lower === '/idea rank') return { text: 'Subjective, user-entered ratings (not objective predictions):\n' + formatIdeas(this.workspace.rankIdeas()) };
    if (lower.startsWith('/idea add ')) {
      const idea = await this.workspace.addIdea(parseIdeaLine(line.slice(10)));
      return { text: `Saved idea [${idea.id}]: ${idea.name}. User-rating score ${idea.score}/100. This is a prioritization aid, not a success prediction.` };
    }
    if (lower.startsWith('/idea brainstorm ')) {
      const topic = line.slice(17).trim();
      if (!topic || topic.length > 400) return { text: 'Give a problem statement of 1–400 characters.' };
      return { askModel: prompt('brainstorm', topic) };
    }
    if (lower === '/decision') return { text: DECISION_USAGE };
    if (lower === '/decision list') return { text: formatDecisions(this.workspace.listDecisions()) };
    if (lower.startsWith('/decision find ')) return { text: formatDecisions(this.workspace.findDecisions(line.slice(15).trim())) };
    if (lower.startsWith('/decision add ')) {
      const parts = line.slice(14).split('|').map(item => item.trim());
      if (parts.length !== 3) return { text: 'Usage: /decision add Question | Chosen option | Reason' };
      const item = await this.workspace.addDecision({ question: parts[0], choice: parts[1], reason: parts[2] });
      return { text: `Saved decision [${item.id}]. Chosen: ${item.choice}. No outcome recorded yet.` };
    }
    if (lower.startsWith('/decision outcome ')) {
      const match = line.slice(18).match(/^([0-9a-f]{8})\s*\|\s*(.+)$/is);
      if (!match) return { text: 'Usage: /decision outcome <id> | Actual result or feedback' };
      const item = await this.workspace.recordOutcome(match[1], match[2]);
      return { text: `Recorded outcome for decision [${item.id}]. This feedback is stored locally; the model weights were not retrained.` };
    }
    if (lower === '/preference') return { text: PREF_USAGE };
    if (lower === '/preference list') {
      const values = this.workspace.getPreferences();
      return { text: Object.keys(values).length ? Object.entries(values).map(([key, value]) => `${key}: ${value}`).join('\n') : 'No explicit Phase 2 preferences.' };
    }
    if (lower.startsWith('/preference set ')) {
      const match = line.slice(16).match(/^([a-z_]+)\s*\|\s*(.+)$/is);
      if (!match) return { text: PREF_USAGE };
      const item = await this.workspace.setPreference(match[1], match[2]);
      return { text: `Saved private preference ${item.key}: ${item.value}. It affects future prompts; it does not retrain Ollama.` };
    }
    if (lower.startsWith('/preference clear ')) {
      const key = line.slice(18).trim();
      return { text: await this.workspace.clearPreference(key) ? `Cleared ${key}.` : `${key} was not set.` };
    }
    if (lower === '/code') return { text: CODE_USAGE };
    if (lower === '/code check') return { text: this.sandbox.inspect().detail };
    if (lower === '/code files') {
      const files = await this.sandbox.listFiles();
      return { text: files.length ? files.map(item => `${item.name} (${item.size} bytes)`).join('\n') : 'No JS files in data/code-workspace. Create one there before using /code run.' };
    }
    if (lower.startsWith('/code syntax ')) {
      const name = line.slice(13).trim();
      const source = await this.sandbox.source(name);
      const check = checkJavascriptSyntax(source.content);
      return { text: `${name}: ${check.output}` };
    }
    if (lower.startsWith('/code run ')) {
      const name = line.slice(10).trim();
      const result = await this.sandbox.run(name);
      return { text: `Isolated execution finished. Exit code: ${result.exitCode}.\nstdout:\n${result.stdout || '(empty)'}\nstderr:\n${result.stderr || '(empty)'}\nSandbox status: ${result.isolated ? 'bubblewrap' : 'unverified'}.` };
    }
    if (lower.startsWith('/code explain ') || lower.startsWith('/code review ')) {
      const mode = lower.startsWith('/code explain ') ? 'explain' : 'review';
      const name = line.slice(mode === 'explain' ? 14 : 13).trim();
      const { content } = await this.sandbox.source(name);
      return { askModel: prompt(mode, content) };
    }
    if (lower.startsWith('/code generate ')) {
      const request = line.slice(15).trim();
      if (!request || request.length > 700) return { text: 'Give a requirement of 1–700 characters.' };
      return { askModel: prompt('generate', request) };
    }
    if (/^\/(?:code|idea|decision|preference|phase2)(?:\s|$)/.test(lower)) return { text: [IDEA_USAGE, DECISION_USAGE, PREF_USAGE, CODE_USAGE].join('\n') };
    return null;
  }
}
