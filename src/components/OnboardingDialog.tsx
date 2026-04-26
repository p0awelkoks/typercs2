/**
 * Dialog widoczny po pierwszym logowaniu — ustawienie nicku i avatara.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";

export function OnboardingDialog() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && profile && !profile.onboarded) {
      setUsername(profile.username ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user, profile]);

  const save = async () => {
    if (!user) return;
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 24) {
      toast.error("Nick musi mieć 3–24 znaki");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      toast.error("Nick może zawierać tylko litery, cyfry, _ i -");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed, avatar_url: avatarUrl || null, onboarded: true })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ten nick jest zajęty" : error.message);
      return;
    }
    toast.success("Profil ustawiony!");
    await refreshProfile();
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Ustaw <span className="gradient-text">profil</span>
          </DialogTitle>
          <DialogDescription>Wybierz nick i avatar widoczny w rankingu.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-center">
            <Avatar className="h-20 w-20 ring-2 ring-primary glow-primary">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{(username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nick">Nick</Label>
            <Input
              id="nick"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="np. s1mple_fan"
              maxLength={24}
            />
          </div>
          <div className="space-y-2">
            <Label>Avatar (opcjonalne)</Label>
            <FileUpload
              bucket="avatars"
              folder={user.id}
              value={avatarUrl}
              onChange={setAvatarUrl}
              label="Wgraj zdjęcie"
            />
          </div>
          <Button onClick={save} disabled={saving} className="w-full" size="lg">
            {saving ? "Zapisuję..." : "Zaczynamy!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
