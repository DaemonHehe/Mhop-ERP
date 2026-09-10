"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  Plus,
  Loader2,
  ExternalLink,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";

export interface ImageUploadProps {
  mode: "single" | "multiple";
  value: string | string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (value: any) => void;
  label?: string;
  hint?: string;
  maxImages?: number;
  disabled?: boolean;
}

export function ImageUpload({
  mode,
  value,
  onChange,
  label,
  hint,
  maxImages = mode === "single" ? 1 : 12,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize image list
  const imageList: string[] = Array.isArray(value)
    ? value.filter(Boolean)
    : value
      ? [value]
      : [];

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (disabled || files.length === 0) return;
    setErrorMessage(null);

    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );

    if (fileArray.length === 0) {
      setErrorMessage("Please select valid image files (JPG, PNG, WebP, etc.)");
      return;
    }

    if (mode === "single") {
      const targetFile = fileArray[0];
      if (targetFile.size > 15 * 1024 * 1024) {
        setErrorMessage("Image exceeds the 15MB limit.");
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", targetFile);

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to upload image");
        }

        onChange(data.url);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to upload image.",
        );
      } finally {
        setIsUploading(false);
      }
    } else {
      // Multiple mode
      const availableSlots = maxImages - imageList.length;
      if (availableSlots <= 0) {
        setErrorMessage(`Maximum of ${maxImages} images reached.`);
        return;
      }

      const filesToUpload = fileArray.slice(0, availableSlots);
      setIsUploading(true);

      try {
        const formData = new FormData();
        for (const file of filesToUpload) {
          if (file.size > 15 * 1024 * 1024) {
            throw new Error(`"${file.name}" exceeds the 15MB limit.`);
          }
          formData.append("files", file);
        }

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to upload images");
        }

        const newUrls = (data.results || []).map((r: { url: string }) => r.url);
        onChange([...imageList, ...newUrls]);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to upload images.",
        );
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files);
      e.target.value = ""; // reset
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (mode === "single") {
      onChange("");
    } else {
      const updated = imageList.filter((_, idx) => idx !== indexToRemove);
      onChange(updated);
    }
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0 || index >= imageList.length) return;
    const item = imageList[index];
    const filtered = imageList.filter((_, idx) => idx !== index);
    onChange([item, ...filtered]);
  };

  const handleAddManualUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualUrl.trim();
    if (!trimmed) return;

    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
      setErrorMessage("Please enter a valid HTTPS URL or /path");
      return;
    }

    if (mode === "single") {
      onChange(trimmed);
    } else {
      onChange([...imageList, trimmed]);
    }
    setManualUrl("");
    setShowUrlInput(false);
    setErrorMessage(null);
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Label & Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-[#444] flex items-center gap-1.5">
            <ImageIcon size={14} className="text-[#666]" />
            {label || (mode === "single" ? "Product Image" : "PUBG Account Screenshots")}
            {mode === "multiple" && imageList.length > 0 && (
              <span className="ml-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                {imageList.length}/{maxImages}
              </span>
            )}
          </label>
          {hint && <p className="mt-0.5 text-[11px] text-[#777]">{hint}</p>}
        </div>

        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-1"
        >
          <LinkIcon size={12} />
          {showUrlInput ? "Hide URL input" : "Or enter image URL"}
        </button>
      </div>

      {/* Manual URL Input dropdown */}
      {showUrlInput && (
        <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50/50 p-2 text-xs">
          <input
            type="text"
            placeholder="https://images.unsplash.com/... or /api/media/..."
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            className="flex-1 rounded-lg border border-[#dedbd0] bg-white px-3 py-1.5 text-xs outline-none focus:border-black"
          />
          <button
            type="button"
            onClick={handleAddManualUrl}
            className="rounded-lg bg-black px-3 py-1.5 font-bold text-white hover:bg-neutral-800"
          >
            Add URL
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[10px] font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={mode === "multiple"}
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
      />

      {/* Single Mode View */}
      {mode === "single" && (
        <div>
          {imageList.length > 0 ? (
            <div className="relative group overflow-hidden rounded-2xl border border-[#dedbd0] bg-neutral-50 flex items-center gap-4 p-3">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <img
                  src={imageList[0]}
                  alt="Product preview"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-neutral-800 truncate">
                  {imageList[0].startsWith("/api/media")
                    ? "Uploaded Image"
                    : imageList[0]}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Direct image preview active
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploading || disabled}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-[#dedbd0] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                  >
                    {isUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UploadCloud size={12} />
                    )}
                    Replace image
                  </button>

                  <a
                    href={imageList[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-[#dedbd0] bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                  >
                    <ExternalLink size={12} /> View full
                  </a>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRemoveImage(0)}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                    title="Remove image"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                isDragging
                  ? "border-black bg-neutral-100"
                  : "border-[#d8d5ca] bg-neutral-50/70 hover:border-black hover:bg-white"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 size={24} className="animate-spin text-neutral-600" />
                  <p className="text-xs font-bold text-neutral-700">
                    Optimizing and uploading image…
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-xs border border-neutral-200">
                    <UploadCloud size={18} className="text-neutral-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold text-neutral-800">
                    Click to upload product image or drag & drop
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Supports PNG, JPG, WebP, GIF up to 15MB (auto-optimized)
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Multiple Mode View (For PUBG Accounts) */}
      {mode === "multiple" && (
        <div className="space-y-3">
          {/* Gallery Grid */}
          {imageList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imageList.map((url, idx) => {
                const isPrimary = idx === 0;
                return (
                  <div
                    key={`${url}-${idx}`}
                    className={`group relative overflow-hidden rounded-xl border transition aspect-[4/3] bg-neutral-100 ${
                      isPrimary
                        ? "border-amber-400 ring-2 ring-amber-400/30"
                        : "border-[#dedbd0] hover:border-neutral-400"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Account screenshot ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />

                    {/* Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {isPrimary ? (
                        <span className="flex items-center gap-1 rounded-md bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-black shadow-xs">
                          <Star size={10} className="fill-white" /> Cover Photo
                        </span>
                      ) : (
                        <span className="rounded-md bg-black/60 text-white px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-xs">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Action Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-2">
                      <div className="flex justify-end gap-1">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-neutral-800 hover:bg-white shadow-xs"
                          title="View full image"
                        >
                          <ExternalLink size={12} />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(idx);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                          title="Delete screenshot"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(idx)}
                          className="w-full rounded-md bg-white/90 hover:bg-white text-neutral-900 py-1 text-[10px] font-black tracking-wide flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Star size={10} /> Set as Cover
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Multi-Dropzone / Add more button */}
          {imageList.length < maxImages && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                isDragging
                  ? "border-black bg-neutral-100"
                  : "border-[#d8d5ca] bg-neutral-50/70 hover:border-black hover:bg-white"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isUploading ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 size={18} className="animate-spin text-neutral-600" />
                  <span className="text-xs font-bold text-neutral-700">
                    Optimizing and uploading screenshots…
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-xs border border-neutral-200">
                    <Plus size={16} className="text-neutral-700" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-neutral-800">
                      {imageList.length === 0
                        ? "Upload PUBG account screenshots (select multiple)"
                        : "Upload more screenshots"}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Select multiple photos at once (Lobby, RP, Gun Skins, Outfits, Stats)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
