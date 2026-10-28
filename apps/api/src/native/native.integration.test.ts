import { afterAll, expect, it } from "vitest";
import { PrismaService } from "../common/prisma.service";
import { NativeService } from "./native.service";

const url = process.env.TEST_DATABASE_URL;
const db = new PrismaService(
  url ? { datasources: { db: { url } } } : undefined,
);
afterAll(async () => {
  await db.$disconnect();
});
it.skipIf(!url)(
  "creates both acute/chronic subtypes and scopes reads to the owning patient",
  async () => {
    const rollback = new Error("ROLLBACK_FIXTURE");
    await expect(
      db.$transaction(
        async (tx) => {
          const proxy = new Proxy(tx, {
            get(target, prop) {
              if (prop === "$transaction")
                return (arg: unknown) =>
                  typeof arg === "function"
                    ? arg(tx)
                    : Promise.all(arg as Promise<unknown>[]);
              return Reflect.get(target, prop);
            },
          });
          const service = new NativeService(proxy as unknown as PrismaService);
          const owner = await tx.nguoi.create({
            data: { ho_ten: "MayDay test", so_dien_thoai: "0999999999" },
          });
          await tx.benhnhan.create({ data: { ma_benh_nhan: owner.ma_nguoi } });
          const admin = { accountId: "1", personId: "1", role: "admin" };
          for (const kind of ["CAP", "MAN"]) {
            const record = await service.create(admin, "hosobenhan", {
              ma_benh_nhan: String(owner.ma_nguoi),
              loai_benh_an: kind,
            });
            expect(record.loai_benh_an).toBe(kind);
            const sub =
              kind === "CAP"
                ? await tx.benhanmaydaycap.findUnique({
                    where: { ma_ho_so: BigInt(String(record.ma_ho_so)) },
                  })
                : await tx.benhanmaydayman.findUnique({
                    where: { ma_ho_so: BigInt(String(record.ma_ho_so)) },
                  });
            expect(sub).toBeTruthy();
            const patient = {
              accountId: "1",
              personId: String(owner.ma_nguoi),
              role: "benh_nhan",
            };
            expect(
              (await service.list(patient, "hosobenhan", {})).data,
            ).toHaveLength(kind === "CAP" ? 1 : 2);
            await expect(
              service.detail(
                { ...patient, personId: "999999999" },
                "hosobenhan",
                String(record._key),
              ),
            ).rejects.toThrow();
          }
          throw rollback;
        },
        { timeout: 20000 },
      ),
    ).rejects.toBe(rollback);
  },
);
