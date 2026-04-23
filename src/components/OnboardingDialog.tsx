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
    if (trimmed.length < 3) {
      toast.error("Nick musi mieć min. 3 znaki");
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
            <Label htmlFor="avatar">URL avatara (opcjonalne)</Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
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
