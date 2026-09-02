'use client';

import React, { useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Rocket,
  Info,
  AlertTriangle,
  CheckSquare,
  Square,
  Lock,
  Loader2,
  MapPin,
  Calendar,
  Camera,
  ExternalLink,
  X,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { UploadedFileItem } from '../types/mediamind';
import { getGoogleLoginUrl, compressImageToJpeg } from '../lib/api';
import { parseExifFromFile } from '../lib/exif';

interface Step1UploadProps {
  files: UploadedFileItem[];
  albumDescription: string;
  isSigned: boolean;
  connectionId: string;
  onFilesChange: (files: UploadedFileItem[]) => void;
  onDescriptionChange: (desc: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
  isLoading: boolean;
}

const MAX_UPLOAD_IMAGES = 30;
const MAX_UPLOAD_SIZE_MB = 300;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const Step1Upload: React.FC<Step1UploadProps> = ({
  files,
  albumDescription,
  isSigned,
  connectionId,
  onFilesChange,
  onDescriptionChange,
  onAnalyze,
  onReset,
  isLoading,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [selectedExifItem, setSelectedExifItem] = useState<UploadedFileItem | null>(null);
  const googleLoginUrl = getGoogleLoginUrl(connectionId);

  const handleGoogleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    const width = 540;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      googleLoginUrl,
      'MediaMuseLabsGoogleAuth',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );
  };

  const handleFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSigned) {
      setErrorMsg('Please connect your Google account before uploading images.');
      return;
    }

    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    setErrorMsg(null);

    if (files.length + selectedFiles.length > MAX_UPLOAD_IMAGES) {
      setErrorMsg(`Please select no more than ${MAX_UPLOAD_IMAGES} images.`);
      return;
    }

    const currentTotalSize = files.reduce((acc, f) => acc + f.size, 0);
    const newTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + newTotalSize > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMsg(`Total upload size exceeds ${MAX_UPLOAD_SIZE_MB}MB limit.`);
      return;
    }

    setIsCompressing(true);
    try {
      // Extract EXIF metadata from original files and compress to JPEG preserving EXIF
      const newItems: UploadedFileItem[] = await Promise.all(
        selectedFiles.map(async (file, idx) => {
          // Parse rich EXIF metadata from the original file (GPS, time, camera, device)
          const exifInfo = await parseExifFromFile(file);

          // Compress image while preserving EXIF binary payload
          const compressedFile = await compressImageToJpeg(file, 1024, 0.8);

          return {
            id: `${compressedFile.name}_${Date.now()}_${idx}`,
            file: compressedFile,
            previewUrl: URL.createObjectURL(compressedFile),
            name: compressedFile.name,
            originalName: file.name,
            size: compressedFile.size,
            included: true,
            exif: exifInfo,
          };
        })
      );

      onFilesChange([...files, ...newItems]);
    } catch (err: any) {
      console.error('Image processing failed:', err);
      setErrorMsg('Failed to process one or more images. Please try again.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const toggleInclude = (id: string) => {
    onFilesChange(
      files.map((item) => (item.id === id ? { ...item, included: !item.included } : item))
    );
  };

  const activeFiles = files.filter((f) => f.included);
  const excludedCount = files.length - activeFiles.length;

  // Compute overall EXIF statistics
  const filesWithGps = files.filter((f) => f.exif?.formattedCoordinates);
  const detectedDevices = Array.from(
    new Set(
      files
        .map((f) => (f.exif ? [f.exif.make, f.exif.model].filter(Boolean).join(' ') : ''))
        .filter(Boolean)
    )
  );
  const detectedDates = Array.from(
    new Set(files.map((f) => f.exif?.formattedDate).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">📥 Upload Album</h2>
              <p className="text-xs text-slate-400">
                Choose up to {MAX_UPLOAD_IMAGES} images to analyze and cluster automatically.
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-all duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-upload images
            </button>
          )}
        </div>

        {!isSigned ? (
          <div className="mb-6 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-300">Google Account Required to Upload</p>
                <p className="text-amber-200/80 mt-1">
                  Media Muse Labs requires an authenticated Google session before processing albums.
                </p>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Connect with Google</span>
            </button>
          </div>
        ) : null}

        {/* Dropzone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 group ${
            isSigned && !isCompressing
              ? 'border-slate-700 hover:border-indigo-500/70 bg-slate-900/40'
              : 'border-slate-800 bg-slate-950/60 opacity-60 cursor-not-allowed'
          }`}
        >
          <input
            type="file"
            multiple
            disabled={!isSigned || isCompressing || isLoading}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileDrop}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div className="flex flex-col items-center justify-center gap-3">
            {isCompressing ? (
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center animate-spin">
                <Loader2 className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-200 text-base">
                {isCompressing ? (
                  'Processing & preparing images...'
                ) : isSigned ? (
                  <>
                    Drag and drop your photos here, or <span className="text-indigo-400 underline">browse</span>
                  </>
                ) : (
                  'Connect with Google above to unlock image upload'
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Max {MAX_UPLOAD_IMAGES} images (up to {MAX_UPLOAD_SIZE_MB}MB) • EXIF, GPS & timestamps preserved
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <p className="text-rose-400 text-xs font-semibold mt-3 flex items-center gap-1.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
          </p>
        )}
      </div>

      {/* Preview Grid */}
      {files.length > 0 && (
        <div className="glass-card p-6 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-100">🖼️ Preview Album ({files.length} images)</h3>
              <p className="text-xs text-slate-400">
                Uncheck photos to exclude them from visual clustering. Click EXIF tags to inspect full metadata.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 self-start sm:self-auto">
              {activeFiles.length} included
            </span>
          </div>

          {/* Album Metadata Summary Banner */}
          {(filesWithGps.length > 0 || detectedDevices.length > 0 || detectedDates.length > 0) && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 shadow-md flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>EXIF Preserved:</span>
              </div>

              {filesWithGps.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                  <MapPin className="w-3.5 h-3.5" /> {filesWithGps.length} with GPS
                </span>
              )}

              {detectedDevices.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">
                  <Camera className="w-3.5 h-3.5" /> {detectedDevices.join(' • ')}
                </span>
              )}

              {detectedDates.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200">
                  <Calendar className="w-3.5 h-3.5" /> {detectedDates[0]}
                  {detectedDates.length > 1 ? ` (+${detectedDates.length - 1} dates)` : ''}
                </span>
              )}
            </div>
          )}

          {/* Image Grid with EXIF Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {files.map((item) => {
              const exif = item.exif;
              const hasExif = !!exif;
              const deviceLabel = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null;

              return (
                <div
                  key={item.id}
                  className={`relative group rounded-2xl overflow-hidden border transition-all duration-200 ${
                    item.included
                      ? 'border-indigo-500/40 bg-slate-900/80 shadow-md shadow-indigo-500/10'
                      : 'border-slate-800 bg-slate-950/80 opacity-40 grayscale'
                  }`}
                >
                  <div
                    onClick={() => toggleInclude(item.id)}
                    className="aspect-square relative overflow-hidden bg-slate-950 cursor-pointer"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Include checkbox */}
                    <div className="absolute top-2 right-2 z-10">
                      {item.included ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400 bg-slate-900/90 rounded" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 bg-slate-900/90 rounded" />
                      )}
                    </div>

                    {/* GPS Tag Overlay on thumbnail */}
                    {exif?.formattedCoordinates && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        <MapPin className="w-3 h-3 text-emerald-400" /> GPS
                      </div>
                    )}
                  </div>

                  {/* Card Content & EXIF Badges */}
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="truncate font-semibold text-slate-200 text-xs flex-1 mr-2" title={item.originalName || item.name}>
                        {item.originalName || item.name}
                      </div>

                      {hasExif && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExifItem(item);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold transition-colors flex-shrink-0"
                          title="View complete EXIF metadata"
                        >
                          <Maximize2 className="w-2.5 h-2.5" /> EXIF
                        </button>
                      )}
                    </div>

                    {/* EXIF Metadata Pill summary */}
                    {exif ? (
                      <div className="space-y-1 text-[11px] text-slate-400">
                        {deviceLabel && (
                          <div className="flex items-center gap-1.5 truncate text-slate-300">
                            <Camera className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                            <span className="truncate">{deviceLabel}</span>
                          </div>
                        )}

                        {exif.formattedDate && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Calendar className="w-3 h-3 text-purple-400 flex-shrink-0" />
                            <span className="truncate">{exif.formattedDate}</span>
                          </div>
                        )}

                        {exif.formattedCoordinates && (
                          <div className="flex items-center gap-1.5 truncate text-emerald-300">
                            <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <a
                              href={exif.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="truncate hover:underline flex items-center gap-1"
                            >
                              <span>{exif.formattedCoordinates}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">No EXIF data found</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {excludedCount > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{excludedCount} image(s) currently excluded from clustering analysis.</span>
            </div>
          )}

          {/* Album Description */}
          <div className="pt-4 border-t border-slate-800/80">
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              📝 Album Description (optional)
            </label>
            <textarea
              rows={3}
              value={albumDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g. Safari expedition in Bandhavgarh — tigers, deer, and golden-hour landscapes shot in June 2026."
              className="w-full glass-input rounded-xl p-3 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              A short summary helps AI extract precise context for your social posts.
            </p>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onAnalyze}
              disabled={activeFiles.length < 1 || !isSigned || isLoading}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing & Clustering...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Analyze & Cluster Images</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Full EXIF Metadata Modal */}
      {selectedExifItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedExifItem(null)}
        >
          <div
            className="glass-card max-w-xl w-full p-6 border border-slate-700 bg-slate-900/95 shadow-2xl space-y-5 rounded-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-100">EXIF Metadata Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedExifItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={selectedExifItem.previewUrl}
                alt={selectedExifItem.name}
                className="w-24 h-24 rounded-xl object-cover border border-slate-700 bg-slate-950 flex-shrink-0"
              />
              <div className="truncate">
                <h4 className="font-bold text-slate-200 text-sm truncate">{selectedExifItem.originalName || selectedExifItem.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Size: {(selectedExifItem.size / 1024).toFixed(1)} KB
                </p>
                {selectedExifItem.exif?.imageWidth && selectedExifItem.exif?.imageHeight && (
                  <p className="text-xs text-slate-400">
                    Dimensions: {selectedExifItem.exif.imageWidth} × {selectedExifItem.exif.imageHeight} px
                  </p>
                )}
              </div>
            </div>

            {selectedExifItem.exif ? (
              <div className="space-y-4 text-xs">
                {/* Device & Camera */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Camera className="w-3.5 h-3.5" /> Camera & Device
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Camera Make:</span>
                      <span className="font-medium">{selectedExifItem.exif.make || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Model:</span>
                      <span className="font-medium">{selectedExifItem.exif.model || '—'}</span>
                    </div>
                    {selectedExifItem.exif.lensModel && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Lens:</span>
                        <span className="font-medium">{selectedExifItem.exif.lensModel}</span>
                      </div>
                    )}
                    {selectedExifItem.exif.software && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Software:</span>
                        <span className="font-medium">{selectedExifItem.exif.software}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* GPS / Location */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-300 flex items-center justify-between text-xs uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> GPS Location
                    </span>
                    {selectedExifItem.exif.googleMapsUrl && (
                      <a
                        href={selectedExifItem.exif.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
                      >
                        Open Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Coordinates:</span>
                      <span className="font-medium">
                        {selectedExifItem.exif.formattedCoordinates || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Altitude:</span>
                      <span className="font-medium">
                        {selectedExifItem.exif.altitude !== undefined
                          ? `${Math.round(selectedExifItem.exif.altitude)} m`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" /> Date & Time
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Date Taken:</span>
                      <span className="font-medium">{selectedExifItem.exif.formattedDate || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Exposure Settings */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Sliders className="w-3.5 h-3.5" /> Exposure Settings
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block">ISO:</span>
                      <span className="font-medium">{selectedExifItem.exif.iso || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Aperture:</span>
                      <span className="font-medium">
                        {selectedExifItem.exif.fNumber ? `f/${selectedExifItem.exif.fNumber}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Shutter:</span>
                      <span className="font-medium">{selectedExifItem.exif.exposureTime || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Focal Length:</span>
                      <span className="font-medium">
                        {selectedExifItem.exif.focalLength ? `${selectedExifItem.exif.focalLength}mm` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/50 rounded-xl">
                No detailed EXIF metadata tags detected in this file.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedExifItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
