import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Calendar, Target } from 'lucide-react';
import { api } from '../../lib/api';
import { publicRoadmapPath } from '../../lib/public-links';
import type { PublicProfile as PublicProfileData, Roadmap } from '../../types';
import { FullScreenMessage } from './FullScreenMessage';
import { ProfileAvatar } from './ProfileAvatar';

export function PublicProfile() {
  const { handle = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setError('Profile handle is required.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getPublicProfile(handle)
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setProfile(data.profile);
        setRoadmaps(data.roadmaps);
      })
      .catch((loadError: unknown) => {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load public profile.');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [handle]);

  if (loading) {
    return <FullScreenMessage title="Open Roadmap" body="Loading public profile." />;
  }

  if (error || !profile) {
    return <FullScreenMessage title="Profile not found" body={error || 'This public profile could not be found.'} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-start gap-6 mb-12">
          <ProfileAvatar image={profile.image} name={profile.displayName} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="mb-2">{profile.displayName}</h1>
            <p className="text-muted-foreground mb-3">@{profile.handle}</p>
            {profile.bio ? (
              <p className="text-muted-foreground mb-4 max-w-xl">{profile.bio}</p>
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="mb-6">Public Roadmaps</h2>
          {roadmaps.length > 0 ? (
            <div className="grid gap-6">
              {roadmaps.map((roadmap) => (
                <Link
                  key={roadmap.id}
                  to={publicRoadmapPath(profile.handle, roadmap.slug)}
                  className="block p-6 bg-card border border-border rounded-lg hover:border-foreground/20 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-2 truncate">{roadmap.publicTitle || roadmap.title}</h3>
                      {(roadmap.publicSummary || roadmap.summary) ? (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {roadmap.publicSummary || roadmap.summary}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{roadmap.nodeCount ?? 0} nodes</span>
                        {roadmap.publishedAt ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Published {formatDate(roadmap.publishedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-32 h-24 bg-accent rounded flex items-center justify-center flex-shrink-0">
                      <Target className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No public roadmaps yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}
