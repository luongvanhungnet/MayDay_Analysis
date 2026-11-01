import { expect, it } from "vitest";
import { canRead, canWrite, table, writableData } from "./schema";
import { ownershipPath } from "./ownership";

it("rejects generated UAS scores and unsafe bigint IDs without losing precision", () => {
  expect(() =>
    writableData(table("nhatkyuashangngay"), { diem_uas_ngay: 6 }),
  ).toThrow();
  expect(
    writableData(table("nhatkyuashangngay"), {
      ma_benh_nhan: "9007199254740993",
      diem_san_phu_hss: 2,
    }),
  ).toEqual({ ma_benh_nhan: "9007199254740993", diem_san_phu_hss: 2 });
  expect(() =>
    writableData(table("nhatkyuashangngay"), {
      ma_benh_nhan: 9007199254740993,
    }),
  ).toThrow();
});

it("traces clinical ownership through prescriptions and visits to the patient", () => {
  const path = ownershipPath("chitietdonthuoc");
  expect(path?.map((step) => step.table)).toEqual([
    "donthuoc",
    "hosobenhan",
    "benhnhan",
  ]);
  expect(ownershipPath("vaitro")).toBeNull();
});

it("denies unknown roles and prevents patients changing account privileges", () => {
  expect(
    canRead(
      { accountId: "1", personId: "1", role: "unknown" },
      table("hosobenhan"),
    ),
  ).toBe(false);
  expect(
    canWrite(
      { accountId: "1", personId: "1", role: "unknown" },
      table("nhatkyuashangngay"),
    ),
  ).toBe(false);
  expect(
    canWrite(
      { accountId: "1", personId: "1", role: "benh_nhan" },
      table("taikhoan"),
    ),
  ).toBe(false);
});
