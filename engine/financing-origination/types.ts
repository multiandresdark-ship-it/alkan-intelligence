export type SignalType =
  | "PERMIT_BURST"
  | "PROJECT_START"
  | "PROJECT_AWARD"
  | "PUBLIC_CONTRACT"
  | "BACKLOG_GROWTH"
  | "REPEAT_PROJECT_ACTIVITY"
  | "BOND_RENEWAL"
  | "BUSINESS_GROWTH";

export type Confidence = "low" | "medium" | "high";

export type EvidenceSource = {
  url: string;
  observed_at: string;
  source_type?: string | null;
  reference?: string | null;
};

export type ContractorSnapshot = {
  lead_id: string;
  client_id: string;
  company_name: string;
  state?: string | null;
  industry?: string | null;
  trade?: string | null;
  years_in_business?: number | null;
  license_active?: boolean | null;
  entity_active?: boolean | null;

  permits_30d?: number | null;
  permits_90d?: number | null;
  permits_12m?: number | null;
  concurrent_projects?: number | null;
  observed_work_value_12m?: number | null;
  recent_award_value?: number | null;
  public_contracts_12m?: number | null;
  project_starts_30d?: number | null;
  project_starts_60d?: number | null;
  bond_renewal_days?: number | null;

  owner_resolved?: boolean | null;
  phone_verified?: boolean | null;
  email_verified?: boolean | null;

  evidence: EvidenceSource[];
};

export type PartnerBox = {
  partner_id: string;
  client_id: string;
  name: string;
  allowed_states?: string[];
  allowed_industries?: string[];
  min_years_in_business?: number | null;
  min_requested_amount?: number | null;
  max_requested_amount?: number | null;
  notes?: string | null;
  required_documents?: string[];
};

export type FinancingSignal = {
  signal_type: SignalType;
  title: string;
  detail: string;
  score: number;
  confidence: Confidence;
  observed_at: string;
  expires_at: string;
  source_urls: string[];
};

export type PartnerFit = {
  score: number;
  reasons: string[];
  unknowns: string[];
  verification_flags: string[];
};

export type FinancingCandidate = {
  lead_id: string;
  client_id: string;
  partner_id: string;
  company_name: string;

  activity_score: number;
  timing_score: number;
  partner_fit_score: number;
  evidence_score: number;
  contactability_score: number;
  priority_score: number;

  reasons: string[];
  signals: FinancingSignal[];
  unknowns: string[];
  verification_flags: string[];

  observed_at: string;
  expires_at: string;
  next_action: string;
};

export type PartnerFeedback = {
  case_id: string;
  partner_id: string;
  decision: "reviewed" | "declined" | "submitted" | "approved" | "funded";
  reason_code?: string | null;
  partner_comment?: string | null;
  decided_at: string;
  candidate_signal_types?: SignalType[];
};
