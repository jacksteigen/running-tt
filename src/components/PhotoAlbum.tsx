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
    <div className="bg-white border rule p-6 md:p-10">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="t-headline text-[1.6rem] md:text-[1.9rem]">Your album</h3>
        <p className="t-numeral text-[1.1rem] text-dust">
          {photos.length} / {MAX_PHOTOS}
        </p>
      </div>

      <p className="mt-2 text-[0.95rem] text-midnight/60 leading-relaxed max-w-md">
        Race day, training, the people you run with. These sit on your public
        athlete profile.
      </p>

      {photos.length > 0 && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
          {photos.map((photo) => (
            <div key={photo.id}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || "Album photo"}
                  className="w-full aspect-[4/5] object-cover bg-stone"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label="Remove photo"
                  className="group/remove absolute top-0 right-0 w-11 h-11 flex items-start justify-end"
                >
                  {/* A small mark, with the full 44px corner to tap. */}
                  <span
                    aria-hidden
                    className="w-8 h-8 flex items-center justify-center bg-midnight/75 text-bone group-hover/remove:bg-terracotta transition-colors"
                  >
                    ×
                  </span>
                </button>
              </div>
              {/* Set like the caption it becomes on the public page. */}
              <input
                type="text"
                defaultValue={photo.caption}
                onBlur={(e) => saveCaption(photo.id, e.target.value)}
                placeholder="Add a caption"
                maxLength={140}
                aria-label="Photo caption"
                className="w-full mt-1 min-h-11 bg-transparent border-0 border-b border-midnight/15 px-0 py-2 font-serif italic text-base text-midnight/80 placeholder:text-midnight/35 focus:outline-none focus:border-terracotta transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      <div aria-live="polite" className="mt-6">
        {status && <p className="text-[0.9rem] text-trail mb-3">{status}</p>}
        {error && (
          <p role="alert" className="text-[0.9rem] text-terracotta mb-3">
            {error}
          </p>
        )}
      </div>

      <label
        className={`btn btn-sm btn-ghost has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta ${
          full || uploading ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
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
          className="sr-only"
          disabled={full || uploading}
        />
      </label>
      <p className="text-[0.8rem] text-midnight/50 mt-2.5">
        JPG, PNG or WebP, up to 5 MB each. Pick several at once.
      </p>
    </div>
  );
}
