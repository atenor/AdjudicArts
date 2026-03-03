"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function looksLikeImage(url: string) {
  return /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(url);
}

export default function DocumentPreviewLink({
  url,
  label,
  title,
  kind = "auto",
}: {
  url: string;
  label: string;
  title: string;
  kind?: "auto" | "image" | "document";
}) {
  const imageLike = kind === "image" ? true : kind === "document" ? false : looksLikeImage(url);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]"
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[980px] p-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {imageLike ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="mx-auto h-auto w-auto max-h-[78vh] max-w-[920px] rounded-lg object-contain"
          />
        ) : (
          <iframe
            src={url}
            title={title}
            className="h-[78vh] w-full rounded-lg border border-[#d8cce9] bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
