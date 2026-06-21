"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

import {
  STEAM_HEADER_IMAGE_HEIGHT,
  STEAM_HEADER_IMAGE_WIDTH,
  getSteamHeaderImageUrl,
} from "@/lib/steam/assets";
import { cn } from "@/lib/utils";

export function GameIdentityBanner({
  steamAppId,
  title,
  priority = false,
  className,
}: {
  steamAppId: number | null;
  title: string;
  priority?: boolean;
  className?: string;
}) {
  const [failedSteamAppId, setFailedSteamAppId] = useState<number | null>(null);
  const imageUrl = failedSteamAppId === steamAppId ? null : getSteamHeaderImageUrl(steamAppId);

  return (
    <div
      className={cn(
        "relative aspect-[92/43] overflow-hidden rounded-t-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${title} Steam header artwork`}
          width={STEAM_HEADER_IMAGE_WIDTH}
          height={STEAM_HEADER_IMAGE_HEIGHT}
          sizes="(min-width: 1280px) 360px, (min-width: 768px) 45vw, 100vw"
          priority={priority}
          className="h-full w-full object-cover"
          onError={() => setFailedSteamAppId(steamAppId)}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
