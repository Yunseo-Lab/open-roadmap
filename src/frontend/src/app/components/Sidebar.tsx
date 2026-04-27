import { Target, Plus, Settings, ChevronLeft, Grid, Trash2 } from 'lucide-react';
import type { Roadmap } from '../../types';

interface SidebarProps {
  selectedRoadmap: string;
  roadmaps: Roadmap[];
  onSelectRoadmap: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCreateRoadmap?: () => void;
  onGoToDashboard?: () => void;
  onRequestDeleteRoadmap?: (roadmap: Roadmap) => void;
}

export function Sidebar({
  selectedRoadmap,
  roadmaps,
  onSelectRoadmap,
  isCollapsed,
  onToggleCollapse,
  onCreateRoadmap,
  onGoToDashboard,
  onRequestDeleteRoadmap,
}: SidebarProps) {
  const currentRoadmap = roadmaps.find((roadmap) => roadmap.id === selectedRoadmap) ?? null;

  if (isCollapsed) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl">
        <button
          onClick={onToggleCollapse}
          className="p-2.5 hover:bg-accent rounded-lg transition-colors h-[42px] w-[42px] flex items-center justify-center"
          title="Expand sidebar"
        >
          <Target className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden">
      <button
        onClick={onToggleCollapse}
        className="p-4 border-b border-border flex-shrink-0 w-full text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
              <Target className="w-5 h-5 text-background" />
            </div>
            <span className="font-medium">Loadmap</span>
          </div>
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-muted-foreground">Roadmaps</h3>
          {onCreateRoadmap ? (
            <button
              className="p-1 hover:bg-accent rounded"
              onClick={onCreateRoadmap}
              title="Create roadmap"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          {roadmaps.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No roadmaps yet
            </div>
          ) : null}
          {roadmaps.map((roadmap) => (
            <button
              key={roadmap.id}
              onClick={() => onSelectRoadmap(roadmap.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedRoadmap === roadmap.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{roadmap.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {roadmap.nodeCount ?? 0} nodes
                  </div>
                </div>
                {roadmap.status === 'published' && (
                  <div className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    Public
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border flex-shrink-0 space-y-1">
        {onGoToDashboard && (
          <button
            onClick={onGoToDashboard}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-lg text-sm"
          >
            <Grid className="w-4 h-4" />
            <span>Go to all Roadmaps</span>
          </button>
        )}
        {onRequestDeleteRoadmap && currentRoadmap ? (
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"
            onClick={() => onRequestDeleteRoadmap(currentRoadmap)}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete this Roadmap</span>
          </button>
        ) : null}
        <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-lg text-sm">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
