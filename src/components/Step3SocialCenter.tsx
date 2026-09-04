'use client';

import React, { useState, useEffect } from 'react';
import {
  Cluster,
  CreatorProfile,
  ScoredClusterMetadata,
  SocialPost,
  UploadedFileItem,
} from '../types/mediamind';
import {
  Download,
  Check,
  Copy,
  Star,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  Facebook,
  Instagram,
  Twitter,
  Hash,
  Eye,
  Loader2,
  MapPin,
  Calendar,
  Camera,
  ExternalLink,
  Tag,
  SlidersHorizontal,
  Filter,
  CheckCircle2,
  Save,
  Send,
  AlertCircle,
} from 'lucide-react';
import { toAbsoluteScore, DEFAULT_SCORE_THRESHOLD } from '../lib/r2';
import {
  getDisplayPreviewUrl,
  getMetaLoginUrl,
  fetchUserSocialAccounts,
  publishToFacebook,
  publishToInstagram,
} from '../lib/api';
import { SocialAccount } from '../types/mediamind';

interface Step3SocialCenterProps {
  clusters: Cluster[];
  posts: Record<string, SocialPost>;
  scoredMetadata: Record<string, ScoredClusterMetadata>;
  files: UploadedFileItem[];
  creatorProfile: CreatorProfile;
  connectionId?: string;
  userId?: string | null;
  projectId?: string | null;
  isStreaming: boolean;
  streamProgress: { completed: number; total: number; text: string };
  onPostUpdate: (clusterId: string, updatedPost: SocialPost) => void;
  onGeneratePosts: (clusterId?: string) => Promise<void> | void;
  onClustersChange?: (updatedClusters: Cluster[]) => void;
  onSetStep: (step: 'upload' | 'choose' | 'edit' | 'finalize') => void;
  onResetApp: () => void;
  onOpenSaveProject?: () => void;
}

