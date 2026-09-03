'use client';

import React, { useState } from 'react';
import {
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  FileText,
} from 'lucide-react';

interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<boolean>;
  defaultName: string;
  defaultDescription: string;
  totalMediaCount: number;
  clustersCount: number;
  postsCount: number;
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultName,
  defaultDescription,
  totalMediaCount,
  clustersCount,
  postsCount,
}) => {
  const [name, setName] = useState(defaultName || 'Visual Story Album');
  const [description, setDescription] = useState(defaultDescription || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a project name.');
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      const ok = await onSave(name.trim(), description.trim());
      if (ok) {
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Failed to save project. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Save Project</h2>
              <p className="text-xs text-slate-400">Store clusters, media metadata, and generated social posts</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>Project saved successfully!</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bandhavgarh Safari Wildlife Series"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              required
              disabled={isSaving || isSuccess}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description / Notes (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this collection, shoot date, locations, or publishing goals..."
              rows={3}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
              disabled={isSaving || isSuccess}
            />
          </div>

          {/* Asset Summary */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Assets Included in Project
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-300 font-medium">{totalMediaCount} Photos</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300 font-medium">{clustersCount} Clusters</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-medium">{postsCount} Posts</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isSuccess}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving project...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
