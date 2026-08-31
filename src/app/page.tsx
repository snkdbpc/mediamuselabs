'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { StepIndicator } from '../components/StepIndicator';
import { Step1Upload } from '../components/Step1Upload';
import { Step2ChooseOrEdit } from '../components/Step2ChooseOrEdit';
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

  // Step 1: Upload & Cluster Analysis
  const handleAnalyzeAlbum = async () => {
    const activeItems = uploadedFiles.filter((item) => item.included);
    if (activeItems.length < 1) return;

    setIsAnalyzing(true);
    try {
      // 1. Upload compressed JPEG image files
      const rawFiles = activeItems.map((item) => item.file);
      const uploadRes = await uploadAlbum(rawFiles, connectionId);
      const newAlbumId = uploadRes.album_id;
      setAlbumId(newAlbumId);

      // 2. Build index map
      const filenames = activeItems.map((item) => item.name);
      const indexMap: Record<string, number> = {};
      filenames.forEach((name, idx) => {
        indexMap[name] = idx;
      });

      // 3. Call clustering service
      const clusterRes = await createClusters(newAlbumId, filenames, indexMap, albumDescription);
      setClusters(clusterRes.clusters);
      setScoredMetadata({});
      setCurrentStep('choose');
    } catch (err: any) {
      alert(`Clustering failed: ${err.message || err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2 -> Step 3: Trigger Streaming Post Generation & Photo Scoring
  const handleGenerateSocialPosts = async () => {
    if (!albumId || clusters.length === 0) return;

    setCurrentStep('finalize');
    setIsGenerating(true);
    setStreamProgress({ completed: 0, total: clusters.length, text: 'Starting social-copy generation...' });

    try {
      const postsObj: Record<string, SocialPost> = {};

      // SSE Stream post generation
      await streamSocialPosts(
        albumId,
        clusters,
        creatorProfile,
        (clusterId, post, completed, total) => {
          postsObj[clusterId] = post;
          setGeneratedPosts((prev) => ({ ...prev, [clusterId]: post }));
          setStreamProgress({
            completed,
            total,
            text: `Generated social posts for cluster ${completed}/${total}...`,
          });
        },
        (clusterId, errMsg) => {
          console.error(`Post generation failed for cluster ${clusterId}:`, errMsg);
        }
      );

      // Trigger parallel quality scoring (top 3 photos)
      try {
        const scoreRes = await scoreClusterImages(albumId, clusters, 3);
        setScoredMetadata(scoreRes.scored_clusters);
      } catch (scoreErr) {
        console.warn('Quality scoring warning:', scoreErr);
      }

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

            {(currentStep === 'choose' || currentStep === 'edit') && (
              <Step2ChooseOrEdit
                currentStep={currentStep}
                clusters={clusters}
                files={uploadedFiles}
                onSetStep={(step) => setCurrentStep(step)}
                onClustersChange={setClusters}
                onGenerate={handleGenerateSocialPosts}
                isLoading={isGenerating}
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
