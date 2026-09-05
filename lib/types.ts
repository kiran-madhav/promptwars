// Shared types for the verification assessment schema

export type OverallAssessment =
  | "likely_authentic"
  | "potentially_manipulated"
  | "likely_synthetic"
  | "inconclusive";

export type Confidence = "low" | "medium" | "high";
export type Severity = "low" | "medium" | "high";

export interface Signal {
  severity: Severity;
  title: string;
  observation: string;
  explanation: string;
  evidence: string;
}

export interface SourceSignal {
  type: string;
  observation: string;
}

export interface MetadataObservation {
  field: string;
  value: string;
  significance: string;
}

export interface VerificationReport {
  overallAssessment: OverallAssessment;
  confidence: Confidence;
  summary: string;
  signals: Signal[];
  sourceSignals: SourceSignal[];
  metadataObservations: MetadataObservation[];
  limitations: string[];
  recommendedActions: string[];
}

export interface AnalysisResponse {
  success: true;
  report: VerificationReport;
  mediaType: "image";
  filename: string;
  fileSize: number;
  mimeType: string;
  analyzedAt: string;
}

export interface AnalysisError {
  success: false;
  error: string;
}

export type AnalysisResult = AnalysisResponse | AnalysisError;
