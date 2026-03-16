import { useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { ImageCropper } from "~/components/ImageCropper";

type BasicInfoCardProps = {
  title: string;
  onTitleChange: (title: string) => void;
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  categories: { slug: string; label: string }[];
  isGroupEvent: boolean;
  headerImagePreview: string | null;
  cropSrc: string | null;
  onCropSrcChange: (src: string | null) => void;
  onHeaderImageChange: (blob: Blob, preview: string) => void;
  onHeaderImageRemove: () => void;
};

export function BasicInfoCard({
  title,
  onTitleChange,
  categoryId,
  onCategoryChange,
  categories,
  isGroupEvent,
  headerImagePreview,
  cropSrc,
  onCropSrcChange,
  onHeaderImageChange,
  onHeaderImageRemove,
}: BasicInfoCardProps) {
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Info</CardTitle>
        <CardDescription>What's your event about?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">
            Category{!isGroupEvent && " (optional)"}
            {isGroupEvent && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={categoryId}
            onValueChange={onCategoryChange}
            required={isGroupEvent}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Header Image */}
        <div className="space-y-1.5">
          <Label>Header Image (optional)</Label>
          {headerImagePreview ? (
            <img
              src={headerImagePreview}
              alt="Header preview"
              className="w-full rounded-md object-cover aspect-[1200/630]"
            />
          ) : (
            <button
              type="button"
              onClick={() => headerFileInputRef.current?.click()}
              className="w-full rounded-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors bg-muted/30 py-8 flex flex-col items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-6 text-muted-foreground">
                <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
              </svg>
              <span className="text-sm text-muted-foreground">
                Click to upload (1200x630, max 10 MB)
              </span>
            </button>
          )}
          <input
            ref={headerFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onCropSrcChange(URL.createObjectURL(file));
              if (headerFileInputRef.current) headerFileInputRef.current.value = "";
            }}
          />
          {headerImagePreview && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => headerFileInputRef.current?.click()}
              >
                Change Image
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onHeaderImageRemove}
              >
                Remove
              </Button>
            </div>
          )}
          {cropSrc && (
            <ImageCropper
              imageSrc={cropSrc}
              open
              onClose={() => onCropSrcChange(null)}
              onCropped={(blob) => {
                onCropSrcChange(null);
                onHeaderImageChange(blob, URL.createObjectURL(blob));
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
