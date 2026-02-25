"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function HeadshotPreview({
  src,
  alt,
  triggerClassName,
}: {
  src: string;
  alt: string;
  triggerClassName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="group" title="Open larger headshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className={triggerClassName} loading="lazy" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[980px] p-3">
        <DialogHeader>
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="mx-auto h-auto w-auto max-h-[78vh] max-w-[920px] rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
