import { expect, it } from "vitest";
import { recordActions, buildPayload, initialPage } from "./care-model";

it("only offers completion and prescribing to the doctor assigned to the active visit", () => {
  const record = {
    status: "in_progress",
    latest_visit: { assigned_doctor_id: "9007199254740993" },
  };
  expect(
    recordActions({ role: "bac_si", person_id: "9007199254740993" }, record),
  ).toEqual(["prescribe", "complete"]);
  expect(recordActions({ role: "bac_si", person_id: "2" }, record)).toEqual([]);
  expect(
    recordActions({ role: "benh_nhan", person_id: "9007199254740993" }, record),
  ).toEqual([]);
  expect(
    recordActions({ role: "bac_si", person_id: "1" }, { status: "completed" }),
  ).toEqual([]);
});

it("redirects existing table bookmarks to the matching care workflow while preserving deep clinical screens", () => {
  expect(initialPage("?table=hosobenhan")).toBe("care:records");
  expect(initialPage("?table=vitritonthuong")).toBe("care:lesions");
  expect(initialPage("?table=phienkhamcap")).toBe("phienkhamcap");
  expect(initialPage("?view=profile")).toBe("care:profile");
});

it("converts local photo timestamps to an unambiguous ISO timestamp", () => {
  const local = "2026-11-01T09:30";
  expect(
    buildPayload(
      [{ name: "taken_at", label: "Thời điểm chụp", type: "datetime-local" }],
      { taken_at: local },
    ),
  ).toEqual({ taken_at: new Date(local).toISOString() });
});

it("does not truncate stored seconds when saving an unchanged minute-precision date field", () => {
  const original = "2026-11-01T02:30:35.000Z";
  const date = new Date(original);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  expect(
    buildPayload(
      [{ name: "onset_at", label: "Xuất hiện", type: "datetime-local" }],
      { onset_at: local },
      { onset_at: original },
    ),
  ).toEqual({});
});

it("keeps bigint references as strings, limits score values and omits fields outside the form contract", () => {
  const fields = [
    { name: "patient_id", label: "Bệnh nhân" },
    {
      name: "hss_score",
      label: "Điểm sẩn",
      type: "number" as const,
      min: 0,
      max: 3,
    },
  ];
  expect(
    buildPayload(fields, {
      patient_id: "9007199254740993",
      hss_score: "2",
      role_id: "1",
    }),
  ).toEqual({ patient_id: "9007199254740993", hss_score: 2 });
  expect(() => buildPayload(fields, { hss_score: "4" })).toThrow();
});
