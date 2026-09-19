"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  createWorkLog,
  listWorkLogs,
  deleteWorkLog,
  compileWeeklyWorkLogs,
  listCandidateBullets,
  approveCandidateBullet,
} from "@/lib/journal/service";
import type { CreateWorkLogInput } from "@/lib/journal/types";

export async function addWorkLogAction(input: CreateWorkLogInput) {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const entry = await createWorkLog(scope, input);
  revalidatePath("/journal");
  return entry;
}

export async function deleteWorkLogAction(id: string) {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  await deleteWorkLog(scope, id);
  revalidatePath("/journal");
  return { success: true };
}

export async function compileWeeklyJournalAction() {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const res = await compileWeeklyWorkLogs(scope);
  revalidatePath("/journal");
  revalidatePath("/master-resume");
  return res;
}

export async function approveCandidateBulletAction(bulletId: string) {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const res = await approveCandidateBullet(scope, bulletId);
  revalidatePath("/journal");
  revalidatePath("/master-resume");
  return res;
}

export async function getJournalDataAction() {
  const { scope } = await getAppContext();
  const [logs, candidateBullets] = await Promise.all([
    listWorkLogs(scope),
    listCandidateBullets(scope),
  ]);
  return { logs, candidateBullets };
}
