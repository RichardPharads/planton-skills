// Questions with tap-to-answer options in the chat: when a plan depends on things only the person knows (where they
// train, what equipment they have), the AI asks with a ```choices block, which the phone draws as lettered buttons
// (choice-card.tsx). Pure and self-contained: the bridge's build copies this file too, so Claude Code on the PC is
// told the same rules (CHOICES_INSTRUCTIONS).

export type ChoiceOption = { label: string; description?: string; recommended?: boolean };
export type ChoiceQuestion = { question: string; header?: string; options: ChoiceOption[]; multiple?: boolean };
export type Choices = { questions: ChoiceQuestion[] };

/** One question's answer: the options picked, by index, and what was typed under Other. */
export type ChoiceAnswer = { picked: number[]; other?: string };

export const CHOICES_TAG = "choices";
export const CHOICE_LIMITS = { questions: 4, minOptions: 2, options: 5, question: 200, header: 24, label: 80, description: 160 };
export const LETTERS = ["A", "B", "C", "D", "E", "F"];
/** Sent by "Skip, just make it" under a set of questions. */
export const SKIP_QUESTIONS_TEXT = "Skip the questions and make it with your best guesses.";
const OTHER_MAX = 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function readOption(value: unknown): ChoiceOption | null {
  if (typeof value === "string") {
    const label = cleanText(value, CHOICE_LIMITS.label);
    return label ? { label } : null;
  }
  if (!isRecord(value)) return null;
  const label = cleanText(value.label, CHOICE_LIMITS.label);
  if (!label) return null;
  const option: ChoiceOption = { label };
  const description = cleanText(value.description, CHOICE_LIMITS.description);
  if (description) option.description = description;
  if (value.recommended === true) option.recommended = true;
  return option;
}

function readQuestion(value: unknown): ChoiceQuestion | null {
  if (!isRecord(value) || !Array.isArray(value.options)) return null;
  const text = cleanText(value.question, CHOICE_LIMITS.question);
  if (!text) return null;
  const options = value.options
    .map(readOption)
    .filter((option): option is ChoiceOption => option !== null)
    .slice(0, CHOICE_LIMITS.options);
  if (options.length < CHOICE_LIMITS.minOptions) return null;
  // One suggestion per question: the first one marked.
  let marked = false;
  for (const option of options) {
    if (option.recommended && marked) delete option.recommended;
    if (option.recommended) marked = true;
  }
  const question: ChoiceQuestion = { question: text, options };
  const header = cleanText(value.header, CHOICE_LIMITS.header);
  if (header) question.header = header;
  if (value.multiple === true) question.multiple = true;
  return question;
}

/** The questions in a choices block's JSON, or null when it isn't a usable set (no question with two options). */
export function parseChoices(json: string): Choices | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  // A lone question is taken as a set of one.
  const list = isRecord(raw) && Array.isArray(raw.questions) ? raw.questions : isRecord(raw) && "question" in raw ? [raw] : null;
  if (!list) return null;
  const questions = list
    .map(readQuestion)
    .filter((question): question is ChoiceQuestion => question !== null)
    .slice(0, CHOICE_LIMITS.questions);
  return questions.length > 0 ? { questions } : null;
}

const FENCE = /```choices[^\n]*\n([\s\S]*?)\n?```/g;

/** Takes the last usable choices block out of a reply; a block that can't be read stays as text. */
export function splitChoices(text: string): { shown: string; choicesText: string | null } {
  let found: { start: number; end: number; json: string } | null = null;
  for (const match of text.matchAll(FENCE)) {
    const json = match[1].trim();
    if (parseChoices(json)) found = { start: match.index, end: match.index + match[0].length, json };
  }
  if (!found) return { shown: text, choicesText: null };
  const shown = (text.slice(0, found.start) + text.slice(found.end)).replace(/\n{3,}/g, "\n\n").trim();
  return { shown, choicesText: found.json };
}

/** The choices block as the model wrote it, to go back with the conversation so it knows what it asked. */
export function choicesBlock(choicesText: string): string {
  return `\`\`\`${CHOICES_TAG}\n${choicesText}\n\`\`\``;
}

