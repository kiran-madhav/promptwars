import { AnalysisResult, OverallAssessment, Confidence, Severity, Signal } from "@/lib/types";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

// ─── Assessment badge config ─────────────────────────────────────────────────

const ASSESSMENT_CONFIG: Record<
  OverallAssessment,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  likely_authentic: {
    label: "Likely Authentic",
    color: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-800/60",
    icon: "✓",
  },
  potentially_manipulated: {
    label: "Potentially Manipulated",
    color: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-800/60",
    icon: "⚠",
  },
  likely_synthetic: {
    label: "Likely Synthetic / AI-Generated",
    color: "text-red-400",
    bg: "bg-red-950/40",
    border: "border-red-800/60",
    icon: "⚠",
  },
  inconclusive: {
    label: "Inconclusive",
    color: "text-gray-400",
    bg: "bg-gray-900/40",
    border: "border-gray-700",
    icon: "?",
  },
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  low: "text-gray-400",
  medium: "text-amber-400",
  high: "text-emerald-400",
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  low: { color: "text-blue-400", bg: "bg-blue-950/30 border-blue-900/40", label: "Low" },
  medium: { color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/40", label: "Medium" },
  high: { color: "text-red-400", bg: "bg-red-950/30 border-red-900/40", label: "High" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
        <span className="w-4 h-px bg-gray-700" />
        {title}
        <span className="flex-1 h-px bg-gray-800" />
      </h2>
      {children}
    </section>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const sev = SEVERITY_CONFIG[signal.severity];
  return (
    <div className={`rounded-xl border p-5 ${sev.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white text-sm leading-snug">{signal.title}</h3>
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${sev.color}`}>
          {sev.label}
        </span>
      </div>

      <div className="space-y-2.5 text-sm">
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide font-semibold">
            Observation
          </span>
          <p className="text-gray-300 mt-0.5">{signal.observation}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide font-semibold">
            Why it matters
          </span>
          <p className="text-gray-400 mt-0.5">{signal.explanation}</p>
        </div>
        {signal.evidence && (
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide font-semibold">
              Where in the image
            </span>
            <p className="text-gray-400 mt-0.5 italic">{signal.evidence}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Source & Provenance section ──────────────────────────────────────────────

interface SourceProvenanceProps {
  sourceSignals: Array<{ type: string; observation: string }>;
  sourceType: "upload" | "url";
  sourceUrl?: string;
}

function SourceProvenance({ sourceSignals, sourceType, sourceUrl }: SourceProvenanceProps) {
  const verificationSteps = [
    { step: "Run a reverse image search", detail: "Use Google Images, TinEye, or Yandex to find the earliest known publication of this image." },
    { step: "Locate the original source", detail: "Identify where the image was first published, by whom, and in what context." },
    { step: "Compare across sources", detail: "Check whether independent outlets report the same image with consistent context." },
    { step: "Verify the metadata independently", detail: "Use tools such as Jeffrey's Exif Viewer or ExifTool to inspect embedded metadata in the original file." },
  ];

  return (
    <Section title="Source & Provenance">
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
        {sourceType === "url" ? (
          <div className="px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source</span>
            <p className="text-gray-300 text-sm mt-1">User-provided image URL</p>
            {sourceUrl && (
              <div className="mt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source URL</span>
                <p className="text-gray-400 text-xs font-mono mt-1 break-all leading-relaxed bg-gray-950/60 rounded-lg px-3 py-2 border border-gray-800">
                  {sourceUrl}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-xs mt-3 leading-relaxed">
              VERIFAI fetched this image from the URL above for visual analysis only.
              The URL has not been verified as the original source of publication.
              VERIFAI did not check the publisher, creation date, author, or geographic origin.
            </p>
          </div>
        ) : (
          <div className="px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source</span>
            <p className="text-gray-300 text-sm mt-1">Direct upload — original source URL not provided</p>
            <p className="text-gray-500 text-xs mt-1">
              The image was submitted directly. No prior publication context is available to VERIFAI.
            </p>
          </div>
        )}

        {sourceSignals && sourceSignals.length > 0 && (
          <>
            <div className="border-t border-gray-800 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Visible content signals</span>
            </div>
            {sourceSignals.map((s, i) => (
              <div key={i} className="border-t border-gray-800/60 px-5 py-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.type.replace(/_/g, " ")}</span>
                <p className="text-gray-300 text-sm mt-1">{s.observation}</p>
              </div>
            ))}
          </>
        )}

        <div className="border-t border-gray-800 bg-gray-900/60 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Recommended verification steps</p>
          <ul className="space-y-2">
            {verificationSteps.map(({ step, detail }) => (
              <li key={step} className="flex items-start gap-2.5 text-sm">
                <span className="text-blue-500 mt-0.5 shrink-0 text-xs font-bold">→</span>
                <div>
                  <span className="text-gray-300 font-medium">{step} — </span>
                  <span className="text-gray-500">{detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerificationReport({ result, onReset }: Props) {
  if (!result.success) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-red-400 mb-2">Analysis Failed</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">{result.error}</p>
        <button
          onClick={onReset}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { report, filename, fileSize, mimeType, analyzedAt, sourceType, sourceUrl } = result;
  const assessment = ASSESSMENT_CONFIG[report.overallAssessment];
  const confColor = CONFIDENCE_COLOR[report.confidence];

  return (
    <div className="space-y-2">
      {/* ── Verification result header ── */}
      <div className={`rounded-2xl border p-6 sm:p-8 ${assessment.bg} ${assessment.border}`}>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          Verification Result
        </p>

        <div className="flex flex-wrap items-start gap-4 mb-4">
          <div className={`text-3xl font-black ${assessment.color}`}>
            {assessment.icon}
          </div>
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${assessment.color}`}>
              {assessment.label}
            </h1>
            <p className={`text-sm mt-1 font-medium ${confColor}`}>
              Confidence: <span className="capitalize">{report.confidence}</span>
            </p>
          </div>
        </div>

        <p className="text-gray-300 leading-relaxed">{report.summary}</p>
      </div>

      {/* ── Signals ── */}
      {report.signals && report.signals.length > 0 ? (
        <Section title="Why we think so — Observable Signals">
          <div className="space-y-3">
            {report.signals.map((signal, i) => (
              <SignalCard key={i} signal={signal} />
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Observable Signals">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <p className="text-gray-400 text-sm">
              No specific manipulation signals were identified in the visual content.
            </p>
            <p className="text-gray-500 text-xs mt-2 leading-relaxed">
              Absence of signals does not confirm authenticity. AI generation techniques are evolving
              rapidly and some synthetic images leave no visually detectable traces.
            </p>
          </div>
        </Section>
      )}

      {/* ── Source & Provenance (always rendered) ── */}
      <SourceProvenance
        sourceSignals={report.sourceSignals ?? []}
        sourceType={sourceType ?? "upload"}
        sourceUrl={sourceUrl}
      />

      {/* ── Media details / metadata ── */}
      <Section title="Media Details">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="divide-y divide-gray-800">
            {[
              { label: "Filename", value: filename },
              { label: "File size", value: formatFileSize(fileSize) },
              { label: "Format", value: mimeType },
              { label: "Analyzed at", value: new Date(analyzedAt).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4 px-5 py-3">
                <span className="text-gray-500 text-sm w-28 shrink-0">{label}</span>
                <span className="text-gray-300 text-sm font-mono break-all">{value}</span>
              </div>
            ))}
          </div>

          {report.metadataObservations && report.metadataObservations.length > 0 && (
            <div className="border-t border-gray-800 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                AI Metadata Observations
              </p>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Based on visual analysis only — VERIFAI cannot read embedded EXIF data directly.
                Observations below are inferred from visible image characteristics.
              </p>
              <div className="space-y-4">
                {report.metadataObservations.map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-gray-400 font-medium">{m.field}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-300 font-mono">{m.value}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">{m.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Limitations ── */}
      {report.limitations && report.limitations.length > 0 && (
        <Section title="Limitations of this Analysis">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <ul className="space-y-2">
              {report.limitations.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-gray-600 mt-0.5 shrink-0">•</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Recommended actions ── */}
      {report.recommendedActions && report.recommendedActions.length > 0 && (
        <Section title="What to Do Next">
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-5">
            <ul className="space-y-3">
              {report.recommendedActions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-blue-800/60 text-blue-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Trust notice ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-5 mt-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Important:</strong> This analysis is probabilistic and
          AI-assisted. It should not be treated as definitive forensic proof. Use this report as one
          input among several in a broader verification process. Consult additional sources,
          reverse image search tools, and domain experts where the stakes are high.
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-3 pt-4">
        <button
          onClick={onReset}
          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          Analyze another image
        </button>
        <button
          onClick={() => window.print()}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-3 rounded-xl transition-colors text-sm"
        >
          Print / Save
        </button>
      </div>
    </div>
  );
}