export const Step3SocialCenter: React.FC<Step3SocialCenterProps> = ({
  clusters,
  posts,
  scoredMetadata,
  files,
  creatorProfile,
  connectionId,
  userId,
  projectId,
  isStreaming,
  streamProgress,
  onPostUpdate,
  onGeneratePosts,
  onClustersChange,
  onSetStep,
  onResetApp,
  onOpenSaveProject,
}) => {
  const [selectedBestN, setSelectedBestN] = useState<Record<string, number>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'fb' | 'ig' | 'tw' | 'hash' | 'seo'>>({});
  const [editingTagsClusterId, setEditingTagsClusterId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [scoreFilterMode, setScoreFilterMode] = useState<'threshold' | 'all'>('threshold');
  const [scoreThreshold, setScoreThreshold] = useState<number>(DEFAULT_SCORE_THRESHOLD);
  const [selectedImagePerCluster, setSelectedImagePerCluster] = useState<Record<string, number>>({});

  // Active/Included files resolution to guarantee correct sequence matching
  const activeFiles = React.useMemo(() => {
    const included = files.filter((f) => f.included !== false);
    return included.length > 0 ? included : files;
  }, [files]);

  const resolveFileItem = React.useCallback(
    (imgIdx: number, filename?: string): UploadedFileItem | undefined => {
      if (filename) {
        const found =
          activeFiles.find(
            (f) =>
              f.name === filename ||
              f.originalName === filename ||
              f.file?.name === filename
          ) ||
          files.find(
            (f) =>
              f.name === filename ||
              f.originalName === filename ||
              f.file?.name === filename
          );
        if (found) return found;
      }
      return activeFiles[imgIdx] || files[imgIdx];
    },
    [activeFiles, files]
  );

  // Default selected N per cluster
  useEffect(() => {
    const initialN: Record<string, number> = {};
    const initialTabs: Record<string, 'fb' | 'ig' | 'tw' | 'hash' | 'seo'> = {};
    clusters.forEach((c) => {
      const cId = String(c.cluster_id);
      initialN[cId] = Math.min(3, c.all_image_indices.length || 1);
      initialTabs[cId] = 'fb';
    });
    setSelectedBestN(initialN);
    setActiveTab(initialTabs);
  }, [clusters]);

  const handleSaveClusterTags = (clusterId: string | number) => {
    const cKey = String(clusterId);
    const draft = tagDraft[cKey];
    if (draft !== undefined && onClustersChange) {
      const parsedTags = draft
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      onClustersChange(
        clusters.map((c) => (String(c.cluster_id) === cKey ? { ...c, tags: parsedTags } : c))
      );
    }
    setEditingTagsClusterId(null);
  };

  const hasAnyPosts = Object.values(posts).some(
    (p) =>
      p &&
      Boolean(
        p.facebook_post ||
        p.instagram_caption ||
        p.twitter_post ||
        (p.hashtags && p.hashtags.length > 0) ||
        p.seo_alt_text
      )
  );

  // Robust clipboard copy supporting modern API and fallback textarea (prevents focus-loss failures)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;
    // 1. Try modern clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed, falling back to textarea:', err);
      }
    }
    // 2. Fallback to hidden textarea
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const success = document.execCommand('copy');
      document.body.removeChild(el);
      return success;
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      return false;
    }
  };

  const handleCopy = async (text: string, key: string) => {
    await copyToClipboard(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [shareFeedback, setShareFeedback] = useState<Record<string, string>>({});

  const showShareFeedback = (clusterId: string, message: string) => {
    setShareFeedback((prev) => ({ ...prev, [clusterId]: message }));
    setTimeout(() => {
      setShareFeedback((prev) => {
        const next = { ...prev };
        delete next[clusterId];
        return next;
      });
    }, 4000);
  };

  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [publishingState, setPublishingState] = useState<
    Record<string, { status: 'idle' | 'publishing' | 'success' | 'failed'; url?: string; error?: string }>
  >({});

  const loadAccounts = async () => {
    if (!userId) return;
    try {
      const accs = await fetchUserSocialAccounts(userId);
      setSocialAccounts(accs);
    } catch (e) {
      console.warn('Could not load social accounts:', e);
    }
  };

  useEffect(() => {
    loadAccounts();
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'META_AUTH_SUCCESS') {
        loadAccounts();
        setIsConnectingMeta(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [userId]);

  const facebookAccount = socialAccounts.find((a) => a.platform === 'facebook');
  const instagramAccount = socialAccounts.find((a) => a.platform === 'instagram');

  const handleConnectMeta = async (targetPlatform?: 'facebook' | 'instagram') => {
    setIsConnectingMeta(true);
    try {
      const authUrl = await getMetaLoginUrl(connectionId || 'default', userId || undefined, targetPlatform);
      window.open(authUrl, 'meta_oauth_popup', 'width=650,height=750,scrollbars=yes');
    } catch (err: any) {
      setIsConnectingMeta(false);
      alert(`Could not start Meta connection: ${err.message}`);
    }
  };

  const handleDirectPublishFacebook = async (
    clusterId: string,
    postText?: string,
    selectedFile?: UploadedFileItem
  ) => {
    if (!userId) {
      alert('Please connect your Google account first to publish.');
      return;
    }
    if (!facebookAccount) {
      handleConnectMeta();
      return;
    }
    if (!postText) {
      alert('Facebook post content is empty.');
      return;
    }

    const imageUrl = selectedFile?.r2Url;
    if (!imageUrl) {
      alert('Please save the project first before publishing.');
      return;
    }

    const stateKey = `${clusterId}_fb`;
    setPublishingState((prev) => ({
      ...prev,
      [stateKey]: { status: 'publishing' },
    }));

    const result = await publishToFacebook({
      userId,
      projectId: projectId || 'default_project',
      message: postText,
      imageUrl,
      pageId: facebookAccount.page_id,
    });

    if (result.success && result.post_url) {
      setPublishingState((prev) => ({
        ...prev,
        [stateKey]: { status: 'success', url: result.post_url },
      }));
      showShareFeedback(clusterId, 'Successfully published to Facebook Page!');
    } else {
      setPublishingState((prev) => ({
        ...prev,
        [stateKey]: { status: 'failed', error: result.error || 'Facebook publishing failed' },
      }));
    }
  };

  const handleDirectPublishInstagram = async (
    clusterId: string,
    captionText?: string,
    hashtags?: string[],
    selectedFile?: UploadedFileItem
  ) => {
    if (!userId) {
      alert('Please connect your Google account first to publish.');
      return;
    }
    if (!instagramAccount) {
      handleConnectMeta();
      return;
    }
    if (!captionText) {
      alert('Instagram caption is empty.');
      return;
    }

    const imageUrl = selectedFile?.r2Url;
    if (!imageUrl) {
      alert('Please save the project first before publishing.');
      return;
    }

    const fullCaption =
      hashtags && hashtags.length > 0
        ? `${captionText}\n\n${hashtags.join(' ')}`
        : captionText;

    const stateKey = `${clusterId}_ig`;
    setPublishingState((prev) => ({
      ...prev,
      [stateKey]: { status: 'publishing' },
    }));

    const result = await publishToInstagram({
      userId,
      projectId: projectId || 'default_project',
      caption: fullCaption,
      imageUrl,
      igUserId: instagramAccount.platform_user_id,
    });

    if (result.success && result.post_url) {
      setPublishingState((prev) => ({
        ...prev,
        [stateKey]: { status: 'success', url: result.post_url },
      }));
      showShareFeedback(clusterId, 'Successfully published to Instagram!');
    } else {
      setPublishingState((prev) => ({
        ...prev,
        [stateKey]: { status: 'failed', error: result.error || 'Instagram publishing failed' },
      }));
    }
  };

  // Helper to trigger download of original uncompressed image file (explicit user button only)
  const downloadOriginalImage = (fileItem?: UploadedFileItem) => {
    if (!fileItem) return;
    const fileToDownload = fileItem.originalFile || fileItem.file;
    const url = URL.createObjectURL(fileToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.originalName || fileItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleShareFacebook = async (clusterId: string, postText?: string, selectedFile?: UploadedFileItem) => {
    if (postText) {
      await copyToClipboard(postText);
    }

    const r2Url = selectedFile?.r2Url;
    const shareUrl = r2Url
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(r2Url)}`
      : 'https://www.facebook.com/';

    window.open(shareUrl, '_blank', 'width=650,height=600');
    showShareFeedback(clusterId, 'Post text copied to clipboard! Paste (Cmd+V) in Facebook.');
  };

  const handleShareInstagram = async (
    clusterId: string,
    captionText?: string,
    hashtags?: string[]
  ) => {
    if (!captionText) return;
    const fullText =
      hashtags && hashtags.length > 0
        ? `${captionText}\n\n${hashtags.join(' ')}`
        : captionText;

    await copyToClipboard(fullText);

    window.open('https://www.instagram.com/', '_blank');
    showShareFeedback(clusterId, 'Caption & hashtags copied to clipboard! Paste (Cmd+V) on Instagram.');
  };

  const handleShareTwitter = async (clusterId: string, tweetText?: string, selectedFile?: UploadedFileItem) => {
    if (!tweetText) return;
    const r2Url = selectedFile?.r2Url;
    const textWithMedia = r2Url ? `${tweetText}\n\n${r2Url}` : tweetText;

    await copyToClipboard(textWithMedia);

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(textWithMedia)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=500');
    showShareFeedback(clusterId, 'Post text copied & opening X (Twitter) composer!');
  };

  const handleShareHashtags = async (clusterId: string, hashtags?: string[]) => {
    if (!hashtags || hashtags.length === 0) return;
    const text = hashtags.join(' ');
    await copyToClipboard(text);
    showShareFeedback(clusterId, 'All hashtags copied to clipboard!');
  };

  const handleShareSeo = async (clusterId: string, seoText?: string) => {
    if (!seoText) return;
    await copyToClipboard(seoText);
    showShareFeedback(clusterId, 'SEO Alt Text copied to clipboard!');
  };

  // Export All Posts as .txt
  const downloadAllPosts = () => {
    const projectName = creatorProfile.name || creatorProfile.profession || 'Media Muse Labs posts';
    const lines = [`Media Muse Labs — Generated Posts for ${projectName}\n${'='.repeat(60)}\n`];

    clusters.forEach((cluster) => {
      const cId = String(cluster.cluster_id);
      const post = posts[cId] || {};
      lines.push(`\n${'—'.repeat(40)}`);
      lines.push(`CLUSTER: ${cluster.name}`);
      lines.push(`${'—'.repeat(40)}\n`);
      lines.push('📘 FACEBOOK POST:');
      lines.push((post.facebook_post || '') + '\n');
      lines.push('📸 INSTAGRAM CAPTION:');
      lines.push((post.instagram_caption || '') + '\n');
      lines.push('🐦 TWITTER/X POST:');
      lines.push((post.twitter_post || '') + '\n');
      lines.push('🏷️ HASHTAGS:');
      lines.push((post.hashtags ? post.hashtags.join(' ') : '') + '\n');
      lines.push('🔍 SEO ALT TEXT:');
      lines.push((post.seo_alt_text || '') + '\n');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_posts.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Streaming Progress Overlay */}
      {isStreaming && (
        <div className="glass-card p-6 border border-indigo-500/40 bg-indigo-950/30 shadow-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              {streamProgress.text || 'Generating social copy with AI...'}
            </span>
            <span>
              {streamProgress.completed} of {streamProgress.total} clusters completed
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-indigo-500/20">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-300"
              style={{
                width: `${streamProgress.total ? (streamProgress.completed / streamProgress.total) * 100 : 5}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Header bar with Create Posts & Export Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            📢 Social Media Center
          </h2>
          <p className="text-xs text-slate-400">
            Review clusters with tags, generate multi-platform social posts, and share or copy instantly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onGeneratePosts()}
            disabled={isStreaming || clusters.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Posts...</span>
              </>
            ) : hasAnyPosts ? (
              <>
                <Sparkles className="w-4 h-4 text-pink-300" />
                <span>Regenerate All Posts</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-pink-300" />
                <span>Create Social Media Posts</span>
              </>
            )}
          </button>

          <button
            onClick={downloadAllPosts}
            disabled={!hasAnyPosts}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" /> Download All (.txt)
          </button>

          {onOpenSaveProject && (
            <button
              onClick={onOpenSaveProject}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold border border-emerald-500/50 shadow-md shadow-emerald-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save className="w-4 h-4" /> Save Project
            </button>
          )}
        </div>
      </div>

      {!hasAnyPosts && !isStreaming && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <span>
              Your images are grouped into {clusters.length} social media cluster(s) with tags. Click <strong>Create Social Media Posts</strong> to generate copy for Facebook, Instagram, Twitter/X, Hashtags, and SEO Alt Text.
            </span>
          </div>
          <button
            onClick={() => onGeneratePosts()}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex-shrink-0 transition-colors shadow-sm"
          >
            Generate All Now
          </button>
        </div>
      )}

      {/* Global Image Quality Score Filter Bar */}
      {clusters.length > 0 && (
        <div className="glass-card p-4 border border-slate-800/90 shadow-xl rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-100">Quality Score Threshold Filter</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Absolute Scale 1–10
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {scoreFilterMode === 'threshold'
                  ? `Filtering out photos with absolute score < ${scoreThreshold.toFixed(1)} / 10 (showing high-quality photos by default)`
                  : 'Displaying all cluster photos without score threshold'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setScoreFilterMode('threshold')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  scoreFilterMode === 'threshold'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filter (≥ {scoreThreshold.toFixed(1)})</span>
              </button>
              <button
                onClick={() => setScoreFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  scoreFilterMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Display All Images
              </button>
            </div>

            {scoreFilterMode === 'threshold' && (
              <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Min Score:</span>
                <select
                  value={scoreThreshold}
                  onChange={(e) => setScoreThreshold(parseFloat(e.target.value))}
                  className="glass-input rounded-lg px-2 py-1 text-slate-100 font-bold focus:outline-none text-xs"
                >
                  <option value="6.0">≥ 6.0 / 10 (Good)</option>
                  <option value="7.0">≥ 7.0 / 10 (Default)</option>
                  <option value="8.0">≥ 8.0 / 10 (High Quality)</option>
                  <option value="8.5">≥ 8.5 / 10 (Hero Shots)</option>
                  <option value="9.0">≥ 9.0 / 10 (Exceptional)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cluster Cards */}
      {clusters.map((cluster, cIdx) => {
        const cId = String(cluster.cluster_id);
        const post =
          posts[cId] ||
          (posts as any)[cluster.cluster_id] ||
          posts[String(cIdx)] ||
          (posts as any)[cIdx] || {
            facebook_post: '',
            instagram_caption: '',
            twitter_post: '',
            hashtags: [],
            seo_alt_text: '',
          };

        const totalImagesInCluster = cluster.all_image_indices.length;
        const currentBestN = selectedBestN[cId] || Math.min(3, totalImagesInCluster);

        // Representatives metadata
        const metadata =
          scoredMetadata[cId] ||
          (scoredMetadata as any)[cluster.cluster_id] ||
          (scoredMetadata as any)[cIdx];
        const reps = metadata?.representatives || (cluster.representatives as any) || [];

        // Build ranked list with absolute quality scores
        const allRankedItems =
          reps.length > 0
            ? reps.map((rep: any, rank: number) => {
                const filename = rep.filename || (rep.path ? rep.path.split('/').pop() : undefined);
                let imgIdx = rep.image_idx;
                if (imgIdx === undefined && filename) {
                  const matchIdx = activeFiles.findIndex(
                    (f) =>
                      f.name === filename ||
                      f.file?.name === filename ||
                      f.originalName === filename
                  );
                  if (matchIdx !== -1) {
                    imgIdx = matchIdx;
                  } else {
                    const fallbackMatch = files.findIndex(
                      (f) =>
                        f.name === filename ||
                        f.file?.name === filename ||
                        f.originalName === filename
                    );
                    if (fallbackMatch !== -1) imgIdx = fallbackMatch;
                  }
                }
                if (imgIdx === undefined) {
                  imgIdx = cluster.all_image_indices[rank] ?? rank;
                }
                const rawQuality = rep.quality_score ?? 0.88;
                return {
                  imgIdx,
                  filename,
                  rawQuality,
                  absoluteScore: toAbsoluteScore(rawQuality),
                  rank: rank + 1,
                };
              })
            : cluster.all_image_indices.map((imgIdx, rank) => {
                const rawQuality = Math.max(0.65, 0.95 - rank * 0.05);
                return {
                  imgIdx,
                  filename: undefined,
                  rawQuality,
                  absoluteScore: toAbsoluteScore(rawQuality),
                  rank: rank + 1,
                };
              });

        // Filter images by score threshold if threshold filter mode is active
        const qualifyingRankedItems =
          scoreFilterMode === 'threshold'
            ? allRankedItems.filter((item) => item.absoluteScore >= scoreThreshold)
            : allRankedItems;

        // Display top N qualifying images, or top 1 fallback if all are below threshold
        const itemsToDisplay =
          qualifyingRankedItems.length > 0
            ? qualifyingRankedItems.slice(0, currentBestN)
            : allRankedItems.slice(0, 1);

        const excludedByThresholdCount = allRankedItems.length - qualifyingRankedItems.length;

        // Default to the best image (Rank #1 / highest score)
        const defaultBestImgIdx = itemsToDisplay[0]?.imgIdx ?? cluster.all_image_indices[0];
        const currentSelectedImgIdx = selectedImagePerCluster[cId] ?? defaultBestImgIdx;
        const currentSelectedFile = resolveFileItem(
          currentSelectedImgIdx,
          itemsToDisplay.find((item) => item.imgIdx === currentSelectedImgIdx)?.filename
        );

        const activeTabKey = activeTab[cId] || 'fb';
        const hasClusterPost = Boolean(
          post.facebook_post ||
          post.instagram_caption ||
          post.twitter_post ||
          (post.hashtags && post.hashtags.length > 0) ||
          post.seo_alt_text
        );
        const isPostGenerating = isStreaming && !hasClusterPost;

        return (
          <div key={cId} className="glass-card p-5 md:p-6 border border-slate-800 shadow-xl space-y-4">
            {/* Cluster Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-base flex-shrink-0 mt-0.5 sm:mt-0">
                  #{cIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-100 truncate">📌 {cluster.name}</h3>

                  {/* Cluster Tags with inline editing */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" /> Tags:
                    </span>
                    {cluster.tags && cluster.tags.length > 0 ? (
                      cluster.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm"
                        >
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">No tags</span>
                    )}

                    {onClustersChange && (
                      <button
                        type="button"
                        onClick={() => {
                          if (editingTagsClusterId === cId) {
                            handleSaveClusterTags(cluster.cluster_id);
                          } else {
                            setTagDraft((prev) => ({ ...prev, [cId]: cluster.tags.join(', ') }));
                            setEditingTagsClusterId(cId);
                          }
                        }}
                        className="ml-1 flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold transition-colors"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{editingTagsClusterId === cId ? 'Done' : 'Edit Tags'}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Tag Editing Input */}
                  {editingTagsClusterId === cId && (
                    <div className="mt-2.5 flex items-center gap-2 max-w-md">
                      <input
                        type="text"
                        value={tagDraft[cId] ?? cluster.tags.join(', ')}
                        onChange={(e) =>
                          setTagDraft((prev) => ({ ...prev, [cId]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveClusterTags(cluster.cluster_id);
                          }
                        }}
                        placeholder="Tags (comma-separated, e.g. safari, wildlife, landscape)"
                        className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveClusterTags(cluster.cluster_id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {/* Cluster Create / Regenerate Post Button */}
                <button
                  onClick={() => onGeneratePosts(cId)}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50 hover:scale-[1.02]"
                  title="Generate or regenerate posts for this cluster"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>
                    {post.facebook_post || post.instagram_caption || post.twitter_post
                      ? 'Regenerate Post'
                      : 'Create Post'}
                  </span>
                </button>

                {/* Best N selector */}
                {totalImagesInCluster > 0 && (
                  <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                    <Star className="w-4 h-4 text-amber-400" />
                    <label className="text-xs font-semibold text-slate-300">Top N:</label>
                    <select
                      value={currentBestN}
                      onChange={(e) =>
                        setSelectedBestN({ ...selectedBestN, [cId]: parseInt(e.target.value, 10) })
                      }
                      className="glass-input rounded-lg px-2.5 py-1 text-xs text-slate-200 font-bold focus:outline-none"
                    >
                      {Array.from({ length: totalImagesInCluster }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Representative Ranked Images - Large Prominent Thumbnails with Absolute Scoring */}
            {totalImagesInCluster > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400" /> Selected Top {itemsToDisplay.length} Image(s) (Absolute Scale)
                    </h4>
                    {scoreFilterMode === 'threshold' && excludedByThresholdCount > 0 && (
                      <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {excludedByThresholdCount} photo{excludedByThresholdCount > 1 ? 's' : ''} excluded (&lt; {scoreThreshold.toFixed(1)})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {cluster.all_image_indices.length} total photos in cluster • Click photo to select for posting
                  </span>
                </div>

                <div className={`grid gap-4 ${
                  itemsToDisplay.length === 1
                    ? 'grid-cols-1 max-w-md'
                    : itemsToDisplay.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}>
                  {itemsToDisplay.map(({ imgIdx, filename, absoluteScore, rank }) => {
                    const fileItem = resolveFileItem(imgIdx, filename);
                    const isSelected = imgIdx === currentSelectedImgIdx;

                    return (
                      <div
                        key={`${imgIdx}_${rank}`}
                        onClick={() => setSelectedImagePerCluster({ ...selectedImagePerCluster, [cId]: imgIdx })}
                        className={`rounded-2xl p-2.5 space-y-2 relative group cursor-pointer transition-all duration-200 shadow-lg border ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/70 shadow-indigo-500/20'
                            : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="aspect-[16/10] sm:h-48 md:h-52 w-full relative rounded-xl overflow-hidden bg-slate-950">
                          {fileItem ? (
                            <img
                              src={getDisplayPreviewUrl(fileItem.previewUrl, fileItem.originalName || fileItem.name)}
                              alt={fileItem.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.currentTarget;
                                const fallbackSource = fileItem.r2Url || fileItem.previewUrl;
                                if (fallbackSource && !target.src.includes('/media/preview')) {
                                  target.src = `/api/v1/media/preview?url=${encodeURIComponent(fallbackSource)}`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                              Image #{imgIdx + 1}
                            </div>
                          )}

                          {/* Rank badge top-left */}
                          <div className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-300 border border-indigo-500/30 shadow-md">
                            Rank #{rank}
                          </div>

                          {/* Selected badge top-right */}
                          {isSelected ? (
                            <div className="absolute top-2 right-2 bg-indigo-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                              <CheckCircle2 className="w-3 h-3" /> Selected for Post
                            </div>
                          ) : (
                            <div className="absolute top-2 right-2 bg-slate-950/75 text-slate-300 font-semibold text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                              Click to select
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-1 text-xs">
                          <span
                            className="text-slate-300 truncate max-w-[140px] font-medium"
                            title={fileItem?.originalName || fileItem?.name}
                          >
                            {fileItem?.originalName || fileItem?.name || `File ${imgIdx + 1}`}
                          </span>

                          {/* Absolute Score Badge (e.g. ⭐ 8.8 / 10) */}
                          <span className={`font-bold px-2 py-0.5 rounded-lg border text-xs flex items-center gap-1 ${
                            absoluteScore >= 8.5
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : absoluteScore >= 7.0
                              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            ⭐ {absoluteScore.toFixed(1)} / 10
                          </span>
                        </div>

                        {/* File details & EXIF */}
                        <div className="px-1 pt-1 border-t border-slate-800 text-[10px] space-y-1 text-slate-400">
                          {fileItem && (
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                Original:{' '}
                                {((fileItem.originalSize || fileItem.size) / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {isSelected && (
                                <span className="text-indigo-400 font-semibold">Active Post Image</span>
                              )}
                            </div>
                          )}

                          {fileItem?.exif && (
                            <>
                              {(fileItem.exif.make || fileItem.exif.model) && (
                                <div className="flex items-center gap-1 truncate text-slate-300">
                                  <Camera className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {[fileItem.exif.make, fileItem.exif.model].filter(Boolean).join(' ')}
                                  </span>
                                </div>
                              )}

                              {fileItem.exif.formattedDate && (
                                <div className="flex items-center gap-1 truncate text-purple-300">
                                  <Calendar className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
                                  <span className="truncate">{fileItem.exif.formattedDate}</span>
                                </div>
                              )}

                              {fileItem.exif.formattedCoordinates && (
                                <div className="flex items-center justify-between gap-1 text-emerald-300">
                                  <div className="flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                                    <span className="truncate">{fileItem.exif.formattedCoordinates}</span>
                                  </div>
                                  {fileItem.exif.googleMapsUrl && (
                                    <a
                                      href={fileItem.exif.googleMapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 underline flex-shrink-0"
                                    >
                                      Maps <ExternalLink className="w-2 h-2" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Original Photo Status Bar */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>
                      Selected Original Image for Sharing:{' '}
                      <strong className="text-white">
                        {currentSelectedFile?.originalName || currentSelectedFile?.name || `Image #${currentSelectedImgIdx + 1}`}
                      </strong>
                      {currentSelectedFile && (
                        <span className="text-slate-400 ml-1">
                          ({((currentSelectedFile.originalSize || currentSelectedFile.size) / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadOriginalImage(currentSelectedFile)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
                      title="Download original high-res photo"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Download Original</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-platform Copy Tabs */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Platform Social Copy & SEO
                  </h4>
                  {hasClusterPost && (
                    <button
                      onClick={() => onGeneratePosts(cId)}
                      disabled={isStreaming}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-300 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 transition-colors disabled:opacity-50"
                      title="Regenerate this cluster's copy"
                    >
                      <Sparkles className="w-3 h-3 text-pink-400" /> Regenerate
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs md:text-sm">
                  <button
                    onClick={() => setActiveTab({ ...activeTab, [cId]: 'fb' })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                      activeTabKey === 'fb' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Facebook className="w-4 h-4" /> Facebook
                  </button>
                  <button
                    onClick={() => setActiveTab({ ...activeTab, [cId]: 'ig' })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                      activeTabKey === 'ig' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Instagram className="w-4 h-4" /> Instagram
                  </button>
                  <button
                    onClick={() => setActiveTab({ ...activeTab, [cId]: 'tw' })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                      activeTabKey === 'tw' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Twitter className="w-4 h-4" /> Twitter/X
                  </button>
                  <button
                    onClick={() => setActiveTab({ ...activeTab, [cId]: 'hash' })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                      activeTabKey === 'hash' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Hash className="w-4 h-4" /> Hashtags
                  </button>
                  <button
                    onClick={() => setActiveTab({ ...activeTab, [cId]: 'seo' })}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                      activeTabKey === 'seo' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-4 h-4" /> SEO Alt Text
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="relative">
                {isPostGenerating ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-indigo-500/30 text-center space-y-3 shadow-lg">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-spin">
                      <Loader2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">
                      Crafting tailored copy for {cluster.name}...
                    </p>
                    <p className="text-xs text-slate-400">
                      Generating Facebook posts, Instagram captions, tweets, hashtags, and SEO alt text.
                    </p>
                  </div>
                ) : !hasClusterPost ? (
                  <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-indigo-950/20 border border-slate-800 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-md">
                      <Sparkles className="w-7 h-7 text-pink-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-100">Ready to Create Social Media Post</h4>
                      <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
                        Generate optimized posts for all platforms (Facebook, Instagram, Twitter/X, Hashtags, and SEO Alt Text) tailored to this cluster&apos;s photos and tags.
                      </p>
                    </div>
                    <button
                      onClick={() => onGeneratePosts(cId)}
                      disabled={isStreaming}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs md:text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Create Social Media Post</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {activeTabKey === 'fb' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-200">Facebook Post Caption</label>
                          <button
                            onClick={() => handleCopy(post.facebook_post, `fb_${cId}`)}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                          >
                            {copiedField === `fb_${cId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedField === `fb_${cId}` ? 'Copied!' : 'Copy Post'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={post.facebook_post || ''}
                          onChange={(e) =>
                            onPostUpdate(cId, { ...post, facebook_post: e.target.value })
                          }
                          placeholder="Facebook post will stream here..."
                          className="w-full glass-input rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none"
                        />
                      </div>
                    )}

                    {activeTabKey === 'ig' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-200">Instagram Caption</label>
                          <button
                            onClick={() => handleCopy(post.instagram_caption, `ig_${cId}`)}
                            className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 font-medium px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
                          >
                            {copiedField === `ig_${cId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedField === `ig_${cId}` ? 'Copied!' : 'Copy Caption'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={post.instagram_caption || ''}
                          onChange={(e) =>
                            onPostUpdate(cId, { ...post, instagram_caption: e.target.value })
                          }
                          placeholder="Instagram caption will stream here..."
                          className="w-full glass-input rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none"
                        />
                      </div>
                    )}

                    {activeTabKey === 'tw' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-200">Twitter / X Post</label>
                          <button
                            onClick={() => handleCopy(post.twitter_post, `tw_${cId}`)}
                            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                          >
                            {copiedField === `tw_${cId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedField === `tw_${cId}` ? 'Copied!' : 'Copy Tweet'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={post.twitter_post || ''}
                          onChange={(e) =>
                            onPostUpdate(cId, { ...post, twitter_post: e.target.value })
                          }
                          placeholder="Twitter/X post will stream here..."
                          className="w-full glass-input rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none"
                        />
                      </div>
                    )}

                    {activeTabKey === 'hash' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-200">Optimized Hashtags</label>
                          <button
                            onClick={() => handleCopy(post.hashtags ? post.hashtags.join(' ') : '', `hash_${cId}`)}
                            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                          >
                            {copiedField === `hash_${cId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedField === `hash_${cId}` ? 'Copied!' : 'Copy Hashtags'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={post.hashtags ? post.hashtags.join(' ') : ''}
                          onChange={(e) =>
                            onPostUpdate(cId, {
                              ...post,
                              hashtags: e.target.value.split(/\s+/).filter(Boolean),
                            })
                          }
                          placeholder="#Tags will appear here..."
                          className="w-full glass-input rounded-xl p-4 text-sm md:text-base text-purple-300 font-mono focus:outline-none leading-relaxed"
                        />
                      </div>
                    )}

                    {activeTabKey === 'seo' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-200">SEO Accessibility Alt Text</label>
                          <button
                            onClick={() => handleCopy(post.seo_alt_text, `seo_${cId}`)}
                            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                          >
                            {copiedField === `seo_${cId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedField === `seo_${cId}` ? 'Copied!' : 'Copy Alt Text'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={post.seo_alt_text || ''}
                          onChange={(e) =>
                            onPostUpdate(cId, { ...post, seo_alt_text: e.target.value })
                          }
                          placeholder="SEO alt text will appear here..."
                          className="w-full glass-input rounded-xl p-4 text-sm md:text-base text-slate-100 leading-relaxed focus:outline-none"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Direct Social Publish / Share Action for Active Platform */}
            {hasClusterPost && (
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {activeTabKey === 'fb' && (
                      <>
                        {facebookAccount ? (
                          <button
                            onClick={() => handleDirectPublishFacebook(cId, post.facebook_post, currentSelectedFile)}
                            disabled={publishingState[`${cId}_fb`]?.status === 'publishing' || !post.facebook_post}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                            title="Publish photo and post text directly to your Facebook Page"
                          >
                            {publishingState[`${cId}_fb`]?.status === 'publishing' ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Publishing to {facebookAccount.page_name || 'Facebook'}...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Publish to Facebook Page {facebookAccount.page_name ? `(${facebookAccount.page_name})` : ''}</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnectMeta('facebook')}
                            disabled={isConnectingMeta}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-xs border border-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            title="Connect your Facebook Page for direct publishing"
                          >
                            {isConnectingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
                            <span>Connect Facebook Account</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleShareFacebook(cId, post.facebook_post, currentSelectedFile)}
                          disabled={!post.facebook_post}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                          title="Copy post and open Facebook composer in browser"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Manual Share</span>
                        </button>
                      </>
                    )}

                    {activeTabKey === 'ig' && (
                      <>
                        {instagramAccount ? (
                          <button
                            onClick={() => handleDirectPublishInstagram(cId, post.instagram_caption, post.hashtags, currentSelectedFile)}
                            disabled={publishingState[`${cId}_ig`]?.status === 'publishing' || !post.instagram_caption}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold text-xs transition-all shadow-md shadow-pink-600/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                            title="Publish photo and caption directly to Instagram"
                          >
                            {publishingState[`${cId}_ig`]?.status === 'publishing' ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Publishing to Instagram...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Publish to Instagram {instagramAccount.username ? `(@${instagramAccount.username})` : ''}</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnectMeta('instagram')}
                            disabled={isConnectingMeta}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 font-semibold text-xs border border-pink-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            title="Connect your Instagram account for direct publishing"
                          >
                            {isConnectingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                            <span>Connect Instagram Account</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleShareInstagram(cId, post.instagram_caption, post.hashtags)}
                          disabled={!post.instagram_caption}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                          title="Copy caption and open Instagram in browser"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Manual Share</span>
                        </button>
                      </>
                    )}

                    {activeTabKey === 'tw' && (
                      <button
                        onClick={() => handleShareTwitter(cId, post.twitter_post, currentSelectedFile)}
                        disabled={!post.twitter_post}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 hover:border-sky-500/50 font-semibold text-xs transition-all shadow-md shadow-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Twitter className="w-4 h-4 text-sky-400" /> Share to X (Twitter)
                      </button>
                    )}

                    {activeTabKey === 'hash' && (
                      <button
                        onClick={() => handleShareHashtags(cId, post.hashtags)}
                        disabled={!post.hashtags || post.hashtags.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Hash className="w-4 h-4" /> Copy All Hashtags
                      </button>
                    )}

                    {activeTabKey === 'seo' && (
                      <button
                        onClick={() => handleShareSeo(cId, post.seo_alt_text)}
                        disabled={!post.seo_alt_text}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Eye className="w-4 h-4" /> Copy SEO Alt Text
                      </button>
                    )}
                  </div>

                  {/* Action feedback message */}
                  {shareFeedback[cId] && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{shareFeedback[cId]}</span>
                    </div>
                  )}
                </div>

                {/* Direct Publish Live Status Banner */}
                {activeTabKey === 'fb' && publishingState[`${cId}_fb`]?.status === 'success' && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Post published to Facebook Page successfully!</span>
                    </div>
                    {publishingState[`${cId}_fb`]?.url && (
                      <a
                        href={publishingState[`${cId}_fb`].url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors"
                      >
                        View Post <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {activeTabKey === 'fb' && publishingState[`${cId}_fb`]?.status === 'failed' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Facebook Publishing Failed: {publishingState[`${cId}_fb`]?.error}</span>
                  </div>
                )}

                {activeTabKey === 'ig' && publishingState[`${cId}_ig`]?.status === 'success' && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Photo published to Instagram successfully!</span>
                    </div>
                    {publishingState[`${cId}_ig`]?.url && (
                      <a
                        href={publishingState[`${cId}_ig`].url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-pink-600 text-white font-bold hover:bg-pink-500 transition-colors"
                      >
                        View Post <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {activeTabKey === 'ig' && publishingState[`${cId}_ig`]?.status === 'failed' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Instagram Publishing Failed: {publishingState[`${cId}_ig`]?.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => onSetStep('upload')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Upload
        </button>

        <button
          onClick={onResetApp}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all duration-200"
        >
          <RotateCcw className="w-4 h-4" /> Start New Project
        </button>
      </div>
    </div>
  );
};
