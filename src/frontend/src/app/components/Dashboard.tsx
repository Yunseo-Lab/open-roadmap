import { useState, type FormEvent } from 'react';
import { Plus, Target, Lock, Globe, Calendar, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { AccountButton } from './AccountButton';
import { AIChat } from './AIChat';
import { RoadmapDeleteDialog } from './RoadmapDeleteDialog';
import type { CreateRoadmapInput, CurrentUser, Roadmap, UpdateRoadmapInput } from '../../types';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface DashboardProps {
  user: CurrentUser;
  roadmaps: Roadmap[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updatingRoadmapId: string | null;
  deletingRoadmapId: string | null;
  onRetry: () => void;
  onSelectRoadmap: (roadmapId: string) => void;
  onCreateRoadmap: (input: CreateRoadmapInput) => Promise<string | null>;
  onUpdateRoadmap: (roadmapId: string, input: UpdateRoadmapInput) => Promise<string | null>;
  onDeleteRoadmap: (roadmapId: string) => Promise<string | null>;
  onSignOut: () => void;
}

export function Dashboard({
  user,
  roadmaps,
  loading,
  error,
  creating,
  updatingRoadmapId,
  deletingRoadmapId,
  onRetry,
  onSelectRoadmap,
  onCreateRoadmap,
  onUpdateRoadmap,
  onDeleteRoadmap,
  onSignOut,
}: DashboardProps) {
  const hasRoadmaps = roadmaps.length > 0;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoadmapTitle, setNewRoadmapTitle] = useState('');
  const [newRoadmapSummary, setNewRoadmapSummary] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editRoadmapTitle, setEditRoadmapTitle] = useState('');
  const [editRoadmapSummary, setEditRoadmapSummary] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingRoadmap, setDeletingRoadmap] = useState<Roadmap | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openCreateDialog() {
    setNewRoadmapTitle('');
    setNewRoadmapSummary('');
    setFormError(null);
    setIsCreateDialogOpen(true);
  }

  function openEditDialog(roadmap: Roadmap) {
    setEditingRoadmap(roadmap);
    setEditRoadmapTitle(roadmap.title);
    setEditRoadmapSummary(roadmap.summary);
    setEditError(null);
  }

  function openDeleteDialog(roadmap: Roadmap) {
    setDeletingRoadmap(roadmap);
    setDeleteError(null);
  }

  async function handleCreateRoadmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newRoadmapTitle.trim();
    const summary = newRoadmapSummary.trim();

    if (!title) {
      setFormError('Title is required.');
      return;
    }

    const createError = await onCreateRoadmap({ title, summary });
    if (createError) {
      setFormError(createError);
      return;
    }

    setIsCreateDialogOpen(false);
  }

  async function handleUpdateRoadmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingRoadmap) {
      return;
    }

    const title = editRoadmapTitle.trim();
    const summary = editRoadmapSummary.trim();

    if (!title) {
      setEditError('Title is required.');
      return;
    }

    const updateError = await onUpdateRoadmap(editingRoadmap.id, { title, summary });
    if (updateError) {
      setEditError(updateError);
      return;
    }

    setEditingRoadmap(null);
  }

  async function handleDeleteRoadmap() {
    if (!deletingRoadmap) {
      return;
    }

    const removeError = await onDeleteRoadmap(deletingRoadmap.id);
    if (removeError) {
      setDeleteError(removeError);
      return;
    }

    setDeletingRoadmap(null);
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Floating Header */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl px-4 h-[42px]">
          <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
            <Target className="w-4 h-4 text-background" />
          </div>
          <span className="text-sm font-medium">Open Roadmap</span>
        </div>
        <AccountButton user={user} onSignOut={onSignOut} />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2>All Roadmaps</h2>
          <button
            onClick={openCreateDialog}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Roadmap
          </button>
        </div>

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <span className="text-destructive">{error}</span>
            <button
              onClick={() => onRetry()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-accent mx-auto mb-6 flex items-center justify-center">
              <Target className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="mb-3">Loading roadmaps</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your roadmap list will appear here in a moment.
            </p>
          </div>
        ) : hasRoadmaps ? (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roadmaps.map((roadmap) => (
              <RoadmapCard
                key={roadmap.id}
                roadmap={roadmap}
                onSelectRoadmap={onSelectRoadmap}
                onEditRoadmap={openEditDialog}
                onDeleteRoadmap={openDeleteDialog}
              />
            ))}

            {/* Create New Card */}
            <div
              onClick={openCreateDialog}
              className="group flex min-h-[244px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-card transition-all hover:border-foreground/50"
            >
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                  <Plus className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="mb-2">Create New Roadmap</h3>
                <p className="text-sm text-muted-foreground">
                  Start planning your next goal
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-accent mx-auto mb-6 flex items-center justify-center">
              <Target className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="mb-3">No roadmaps yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first roadmap to start planning and tracking your goals with AI assistance.
            </p>
            <button
              onClick={openCreateDialog}
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Create Your First Roadmap
            </button>
          </div>
        )}
      </main>

      <AIChat isOpen={true} />

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setIsCreateDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Roadmap</DialogTitle>
            <DialogDescription className="sr-only">
              Enter a title and summary before creating a roadmap.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateRoadmap}>
            <div className="space-y-2">
              <Label htmlFor="new-roadmap-title">Title</Label>
              <Input
                id="new-roadmap-title"
                value={newRoadmapTitle}
                onChange={(event) => {
                  setNewRoadmapTitle(event.target.value);
                  setFormError(null);
                }}
                placeholder="Career Growth 2026"
                maxLength={120}
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-roadmap-summary">Summary</Label>
              <Textarea
                id="new-roadmap-summary"
                value={newRoadmapSummary}
                onChange={(event) => setNewRoadmapSummary(event.target.value)}
                placeholder="My path from mid-level to senior frontend engineer"
                maxLength={1000}
                disabled={creating}
                className="min-h-24"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newRoadmapTitle.trim()}>
                {creating ? 'Creating...' : 'Create Roadmap'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingRoadmap)}
        onOpenChange={(open) => {
          if (!open && !updatingRoadmapId) {
            setEditingRoadmap(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Roadmap</DialogTitle>
            <DialogDescription className="sr-only">
              Update the roadmap title and summary.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateRoadmap}>
            <div className="space-y-2">
              <Label htmlFor="edit-roadmap-title">Title</Label>
              <Input
                id="edit-roadmap-title"
                value={editRoadmapTitle}
                onChange={(event) => {
                  setEditRoadmapTitle(event.target.value);
                  setEditError(null);
                }}
                maxLength={120}
                disabled={Boolean(updatingRoadmapId)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-roadmap-summary">Summary</Label>
              <Textarea
                id="edit-roadmap-summary"
                value={editRoadmapSummary}
                onChange={(event) => setEditRoadmapSummary(event.target.value)}
                maxLength={1000}
                disabled={Boolean(updatingRoadmapId)}
                className="min-h-24"
              />
            </div>
            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRoadmap(null)}
                disabled={Boolean(updatingRoadmapId)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={Boolean(updatingRoadmapId) || !editRoadmapTitle.trim()}>
                {updatingRoadmapId ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RoadmapDeleteDialog
        roadmap={deletingRoadmap}
        open={Boolean(deletingRoadmap)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoadmap(null);
            setDeleteError(null);
          }
        }}
        deleting={Boolean(deletingRoadmapId)}
        error={deleteError}
        onConfirm={handleDeleteRoadmap}
      />
    </div>
  );
}

function RoadmapCard({
  roadmap,
  onSelectRoadmap,
  onEditRoadmap,
  onDeleteRoadmap,
}: {
  roadmap: Roadmap;
  onSelectRoadmap: (roadmapId: string) => void;
  onEditRoadmap: (roadmap: Roadmap) => void;
  onDeleteRoadmap: (roadmap: Roadmap) => void;
}) {
  const isPublic = roadmap.status === 'published';

  return (
    <div
      className="group bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg hover:border-foreground/20 transition-all cursor-pointer"
      onClick={() => onSelectRoadmap(roadmap.id)}
    >
      {/* Card Header */}
      <div className="flex min-h-[188px] flex-col justify-between border-b border-border bg-gradient-to-br from-blue-50 to-purple-50 p-6 dark:from-blue-950/30 dark:to-purple-950/30">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10">
            <Target className="h-6 w-6 text-foreground" />
          </div>
          <div className="flex items-center gap-2">
            {isPublic ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                <Globe className="w-3 h-3" />
                Public
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">
                <Lock className="w-3 h-3" />
                Private
              </div>
            )}
            <button
              type="button"
              aria-label="Edit roadmap"
              title="Edit roadmap"
              onClick={(event) => {
                event.stopPropagation();
                onEditRoadmap(roadmap);
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete roadmap"
              title="Delete roadmap"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteRoadmap(roadmap);
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-destructive/30 bg-background/70 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-lg">{roadmap.title}</h3>
          {roadmap.summary ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {roadmap.summary}
            </p>
          ) : null}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span>{roadmap.nodeCount ?? 0} nodes</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(roadmap.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}
