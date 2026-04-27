import { User, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { CurrentUser } from '../../types';
import { ProfileAvatar } from './ProfileAvatar';

interface AccountButtonProps {
  user: CurrentUser;
  onSignOut: () => void;
}

export function AccountButton({ user, onSignOut }: AccountButtonProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const displayName = user.profile.displayName || user.name || user.email;
  const profileHandle = user.profile.handle;
  const handle = profileHandle ? `@${profileHandle}` : user.email;

  return (
    <div className="relative">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="rounded-full shadow-2xl hover:shadow-xl transition-all"
        title="Account"
      >
        <ProfileAvatar image={user.image} name={displayName} size="sm" />
      </button>

      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-12 right-0 w-64 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <ProfileAvatar image={user.image} name={displayName} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{displayName}</div>
                  <div className="text-sm text-muted-foreground truncate">{handle}</div>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!profileHandle}
                onClick={() => {
                  if (!profileHandle) {
                    return;
                  }
                  setIsMenuOpen(false);
                  navigate(`/u/${encodeURIComponent(profileHandle)}`);
                }}
              >
                <User className="w-4 h-4" />
                <span>View profile</span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-lg transition-colors text-sm"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/settings');
                }}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <div className="my-2 h-px bg-border" />
              <button
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-lg transition-colors text-sm text-destructive"
                onClick={() => {
                  setIsMenuOpen(false);
                  onSignOut();
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
