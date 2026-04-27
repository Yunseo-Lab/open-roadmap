import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  LogOut,
  Mail,
  ShieldCheck,
  Target,
  User,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { AccountButton } from './AccountButton';
import { ProfileAvatar } from './ProfileAvatar';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';

export function SettingsPage() {
  const navigate = useNavigate();
  const { applyProfileUpdate, signOut, user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.profile.displayName || '');
  const [handle, setHandle] = useState(user?.profile.handle || '');
  const [bio, setBio] = useState(user?.profile.bio || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const normalizedHandle = handle.trim().replace(/^@/, '').toLowerCase();

  if (!user) {
    return null;
  }

  const currentDisplayName = user.profile.displayName || user.name || user.email;
  const profileUrl = `${window.location.origin}/u/${encodeURIComponent(user.profile.handle)}`;
  const cleanedDisplayName = displayName.trim();
  const cleanedBio = bio.trim();
  const hasProfileChanges =
    cleanedDisplayName !== user.profile.displayName ||
    normalizedHandle !== user.profile.handle ||
    cleanedBio !== user.profile.bio;

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cleanedDisplayName) {
      setSaveError('Display name is required.');
      setSaveMessage(null);
      return;
    }

    if (!normalizedHandle) {
      setSaveError('Handle is required.');
      setSaveMessage(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const data = await api.updateProfile({
        displayName: cleanedDisplayName,
        handle: normalizedHandle,
        bio: cleanedBio,
      });
      applyProfileUpdate(data.profile);
      setDisplayName(data.profile.displayName);
      setHandle(data.profile.handle);
      setBio(data.profile.bio);
      setSaveMessage('Profile saved.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyProfileLink() {
    if (!profileUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopyMessage('Profile link copied.');
    } catch {
      setCopyMessage('Unable to copy link.');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed left-4 right-4 top-4 z-40 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex h-[42px] items-center gap-2 rounded-lg border border-border bg-background/95 px-4 text-sm shadow-2xl backdrop-blur-sm transition-colors hover:bg-accent"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
            <Target className="h-4 w-4 text-background" />
          </div>
          <span>Open Roadmap</span>
        </button>
        <AccountButton user={user} onSignOut={signOut} />
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-24">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="-ml-3 mb-3"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <h1 className="text-2xl">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">@{user.profile.handle}</p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Signed in
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-border bg-card p-2">
            <a
              href="#public-profile"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <User className="h-4 w-4" />
              Public profile
            </a>
            <a
              href="#account"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Account
            </a>
          </aside>

          <div className="space-y-6">
            <section id="public-profile" className="rounded-lg border border-border bg-card">
              <form onSubmit={handleSaveProfile}>
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
                  <ProfileAvatar image={user.image} name={currentDisplayName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl">Public profile</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {profileUrl || 'Profile link unavailable'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!profileUrl}
                          onClick={handleCopyProfileLink}
                        >
                          <Copy className="h-4 w-4" />
                          Copy link
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!profileUrl}
                          onClick={() => navigate(`/u/${encodeURIComponent(user.profile.handle)}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="settings-display-name">Display name</Label>
                        <Input
                          id="settings-display-name"
                          value={displayName}
                          maxLength={80}
                          disabled={saving}
                          onChange={(event) => {
                            setDisplayName(event.target.value);
                            setSaveError(null);
                            setSaveMessage(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="settings-handle">Handle</Label>
                        <div className="flex rounded-md border border-input bg-input-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                          <span className="flex h-9 items-center px-3 text-sm text-muted-foreground">@</span>
                          <input
                            id="settings-handle"
                            value={handle}
                            maxLength={40}
                            disabled={saving}
                            onChange={(event) => {
                              setHandle(event.target.value);
                              setSaveError(null);
                              setSaveMessage(null);
                            }}
                            className="h-9 min-w-0 flex-1 bg-transparent px-0 pr-3 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="settings-bio">Bio</Label>
                      <Textarea
                        id="settings-bio"
                        value={bio}
                        maxLength={240}
                        disabled={saving}
                        className="min-h-28"
                        onChange={(event) => {
                          setBio(event.target.value);
                          setSaveError(null);
                          setSaveMessage(null);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-h-5">
                    {saveError ? (
                      <p className="text-sm text-destructive">{saveError}</p>
                    ) : saveMessage ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {saveMessage}
                      </p>
                    ) : copyMessage ? (
                      <p className="text-sm text-muted-foreground">{copyMessage}</p>
                    ) : null}
                  </div>
                  <Button type="submit" disabled={saving || !hasProfileChanges}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </section>

            <section id="account" className="rounded-lg border border-border bg-card">
              <div className="p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl">Account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary" className="gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" />
                    Google
                  </Badge>
                </div>

                <div className="grid gap-x-8 gap-y-4 border-y border-border py-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      Session
                    </div>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                </div>

                <Alert className="mt-5">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    Roadmaps stay private until you publish them.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              <div className="flex justify-end px-6 py-4">
                <Button type="button" variant="outline" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
