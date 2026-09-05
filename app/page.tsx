"use client";

import { useState, useCallback, useRef } from "react";
import { AnalysisResult } from "@/lib/types";
import { VerificationReport } from "@/components/VerificationReport";
import { UploadZone } from "@/components/UploadZone";
import { LoadingState } from "@/components/LoadingState";
import { Header } from "@/components/Header";
import { Hero, MediaTab } from "@/components/Hero";
import { ComingSoon } from "@/components/ComingSoon";

type AppState = "idle" | "analyzing" | "result" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [mediaTab, setMediaTab] = useState<MediaTab>("image");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAppState("analyzing");
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = (await res.json()) as AnalysisResult;
      setResult(data);
      setAppState(data.success ? "result" : "error");

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
  }, []);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setAppState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [previewUrl]);

  const handleTabChange = useCallback(
    (tab: MediaTab) => {
      // Switching tabs while a result is shown resets to idle
      if (appState !== "idle") handleReset();
      setMediaTab(tab);
    },
    [appState, handleReset]
  );

  return (
    <div className="min-h-screen">
      <Header onReset={appState !== "idle" ? handleReset : undefined} />

      <main className="max-w-4xl mx-auto px-4 pb-20">
        {/* Hero + tab selector always visible in idle state */}
        {appState === "idle" && (
          <Hero activeTab={mediaTab} onTabChange={handleTabChange} />
        )}

        {/* ── IMAGE TAB ── */}
        {mediaTab === "image" && (
          <>
            {appState === "idle" && (
              <>
                <div id="panel-image" role="tabpanel" aria-labelledby="tab-image">
                  <UploadZone onFile={handleFile} />
                </div>
                <Disclaimer />
              </>
            )}

            {appState === "analyzing" && (
              <div className="mt-12">
                {previewUrl && (
                  <div className="mb-8 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Uploaded image being analyzed"
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
    <p className="mt-5 text-center text-xs text-gray-500 max-w-xl mx-auto leading-relaxed">
      VERIFAI provides probabilistic AI-assisted analysis, not definitive forensic proof.
      Results should be used as one input among many in a verification process.
    </p>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-20 py-8 text-center text-xs text-gray-600">
      <p>VERIFAI · AI-Assisted Media Verification · Analysis is probabilistic, not conclusive.</p>
    </footer>
  );
}
