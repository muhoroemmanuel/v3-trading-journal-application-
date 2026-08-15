"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Camera } from "lucide-react"
import type { ReturnType } from "@/hooks/use-image-uploads"

interface Props {
  images: ReturnType<typeof import("@/hooks/use-image-uploads").useImageUploads>
}

export function TradeImageGallery({ images }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Trade Images</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {images.images.map((img, index) => (
          <div key={img.id} className="relative group">
            <img
              src={img.preview}
              alt={img.caption || `Trade image ${index + 1}`}
              className="w-full h-24 object-cover rounded-lg"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => images.removeImage(img.id)}
            >
              <X className="h-3 w-3" />
            </Button>
            <Input
              value={img.caption}
              onChange={(e) => images.updateCaption(img.id, e.target.value)}
              placeholder="Caption..."
              className="mt-1 text-xs"
            />
          </div>
        ))}
        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <Camera className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Add Image</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => images.addImages(Array.from(e.target.files || []))}
          />
        </label>
      </div>
      {images.images.length > 0 && (
        <p className="text-xs text-muted-foreground">{images.images.length} image(s) attached</p>
      )}
    </div>
  )
}
