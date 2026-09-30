import { useState, useEffect } from "react";

// stage: "uploading" | "processing" | "done"
// uploadPercent: 0-100, only meaningful during "uploading"
export default function UploadProgress({ stage, uploadPercent }) {
  const [processingLabel, setProcessingLabel] = useState("Parsing your statement...");

  useEffect(() => {
    if (stage !== "processing") return;
    setProcessingLabel("Parsing your statement...");
    const timer = setTimeout(() => {
      setProcessingLabel("Categorizing transactions...");
    }, 2500); // just cosmetic — no real signal backs this timing
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div className="w-full max-w-md mx-auto p-4 rounded-xl bg-card shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between text-sm mb-2 text-text">
        <span>
          {stage === "uploading" && "Uploading..."}
          {stage === "processing" && processingLabel}
          {stage === "done" && "Done!"}
        </span>
        {stage === "uploading" && <span>{uploadPercent}%</span>}
      </div>

      <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        {stage === "uploading" && (
          <div
            className="h-full bg-emerald-500 transition-all duration-200 ease-out"
            style={{ width: `${uploadPercent}%` }}
          />
        )}
        {stage === "processing" && (
          <div className="h-full bg-blue-500 animate-pulse w-full" />
        )}
        {stage === "done" && <div className="h-full bg-emerald-500 w-full" />}
      </div>
    </div>
  );
}