"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { LayoutStyle } from "@/components/templates/AdTemplateTakumi";

const LAYOUTS: { id: LayoutStyle; name: string }[] = [
  { id: 'bold-statement',  name: 'Bold Statement' },
  { id: 'split-panel',     name: 'Split Panel'    },
  { id: 'data-card',       name: 'Data Card'      },
  { id: 'device-showcase', name: 'App Screenshot' },
];

const allLoading = () => Object.fromEntries(LAYOUTS.map(({ id }) => [id, true]));

interface TemplatePickerProps {
  selected: LayoutStyle;
  onChange: (layout: LayoutStyle) => void;
  templateType: "ad" | "reel";
  brandColor: string;
}

export function TemplatePicker({ selected, onChange, templateType, brandColor }: TemplatePickerProps) {
  const [thumbnailUrls, setThumbnailUrls] = useState<Partial<Record<LayoutStyle, string>>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>(allLoading);
  const prevUrlsRef = useRef<Partial<Record<LayoutStyle, string>>>({});

  useEffect(() => {
    // When templateType or brandColor changes, re-fetch all thumbnails
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset spinners before the fetches below
    setLoading(allLoading());

    // Revoke old blob URLs to prevent memory leaks
    Object.values(prevUrlsRef.current).forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    prevUrlsRef.current = {};
    setThumbnailUrls({});

    LAYOUTS.forEach(async ({ id }) => {
      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preview: true,
            templateType,
            layoutStyle: id,
            backgroundPreset: 'dark-gradient',
            brandColor,
            headlineStart: "Your message",
            headlineHighlight: "right here",
            subtext: "Supporting context that drives action.",
            icon: "⚡",
            bulletPoints: ["First benefit", "Second benefit", "Third benefit"],
            metricValue: "4.8",
            metricUnit: "stars",
            metricStatus: "RATED",
            progressPercent: 72,
          }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        prevUrlsRef.current[id] = url;
        setThumbnailUrls(prev => ({ ...prev, [id]: url }));
        setLoading(prev => ({ ...prev, [id]: false }));
      } catch {
        setLoading(prev => ({ ...prev, [id]: false }));
      }
    });
  }, [templateType, brandColor]);

  const isReel = templateType === 'reel';
  // Display aspect: feed 4:5 at 128px wide, reel 9:16 at 90px wide
  const thumbWidth  = isReel ? 90  : 128;
  const thumbHeight = 160;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Choose Layout</p>
      <div className="flex gap-4">
        {LAYOUTS.map(({ id, name }) => {
          const isSelected = selected === id;
          const isLoading  = loading[id] !== false;
          const url        = thumbnailUrls[id];
          return (
            <div
              key={id}
              onClick={() => onChange(id)}
              className={`cursor-pointer rounded-lg p-1 flex flex-col items-center gap-2 flex-1 border transition-all ${
                isSelected
                  ? 'ring-2 ring-primary border-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div
                className="rounded overflow-hidden bg-muted flex items-center justify-center relative"
                style={{ width: thumbWidth, height: thumbHeight }}
              >
                {isLoading ? (
                  <div className="animate-pulse bg-muted w-full h-full rounded" />
                ) : url ? (
                  <img
                    src={url}
                    alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
              </div>
              <span className={`text-xs ${isSelected ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
