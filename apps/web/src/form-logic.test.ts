import { expect, test } from "vitest";
import { visibleQuestions } from "./form-logic";

test("hides dependent questions when the parent answer does not match", () => {
  const questions = [
    { id: "symptom" },
    { id: "photo", parent_question_id: "symptom", show_if_answer: "yes" },
  ];
  expect(
    visibleQuestions(questions, { symptom: "no" }).map((q) => q.id),
  ).toEqual(["symptom"]);
});

test("uses explicit contains and not-equals rules without revealing unanswered parents", () => {
  const questions = [
    { id: "symptom" },
    {
      id: "photo",
      parent_question_id: "symptom",
      condition_rules: { operator: "contains", value: "itch" },
    },
    {
      id: "notes",
      parent_question_id: "symptom",
      condition_rules: { operator: "not_equals", value: "none" },
    },
  ];
  expect(
    visibleQuestions(questions, { symptom: "itchy skin" }).map((q) => q.id),
  ).toEqual(["symptom", "photo", "notes"]);
  expect(visibleQuestions(questions, {}).map((q) => q.id)).toEqual(["symptom"]);
});

test("supports allowed-answer arrays for conditional parent values", () => {
  const questions = [
    { id: "symptom" },
    {
      id: "photo",
      parent_question_id: "symptom",
      show_if_answer: ["moderate", "severe"],
    },
  ];
  expect(
    visibleQuestions(questions, { symptom: "severe" }).map((q) => q.id),
  ).toEqual(["symptom", "photo"]);
});

test("supports checkbox conditions when a selected option contains the expected answer", () => {
  const questions = [
    { id: "triggers" },
    { id: "details", parent_question_id: "triggers", show_if_answer: "food" },
  ];
  expect(
    visibleQuestions(questions, { triggers: ["food", "stress"] }).map(
      (q) => q.id,
    ),
  ).toEqual(["triggers", "details"]);
});

test("hides descendants of hidden parents even if stale answers remain", () => {
  const questions = [
    { id: "symptom" },
    { id: "location", parent_question_id: "symptom", show_if_answer: "yes" },
    { id: "photo", parent_question_id: "location", show_if_answer: "arm" },
  ];
  expect(
    visibleQuestions(questions, { symptom: "no", location: "arm" }).map(
      (q) => q.id,
    ),
  ).toEqual(["symptom"]);
});
