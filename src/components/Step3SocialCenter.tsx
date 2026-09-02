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
} from 'lucide-react';
import { getFacebookLoginUrl } from '../lib/api';

interface Step3SocialCenterProps {
  clusters: Cluster[];
  posts: Record<string, SocialPost>;
  scoredMetadata: Record<string, ScoredClusterMetadata>;
  files: UploadedFileItem[];
  creatorProfile: CreatorProfile;
  connectionId: string;
  isStreaming: boolean;
  streamProgress: { completed: number; total: number; text: string };
  onPostUpdate: (clusterId: string, updatedPost: SocialPost) => void;
  onSetStep: (step: 'upload' | 'choose' | 'edit' | 'finalize') => void;
  onResetApp: () => void;
}

export const Step3SocialCenter: React.FC<Step3SocialCenterProps> = ({
  clusters,
  posts,
  scoredMetadata,
  files,
  creatorProfile,
  connectionId,
  isStreaming,
  streamProgress,
  onPostUpdate,
  onSetStep,
  onResetApp,
}) => {
  const [selectedBestN, setSelectedBestN] = useState<Record<string, number>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'fb' | 'ig' | 'tw' | 'hash' | 'seo'>>({});

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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
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

  const handleShareFacebook = async (clusterId: string, postText?: string) => {
    if (postText) {
      navigator.clipboard.writeText(postText);
    }
    const url = await getFacebookLoginUrl(connectionId);
    if (url) {
      window.open(url, '_blank', 'width=600,height=700');
      showShareFeedback(clusterId, 'Facebook post copied! Opening Facebook...');
    } else {
      const shareUrl = postText
        ? `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(postText)}`
        : 'https://www.facebook.com/';
      window.open(shareUrl, '_blank', 'width=600,height=600');
      showShareFeedback(clusterId, 'Facebook post copied! Opening Facebook...');
    }
  };

  const handleShareInstagram = (clusterId: string, captionText?: string, hashtags?: string[]) => {
    if (!captionText) return;
    const fullText =
      hashtags && hashtags.length > 0
        ? `${captionText}\n\n${hashtags.join(' ')}`
        : captionText;

    navigator.clipboard.writeText(fullText);
    window.open('https://www.instagram.com/', '_blank');
    showShareFeedback(clusterId, 'Instagram caption copied! Paste into your Instagram post.');
  };

  const handleShareTwitter = (clusterId: string, tweetText?: string) => {
    if (!tweetText) return;
    navigator.clipboard.writeText(tweetText);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=500');
    showShareFeedback(clusterId, 'Opening X (Twitter) with your post ready...');
  };

  const handleShareHashtags = (clusterId: string, hashtags?: string[]) => {
    if (!hashtags || hashtags.length === 0) return;
    const text = hashtags.join(' ');
    navigator.clipboard.writeText(text);
    showShareFeedback(clusterId, 'All hashtags copied to clipboard!');
  };

  const handleShareSeo = (clusterId: string, seoText?: string) => {
    if (!seoText) return;
    navigator.clipboard.writeText(seoText);
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
              {streamProgress.completed} of {streamProgress.total} completed
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

      {/* Header bar with Export Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            📢 Social Media Center
          </h2>
          <p className="text-xs text-slate-400">
            Review, edit, rank, and download tailored multi-platform social content for your visual story.
          </p>
        </div>

        <button
          onClick={downloadAllPosts}
          disabled={Object.keys(posts).length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          <Download className="w-4 h-4" /> Download All Posts (.txt)
        </button>
      </div>

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

        // Build ranked list mapping representative image indices
        const rankedItems =
          reps.length > 0
            ? reps.slice(0, currentBestN).map((rep: any, rank: number) => {
                let imgIdx = rep.image_idx;
                if (imgIdx === undefined && rep.filename) {
                  const matchIdx = files.findIndex(
                    (f) => f.name === rep.filename || f.file.name === rep.filename || f.originalName === rep.filename
                  );
                  if (matchIdx !== -1) imgIdx = matchIdx;
                }
                if (imgIdx === undefined) {
                  imgIdx = cluster.all_image_indices[rank] ?? rank;
                }
                return {
                  imgIdx,
                  qualityScore: rep.quality_score ?? 0.9,
                  rank: rank + 1,
                };
              })
            : cluster.all_image_indices.slice(0, currentBestN).map((imgIdx, rank) => ({
                imgIdx,
                qualityScore: Math.max(0.7, 0.95 - rank * 0.05),
                rank: rank + 1,
              }));

        const activeTabKey = activeTab[cId] || 'fb';
        const isPostGenerating = isStreaming && !post.facebook_post && !post.instagram_caption;

        return (
          <div key={cId} className="glass-card p-5 md:p-6 border border-slate-800 shadow-xl space-y-4">
            {/* Cluster Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-base flex-shrink-0">
                  #{cIdx + 1}
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-100">📌 {cluster.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {cluster.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/80"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Best N selector */}
              {totalImagesInCluster > 0 && (
                <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Star className="w-4 h-4 text-amber-400" />
                  <label className="text-xs md:text-sm font-semibold text-slate-300">Top N photos:</label>
                  <select
                    value={currentBestN}
                    onChange={(e) =>
                      setSelectedBestN({ ...selectedBestN, [cId]: parseInt(e.target.value, 10) })
                    }
                    className="glass-input rounded-lg px-2.5 py-1 text-xs md:text-sm text-slate-200 font-bold focus:outline-none"
                  >
                    {Array.from({ length: totalImagesInCluster }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Representative Ranked Images - Large Prominent Thumbnails */}
            {totalImagesInCluster > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> Selected Top {currentBestN} Image(s) & Quality Score
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {cluster.all_image_indices.length} total photos in cluster
                  </span>
                </div>

                <div className={`grid gap-4 ${
                  currentBestN === 1
                    ? 'grid-cols-1 max-w-md'
                    : currentBestN === 2
                    ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}>
                  {rankedItems.map(({ imgIdx, qualityScore, rank }) => {
                    const fileItem = files[imgIdx];

                    return (
                      <div
                        key={`${imgIdx}_${rank}`}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 space-y-2 relative group hover:border-indigo-500/50 transition-all duration-200 shadow-lg"
                      >
                        <div className="aspect-[16/10] sm:h-48 md:h-52 w-full relative rounded-xl overflow-hidden bg-slate-950">
                          {fileItem ? (
                            <img
                              src={fileItem.previewUrl}
                              alt={fileItem.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                              Image #{imgIdx + 1}
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-300 border border-indigo-500/30 shadow-md">
                            Rank #{rank}
                          </div>
                        </div>

                        <div className="flex items-center justify-between px-1 text-xs">
                          <span className="text-slate-300 truncate max-w-[130px] font-medium" title={fileItem?.originalName || fileItem?.name}>
                            {fileItem?.originalName || fileItem?.name || `File ${imgIdx + 1}`}
                          </span>
                          <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 text-xs">
                            {(qualityScore * 100).toFixed(0)}% Score
                          </span>
                        </div>

                        {fileItem?.exif && (
                          <div className="px-1 pt-1 border-t border-slate-800 text-[10px] space-y-1 text-slate-400">
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
                                    className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 underline flex-shrink-0"
                                  >
                                    Maps <ExternalLink className="w-2 h-2" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi-platform Copy Tabs */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h4 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Platform Social Copy & SEO
                </h4>

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
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-spin">
                      <Loader2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-200">
                      Crafting tailored copy for {cluster.name}...
                    </p>
                    <p className="text-xs text-slate-400">
                      AI is generating story posts, hashtags, and SEO alt text.
                    </p>
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

            {/* Direct Social Share Action for Active Platform */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {activeTabKey === 'fb' && (
                  <button
                    onClick={() => handleShareFacebook(cId, post.facebook_post)}
                    disabled={!post.facebook_post}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Facebook className="w-4 h-4" /> Share to Facebook
                  </button>
                )}

                {activeTabKey === 'ig' && (
                  <button
                    onClick={() => handleShareInstagram(cId, post.instagram_caption, post.hashtags)}
                    disabled={!post.instagram_caption}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-semibold text-xs transition-all shadow-md shadow-pink-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Instagram className="w-4 h-4" /> Share to Instagram
                  </button>
                )}

                {activeTabKey === 'tw' && (
                  <button
                    onClick={() => handleShareTwitter(cId, post.twitter_post)}
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

                <span className="text-[11px] text-slate-400">
                  {activeTabKey === 'fb' && 'Opens Facebook and copies post text'}
                  {activeTabKey === 'ig' && 'Copies caption & hashtags and opens Instagram'}
                  {activeTabKey === 'tw' && 'Opens Twitter/X compose with post pre-filled'}
                  {activeTabKey === 'hash' && 'Copies all optimized hashtags'}
                  {activeTabKey === 'seo' && 'Copies SEO alt text to clipboard'}
                </span>
              </div>

              {/* Action feedback message */}
              {shareFeedback[cId] && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>{shareFeedback[cId]}</span>
                </div>
              )}
            </div>
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
