// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { careLink, go, useLocationSearch, useUrlState } from "./navigation";
import { ActionForm } from "./care-ui";
import { ConfirmHost } from "./confirmation";
import { RecordsPage, UasPage } from "./care-clinical";
import type { Session } from "./api";

const session: Session = {
  token: "fixture",
  user: {
    id: "1",
    person_id: "20",
    full_name: "Patient",
    phone: "0999999999",
    role: "benh_nhan",
  },
};
afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

function RouteProbe() {
  const search = useLocationSearch();
  const [page, setPage] = useUrlState("page", 1);
  return (
    <>
      <output>{search}</output>
      <button onClick={() => setPage(page + 1)}>Trang sau</button>
    </>
  );
}
it("restores bookmarked list filters after browser Back and Forward", async () => {
  history.replaceState(null, "", "?view=records&status=pending&page=3");
  render(<RouteProbe />);
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(location.search).toContain("page=4");
  await act(() => go(careLink("records", { record: "9007199254740993" })));
  act(() => history.back());
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("page=4"),
  );
  expect(location.search).toContain("status=pending");
  act(() => history.forward());
  await waitFor(() =>
    expect(location.search).toContain("record=9007199254740993"),
  );
});

it("keeps an edited form when navigation or Back is cancelled", async () => {
  history.replaceState(null, "", "?view=records");
  render(
    <>
      <RouteProbe />
      <ActionForm
        title="Chỉnh sửa"
        fields={[{ name: "name", label: "Tên" }]}
        close={() => {}}
        onSubmit={async () => {}}
        saved={() => {}}
      />
      <ConfirmHost />
    </>,
  );
  await act(() => go("?view=profile"));
  fireEvent.change(screen.getByLabelText("Tên"), {
    target: { value: "Chưa lưu" },
  });
  let navigation: Promise<void>;
  act(() => {
    navigation = go("?view=uas");
  });
  await screen.findByRole("dialog", { name: "Xác nhận thao tác" });
  fireEvent.click(
    screen
      .getByRole("dialog", { name: "Xác nhận thao tác" })
      .querySelector("button.secondary")!,
  );
  await act(() => navigation!);
  expect(location.search).toBe("?view=profile");
  act(() => history.back());
  await screen.findByRole("dialog", { name: "Xác nhận thao tác" });
  fireEvent.click(
    screen
      .getByRole("dialog", { name: "Xác nhận thao tác" })
      .querySelector("button.secondary")!,
  );
  await waitFor(() => expect(location.search).toBe("?view=profile"));
  expect((screen.getByLabelText("Tên") as HTMLInputElement).value).toBe(
    "Chưa lưu",
  );
});

it("opens a record bookmark directly and retains the selected tab after reload", async () => {
  history.replaceState(null, "", "?view=records&record=10&tab=labs");
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const data = url.includes("lab-results")
        ? [{ ma_ket_qua_can_lam_sang: "5" }]
        : url.includes("history")
          ? []
          : {
              id: "10",
              patient_id: "20",
              record_type: "MAN",
              status: "completed",
            };
      return new Response(JSON.stringify({ code: 1000, data }));
    }),
  );
  render(<RecordsPage session={session} />);
  await screen.findByText("Kết quả #5");
  expect(
    screen
      .getByRole("button", { name: "Kết quả" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(urls.some((url) => url.includes("/medical_records/all"))).toBe(false);
});

it("recognizes today’s saved UAS and ignores a different patient in the URL", async () => {
  history.replaceState(null, "", "?view=uas&patient=999");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      return new Response(
        JSON.stringify({
          code: 1000,
          data: url.includes("eligibility")
            ? { eligible: true, medical_record_ids: ["10"] }
            : [{ score_date: today, hss_score: 1, iss_score: 1 }],
        }),
      );
    }),
  );
  render(<UasPage session={session} />);
  const button = await screen.findByRole("button", {
    name: "Đã ghi điểm hôm nay",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(urls.some((url) => url.includes("/patient/999"))).toBe(false);
  expect(urls.some((url) => url.includes("/patient/20"))).toBe(true);
});
