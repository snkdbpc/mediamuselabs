'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { StepIndicator } from '../components/StepIndicator';
import { Step1Upload } from '../components/Step1Upload';
import { Step3SocialCenter } from '../components/Step3SocialCenter';
import {
  AppStep,
  Cluster,
  CreatorProfile,
  GoogleAccountStatus,
  ScoredClusterMetadata,
  SocialPost,
  UploadedFileItem,
} from '../types/mediamind';
import {
  createClusters,
  getGoogleStatus,
  scoreClusterImages,
  streamSocialPosts,
  uploadAlbum,
} from '../lib/api';
import { uploadOriginalFilesBatch } from '../lib/r2';

export default function Home() {
  const [connectionId, setConnectionId] = useState<string>('');
  const [googleStatus, setGoogleStatus] = useState<GoogleAccountStatus>({ connected: false });

  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>({
    user_type: 'Individual',
    name: '',
    profession: '',
    content_type: 'Social post',
    target_audience: '',
    target_age_group: '18–24',
  });

  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [albumDescription, setAlbumDescription] = useState<string>('');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [generatedPosts, setGeneratedPosts] = useState<Record<string, SocialPost>>({});
  const [scoredMetadata, setScoredMetadata] = useState<Record<string, ScoredClusterMetadata>>({});

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
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

    if (!cid && typeof window !== 'undefined') {
      cid = localStorage.getItem('social_connection_id');
    }

    if (!cid) {
      cid = 'conn_' + Math.random().toString(36).substring(2, 11);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('social_connection_id', cid);
      const newUrl = new URL(window.location.href);
      if (newUrl.searchParams.get('connection_id') !== cid) {
        newUrl.searchParams.set('connection_id', cid);
        window.history.replaceState({}, '', newUrl.toString());
      }
    }

    setConnectionId(cid);
    getGoogleStatus(cid).then((status) => setGoogleStatus(status));

    // Listen for OAuth completion from popup window
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        getGoogleStatus(cid).then((status) => {
          if (status.connected) setGoogleStatus(status);
        });
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Poll Google status when not yet connected
  useEffect(() => {
    if (!connectionId || googleStatus.connected) return;
    const interval = setInterval(() => {
      getGoogleStatus(connectionId).then((status) => {
        if (status.connected) {
          setGoogleStatus(status);
        }
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [connectionId, googleStatus.connected]);

  // Step 1: Upload & Cluster Analysis with Parallel Storage Sync
  const handleAnalyzeAlbum = async () => {
    const activeItems = uploadedFiles.filter((item) => item.included);
    if (activeItems.length < 1) return;

    setIsAnalyzing(true);
    try {
      // 1. Upload lightweight images to backend for fast clustering analysis
      const lightweightFiles = activeItems.map((item) => item.compressedFile || item.file);
      const uploadRes = await uploadAlbum(lightweightFiles, connectionId);
      const newAlbumId = uploadRes.album_id;
      setAlbumId(newAlbumId);

      // 2. Build index map matching uploaded files
      const filenames = lightweightFiles.map((f) => f.name);
      const indexMap: Record<string, number> = {};
      filenames.forEach((name, idx) => {
        indexMap[name] = idx;
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

      // Wait for both clustering and original photo sync to complete
      const [, clusterRes] = await Promise.all([storageSyncPromise, clusterPromise]);
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
      setCurrentStep('finalize');
    } catch (err: any) {
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

  const handleResetApp = () => {
    setUploadedFiles([]);
    setAlbumDescription('');
    setAlbumId(null);
    setClusters([]);
    setGeneratedPosts({});
    setScoredMetadata({});
    setCurrentStep('upload');
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 relative w-full">
      <div className="ambient-glow" />

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 pb-16">
        {/* Top Header */}
        <Header
          creatorProfile={creatorProfile}
          googleStatus={googleStatus}
          connectionId={connectionId}
        />

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row items-start gap-8 w-full">
          {/* Sidebar Creator Profile */}
          <Sidebar profile={creatorProfile} onChange={setCreatorProfile} />

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
              />
            )}

            {currentStep === 'finalize' && (
              <Step3SocialCenter
                clusters={clusters}
                posts={generatedPosts}
                scoredMetadata={scoredMetadata}
                files={uploadedFiles}
                creatorProfile={creatorProfile}
                connectionId={connectionId}
                isStreaming={isGenerating}
                streamProgress={streamProgress}
                onPostUpdate={handlePostUpdate}
                onGeneratePosts={handleGenerateSocialPosts}
                onClustersChange={setClusters}
                onSetStep={(step) => setCurrentStep(step)}
                onResetApp={handleResetApp}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
