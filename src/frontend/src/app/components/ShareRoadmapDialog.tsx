import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

interface ShareRoadmapDialogProps {
  open: boolean;
  url: string;
  onOpenChange: (open: boolean) => void;
}

export function ShareRoadmapDialog({
  open,
  url,
  onOpenChange,
}: ShareRoadmapDialogProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setCopyStatus('idle');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Roadmap</DialogTitle>
          <DialogDescription>
            Copy the public link for this roadmap.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" onClick={copyShareUrl}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
        {copyStatus === 'copied' ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Copied to clipboard.</p>
        ) : null}
        {copyStatus === 'failed' ? (
          <p className="text-sm text-destructive">Unable to copy the link.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
