/**
 * FileUpload — uniwersalny komponent do wgrywania plików do Supabase Storage.
 * Obsługuje preview, walidację typu/rozmiaru i zwraca publiczny URL.
 */
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  bucket: "avatars" | "team-logos";
  /** Folder w bucket (np. user.id dla avatarów). Wymagany dla avatarów (RLS). */
  folder?: string;
  value: string;
  onChange: (url: string) => void;
  /** Pokaż również pole na URL obok przycisku uploadu */
  allowUrl?: boolean;
  label?: string;
  /** Maksymalny rozmiar w MB (default 5) */
  maxMB?: number;
};

export function FileUpload({
  bucket,
  folder,
  value,
  onChange,
  allowUrl = true,
  label = "Wgraj plik",
  maxMB = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Tylko obrazy");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Maks. ${maxMB} MB`);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = folder ? `${folder}/${fileName}` : fileName;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success("Wgrano");
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? "Wgrywam..." : label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {allowUrl && (
        <Input
          placeholder="...lub wklej URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs"
        />
      )}
    </div>
  );
}
