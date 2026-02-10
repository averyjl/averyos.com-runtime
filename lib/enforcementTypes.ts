export type EnforcementEvent = {
  id: string;
  capsuleId: string;
  sha512: string;
  timestamp: string;
  source?: string;
  status: "observed" | "notice_issued" | "licensed";
  message: string;
};

export type EnforcementBundle = {
  event: EnforcementEvent;
  noticePath: string;
  evidencePath: string;
};
