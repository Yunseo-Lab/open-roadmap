import { useState } from 'react';
import { X, Edit3, Globe, Upload, Link as LinkIcon, FileText, ChevronRight } from 'lucide-react';
import type { GraphNode } from '../graph/types';

interface InspectorProps {
  selectedNode: GraphNode | null;
  view: 'edit' | 'publish';
  onViewChange: (view: 'edit' | 'publish') => void;
  onNodeUpdate: (updates: Partial<GraphNode['data']>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Inspector({ selectedNode, view, onViewChange, onNodeUpdate, isCollapsed, onToggleCollapse }: InspectorProps) {
  const [publishTitle, setPublishTitle] = useState('');
  const [publishSlug, setPublishSlug] = useState('');

  if (isCollapsed) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-3">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Expand panel"
        >
          <Edit3 className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex items-center border-b border-border flex-shrink-0">
        <div className="flex-1 flex items-center">
          <button
            onClick={() => onViewChange('edit')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              view === 'edit'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onViewChange('publish')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              view === 'publish'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            Publish
          </button>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-accent transition-colors border-l border-border"
          title="Collapse panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {view === 'edit' && (
          <div>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3>Edit Node</h3>
                    <div className={`text-xs px-2 py-1 rounded ${
                      selectedNode.type === 'objective' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      selectedNode.type === 'milestone' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                      selectedNode.type === 'event' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm block mb-2">Title</label>
                  <input
                    type="text"
                    value={selectedNode.data.label}
                    onChange={(e) => onNodeUpdate({ label: e.target.value })}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm block mb-2">Description</label>
                  <textarea
                    value={selectedNode.data.description || ''}
                    onChange={(e) => onNodeUpdate({ description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
                  />
                </div>

                {(selectedNode.type === 'milestone' || selectedNode.type === 'event') && (
                  <div>
                    <label className="text-sm block mb-2">Date</label>
                    <input
                      type="date"
                      value={selectedNode.data.date || ''}
                      onChange={(e) => onNodeUpdate({ date: e.target.value })}
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                    />
                  </div>
                )}

                {selectedNode.type === 'objective' && (
                  <div>
                    <label className="text-sm block mb-2">Status</label>
                    <select
                      value={selectedNode.data.status || 'pending'}
                      onChange={(e) => onNodeUpdate({ status: e.target.value })}
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-sm block mb-3">Attachments</label>
                  <div className="space-y-2">
                    <button className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm">
                      <Upload className="w-4 h-4" />
                      Upload File
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm">
                      <LinkIcon className="w-4 h-4" />
                      Add Link
                    </button>
                  </div>

                  {selectedNode.data.attachments && selectedNode.data.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {selectedNode.data.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-accent rounded text-xs">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{att.name}</span>
                          <button className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Edit3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Select a node to edit</p>
              </div>
            )}
          </div>
        )}

        {view === 'publish' && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2">Publish as Portfolio</h3>
              <p className="text-sm text-muted-foreground">
                Make this roadmap public. Others can view it as a portfolio showcase.
              </p>
            </div>

            <div>
              <label className="text-sm block mb-2">Public Title</label>
              <input
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder="Career Growth Journey 2026"
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="text-sm block mb-2">URL Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">loadmap.io/r/</span>
                <input
                  type="text"
                  value={publishSlug}
                  onChange={(e) => setPublishSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="career-2026"
                  className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm block mb-2">Summary</label>
              <textarea
                rows={3}
                placeholder="Brief overview of this roadmap..."
                className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-sm block mb-2">Visibility</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="visibility" value="public" defaultChecked className="w-4 h-4" />
                  <div>
                    <div className="text-sm">Public</div>
                    <div className="text-xs text-muted-foreground">Anyone with the link can view</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="visibility" value="unlisted" className="w-4 h-4" />
                  <div>
                    <div className="text-sm">Unlisted</div>
                    <div className="text-xs text-muted-foreground">Only those with link, not in your public profile</div>
                  </div>
                </label>
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity">
              <Globe className="w-4 h-4" />
              Publish Roadmap
            </button>

            <div className="pt-4 border-t border-border">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  💡 Published roadmaps appear on your public profile and can be shared as portfolio pieces.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