/** Whether a question has an answer: an option picked, or something typed under Other. */
export function isAnswered(answer: ChoiceAnswer | undefined): boolean {
  return !!answer && (answer.picked.length > 0 || !!answer.other?.trim());
}

/** Every question answered, so the answers can be sent. */
export function answersReady(choices: Choices, answers: ChoiceAnswer[]): boolean {
  return choices.questions.every((_, index) => isAnswered(answers[index]));
}

/** A tap on an option: one answer per question, or toggled on and off when several can apply. */
export function pickOption(question: ChoiceQuestion, answer: ChoiceAnswer | undefined, index: number): ChoiceAnswer {
  const current = answer ?? { picked: [] };
  if (!question.multiple) return { picked: [index] };
  const picked = current.picked.includes(index)
    ? current.picked.filter((item) => item !== index)
    : [...current.picked, index].sort((a, b) => a - b);
  return { ...current, picked };
}

/**
 * The answers as the message sent back, one line per question ("Place: At a gym"); a set of one question is just its
 * answer, so "Ask me a few questions" reads as the person saying it.
 */
export function answerText(choices: Choices, answers: ChoiceAnswer[]): string {
  const lines = choices.questions.map((question, index) => {
    const answer = answers[index] ?? { picked: [] };
    const parts = answer.picked
      .filter((pick) => pick >= 0 && pick < question.options.length)
      .map((pick) => question.options[pick].label);
    const other = answer.other?.trim().slice(0, OTHER_MAX);
    if (other) parts.push(other);
    const value = parts.join(", ") || "No preference";
    if (choices.questions.length === 1) return value;
    return `${question.header ?? question.question}: ${value}`;
  });
  return lines.join("\n");
}

/** Saved answers read back, dropping anything that doesn't fit the questions. */
export function readAnswers(value: unknown, choices: Choices | null): ChoiceAnswer[] | null {
  if (!choices || !Array.isArray(value)) return null;
  const answers = choices.questions.map((question, index): ChoiceAnswer => {
    const item = value[index];
    if (!isRecord(item) || !Array.isArray(item.picked)) return { picked: [] };
    const picked = item.picked.filter(
      (pick): pick is number => Number.isInteger(pick) && pick >= 0 && pick < question.options.length,
    );
    const answer: ChoiceAnswer = { picked: question.multiple ? picked : picked.slice(0, 1) };
    if (typeof item.other === "string" && item.other.trim()) answer.other = item.other.slice(0, OTHER_MAX);
    return answer;
  });
  return answers.some(isAnswered) ? answers : null;
}

/** What the AI is told about asking, for the in-app chat and for Claude Code on the PC alike. */
export const CHOICES_INSTRUCTIONS = `Asking before a plan
When someone asks for a plan and a good one depends on things only they know, don't guess: ask, with a choices block, which their phone shows as buttons they tap. A fitness plan, for example, depends on where they train, what equipment they have, their goal and how many days a week.

1. First ask whether they want a few quick questions or a general plan now: one short sentence on why the questions help, then a choices block with one question and two options, "Ask me a few questions" (recommended) and "Just make a general plan".
2. If they want the questions, ask them all in one choices block: up to 4 questions, each with 2 to 4 short options. Mark the option you'd suggest for them as recommended, with a few words on why in its description. Set "multiple": true when several options can apply together (which parts of the body to train).
3. Then write the plan from their answers. Ask a second round only when an answer really needs it, never more than two rounds.

Skip all of this when the request already gives the details that matter, when they asked for a general plan, or for a quick question. Don't ask about anything you can pick a sensible default for. They can type their own answer instead of tapping one, and "No preference" means you choose.

The block, after your sentence, at most one per reply and never in the same reply as a plan:
\`\`\`choices
{"questions":[{"header":"Place","question":"Where will you train?","options":[{"label":"At a gym","description":"Machines and free weights","recommended":true},{"label":"At home, with some equipment"},{"label":"At home, no equipment"}]},{"header":"Focus","question":"What do you want to work on?","multiple":true,"options":[{"label":"Upper body"},{"label":"Lower body"},{"label":"Core"},{"label":"Cardio"}]}]}
\`\`\`
"header" is one or two words, "question" one sentence, "label" a few words, and "description" optional, under 12 words.`;
