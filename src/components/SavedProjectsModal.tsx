'use client';

import React, { useState } from 'react';
import {
  X,
  Folder,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  Trash2,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { SavedProjectSummary } from '../types/mediamind';

interface SavedProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: SavedProjectSummary[];
  isLoading: boolean;
  onOpenProject: (projectId: string) => Promise<void>;
  onDeleteProject?: (projectId: string) => Promise<void>;
}

export const SavedProjectsModal: React.FC<SavedProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  isLoading,
  onOpenProject,
  onDeleteProject,
}) => {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpen = async (id: string) => {
    setOpeningId(id);
    try {
      await onOpenProject(id);
      onClose();
    } catch (err) {
      console.error('Failed to open project:', err);
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteProject) return;
    setDeletingId(id);
    try {
      await onDeleteProject(id);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Saved Projects</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {projects.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">Open or manage your saved projects</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs font-medium">Loading saved projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">No Saved Projects Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Once your clusters are analyzed and finalized on the Social Media screen, click
                <span className="text-indigo-300 font-medium"> &quot;Save Project&quot;</span> to store your work here.
              </p>
            </div>
          ) : (
            projects.map((proj) => {
              const formattedDate = proj.updated_at
                ? new Date(proj.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';

              return (
                <div
                  key={proj.id}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/40 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-100 truncate">{proj.name}</h4>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                        {proj.status || 'finalized'}
                      </span>
                    </div>

                    {proj.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                        {proj.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formattedDate}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                        {proj.media_count} {proj.media_count === 1 ? 'photo' : 'photos'}
                      </span>
                      {proj.clusters_count > 0 && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          {proj.clusters_count} {proj.clusters_count === 1 ? 'cluster' : 'clusters'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {confirmDeleteId === proj.id ? (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <button
                          onClick={() => handleDelete(proj.id)}
                          disabled={deletingId === proj.id}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          {deletingId === proj.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Confirm Delete'
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {onDeleteProject && (
                          <button
                            onClick={() => setConfirmDeleteId(proj.id)}
                            title="Delete project"
                            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpen(proj.id)}
                          disabled={openingId === proj.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {openingId === proj.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <span>Open Project</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between text-xs text-slate-400">
          <span>Synced with your account</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
