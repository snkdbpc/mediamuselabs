'use client';

import React from 'react';
import { Cluster, UploadedFileItem } from '../types/mediamind';
import {
  Edit3,
  Sparkles,
  ArrowLeft,
  Tag,
  MapPin,
  AlignLeft,
  Layers,
  Camera,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface Step2ChooseOrEditProps {
  currentStep: 'choose' | 'edit';
  clusters: Cluster[];
  files: UploadedFileItem[];
  onSetStep: (step: 'choose' | 'edit' | 'finalize' | 'upload') => void;
  onClustersChange: (updatedClusters: Cluster[]) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

export const Step2ChooseOrEdit: React.FC<Step2ChooseOrEditProps> = ({
  currentStep,
  clusters,
  files,
  onSetStep,
  onClustersChange,
  onGenerate,
  isLoading,
}) => {
  // Update Cluster Tags
  const handleClusterTagsChange = (clusterId: string | number, newTagsStr: string) => {
    const newTags = newTagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    onClustersChange(
      clusters.map((c) => (c.cluster_id === clusterId ? { ...c, tags: newTags } : c))
    );
  };

  // Update Image Details inside Cluster
  const handleImageDetailChange = (
    clusterId: string | number,
    imgIdx: number,
    field: 'tags' | 'description' | 'image_location',
    value: string
  ) => {
    onClustersChange(
      clusters.map((c) => {
        if (c.cluster_id !== clusterId) return c;
        const details = { ...(c.image_details || {}) };
        const currentItem = details[imgIdx] || { description: '', tags: [], image_location: '' };

        if (field === 'tags') {
          currentItem.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
        } else {
          currentItem[field] = value;
        }

        details[imgIdx] = currentItem;
        return { ...c, image_details: details };
      })
    );
  };

  if (currentStep === 'choose') {
    return (
      <div className="glass-card p-8 border border-slate-800 shadow-2xl space-y-6 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
          <Layers className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Album Analyzed & Clustered!</h2>
          <p className="text-slate-400 text-sm mt-2">
            We discovered <strong className="text-indigo-300">{clusters.length} visual cluster(s)</strong>.
            Choose whether to review cluster tags and image descriptions or generate social copy immediately.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <button
            onClick={() => onSetStep('edit')}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold transition-all duration-200 group shadow-md"
          >
            <Edit3 className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <span>✏️ Review & Edit Clusters</span>
            <span className="text-xs text-slate-400 font-normal">Refine tags, locations, and descriptions</span>
          </button>

          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 group"
          >
            <Sparkles className="w-6 h-6 text-pink-300 group-hover:scale-110 transition-transform" />
            <span>✨ Generate Social Copy</span>
            <span className="text-xs text-indigo-200/80 font-normal">Proceed straight to post creation</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">✏️ Review & Edit Clusters</h2>
          <p className="text-xs text-slate-400">
            Customize cluster tags and individual photo descriptions to fine-tune AI copy generation.
          </p>
        </div>
        <button
          onClick={() => onSetStep('upload')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Upload
        </button>
      </div>

      {clusters.map((cluster, cIdx) => (
        <div key={cluster.cluster_id} className="glass-card p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Cluster {cIdx + 1}
              </span>
              <h3 className="text-xl font-bold text-slate-100 mt-1">{cluster.name}</h3>
            </div>

            <div className="w-full md:w-auto flex-1 max-w-md">
              <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-400" /> Cluster tags (comma separated)
              </label>
              <input
                type="text"
                value={cluster.tags.join(', ')}
                onChange={(e) => handleClusterTagsChange(cluster.cluster_id, e.target.value)}
                placeholder="e.g. Featured, Hero Shot, Sunset"
                className="w-full glass-input rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <h4 className="text-base font-semibold text-slate-200">🖼️ Images in Cluster ({cluster.all_image_indices.length})</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cluster.all_image_indices.map((imgIdx) => {
              const fileItem = files[imgIdx];
              const exif = fileItem?.exif;
              const deviceLabel = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null;

              const imageDetail = (cluster.image_details || {})[imgIdx] || {
                description: '',
                tags: [],
                image_location: '',
              };

              return (
                <div key={imgIdx} className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="aspect-[16/10] sm:h-48 md:h-52 w-full relative rounded-xl overflow-hidden bg-slate-950">
                      {fileItem ? (
                        <img src={fileItem.previewUrl} alt={fileItem.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                          Photo #{imgIdx + 1}
                        </div>
                      )}

                      {/* GPS tag overlay */}
                      {exif?.formattedCoordinates && (
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                          <MapPin className="w-3 h-3 text-emerald-400" /> GPS
                        </div>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-200 truncate" title={fileItem?.originalName || fileItem?.name}>
                      {fileItem?.originalName || fileItem?.name || `Image #${imgIdx + 1}`}
                    </p>

                    {/* Preserved EXIF Info Card */}
                    {exif && (
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] space-y-1.5 text-slate-300">
                        {deviceLabel && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Camera className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                            <span className="truncate font-medium">{deviceLabel}</span>
                          </div>
                        )}
                        {exif.formattedDate && (
                          <div className="flex items-center gap-1.5 truncate text-slate-400">
                            <Calendar className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <span className="truncate">{exif.formattedDate}</span>
                          </div>
                        )}
                        {exif.formattedCoordinates && (
                          <div className="flex items-center justify-between gap-1 text-emerald-300">
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              <span className="truncate">{exif.formattedCoordinates}</span>
                            </div>
                            {exif.googleMapsUrl && (
                              <a
                                href={exif.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 underline flex-shrink-0"
                              >
                                Maps <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-xs pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-purple-400" /> Image tags
                      </label>
                      <input
                        type="text"
                        value={imageDetail.tags?.join(', ') || ''}
                        onChange={(e) =>
                          handleImageDetailChange(cluster.cluster_id, imgIdx, 'tags', e.target.value)
                        }
                        placeholder="e.g. tiger, forest"
                        className="w-full glass-input rounded-lg px-3 py-1.5 text-xs md:text-sm text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <AlignLeft className="w-3.5 h-3.5 text-indigo-400" /> Image description
                      </label>
                      <textarea
                        rows={2}
                        value={imageDetail.description || ''}
                        onChange={(e) =>
                          handleImageDetailChange(cluster.cluster_id, imgIdx, 'description', e.target.value)
                        }
                        placeholder="Describe this photo..."
                        className="w-full glass-input rounded-lg p-2.5 text-xs md:text-sm text-slate-200"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-pink-400" /> Image location
                        </label>
                        {exif?.formattedCoordinates && !imageDetail.image_location && (
                          <button
                            type="button"
                            onClick={() =>
                              handleImageDetailChange(
                                cluster.cluster_id,
                                imgIdx,
                                'image_location',
                                exif.formattedCoordinates!
                              )
                            }
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20"
                          >
                            📍 Use GPS Location
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={imageDetail.image_location || ''}
                        onChange={(e) =>
                          handleImageDetailChange(cluster.cluster_id, imgIdx, 'image_location', e.target.value)
                        }
                        placeholder="e.g. Bandhavgarh National Park"
                        className="w-full glass-input rounded-lg px-3 py-1.5 text-xs md:text-sm text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => onSetStep('upload')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </button>

        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          <span>✨ Generate Social Copy & Finalize</span>
        </button>
      </div>
    </div>
  );
};
