import { AlertTriangle } from 'lucide-react';
import type { Roadmap } from '../../types';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface RoadmapDeleteDialogProps {
  roadmap: Roadmap | null;
  open: boolean;
  deleting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RoadmapDeleteDialog({
  roadmap,
  open,
  deleting,
  error,
  onOpenChange,
  onConfirm,
}: RoadmapDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!deleting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Roadmap</DialogTitle>
          <DialogDescription>
            This will permanently delete "{roadmap?.title}" and its graph data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>This action cannot be undone.</span>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Roadmap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
