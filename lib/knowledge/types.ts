/**
 * Knowledge Notebook - chunk types indexed for RAG retrieval.
 */
export type KnowledgeSourceType =
  | "profile_entry"
  | "profile_note"
  | "company_brief"
  | "job"
  | "application_answer";

export interface KnowledgeChunk {
  id: string;
  sourceType: KnowledgeSourceType;
  sourceId?: string;
  text: string;
  cacheKey: string;
}

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
}

export interface RetrieveQuery {
  query: string;
  companyName?: string;
  jobDescription?: string;
  topK?: number;
}
