export type AnswerValue = string | number | boolean | string[] | null;
export interface ConditionalQuestion {
  id: string;
  parent_question_id?: string | null;
  show_if_answer?: unknown;
  condition_rules?: { operator?: string; value?: unknown } | null;
}
export function visibleQuestions<T extends ConditionalQuestion>(
  questions: T[],
  answers: Record<string, AnswerValue>,
): T[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  function visible(question: T, visited = new Set<string>()): boolean {
    if (!question.parent_question_id) return true;
    if (visited.has(question.id)) return false;
    visited.add(question.id);
    const parent = byId.get(question.parent_question_id);
    const answer = parent ? answers[parent.id] : null;
    if (answer === undefined || answer === null) return false;
    const rules = question.condition_rules;
    const expected = rules ? rules.value : question.show_if_answer;
    const equals = JSON.stringify(answer) === JSON.stringify(expected);
    const matches = rules
      ? rules.operator === "not_equals"
        ? !equals
        : rules.operator === "contains"
          ? Array.isArray(answer)
            ? answer.includes(String(expected))
            : typeof answer === "string" && answer.includes(String(expected))
          : equals
      : Array.isArray(expected)
        ? Array.isArray(answer)
          ? answer.some((value) => expected.includes(value))
          : expected.includes(answer)
        : Array.isArray(answer)
          ? answer.includes(String(expected))
          : equals;
    return !!parent && visible(parent, visited) && matches;
  }
  return questions.filter((question) => visible(question));
}
