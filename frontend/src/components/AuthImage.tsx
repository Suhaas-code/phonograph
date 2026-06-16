import { useEffect, useState } from "react";
import { apiBlob } from "../api/client";

// Loads a protected image (with the bearer token) and renders it from an object
// URL, so access control is enforced and the URL is never exposed.
export default function AuthImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    apiBlob(path)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) return <div className="text-xs text-red-400">Image unavailable</div>;
  if (!src) return <div className="h-32 w-48 animate-pulse rounded bg-edge" />;
  return <img src={src} alt={alt} className={className} />;
}
