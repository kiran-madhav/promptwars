"use client";

import { useRef, useState } from "react";

interface UrlInputProps {
  onUrl: (url: string) => void;
  disabled?: boolean;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlInput({ onUrl, disabled = false }: UrlInputProps) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValid = isValidHttpUrl(value);
  const showError = touched && value.trim().length > 0 && !isValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) {
      inputRef.current?.focus();
      return;
    }
    onUrl(value.trim());
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-3">
          {/* Label */}
          <label
            htmlFor="image-url-input"
            className="text-sm font-medium text-gray-300"
          >
            Direct image URL
          </label>

          {/* Input row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                id="image-url-input"
                type="url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="https://example.com/image.jpg"
                disabled={disabled}
                aria-describedby={showError ? "url-error" : undefined}
                aria-invalid={showError}
                className={`
                  w-full bg-gray-900 text-gray-100 text-sm rounded-xl px-4 py-3 pr-10
                  border transition-colors outline-none
                  placeholder:text-gray-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${showError
                    ? "border-red-600 focus:border-red-500"
                    : "border-gray-700 focus:border-blue-500"
                  }
                `}
              />
              {/* Clear button */}
              {value && !disabled && (
                <button
                  type="button"
                  onClick={() => { setValue(""); setTouched(false); inputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                  aria-label="Clear URL"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="
                shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                disabled:cursor-not-allowed text-white font-semibold
                px-5 py-3 rounded-xl text-sm transition-colors whitespace-nowrap
              "
            >
              Analyze URL
            </button>
          </div>

          {/* Validation error */}
          {showError && (
            <p id="url-error" role="alert" className="flex items-center gap-1.5 text-red-400 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Please enter a valid image URL starting with https:// or http://
            </p>
          )}

          {/* Guidance */}
          <p className="text-xs text-gray-600 leading-relaxed">
            Paste the direct address of a publicly accessible image — the URL must link to the image file
            itself (JPEG, PNG, WebP, or GIF), not to a webpage containing it. Max 10 MB.
            <span className="block mt-1 text-gray-500">
              Tip: right-click an image in your browser and choose &quot;Copy image address&quot;.
            </span>
          </p>
        </div>
      </form>
    </div>
  );
}
