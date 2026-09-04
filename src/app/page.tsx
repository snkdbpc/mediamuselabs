'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { StepIndicator } from '../components/StepIndicator';
import { Step1Upload } from '../components/Step1Upload';
import { Step3SocialCenter } from '../components/Step3SocialCenter';
import { SavedProjectsModal } from '../components/SavedProjectsModal';
import { SaveProjectModal } from '../components/SaveProjectModal';
import { Footer } from '../components/Footer';
import {
  AppStep,
  Cluster,
  CreatorProfile,
  GoogleAccountStatus,
  ScoredClusterMetadata,
  SocialPost,
  UploadedFileItem,
  UserPreset,
  SavedProjectSummary,
  AnalyzeProgress,
} from '../types/mediamind';
import {
  createClusters,
  getGoogleStatus,
  scoreClusterImages,
  streamSocialPosts,
  uploadAlbum,
} from '../lib/api';
import { uploadOriginalFilesBatch } from '../lib/r2';
import {
  syncUserWithSupabase,
  updateUserProStatus,
  fetchUserPresets,
  saveUserPreset,
  saveProjectToSupabase,
  fetchUserProjects,
  loadProjectFromSupabase,
  deleteProjectFromSupabase,
} from '../lib/supabase';

export default function Home() {
  const [connectionId, setConnectionId] = useState<string>('');
  const [googleStatus, setGoogleStatus] = useState<GoogleAccountStatus>({ connected: false });
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  // Pro user state (infinite data upload)
  const [isPro, setIsPro] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mediamind_is_pro') === 'true';
      if (stored) {
        setIsPro(true);
        setCreatorProfile((prev) => ({ ...prev, is_pro: true }));
      }
    }
  }, []);

  const handleTogglePro = (nextVal?: boolean) => {
    setIsPro((prev) => {
      const val = nextVal !== undefined ? nextVal : !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mediamind_is_pro', String(val));
      }
      setCreatorProfile((cp) => ({ ...cp, is_pro: val }));

      // Immediately persist to Supabase users table if user is signed in
      if (supabaseUserId) {
        updateUserProStatus(supabaseUserId, val).catch((err) => {
          console.warn('Unable to sync pro status to users table:', err);
        });
      }

      return val;
    });
  };

  // User presets state (from Supabase user_presets table)
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [savePresetOnNextStep, setSavePresetOnNextStep] = useState<boolean>(true);

  // Saved Projects state (from Supabase projects table)
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [isSavedProjectsModalOpen, setIsSavedProjectsModalOpen] = useState<boolean>(false);
  const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState<boolean>(false);

  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>({
    user_type: 'Individual',
    name: '',
    profession: '',
    content_type: 'Social post',
    language: 'English',
    target_audience: '',
    target_age_group: '18–24',
    professional: false,
    publishing_preference: { facebook: true, instagram: true, twitter: true },
    target_age_groups: ['18–24'],
  });

  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [albumDescription, setAlbumDescription] = useState<string>('');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [generatedPosts, setGeneratedPosts] = useState<Record<string, SocialPost>>({});
  const [scoredMetadata, setScoredMetadata] = useState<Record<string, ScoredClusterMetadata>>({});

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<AnalyzeProgress>({
    progress: 0,
    stageText: '',
    stageSubtitle: '',
    status: 'idle',
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<{
    completed: number;
    total: number;
    text: string;
  }>({ completed: 0, total: 0, text: '' });

  // Initialize Connection ID & Sync Google Auth Status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    let cid = urlParams.get('connection_id');

    // If returning from OAuth redirect with connection_id in URL, store it and immediately clean the URL
    if (cid) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('social_connection_id', cid);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('connection_id');
        const cleanSearch = cleanUrl.searchParams.toString();
        const cleanPath = cleanUrl.pathname + (cleanSearch ? `?${cleanSearch}` : '') + cleanUrl.hash;
        window.history.replaceState({}, '', cleanPath);
      }
    } else if (typeof window !== 'undefined') {
      cid = localStorage.getItem('social_connection_id');
    }

    if (!cid) {
      cid = 'conn_' + Math.random().toString(36).substring(2, 11);
      if (typeof window !== 'undefined') {
        localStorage.setItem('social_connection_id', cid);
      }
    }

    setConnectionId(cid);
    getGoogleStatus(cid).then((status) => setGoogleStatus(status));

    // Listen for OAuth completion from popup window
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const authedCid = event.data?.connection_id || cid;
        if (authedCid && authedCid !== cid) {
          cid = authedCid;
          setConnectionId(authedCid);
          if (typeof window !== 'undefined') {
            localStorage.setItem('social_connection_id', authedCid);
          }
        }
        getGoogleStatus(authedCid).then((status) => {
          if (status.connected) setGoogleStatus(status);
        });
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Poll Google status when not yet connected, and sync immediately on window focus/visibility
  useEffect(() => {
    if (!connectionId || googleStatus.connected) return;

    const checkStatus = () => {
      getGoogleStatus(connectionId).then((status) => {
        if (status.connected) {
          setGoogleStatus(status);
        }
      });
    };

    const interval = setInterval(checkStatus, 1500);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [connectionId, googleStatus.connected]);

  // Sync authenticated user with Supabase `users` table & load presets/projects/pro status
  useEffect(() => {
    if (!googleStatus.connected || !googleStatus.email) return;

    syncUserWithSupabase(googleStatus).then((syncRes) => {
      if (syncRes && syncRes.userId) {
        const userId = syncRes.userId;
        setSupabaseUserId(userId);

        // Synchronize Pro Status fetched directly from Supabase users table
        const serverIsPro = Boolean(syncRes.isPro);
        console.log('[Auth Sync] Loaded is_pro from Supabase users table:', serverIsPro);
        setIsPro(serverIsPro);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mediamind_is_pro', String(serverIsPro));
        }
        setCreatorProfile((prev) => ({ ...prev, is_pro: serverIsPro }));

        // Load saved user presets
        fetchUserPresets(userId).then((presets) => {
          setUserPresets(presets);
          if (presets.length > 0 && !selectedPresetId) {
            const p0 = presets[0];
            setSelectedPresetId(p0.id || null);
            setCreatorProfile((prev) => ({
              ...prev,
              preset_id: p0.id,
              preset_name: p0.name,
              name: p0.name || prev.name,
              user_type: p0.user_type || prev.user_type,
              professional: p0.professional,
              publishing_preference: p0.publishing_preference || prev.publishing_preference,
              target_audience: p0.target_audience || prev.target_audience,
              target_age_groups: p0.target_age_groups || prev.target_age_groups,
              target_age_group: p0.target_age_groups?.[0] || prev.target_age_group,
              is_pro: serverIsPro,
            }));
          }
        });

        // Load saved projects list
        fetchUserProjects(userId).then((projs) => {
          setSavedProjects(projs);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleStatus.connected, googleStatus.email]);

  // Preset Selection Handler
  const handleSelectPreset = (preset: UserPreset | null) => {
    if (!preset) {
      setSelectedPresetId(null);
      return;
    }
    setSelectedPresetId(preset.id || null);
    setCreatorProfile((prev) => ({
      ...prev,
      preset_id: preset.id,
      preset_name: preset.name,
      name: preset.name || prev.name,
      user_type: preset.user_type || prev.user_type,
      language: preset.language || prev.language || 'English',
      professional: preset.professional,
      publishing_preference: preset.publishing_preference || prev.publishing_preference,
      target_audience: preset.target_audience || prev.target_audience,
      target_age_groups: preset.target_age_groups || prev.target_age_groups,
      target_age_group: preset.target_age_groups?.[0] || prev.target_age_group,
    }));
  };

  // Manual Save Preset Handler
  const handleManualSavePreset = async (presetName: string): Promise<boolean> => {
    if (!supabaseUserId) {
      alert('Please connect your Google account first to save presets.');
      return false;
    }
    const presetPayload: UserPreset = {
      id: selectedPresetId || undefined,
      user_id: supabaseUserId,
      name: presetName,
      user_type: creatorProfile.user_type || 'Individual',
      language: creatorProfile.language || 'English',
      professional: Boolean(creatorProfile.professional),
      publishing_preference: creatorProfile.publishing_preference || {
        facebook: true,
        instagram: true,
        twitter: true,
      },
      target_audience: creatorProfile.target_audience || '',
      target_age_groups:
        creatorProfile.target_age_groups || [creatorProfile.target_age_group].filter(Boolean),
    };

    const saved = await saveUserPreset(supabaseUserId, presetPayload);
    if (saved) {
      setSelectedPresetId(saved.id || null);
      const refreshed = await fetchUserPresets(supabaseUserId);
      setUserPresets(refreshed);
      return true;
    }
    return false;
  };

  // Step 1: Upload & Cluster Analysis with Parallel Storage Sync & Preset Auto-Save
  const handleAnalyzeAlbum = async () => {
    const activeItems = uploadedFiles.filter((item) => item.included);
    if (activeItems.length < 1) return;

    // Auto-save user preset to Supabase user_presets if user opted to save preset
    if (supabaseUserId && savePresetOnNextStep) {
      const presetToSave: UserPreset = {
        id: selectedPresetId || undefined,
        user_id: supabaseUserId,
        name: creatorProfile.preset_name || creatorProfile.name || 'My Preset',
        user_type: creatorProfile.user_type || 'Individual',
        language: creatorProfile.language || 'English',
        professional: Boolean(creatorProfile.professional),
        publishing_preference: creatorProfile.publishing_preference || {
          facebook: true,
          instagram: true,
          twitter: true,
        },
        target_audience: creatorProfile.target_audience || '',
        target_age_groups:
          creatorProfile.target_age_groups || [creatorProfile.target_age_group].filter(Boolean),
      };

      saveUserPreset(supabaseUserId, presetToSave)
        .then((saved) => {
          if (saved) {
            fetchUserPresets(supabaseUserId).then(setUserPresets);
          }
        })
        .catch((err) => console.warn('Auto-save preset notice:', err));
    }

    setIsAnalyzing(true);
    setAnalyzeProgress({
      progress: 8,
      stageText: 'Preparing photos for AI analysis...',
      stageSubtitle: 'Optimizing payload and generating lightning-fast previews',
      status: 'running',
    });

    let progressTimer: NodeJS.Timeout | null = null;

    try {
      // 1. Upload lightweight images to backend for fast clustering analysis
      const lightweightFiles = activeItems.map((item) => item.compressedFile || item.file);
      setAnalyzeProgress({
        progress: 22,
        stageText: 'Uploading photos to neural engine...',
        stageSubtitle: 'Streaming lightweight images to clustering pipeline',
        status: 'running',
      });

      const uploadRes = await uploadAlbum(lightweightFiles, connectionId, isPro, supabaseUserId);
      const newAlbumId = uploadRes.album_id;
      setAlbumId(newAlbumId);

      // 2. Build index map matching uploaded files
      const filenames = lightweightFiles.map((f) => f.name);
      const indexMap: Record<string, number> = {};
      filenames.forEach((name, idx) => {
        indexMap[name] = idx;
      });

      setAnalyzeProgress({
        progress: 42,
        stageText: 'Preserving full-res originals in bucket storage...',
        stageSubtitle: 'Safeguarding high-resolution data and full EXIF metadata in parallel',
        status: 'running',
      });

      // 3. Parallel Execution during Clustering Phase:
      // (a) Sync uncompressed original files to bucket storage in parallel (opaque to user)
      const storageSyncPromise = uploadOriginalFilesBatch(
        activeItems,
        newAlbumId,
        (fileId, r2Url) => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, r2Url, r2Status: 'success' } : f))
          );
        }
      ).catch((err) => {
        console.warn('Storage sync notice:', err);
        return {};
      });

      // (b) Run clustering analysis on the backend
      const clusterPromise = createClusters(newAlbumId, filenames, indexMap, albumDescription);

      // Dynamic progress advancement during deep feature extraction & clustering
      progressTimer = setInterval(() => {
        setAnalyzeProgress((prev) => {
          if (prev.progress >= 96) return prev;
          const next = Math.min(96, prev.progress + 3.5);
          let text = prev.stageText;
          let subtitle = prev.stageSubtitle;
          if (next >= 55 && next < 75) {
            text = 'Extracting deep visual semantics with SigLIP...';
            subtitle = 'Analyzing lighting, scene features, and thematic motifs';
          } else if (next >= 75 && next < 90) {
            text = 'Grouping photos into visual stories & scenes...';
            subtitle = 'Computing semantic affinity graph & community clusters';
          } else if (next >= 90) {
            text = 'Evaluating image quality & best shots with Florence-2...';
            subtitle = 'Ranking cluster representatives and generating rich descriptive tags';
          }
          return { ...prev, progress: next, stageText: text, stageSubtitle: subtitle };
        });
      }, 250);

      // Wait for both clustering and original photo sync to complete
      const [, clusterRes] = await Promise.all([storageSyncPromise, clusterPromise]);
      if (progressTimer) clearInterval(progressTimer);

      setAnalyzeProgress({
        progress: 100,
        stageText: 'Analysis complete! Launching Social Studio...',
        stageSubtitle: 'Preparing your personalized Social Media Studio',
        status: 'completed',
      });

      setClusters(clusterRes.clusters);

      // Initialize scored metadata from cluster representatives
      const initialScored: Record<string, ScoredClusterMetadata> = {};
      clusterRes.clusters.forEach((c) => {
        const cId = String(c.cluster_id);
        if (c.representatives && c.representatives.length > 0) {
          initialScored[cId] = {
            representatives: c.representatives.map((r, rank) => ({
              rank: rank + 1,
              path: '',
              quality_score: r.quality_score ?? 0.9,
              image_idx: r.image_idx,
            })),
            avg_quality: 0.9,
          };
        }
      });
      // Background photo quality scoring
      scoreClusterImages(newAlbumId, clusterRes.clusters, 4)
        .then((scoreRes) => {
          if (scoreRes?.scored_clusters) {
            setScoredMetadata((prev) => ({ ...prev, ...scoreRes.scored_clusters }));
          }
        })
        .catch((scoreErr) => {
          console.warn('Background quality scoring notice:', scoreErr);
        });

      setScoredMetadata(initialScored);

      // Brief delay to let the user see the 100% completion pulse
      await new Promise((resolve) => setTimeout(resolve, 450));
      setCurrentStep('finalize');
    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      setAnalyzeProgress({
        progress: 0,
        stageText: 'Clustering failed',
        stageSubtitle: String(err.message || err),
        status: 'error',
      });
      alert(`Clustering failed: ${err.message || err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger Streaming Post Generation
  const handleGenerateSocialPosts = async (targetClusterId?: string) => {
    if (!albumId || clusters.length === 0) return;

    const clustersToProcess = targetClusterId
      ? clusters.filter((c) => String(c.cluster_id) === String(targetClusterId))
      : clusters;

    if (clustersToProcess.length === 0) return;

    setCurrentStep('finalize');
    setIsGenerating(true);
    setStreamProgress({
      completed: 0,
      total: clustersToProcess.length,
      text: `Preparing social media posts (${clustersToProcess.length} cluster${clustersToProcess.length > 1 ? 's' : ''})...`,
    });

    try {
      const postsObj: Record<string, SocialPost> = {};

      // SSE Stream post generation
      await streamSocialPosts(
        albumId,
        clustersToProcess,
        creatorProfile,
        (clusterId, post, completed, total) => {
          postsObj[clusterId] = post;
          setGeneratedPosts((prev) => ({ ...prev, [clusterId]: post }));
          setStreamProgress({
            completed,
            total,
            text: `Generated posts (${completed}/${total})...`,
          });
        },
        (clusterId, errMsg) => {
          console.error(`Post generation failed for cluster ${clusterId}:`, errMsg);
        }
      );

      // Confetti burst on completion!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(`Social generation failed: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
      setStreamProgress({ completed: 0, total: 0, text: '' });
    }
  };

  const handlePostUpdate = (clusterId: string, updatedPost: SocialPost) => {
    setGeneratedPosts((prev) => ({
      ...prev,
      [clusterId]: updatedPost,
    }));
  };

  // Save Project to Supabase
  const handleSaveProject = async (name: string, description?: string): Promise<boolean> => {
    if (!supabaseUserId) {
      alert('Please connect your Google account first to save projects.');
      return false;
    }

    if (!isPro && savedProjects.length >= 2) {
      alert('Free tier limit reached: You can save up to 2 projects. Upgrade to Pro for unlimited project saves or delete an existing project.');
      return false;
    }

    const activeItems = uploadedFiles.filter((f) => f.included);
    const res = await saveProjectToSupabase({
      userId: supabaseUserId,
      name,
      description,
      status: 'finalized',
      creatorProfile: { ...creatorProfile, is_pro: isPro },
      files: activeItems.length > 0 ? activeItems : uploadedFiles,
      clusters,
      posts: generatedPosts,
      scoredMetadata,
    });

    if (res.success) {
      // Refresh saved projects list
      fetchUserProjects(supabaseUserId).then(setSavedProjects);
      return true;
    } else {
      alert(`Failed to save project: ${res.error}`);
      return false;
    }
  };

  // Open a saved project from Supabase
  const handleOpenProject = async (projectId: string) => {
    setIsLoadingProjects(true);
    try {
      const data = await loadProjectFromSupabase(projectId);
      if (!data) {
        alert('Could not load saved project. Please try again.');
        return;
      }

      // 1. Restore Creator Profile
      if (data.preset) {
        setCreatorProfile({
          user_type: data.preset.user_type,
          name: data.preset.name,
          profession: '',
          content_type: 'Social post',
          language: data.preset.language || 'English',
          target_audience: data.preset.target_audience,
          target_age_group: data.preset.target_age_groups?.[0] || '18-24',
          professional: data.preset.professional,
          is_pro: data.preset.is_pro ?? isPro,
          publishing_preference: data.preset.publishing_preference,
          target_age_groups: data.preset.target_age_groups,
          preset_id: data.preset.id,
          preset_name: data.preset.name,
        });
        if (data.preset.is_pro !== undefined) {
          setIsPro(data.preset.is_pro);
        }
      }

      // 2. Restore Project State
      setAlbumId(data.project.id);
      setAlbumDescription(data.albumDescription || data.project.description || '');
      setUploadedFiles(data.media);
      setClusters(data.clusters);
      setGeneratedPosts(data.posts);
      if (data.scoredMetadata) {
        setScoredMetadata(data.scoredMetadata);
      }

      // 3. Set Step to Finalize Screen
      setCurrentStep('finalize');
    } catch (err: any) {
      console.error('Error opening project:', err);
      alert(`Failed to load project: ${err.message || err}`);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Delete a saved project
  const handleDeleteProject = async (projectId: string) => {
    const ok = await deleteProjectFromSupabase(projectId);
    if (ok && supabaseUserId) {
      setSavedProjects((prev) => prev.filter((p) => p.id !== projectId));
    }
  };

  const handleResetApp = () => {
    setUploadedFiles([]);
    setAlbumDescription('');
    setAlbumId(null);
    setClusters([]);
    setGeneratedPosts({});
    setScoredMetadata({});
    setCurrentStep('upload');
  };

  const handleDisconnectGoogle = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('social_connection_id');
      localStorage.removeItem('mediamind_is_pro');
    }
    const newCid = 'conn_' + Math.random().toString(36).substring(2, 11);
    if (typeof window !== 'undefined') {
      localStorage.setItem('social_connection_id', newCid);
    }
    setConnectionId(newCid);
    setGoogleStatus({ connected: false });
    setSupabaseUserId(null);
    setIsPro(false);
    setUserPresets([]);
    setSavedProjects([]);
  };

  const totalGeneratedPostsCount = Object.values(generatedPosts).filter((p) =>
    Boolean(p.facebook_post || p.instagram_caption || p.twitter_post)
  ).length;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0B0F19] text-slate-100 relative w-full">
      <div className="ambient-glow" />

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 pb-16 flex-1">
        {/* Top Header with Saved Projects Trigger */}
        {/* Top Header with Saved Projects Trigger and Pro Membership */}
        <Header
          creatorProfile={creatorProfile}
          googleStatus={googleStatus}
          connectionId={connectionId}
          savedProjectsCount={savedProjects.length}
          onOpenSavedProjectsModal={() => setIsSavedProjectsModalOpen(true)}
          isPro={isPro}
          onTogglePro={() => handleTogglePro()}
          onDisconnect={handleDisconnectGoogle}
        />

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row items-start gap-8 w-full">
          {/* Sidebar Creator Profile, Pro Plan & Presets */}
          <Sidebar
            profile={creatorProfile}
            onChange={setCreatorProfile}
            userPresets={userPresets}
            isSigned={googleStatus.connected}
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            savePresetOnNextStep={savePresetOnNextStep}
            onToggleSavePresetOnNextStep={setSavePresetOnNextStep}
            onManualSavePreset={handleManualSavePreset}
            isPro={isPro}
            onTogglePro={handleTogglePro}
          />

          {/* Workflow Center */}
          <div className="flex-1 w-full min-w-0">
            <StepIndicator
              currentStep={currentStep}
              onStepClick={(step) => setCurrentStep(step)}
            />

            {/* Step Views */}
            {currentStep === 'upload' && (
              <Step1Upload
                files={uploadedFiles}
                albumDescription={albumDescription}
                isSigned={googleStatus.connected}
                connectionId={connectionId}
                onFilesChange={setUploadedFiles}
                onDescriptionChange={setAlbumDescription}
                onAnalyze={handleAnalyzeAlbum}
                onReset={handleResetApp}
                isLoading={isAnalyzing}
                analyzeProgress={analyzeProgress}
                isPro={isPro}
                onTogglePro={() => handleTogglePro()}
              />
            )}

            {currentStep === 'finalize' && (
              <Step3SocialCenter
                clusters={clusters}
                posts={generatedPosts}
                scoredMetadata={scoredMetadata}
                files={uploadedFiles.filter((item) => item.included)}
                creatorProfile={creatorProfile}
                connectionId={connectionId}
                userId={supabaseUserId}
                projectId={albumId}
                isStreaming={isGenerating}
                streamProgress={streamProgress}
                onPostUpdate={handlePostUpdate}
                onGeneratePosts={handleGenerateSocialPosts}
                onClustersChange={setClusters}
                onSetStep={(step) => setCurrentStep(step)}
                onResetApp={handleResetApp}
                onOpenSaveProject={() => setIsSaveProjectModalOpen(true)}
              />
            )}
          </div>
        </div>
      </main>
 
      {/* Footer Section */}
      <Footer
        isPro={isPro}
        onTogglePro={() => handleTogglePro()}
        savedProjectsCount={savedProjects.length}
        onOpenSavedProjectsModal={
          googleStatus.connected ? () => setIsSavedProjectsModalOpen(true) : undefined
        }
      />

      {/* Saved Projects Modal */}
      <SavedProjectsModal
        isOpen={isSavedProjectsModalOpen}
        onClose={() => setIsSavedProjectsModalOpen(false)}
        projects={savedProjects}
        isLoading={isLoadingProjects}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Save Project Modal */}
      <SaveProjectModal
        isOpen={isSaveProjectModalOpen}
        onClose={() => setIsSaveProjectModalOpen(false)}
        onSave={handleSaveProject}
        defaultName={
          creatorProfile.name
            ? `${creatorProfile.name} Project`
            : `Visual Album ${new Date().toLocaleDateString()}`
        }
        defaultDescription={albumDescription}
        totalMediaCount={uploadedFiles.length}
        clustersCount={clusters.length}
        postsCount={totalGeneratedPostsCount}
        isPro={isPro}
        savedProjectsCount={savedProjects.length}
        onTogglePro={() => handleTogglePro()}
        onOpenSavedProjectsModal={() => setIsSavedProjectsModalOpen(true)}
      />
    </div>
  );
}
