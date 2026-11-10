import { describe, expect, test } from "bun:test";
import { adminKlinikasi, xodimSxema } from "./xodimlar.schemas";
import { xodimniYarat } from "./xodimlar.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const input = { fullName: "Sinov Xodim", email: "test@example.test", parol: "aB2!cD3?", role: "kassa" as const };
describe("Staff provisioning rules", () => {
  test("password must contain at least 8 characters", () => {
    expect(xodimSxema.safeParse({ ...input, parol: "1234567" }).success).toBe(false);
    expect(xodimSxema.safeParse(input).success).toBe(true);
  });
  for (const role of ["kassa", "rahbar", "qabul"]) test(`${role} is allowed`, () => {
    expect(xodimSxema.safeParse({ ...input, role }).success).toBe(true);
  });
  for (const role of ["doktor", "admin", "super_admin"]) test(`${role} cannot be provisioned by staff endpoint`, () => {
    expect(xodimSxema.safeParse({ ...input, role }).success).toBe(false);
  });
  test("caller cannot submit a target clinic", () => {
    expect(xodimSxema.safeParse({ ...input, clinicId: "foreign" }).success).toBe(false);
  });
  for (const role of ["admin", "super_admin"]) test(`${role} is restricted to trusted role clinic`, () => {
    expect(adminKlinikasi([{ role, clinic_id: "own" }], "own")).toBe("own");
    expect(() => adminKlinikasi([{ role, clinic_id: "own" }], "other")).toThrow();
  });
  test("non-admin cannot create staff", () => {
    expect(() => adminKlinikasi([{ role: "qabul", clinic_id: "own" }], "own")).toThrow();
  });
  test("failed database transaction deletes newly created auth account", async () => {
    const deleted: string[] = [];
    const client = {
      auth: { admin: {
        createUser: async () => ({ data: { user: { id: "new-user" } }, error: null }),
        deleteUser: async (id: string) => { deleted.push(id); return { error: null }; },
      } },
      rpc: async () => ({ error: new Error("transaction failed") }),
    } as unknown as SupabaseClient<Database>;
    await expect(xodimniYarat(client, "own", input)).rejects.toThrow("orqaga qaytarildi");
    expect(deleted).toEqual(["new-user"]);
  });
});