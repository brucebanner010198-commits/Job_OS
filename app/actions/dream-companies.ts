"use server";

import { revalidatePath } from "next/cache";
import {
  requireAccessForMutation,
  requireAccessForRead,
} from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  getDreamCompanies,
  saveDreamCompanies,
} from "@/lib/goals/dream-companies-store";
import type { DreamCompany } from "@/lib/goals/dream-companies";

export async function loadDreamCompaniesAction(): Promise<DreamCompany[]> {
  await requireAccessForRead();
  const { scope } = await getAppContext();
  return getDreamCompanies(scope);
}

export async function saveDreamCompaniesAction(
  companies: DreamCompany[],
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  await saveDreamCompanies(scope, companies);
  revalidatePath("/goals");
  return { ok: true };
}
