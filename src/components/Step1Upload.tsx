'use client';

import React, { useState, useEffect } from 'react';
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
  Crown,
  Zap,
  Sparkles,
} from 'lucide-react';
import { UploadedFileItem, AnalyzeProgress } from '../types/mediamind';
import { getGoogleLoginUrl, compressImageToJpeg, getDisplayPreviewUrl } from '../lib/api';
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
  analyzeProgress?: AnalyzeProgress;
  isPro?: boolean;
  onTogglePro?: () => void;
}

const MAX_UPLOAD_IMAGES = 30;
const MAX_UPLOAD_SIZE_MB = 300;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const PROGRESS_STAGES = [
  { min: 0, max: 18, text: 'Preparing photos for AI analysis...', subtitle: 'Optimizing payload and generating lightning-fast previews' },
  { min: 18, max: 38, text: 'Uploading photos to neural engine...', subtitle: 'Streaming lightweight images to clustering pipeline' },
  { min: 38, max: 58, text: 'Preserving full-res originals in bucket storage...', subtitle: 'Safeguarding high-resolution data and full EXIF metadata in parallel' },
  { min: 58, max: 76, text: 'Extracting deep visual semantics with SigLIP...', subtitle: 'Analyzing lighting, scene features, and thematic motifs' },
  { min: 76, max: 90, text: 'Grouping photos into visual stories & scenes...', subtitle: 'Computing semantic affinity graph & community clusters' },
  { min: 90, max: 98, text: 'Evaluating image quality & best shots with Florence-2...', subtitle: 'Ranking cluster representatives and generating rich descriptive tags' },
  { min: 98, max: 101, text: 'Analysis complete! Launching Social Studio...', subtitle: 'Preparing your personalized Social Media Studio' },
];

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
  analyzeProgress,
  isPro = false,
  onTogglePro,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [selectedExifItem, setSelectedExifItem] = useState<UploadedFileItem | null>(null);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [internalProgress, setInternalProgress] = useState<number>(0);

  const googleLoginUrl = getGoogleLoginUrl(connectionId);

  // Smooth progress progression timer during clustering analysis
  useEffect(() => {
    if (!isLoading) {
      setInternalProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 98) return 98;
        const increment = prev < 25 ? 3.5 : prev < 65 ? 2.2 : prev < 88 ? 1.4 : 0.6;
        return Math.min(98, prev + increment);
      });
    }, 220);

    return () => clearInterval(interval);
  }, [isLoading]);

  const currentProgress =
    analyzeProgress?.progress && analyzeProgress.progress > 0
      ? analyzeProgress.progress
      : internalProgress;

  const activeStage =
    PROGRESS_STAGES.find((s) => currentProgress >= s.min && currentProgress < s.max) ||
    PROGRESS_STAGES[PROGRESS_STAGES.length - 1];

  const displayStageText = analyzeProgress?.stageText || activeStage.text;
  const displayStageSubtitle = analyzeProgress?.stageSubtitle || activeStage.subtitle;

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

    // Pro users have infinite data upload - no limits!
    if (!isPro && files.length + selectedFiles.length > MAX_UPLOAD_IMAGES) {
      setErrorMsg(`Free plan allows up to ${MAX_UPLOAD_IMAGES} images. Enable Pro Mode for infinite data uploads!`);
      return;
    }

    const currentTotalSize = files.reduce((acc, f) => acc + f.size, 0);
    const newTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    if (!isPro && currentTotalSize + newTotalSize > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMsg(`Free plan upload size exceeds ${MAX_UPLOAD_SIZE_MB}MB limit. Enable Pro Mode for infinite data uploads!`);
      return;
    }

    setIsPreparing(true);
    try {
      // Extract EXIF metadata from original files and prepare preview representations
      const newItems: UploadedFileItem[] = await Promise.all(
        selectedFiles.map(async (file, idx) => {
          // Parse rich EXIF metadata from the original uncompressed file (GPS, time, camera, device)
          const exifInfo = await parseExifFromFile(file);

          // Create lightweight representation for fast clustering and preview
          const compressedFile = await compressImageToJpeg(file, 1024, 0.8);

          return {
            id: `${file.name}_${Date.now()}_${idx}`,
            file: file,                      // Original uncompressed file
            originalFile: file,              // Original uncompressed file
            compressedFile: compressedFile,  // Lightweight file for clustering
            originalSize: file.size,
            previewUrl: URL.createObjectURL(compressedFile),
            name: file.name,
            originalName: file.name,
            size: file.size,
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
      setIsPreparing(false);
      e.target.value = '';
    }
  };

  // Support sequence range selection with Shift+Click
  const handleToggleInclude = (index: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const targetState = !files[index].included;
      onFilesChange(
        files.map((item, idx) => {
          if (idx >= start && idx <= end) {
            return { ...item, included: targetState };
          }
          return item;
        })
      );
    } else {
      onFilesChange(
        files.map((item, idx) => (idx === index ? { ...item, included: !item.included } : item))
      );
      setLastClickedIndex(index);
    }
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">📥 Upload Album</h2>
                {isPro ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-indigo-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3 text-amber-400" /> PRO INFINITE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Free Tier
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isPro
                  ? 'Infinite data mode: Upload unlimited images with no size caps to analyze & cluster automatically.'
                  : `Choose up to ${MAX_UPLOAD_IMAGES} images (or unlimited with Pro) to analyze and cluster automatically.`}
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
            isSigned && !isPreparing
              ? 'border-slate-700 hover:border-indigo-500/70 bg-slate-900/40'
              : 'border-slate-800 bg-slate-950/60 opacity-60 cursor-not-allowed'
          }`}
        >
          <input
            type="file"
            multiple
            disabled={!isSigned || isPreparing || isLoading}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileDrop}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div className="flex flex-col items-center justify-center gap-3">
            {isPreparing ? (
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
                {isPreparing ? (
                  'Preparing images...'
                ) : isSigned ? (
                  <>
                    Drag and drop your photos here, or <span className="text-indigo-400 underline">browse</span>
                  </>
                ) : (
                  'Connect with Google above to unlock image upload'
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isPro ? (
                  <span className="text-amber-300/90 font-medium flex items-center justify-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    PRO Infinite Mode Active • Unlimited photos & data size • EXIF & GPS preserved
                  </span>
                ) : (
                  `Max ${MAX_UPLOAD_IMAGES} images (up to ${MAX_UPLOAD_SIZE_MB}MB) • EXIF, GPS & timestamps preserved`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Pro Switch suggestion banner for free users */}
        {!isPro && onTogglePro && (
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Need to upload more than 30 images? Pro users get infinite data uploads.</span>
            </div>
            <button
              type="button"
              onClick={onTogglePro}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm flex-shrink-0"
            >
              <Zap className="w-3 h-3 text-amber-400" /> Enable Pro Mode
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <p className="text-rose-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
            </p>
            {!isPro && onTogglePro && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  onTogglePro();
                }}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1 flex-shrink-0"
              >
                <Crown className="w-3.5 h-3.5" /> Unlock Pro (Infinite Data)
              </button>
            )}
          </div>
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
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onFilesChange(files.map((f) => ({ ...f, included: true })))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-emerald-500/50 transition-colors shadow-sm"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select All</span>
              </button>

              <button
                type="button"
                onClick={() => onFilesChange(files.map((f) => ({ ...f, included: false })))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Deselect All</span>
              </button>

              <button
                type="button"
                onClick={() => onFilesChange(files.map((f) => ({ ...f, included: !f.included })))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-indigo-500/50 transition-colors shadow-sm"
                title="Invert current selection"
              >
                <span>Invert</span>
              </button>

              {filesWithGps.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onFilesChange(
                      files.map((f) => ({
                        ...f,
                        included: Boolean(f.exif?.formattedCoordinates),
                      }))
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors shadow-sm"
                  title="Select only photos with GPS coordinates"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>GPS Only ({filesWithGps.length})</span>
                </button>
              )}

              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {activeFiles.length} / {files.length} selected
              </span>
            </div>
          </div>

          {/* Sequence Selection Helper Tip */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>
              <strong className="text-slate-200">Sequence Selection:</strong> Click to toggle individual photos. Hold{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px] font-bold">
                Shift
              </kbd>{' '}
              while clicking another photo to select or deselect the entire sequence in between.
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

          {/* Image Grid with Sequence Numbers & EXIF Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {files.map((item, idx) => {
              const exif = item.exif;
              const hasExif = !!exif;
              const deviceLabel = exif ? [exif.make, exif.model].filter(Boolean).join(' ') : null;
              const sequenceNum = item.included
                ? activeFiles.findIndex((f) => f.id === item.id) + 1
                : null;

              return (
                <div
                  key={item.id}
                  className={`relative group rounded-2xl overflow-hidden border transition-all duration-200 ${
                    item.included
                      ? 'border-indigo-500/40 bg-slate-900/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                      : 'border-slate-800 bg-slate-950/80 opacity-40 grayscale hover:opacity-60'
                  }`}
                >
                  <div
                    onClick={(e) => handleToggleInclude(idx, e)}
                    className="aspect-square relative overflow-hidden bg-slate-950 cursor-pointer"
                  >
                    <img
                      src={getDisplayPreviewUrl(item.previewUrl, item.originalName || item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallbackSource = item.r2Url || item.previewUrl;
                        if (fallbackSource && !target.src.includes('/media/preview')) {
                          target.src = `/api/v1/media/preview?url=${encodeURIComponent(fallbackSource)}`;
                        }
                      }}
                    />

                    {/* Include checkbox with Shift-click support */}
                    <div
                      className="absolute top-2 right-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleInclude(idx, e);
                      }}
                    >
                      {item.included ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400 bg-slate-900/90 rounded" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 bg-slate-900/90 rounded" />
                      )}
                    </div>

                    {/* Sequence and GPS Tag Overlays on thumbnail */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
                      {sequenceNum !== null && (
                        <div
                          className="flex items-center gap-1 bg-indigo-600/95 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-white border border-indigo-400/40 shadow-md"
                          title={`Selected in Sequence: #${sequenceNum}`}
                        >
                          <span>#{sequenceNum}</span>
                        </div>
                      )}
                      {exif?.formattedCoordinates && (
                        <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                          <MapPin className="w-3 h-3 text-emerald-400" /> GPS
                        </div>
                      )}
                    </div>
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

          {/* Progress Bar with Percentage and Dynamic Changing Text */}
          {isLoading && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-purple-950/40 border border-indigo-500/50 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 flex-shrink-0 animate-pulse">
                    <Sparkles className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        {displayStageText}
                      </h4>
                    </div>
                    <p className="text-xs text-indigo-300/80 mt-0.5">
                      {displayStageSubtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1.5 self-end sm:self-auto flex-shrink-0">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 tabular-nums">
                    {Math.round(currentProgress)}%
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">completed</span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-3.5 bg-slate-950/90 rounded-full p-0.5 border border-indigo-500/30 overflow-hidden relative shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 relative shadow-md shadow-indigo-500/50"
                  style={{ width: `${Math.max(4, Math.min(100, currentProgress))}%` }}
                >
                  {/* Subtle shine pulse */}
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                </div>
              </div>

              {/* Dynamic 4-Stage Step Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    currentProgress >= 20
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      currentProgress >= 20 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentProgress >= 20 ? '✓' : '1'}
                  </div>
                  <span className="font-semibold truncate">1. Optimize & Upload</span>
                </div>

                <div
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    currentProgress >= 45
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      currentProgress >= 45 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentProgress >= 45 ? '✓' : '2'}
                  </div>
                  <span className="font-semibold truncate">2. Cloud Sync</span>
                </div>

                <div
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    currentProgress >= 75
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      currentProgress >= 75 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentProgress >= 75 ? '✓' : '3'}
                  </div>
                  <span className="font-semibold truncate">3. SigLIP Semantic Graph</span>
                </div>

                <div
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    currentProgress >= 95
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      currentProgress >= 98 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentProgress >= 98 ? '✓' : '4'}
                  </div>
                  <span className="font-semibold truncate">4. Florence-2 Ranking</span>
                </div>
              </div>
            </div>
          )}

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
                  <span>Analyzing ({Math.round(currentProgress)}%)...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Lets Go!</span>
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
                src={getDisplayPreviewUrl(selectedExifItem.previewUrl, selectedExifItem.originalName || selectedExifItem.name)}
                alt={selectedExifItem.name}
                loading="lazy"
                className="w-24 h-24 rounded-xl object-cover border border-slate-700 bg-slate-950 flex-shrink-0"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallbackSource = selectedExifItem.r2Url || selectedExifItem.previewUrl;
                  if (fallbackSource && !target.src.includes('/media/preview')) {
                    target.src = `/api/v1/media/preview?url=${encodeURIComponent(fallbackSource)}`;
                  }
                }}
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
