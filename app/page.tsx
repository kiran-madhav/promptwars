"use client";

import { useState, useCallback, useRef } from "react";
import { AnalysisResult } from "@/lib/types";
import { VerificationReport } from "@/components/VerificationReport";
import { UploadZone } from "@/components/UploadZone";
import { UrlInput } from "@/components/UrlInput";
import { LoadingState } from "@/components/LoadingState";
import { Header } from "@/components/Header";
import { Hero, MediaTab } from "@/components/Hero";
import { ComingSoon } from "@/components/ComingSoon";

type AppState = "idle" | "analyzing" | "result" | "error";
type ImageInputMode = "upload" | "url";

// ─── Input mode sub-tab ────────────────────────────────────────────────────────

interface InputModeTabsProps {
  active: ImageInputMode;
  onChange: (mode: ImageInputMode) => void;
}

function InputModeTabs({ active, onChange }: InputModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Image input method"
      className="flex gap-1 mb-4 bg-gray-900/60 border border-gray-800 rounded-xl p-1 w-fit"
    >
      {(
        [
          { id: "upload" as const, label: "Upload Image", icon: "📁" },
          { id: "url" as const, label: "Direct image URL", icon: "🔗" },
        ] as const
      ).map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${active === tab.id
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }
          `}
        >
          <span aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [mediaTab, setMediaTab] = useState<MediaTab>("image");
  const [imageInputMode, setImageInputMode] = useState<ImageInputMode>("upload");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // For uploads: objectURL (needs revoke). For URLs: the URL string (no revoke needed).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsObjectUrl, setPreviewIsObjectUrl] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // ── Shared post-fetch handling ─────────────────────────────────────────────
  const handleAnalysisResponse = useCallback(
    async (fetchPromise: Promise<Response>) => {
      try {
        const res = await fetchPromise;
        const contentType = res.headers.get("content-type") || "";
        
        let data: AnalysisResult;
        if (contentType.includes("application/json")) {
          data = (await res.json()) as AnalysisResult;
        } else {
          // If the server returns 413 Payload Too Large as text/html or text/plain
          await res.text(); // Consume the stream
          const errorMsg = res.status === 413 
            ? "File too large for the server to process. Please try a smaller image."
            : `Unexpected server response (${res.status}).`;
          data = { success: false, error: errorMsg };
        }

        if (!data.success) {
          setResult({
            success: false,
            error: data.error || "Analysis failed. Please try again.",
          });
          setAppState("error");
          return;
        }

        setResult(data);
        setAppState("result");
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } catch (err) {
        setResult({
          success: false,
          error: err instanceof Error ? err.message : "Network error. Please try again.",
        });
        setAppState("error");
      }
    },
    []
  );

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setPreviewIsObjectUrl(true);
      setAppState("analyzing");
      setResult(null);

      const form = new FormData();
      form.append("file", file);

      await handleAnalysisResponse(
        fetch("/api/analyze", { method: "POST", body: form })
      );
    },
    [handleAnalysisResponse]
  );

  // ── URL handler ────────────────────────────────────────────────────────────
  const handleUrl = useCallback(
    async (url: string) => {
      // Use the URL directly as preview src — browser fetches it for display.
      // The server fetches it separately for analysis.
      setPreviewUrl(url);
      setPreviewIsObjectUrl(false);
      setAppState("analyzing");
      setResult(null);

      await handleAnalysisResponse(
        fetch("/api/analyze-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      );
    },
    [handleAnalysisResponse]
  );

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (previewUrl && previewIsObjectUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewIsObjectUrl(false);
    setResult(null);
    setAppState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [previewUrl, previewIsObjectUrl]);

  const handleTabChange = useCallback(
    (tab: MediaTab) => {
      if (appState !== "idle") handleReset();
      setMediaTab(tab);
    },
    [appState, handleReset]
  );

  const handleInputModeChange = useCallback(
    (mode: ImageInputMode) => {
      if (appState !== "idle") handleReset();
      setImageInputMode(mode);
    },
    [appState, handleReset]
  );

  return (
    <div className="min-h-screen">
      <Header onReset={appState !== "idle" ? handleReset : undefined} />

      <main className="max-w-4xl mx-auto px-4 pb-20">
        {appState === "idle" && (
          <Hero activeTab={mediaTab} onTabChange={handleTabChange} />
        )}

        {/* ── IMAGE TAB ── */}
        {mediaTab === "image" && (
          <>
            {appState === "idle" && (
              <div id="panel-image" role="tabpanel" aria-labelledby="tab-image">
                <InputModeTabs active={imageInputMode} onChange={handleInputModeChange} />

                {imageInputMode === "upload" ? (
                  <UploadZone onFile={handleFile} />
                ) : (
                  <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-6">
                    <UrlInput onUrl={handleUrl} />
                  </div>
                )}

                <Disclaimer />
              </div>
            )}

            {appState === "analyzing" && (
              <div className="mt-12">
                {previewUrl && (
                  <div className="mb-8 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Image being analyzed"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      className="max-h-64 max-w-full rounded-xl border border-gray-700 object-contain shadow-2xl"
                    />
                  </div>
                )}
                <LoadingState />
              </div>
            )}

            {(appState === "result" || appState === "error") && result && (
              <div ref={resultRef} className="mt-8">
                {previewUrl && result.success && (
                  <div className="mb-8 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Analyzed image"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      className="max-h-64 max-w-full rounded-xl border border-gray-700 object-contain shadow-2xl"
                    />
                  </div>
                )}
                <VerificationReport result={result} onReset={handleReset} />
              </div>
            )}
          </>
        )}

        {/* ── AUDIO TAB ── */}
        {mediaTab === "audio" && appState === "idle" && (
          <div id="panel-audio" role="tabpanel" aria-labelledby="tab-audio">
            <ComingSoon mediaType="audio" />
          </div>
        )}

        {/* ── VIDEO TAB ── */}
        {mediaTab === "video" && appState === "idle" && (
          <div id="panel-video" role="tabpanel" aria-labelledby="tab-video">
            <ComingSoon mediaType="video" />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-5 text-center text-xs text-gray-400 max-w-xl mx-auto leading-relaxed">
      VERIFAI provides probabilistic AI-assisted analysis, not definitive forensic proof.
      Results should be used as one input among many in a verification process.
    </p>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-20 py-8 text-center text-xs text-gray-400">
      <p>VERIFAI · AI-Assisted Media Verification · Analysis is probabilistic, not conclusive.</p>
    </footer>
  );
}
