import { useState, useCallback } from "react";
import { X, Plus, GripVertical, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUploader({ images, onChange, maxImages = 10 }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [];

    for (const file of filesToUpload) {
      try {
        const response = await fetch("/api/objects/upload", { method: "POST" });
        if (!response.ok) throw new Error("Failed to get upload URL");

        const { uploadURL } = await response.json();

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) throw new Error("Failed to upload file");

        const normalizeResponse = await fetch("/api/objects/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: uploadURL.split("?")[0] }),
        });

        if (normalizeResponse.ok) {
          const { objectPath } = await normalizeResponse.json();
          newImages.push(objectPath);
        }
      } catch (error) {
        console.error("Upload error:", error);
      }
    }

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }

    setIsUploading(false);
    e.target.value = "";
  }, [images, maxImages, onChange]);

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
  };

  const setCoverImage = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(index, 1);
    newImages.unshift(moved);
    onChange(newImages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newImages = [...images];
      const [moved] = newImages.splice(draggedIndex, 1);
      newImages.splice(dragOverIndex, 0, moved);
      onChange(newImages);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith("/objects/")) {
      return path;
    }
    return path;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <ImageIcon className="h-4 w-4" />
        <span>Upload at least 4 photos (maximum {maxImages} photos) to attract shoppers to your offer.</span>
      </div>
      <p className="text-xs text-slate-500">Hold and drag to reorder. First image will be the cover photo.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((image, index) => (
          <div
            key={`${image}-${index}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative aspect-[4/3] rounded-lg overflow-hidden border-2 cursor-move group",
              index === 0 ? "border-[#00426D]" : "border-slate-200",
              dragOverIndex === index && "border-blue-500 border-dashed"
            )}
          >
            <img
              src={getImageUrl(image)}
              alt={`Upload ${index + 1}`}
              className="w-full h-full object-cover"
            />

            {index === 0 && (
              <div className="absolute top-2 left-2 bg-[#00426D] text-white text-xs px-2 py-1 rounded">
                Cover Photo
              </div>
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <GripVertical className="h-5 w-5 text-white" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                data-testid={`button-remove-image-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {index !== 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCoverImage(index);
                }}
                className="absolute bottom-2 left-2 right-2 bg-white/90 hover:bg-white text-xs py-1 rounded text-center transition-colors"
                data-testid={`button-set-cover-${index}`}
              >
                Set as Cover
              </button>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <label
            className={cn(
              "aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#00426D] hover:bg-slate-50 transition-colors",
              isUploading && "opacity-50 cursor-wait"
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              data-testid="input-image-upload"
            />
            {isUploading ? (
              <div className="text-sm text-slate-500">Uploading...</div>
            ) : (
              <>
                <Plus className="h-8 w-8 text-slate-400" />
                <span className="text-sm text-slate-500">Add More Photos</span>
              </>
            )}
          </label>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {images.length} of {maxImages} photos uploaded
      </p>
    </div>
  );
}
