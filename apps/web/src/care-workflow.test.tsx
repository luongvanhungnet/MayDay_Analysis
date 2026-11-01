// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RecordsPage, UasPage } from "./care-clinical";
import CarePage from "./CarePage";
import { UploadImage } from "./care-media";
import { UsersPage } from "./care-account";
import { ConfirmHost } from "./confirmation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("creates login access for an existing patient without creating another person record", async () => {
  const writes: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST")
        writes.push({ url, body: JSON.parse(String(options.body)) });
      const data = url.includes("/roles")
        ? [{ id: "5", name: "benh_nhan", display_name: "Bệnh nhân" }]
        : url.includes("/doctor/patients/search")
          ? [{ id: "20", full_name: "Existing patient", phone: "0999999999" }]
          : [];
      return new Response(JSON.stringify({ code: 1000, data }), {
        status: 200,
      });
    }),
  );
  render(
    <UsersPage
      session={{
        token: "fixture",
        user: {
          id: "1",
          person_id: "1",
          full_name: "Admin",
          phone: "0999999998",
          role: "admin",
        },
      }}
    />,
  );
  const button = screen.getByRole("button", {
    name: "Cấp cho bệnh nhân đã có hồ sơ",
  });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  await screen.findByRole("option", { name: /Existing patient/ });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Bệnh nhân đã tiếp nhận" }),
    { target: { value: "20" } },
  );
  fireEvent.change(screen.getByLabelText(/Tên đăng nhập/), {
    target: { value: "existing_patient" },
  });
  fireEvent.change(screen.getByLabelText(/Mật khẩu/), {
    target: { value: "FixturePassword2026!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await waitFor(() =>
    expect(writes).toEqual([
      {
        url: "/api/v1/data/taikhoan",
        body: {
          ma_nguoi: "20",
          ma_vai_tro: "5",
          ten_dang_nhap: "existing_patient",
          password: "FixturePassword2026!",
        },
      },
    ]),
  );
});

it("does not expose administration or request protected administration data to patients through a direct URL", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <CarePage
      page="users"
      session={{
        token: "fixture",
        user: {
          id: "1",
          person_id: "20",
          full_name: "Patient",
          phone: "0999999999",
          role: "benh_nhan",
        },
      }}
    />,
  );
  expect(
    screen.getByText("Bạn không có quyền truy cập chức năng này"),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cấp tài khoản" })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("uploads the selected image as multipart data linked to the selected record", async () => {
  let uploaded: FormData | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/image-attachments/upload"))
        uploaded = options?.body as FormData;
      return new Response(
        JSON.stringify({
          code: 1000,
          data:
            options?.method === "POST"
              ? { id: "1" }
              : [
                  {
                    id: "10",
                    patient_id: "20",
                    record_type: "MAN",
                    status: "in_progress",
                  },
                ],
        }),
        { status: 200 },
      );
    }),
  );
  const saved = vi.fn();
  render(<UploadImage close={() => {}} saved={saved} />);
  await screen.findByRole("option", { name: /Hồ sơ #10/ });
  fireEvent.change(screen.getByRole("combobox", { name: "hồ sơ bệnh án" }), {
    target: { value: "10" },
  });
  const file = new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    "test.png",
    { type: "image/png" },
  );
  fireEvent.change(screen.getByLabelText(/Ảnh \(JPEG/), {
    target: { files: [file] },
  });
  // jsdom does not model file-picker constraint validation for a synthetic FileList.
  // Exercise the submit handler after selecting the file, rather than native validation.
  fireEvent.submit(
    screen
      .getByRole("dialog", { name: "Tải ảnh tổn thương" })
      .querySelector("form")!,
  );
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(uploaded?.get("medical_record_id")).toBe("10");
  expect((uploaded?.get("image") as File).name).toBe("test.png");
});
it("accepts a pending record through an in-app confirmation, then opens prescribing without closing the underlying record", async () => {
  let status = "pending";
  const requests: { path: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = url.replace("/api/v1", "");
      requests.push({ path, method: options?.method ?? "GET" });
      const record = { id: "10", patient_id: "20", record_type: "MAN", status };
      let data: unknown = record;
      if (path.startsWith("/medical_records/all") || path.includes("/history"))
        data = [record];
      if (path === "/medical_records/10/summary")
        data = {
          ...record,
          latest_visit:
            status === "pending" ? null : { id: "1", assigned_doctor_id: "30" },
        };
      if (path === "/lab-results/10") data = [];
      if (path === "/medical_records/10/accept") {
        status = "in_progress";
        data = { ...record, status };
      }
      return new Response(JSON.stringify({ code: 1000, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  render(
    <>
      <RecordsPage
        session={{
          token: "fixture",
          user: {
            id: "1",
            person_id: "30",
            full_name: "Doctor",
            phone: "0999999999",
            role: "bac_si",
          },
        }}
      />
      <ConfirmHost />
    </>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mở hồ sơ" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Tiếp nhận khám" }),
  );
  expect(requests.some((r) => r.path.endsWith("/accept"))).toBe(false);
  fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
  fireEvent.click(await screen.findByRole("button", { name: "Kê đơn thuốc" }));
  expect(
    await screen.findByRole("dialog", { name: "Kê đơn · Hồ sơ #10" }),
  ).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Kê đơn · Hồ sơ #10" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("dialog", { name: "Hồ sơ #10" })).toBeTruthy();
  expect(
    requests.filter((r) => r.path === "/medical_records/10/accept"),
  ).toEqual([{ path: "/medical_records/10/accept", method: "POST" }]);
});

it("submits today’s UAS scores as numbers without sending a generated total or another patient ID", async () => {
  let submitted: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const data = url.includes("/eligibility")
        ? { eligible: true, medical_record_ids: ["10"] }
        : options?.method === "POST"
          ? ((submitted = JSON.parse(String(options.body))), { uas_score: 3 })
          : [];
      return new Response(JSON.stringify({ code: 1000, data }), {
        status: 200,
      });
    }),
  );
  render(
    <UasPage
      session={{
        token: "fixture",
        user: {
          id: "1",
          person_id: "20",
          full_name: "Patient",
          phone: "0999999999",
          role: "benh_nhan",
        },
      }}
    />,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Ghi điểm hôm nay",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Ghi điểm hôm nay" }));
  fireEvent.change(screen.getByLabelText(/Điểm sẩn phù/), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText(/Điểm ngứa/), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
  await screen.findByText("Đã ghi điểm UAS hôm nay.");
  expect(submitted).toEqual({ hss_score: 0, iss_score: 3 });
});
