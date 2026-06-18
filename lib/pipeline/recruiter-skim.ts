/** Deep link to tailored resume preview for a job (recruiter skim). */
export function recruiterSkimHref(company: string, title: string): string {
  const params = new URLSearchParams({ company, title });
  return `/resume?${params.toString()}`;
}
