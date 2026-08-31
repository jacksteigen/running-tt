"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface AlbumPhoto {
  id: string;
  url: string;
  caption: string;
}

const MAX_PHOTOS = 10;

/**
 * The athlete's album: up to ten photos, each with an optional caption.
 * Captions save on blur so there is no second save button to remember.
 */
export default function PhotoAlbum({
  initialPhotos,
}: {
  initialPhotos: AlbumPhoto[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const full = photos.length >= MAX_PHOTOS;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setError("");
    setUploading(true);

    const room = MAX_PHOTOS - photos.length;
    const queue = files.slice(0, room);
    if (files.length > room) {
      setError(`Only ${room} more photo${room === 1 ? "" : "s"} will fit.`);
    }

    for (const file of queue) {
      try {
        const formData = new FormData();
        formData.append("photo", file);
        const res = await fetch("/api/profile/photos", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as {
          photo?: AlbumPhoto;
          error?: string;
        };
        if (data.photo) {
          setPhotos((prev) => [...prev, data.photo as AlbumPhoto]);
        } else {
          setError(data.error || "Upload failed");
          break;
        }
      } catch {
        setError("Upload failed. Try again.");
        break;
      }
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function saveCaption(id: string, caption: string) {
    try {
      await fetch(`/api/profile/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      setStatus("Caption saved");
      setTimeout(() => setStatus(""), 1500);
      router.refresh();
    } catch {
      setError("Could not save that caption.");
    }
  }

  async function removePhoto(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/profile/photos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
        router.refresh();
      } else {
        setError("Could not remove that photo.");
      }
    } catch {
      setError("Could not remove that photo.");
    }
  }

  return (
    <div className="bg-white border border-stone/40 p-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
            Your album
          </p>
          <h3 className="text-lg font-semibold tracking-tight">Photos</h3>
        </div>
        <p className="font-mono text-xs text-dust">
          {photos.length} / {MAX_PHOTOS}
        </p>
      </div>

      <p className="text-sm text-midnight/60 leading-relaxed mb-5">
        Race day, training, the people you run with. These sit on your public
        athlete profile.
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          {photos.map((photo) => (
            <div key={photo.id}>
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || "Album photo"}
                  className="w-full aspect-square object-cover border border-stone/40"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-midnight/80 text-white text-sm hover:bg-terracotta transition-colors"
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                defaultValue={photo.caption}
                onBlur={(e) => saveCaption(photo.id, e.target.value)}
                placeholder="Add a caption"
                maxLength={140}
                aria-label="Photo caption"
                className="w-full mt-1.5 border border-stone/40 px-2 py-1.5 text-xs bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      <div aria-live="polite">
        {status && <p className="text-xs text-trail mb-2">{status}</p>}
        {error && (
          <p role="alert" className="text-xs text-terracotta mb-2">
            {error}
          </p>
        )}
      </div>

      <label
        className={`inline-block text-xs font-medium border px-4 py-2 transition-colors ${
          full || uploading
            ? "border-stone/40 text-dust cursor-not-allowed"
            : "border-terracotta/30 text-terracotta hover:bg-terracotta/5 cursor-pointer"
        }`}
      >
        {uploading
          ? "Uploading..."
          : full
            ? "Album full"
            : photos.length
              ? "Add more photos"
              : "Add photos"}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFiles}
          className="hidden"
          disabled={full || uploading}
        />
      </label>
      <p className="text-[11px] text-midnight/40 mt-2">
        JPG, PNG or WebP, up to 5 MB each. Pick several at once.
      </p>
    </div>
  );
}
