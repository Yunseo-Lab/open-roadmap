import { AlertCircle, Check, Loader2, Save } from 'lucide-react';

interface SaveStatusProps {
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
}

export function SaveStatus({ isDirty, isSaving, error, onSave }: SaveStatusProps) {
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl overflow-hidden">
      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="flex items-center gap-2 px-3 hover:bg-accent rounded-lg transition-colors h-[42px] disabled:opacity-60 disabled:cursor-not-allowed"
        title={isDirty ? 'Save graph' : 'Saved'}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isDirty ? (
          <Save className="w-4 h-4" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">{isSaving ? 'Saving' : isDirty ? 'Save' : 'Saved'}</span>
      </button>
      {error ? (
        <div className="flex items-start gap-2 border-t border-border px-3 py-2 text-xs text-destructive max-w-64">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
