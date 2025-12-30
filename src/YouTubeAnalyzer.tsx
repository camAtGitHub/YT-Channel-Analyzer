import React, { useState } from 'react';
import { BarChart3, TrendingUp, MessageSquare, Eye, ThumbsUp, Download, RefreshCw, Sparkles, AlertCircle, ChevronDown, ChevronUp, Info, Clock } from 'lucide-react';

const YouTubeAnalyzer = () => {
  const [apiKey, setApiKey] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('cpd');
  const [channelInfo, setChannelInfo] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [progress, setProgress] = useState('');
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [channelAverages, setChannelAverages] = useState(null);
  const [minVideoLength, setMinVideoLength] = useState(2);
  const [maxVideosToAnalyze, setMaxVideosToAnalyze] = useState(500);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  const parseDuration = (duration) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatDuration = (seconds) => {
    if (seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const extractChannelId = (input) => {
    const cleanInput = input.trim();
    
    if (cleanInput.startsWith('UC') && cleanInput.length === 24) {
      return cleanInput;
    }
    
    const urlPatterns = [
      /youtube\.com\/channel\/(UC[\w-]{22})/,
      /youtube\.com\/@([\w-]+)/,
      /youtube\.com\/c\/([\w-]+)/,
      /youtube\.com\/user\/([\w-]+)/,
    ];
    
    for (const pattern of urlPatterns) {
      const match = cleanInput.match(pattern);
      if (match) return match[1];
    }
    
    return cleanInput;
  };

  const fetchChannelId = async (handle) => {
    if (handle.startsWith('UC')) return handle;
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        return data.items[0].id;
      }
      
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${apiKey}&maxResults=1`
      );
      const searchData = await searchResponse.json();
      
      if (searchData.items && searchData.items.length > 0) {
        return searchData.items[0].snippet.channelId;
      }
    } catch (err) {
      console.error('Error fetching channel ID:', err);
    }
    
    return null;
  };

  const analyzeChannel = async () => {
    if (!apiKey) {
      setError('Please enter your YouTube API key');
      return;
    }
    
    if (!channelInput) {
      setError('Please enter a channel URL or ID');
      return;
    }

    setLoading(true);
    setError('');
    setVideos([]);
    setProgress('Starting analysis...');

    try {
      const extractedId = extractChannelId(channelInput);
      setProgress('Resolving channel ID...');
      const channelId = await fetchChannelId(extractedId);
      
      if (!channelId) {
        throw new Error('Could not find channel. Please check the URL or ID.');
      }

      setProgress('Fetching channel information...');
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet,statistics&id=${channelId}&key=${apiKey}`
      );
      
      const channelData = await channelResponse.json();
      
      if (channelData.error) {
        throw new Error(channelData.error.message);
      }
      
      if (!channelData.items || channelData.items.length === 0) {
        throw new Error('Channel not found');
      }

      const channel = channelData.items[0];
      setChannelInfo({
        title: channel.snippet.title,
        subscribers: parseInt(channel.statistics.subscriberCount || 0),
        totalVideos: parseInt(channel.statistics.videoCount || 0),
      });

      const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

      if (maxVideosToAnalyze > 2000) {
        const confirmed = window.confirm(`Fetching ${maxVideosToAnalyze} videos may take some time. Continue?`);
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }

      setProgress('Fetching video list...');
      let allVideoIds = [];
      let nextPageToken = null;
      let pageCount = 0;
      const maxPages = Math.min(Math.ceil(maxVideosToAnalyze / 50), 200);

      while (pageCount < maxPages && allVideoIds.length < maxVideosToAnalyze) {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        
        const playlistResponse = await fetch(playlistUrl);
        const playlistData = await playlistResponse.json();
        
        if (playlistData.error) {
          throw new Error(playlistData.error.message);
        }
        
        const videoIds = playlistData.items.map(item => item.contentDetails.videoId);
        allVideoIds = [...allVideoIds, ...videoIds];
        
        nextPageToken = playlistData.nextPageToken;
        pageCount++;
        
        if (!nextPageToken) break;
      }

      allVideoIds = allVideoIds.slice(0, maxVideosToAnalyze);
      setFetchedCount(allVideoIds.length);
      setProgress(`Fetching details for ${allVideoIds.length} videos...`);

      const videoDetails = [];
      for (let i = 0; i < allVideoIds.length; i += 50) {
        const batch = allVideoIds.slice(i, i + 50);
        setProgress(`Fetching video details (${i + batch.length}/${allVideoIds.length})...`);
        
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batch.join(',')}&key=${apiKey}`;
        
        const videoResponse = await fetch(videoUrl);
        const videoData = await videoResponse.json();
        
        if (videoData.error) {
          throw new Error(videoData.error.message);
        }
        
        videoDetails.push(...videoData.items);
      }

      // Filter videos based on minimum length and max count
      const minLengthSeconds = minVideoLength * 60;
      let filteredVideoDetails = videoDetails.filter(video => {
        const duration = parseDuration(video.contentDetails?.duration || '');
        return duration >= minLengthSeconds;
      });

      // Limit to max videos to analyze
      filteredVideoDetails = filteredVideoDetails.slice(0, maxVideosToAnalyze);

      setFilteredCount(fetchedCount - filteredVideoDetails.length);
      setProgress(`Filtering videos (min ${minVideoLength}min length)...`);
      setProgress('Calculating analytics...');
      const now = new Date();
      const processedVideos = filteredVideoDetails.map(video => {
        const publishedAt = new Date(video.snippet.publishedAt);
        const daysAgo = Math.max(1, Math.floor((now - publishedAt) / (1000 * 60 * 60 * 24)));
        
        const views = parseInt(video.statistics.viewCount || 0);
        const comments = parseInt(video.statistics.commentCount || 0);
        const likes = parseInt(video.statistics.likeCount || 0);
        
        const cpd = comments / daysAgo;
        const cpv = views > 0 ? comments / views : 0;
        const lpv = views > 0 ? likes / views : 0;
        const engagementRate = views > 0 ? (likes + comments) / views : 0;
        
        return {
          id: video.id,
          title: video.snippet.title,
          publishedAt,
          daysAgo,
          views,
          comments,
          likes,
          cpd,
          cpv,
          lpv,
          engagementRate,
        };
      });

      const avgCpd = processedVideos.reduce((sum, v) => sum + v.cpd, 0) / processedVideos.length;
      const avgViews = processedVideos.reduce((sum, v) => sum + v.views, 0) / processedVideos.length;
      const avgEngagement = processedVideos.reduce((sum, v) => sum + v.engagementRate, 0) / processedVideos.length;

      setChannelAverages({
        avgCpd,
        avgViews,
        avgEngagement,
      });

      const enrichedVideos = processedVideos.map(video => {
        const cpdRatio = avgCpd > 0 ? video.cpd / avgCpd : 0;
        const viewsRatio = avgViews > 0 ? video.views / avgViews : 0;
        const engagementRatio = avgEngagement > 0 ? video.engagementRate / avgEngagement : 0;
        
        const hiddenGemScore = engagementRatio - viewsRatio;
        const viralScore = viewsRatio * engagementRatio;
        const velocityScore = video.engagementRate / Math.log(video.daysAgo + 2);
        
        return {
          ...video,
          cpdRatio,
          viewsRatio,
          engagementRatio,
          hiddenGemScore,
          viralScore,
          velocityScore,
        };
      });

      setVideos(enrichedVideos);
      setProgress('');
    } catch (err) {
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const sortedVideos = [...videos].sort((a, b) => {
    const metrics = {
      cpd: (v) => v.cpd,
      cpv: (v) => v.cpv,
      lpv: (v) => v.lpv,
      engagement: (v) => v.engagementRate,
      views: (v) => v.views,
      hidden: (v) => v.hiddenGemScore,
      viral: (v) => v.viralScore,
      velocity: (v) => v.velocityScore,
    };
    
    return metrics[sortBy](b) - metrics[sortBy](a);
  });

  const exportData = () => {
    const data = {
      videos,
      channelInfo,
      channelAverages,
      fetchedCount,
      filteredCount,
      timestamp: Date.now(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `youtube-analysis-${channelInfo?.title || 'unknown'}-${dateStr}.json`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = ['Title', 'Views', 'Likes', 'Comments', 'CPD', 'CPV', 'LPV', 'Engagement Rate', 'Days Ago', 'Published', 'URL'];
    const rows = sortedVideos.map(v => [
      `"${v.title.replace(/"/g, '""')}"`,
      v.views,
      v.likes,
      v.comments,
      v.cpd.toFixed(4),
      v.cpv.toFixed(6),
      v.lpv.toFixed(6),
      v.engagementRate.toFixed(6),
      v.daysAgo,
      v.publishedAt.toISOString().split('T')[0],
      `https://www.youtube.com/watch?v=${v.id}`,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-analysis-${Date.now()}.csv`;
    a.click();
  };

  const reset = () => {
    setChannelInput('');
    setVideos([]);
    setError('');
    setChannelInfo(null);
    setProgress('');
    setExpandedVideo(null);
    setChannelAverages(null);
  };

  const loadData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.videos && data.channelInfo && data.channelAverages) {
          setVideos(data.videos);
          setChannelInfo(data.channelInfo);
          setChannelAverages(data.channelAverages);
          setFetchedCount(data.fetchedCount || 0);
          setFilteredCount(data.filteredCount || 0);
          setHasApiKey(true);
          setError('');
        } else {
          setError('Invalid data file. Please check the file format.');
        }
      } catch (err) {
        setError('Failed to load data. The file may be corrupted.');
      }
    };
    reader.readAsText(file);
  };

  const toggleVideoDetails = (videoId) => {
    setExpandedVideo(expandedVideo === videoId ? null : videoId);
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-8 h-8 text-red-600" />
              <h1 className="text-3xl font-bold text-gray-900">YouTube Channel Analyzer</h1>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Discover the best videos on any YouTube channel using advanced engagement metrics and analytics.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Getting your YouTube API Key:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                  <li>Create a new project or select an existing one</li>
                  <li>Enable the "YouTube Data API v3"</li>
                  <li>Go to "Credentials" and create an API key</li>
                  <li>Copy and paste it below</li>
                </ol>
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube Data API Key
            </label>
             <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Load Saved Data
              </label>
              <input
                type="file"
                accept=".json"
                onChange={loadData}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => {
                if (apiKey) {
                  setHasApiKey(true);
                } else {
                  setError('Please enter an API key');
                }
              }}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Continue
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="mt-6 text-xs text-gray-500">
              <p className="font-semibold mb-1">Privacy Note:</p>
              <p>Your API key is stored only in your browser's memory for this session and is never sent to any server except Google's YouTube API. Your browser may offer to save the key to your password manager.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-red-600" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">YouTube Channel Analyzer</h1>
            </div>
            <button
              onClick={() => setHasApiKey(false)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Change API Key
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel URL or ID
              </label>
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="e.g., https://youtube.com/@channelname or UC..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={loading}
              />
             </div>

            <div className="mb-4">
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Options
              </button>

              {showAdvancedOptions && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Video Length
                    </label>
                    <select
                      value={minVideoLength}
                      onChange={(e) => setMinVideoLength(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value={2}>2 minutes</option>
                      <option value={5}>5 minutes</option>
                      <option value={7}>7 minutes</option>
                      <option value={9}>9 minutes</option>
                      <option value={14}>14 minutes</option>
                      <option value={19}>19 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Videos to Analyze (1-9999)
                    </label>
                    <input
                      type="number"
                      value={maxVideosToAnalyze}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 1 && value <= 9999) {
                          setMaxVideosToAnalyze(value);
                        }
                      }}
                      min={1}
                      max={9999}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={analyzeChannel}
                disabled={loading || !channelInput}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze Channel
                  </>
                )}
              </button>
              
              {videos.length > 0 && (
                <button
                  onClick={reset}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Reset
                </button>
              )}
            </div>

            {progress && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {progress}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-red-700">{error}</div>
              </div>
            </div>
          )}
        </div>

        {channelInfo && channelAverages && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{channelInfo.title}</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
               <div className="text-center">
                 <div className="text-2xl font-bold text-red-600">{channelInfo.subscribers.toLocaleString()}</div>
                 <div className="text-sm text-gray-600">Subscribers</div>
               </div>
               <div className="text-center">
                 <div className="text-2xl font-bold text-red-600">{channelInfo.totalVideos.toLocaleString()}</div>
                 <div className="text-sm text-gray-600">Total Videos</div>
               </div>
               <div className="text-center">
                 <div className="text-2xl font-bold text-red-600">{videos.length.toLocaleString()}</div>
                 <div className="text-sm text-gray-600">Analyzed</div>
               </div>
               <div className="text-center">
                 <div className="text-lg font-bold text-gray-700">{fetchedCount.toLocaleString()}</div>
                 <div className="text-sm text-gray-600">Fetched</div>
               </div>
             </div>

             {filteredCount > 0 && (
               <div className="text-center text-sm text-gray-600 mb-4">
                 {filteredCount.toLocaleString()} video{filteredCount !== 1 ? 's' : ''} excluded (shorter than {minVideoLength} min)
               </div>
             )}
            
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Channel Averages (used for comparisons)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Avg Comments/Day</div>
                  <div className="font-semibold text-gray-900">{channelAverages.avgCpd.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Avg Views</div>
                  <div className="font-semibold text-gray-900">{channelAverages.avgViews.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                </div>
                <div>
                  <div className="text-gray-600">Avg Engagement Rate</div>
                  <div className="font-semibold text-gray-900">{(channelAverages.avgEngagement * 100).toFixed(3)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <>
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Results</h2>
                
                <div className="flex flex-wrap gap-3">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="cpd">Comments Per Day</option>
                    <option value="cpv">Comments Per View</option>
                    <option value="lpv">Likes Per View</option>
                    <option value="engagement">Engagement Rate</option>
                    <option value="views">Views</option>
                    <option value="hidden">Hidden Gems</option>
                    <option value="viral">Viral Score</option>
                    <option value="velocity">Velocity Score</option>
                  </select>
                  
                   <button
                     onClick={exportData}
                     className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                   >
                     <Download className="w-5 h-5" />
                     Save Data for Offline Viewing
                   </button>

                   <button
                     onClick={exportToCSV}
                     className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                   >
                     <Download className="w-5 h-5" />
                     Export CSV
                   </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="space-y-3">
                  {sortedVideos.slice(0, 50).map((video, idx) => (
                    <div key={video.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-semibold text-gray-900 hover:text-red-600 block mb-2"
                          >
                            {video.title}
                          </a>
                          
                           <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold">{video.views.toLocaleString()}</span>
                              <span className="text-gray-600">views</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <ThumbsUp className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold">{video.likes.toLocaleString()}</span>
                              <span className="text-gray-600">likes</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold">{video.comments.toLocaleString()}</span>
                              <span className="text-gray-600">comments</span>
                            </div>
                            
                             <div className="flex items-center gap-2">
                               <TrendingUp className="w-4 h-4 text-gray-400" />
                               <span className="font-semibold">{video.daysAgo}</span>
                               <span className="text-gray-600">days ago</span>
                             </div>

                             <div className="flex items-center gap-2">
                               <Clock className="w-4 h-4 text-gray-400" />
                               <span className="font-semibold">{formatDuration(parseDuration(video.contentDetails?.duration || ''))}</span>
                               <span className="text-gray-600">duration</span>
                             </div>
                           </div>
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                              CPD: {video.cpd.toFixed(2)}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                              CPV: {(video.cpv * 1000).toFixed(2)}‰
                            </span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                              LPV: {(video.lpv * 100).toFixed(2)}%
                            </span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                              Eng: {(video.engagementRate * 100).toFixed(2)}%
                            </span>
                            {video.hiddenGemScore > 0.5 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                                💎 Hidden Gem
                              </span>
                            )}
                            {video.viralScore > 2 && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                🔥 Viral
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => toggleVideoDetails(video.id)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {expandedVideo === video.id ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide Calculations
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Show Calculations
                              </>
                            )}
                          </button>

                          {expandedVideo === video.id && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Basic Metrics</h4>
                                <div className="space-y-1 font-mono text-xs">
                                  <div><span className="text-gray-600">Comments Per Day (CPD) =</span> {video.comments} comments ÷ {video.daysAgo} days = <span className="font-bold">{video.cpd.toFixed(4)}</span></div>
                                  <div><span className="text-gray-600">Comments Per View (CPV) =</span> {video.comments} comments ÷ {video.views.toLocaleString()} views = <span className="font-bold">{video.cpv.toFixed(6)}</span> ({(video.cpv * 1000).toFixed(2)}‰)</div>
                                  <div><span className="text-gray-600">Likes Per View (LPV) =</span> {video.likes} likes ÷ {video.views.toLocaleString()} views = <span className="font-bold">{video.lpv.toFixed(6)}</span> ({(video.lpv * 100).toFixed(2)}%)</div>
                                  <div><span className="text-gray-600">Engagement Rate =</span> ({video.likes} likes + {video.comments} comments) ÷ {video.views.toLocaleString()} views = <span className="font-bold">{video.engagementRate.toFixed(6)}</span> ({(video.engagementRate * 100).toFixed(2)}%)</div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Advanced Metrics</h4>
                                <div className="space-y-1 font-mono text-xs">
                                  <div><span className="text-gray-600">CPD Ratio =</span> {video.cpd.toFixed(2)} ÷ {channelAverages.avgCpd.toFixed(2)} (channel avg) = <span className="font-bold">{video.cpdRatio.toFixed(2)}x</span></div>
                                  <div><span className="text-gray-600">Views Ratio =</span> {video.views.toLocaleString()} ÷ {channelAverages.avgViews.toFixed(0)} (channel avg) = <span className="font-bold">{video.viewsRatio.toFixed(2)}x</span></div>
                                  <div><span className="text-gray-600">Engagement Ratio =</span> {video.engagementRate.toFixed(6)} ÷ {channelAverages.avgEngagement.toFixed(6)} (channel avg) = <span className="font-bold">{video.engagementRatio.toFixed(2)}x</span></div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Scores</h4>
                                <div className="space-y-2 text-xs">
                                  <div>
                                    <div className="font-mono"><span className="text-gray-600">Hidden Gem Score =</span> {video.engagementRatio.toFixed(2)} (eng ratio) - {video.viewsRatio.toFixed(2)} (views ratio) = <span className="font-bold">{video.hiddenGemScore.toFixed(2)}</span></div>
                                    {video.hiddenGemScore > 0.5 ? (
                                      <div className="text-yellow-700 mt-1">✨ This video has {video.engagementRatio.toFixed(1)}x better engagement than average, but only {video.viewsRatio.toFixed(1)}x the views. It's underrated!</div>
                                    ) : (
                                      <div className="text-gray-600 mt-1">Score &lt; 0.5: Views match or exceed engagement level</div>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="font-mono"><span className="text-gray-600">Viral Score =</span> {video.viewsRatio.toFixed(2)} (views ratio) × {video.engagementRatio.toFixed(2)} (eng ratio) = <span className="font-bold">{video.viralScore.toFixed(2)}</span></div>
                                    {video.viralScore > 2 ? (
                                      <div className="text-red-700 mt-1">🔥 This video has both high views AND high engagement - a true hit!</div>
                                    ) : (
                                      <div className="text-gray-600 mt-1">Score &lt; 2: Not exceptional in both dimensions</div>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="font-mono"><span className="text-gray-600">Velocity Score =</span> {video.engagementRate.toFixed(6)} (eng rate) ÷ ln({video.daysAgo} + 2) = <span className="font-bold">{video.velocityScore.toFixed(6)}</span></div>
                                    <div className="text-gray-600 mt-1">Adjusts engagement for age - newer videos get higher scores, rewarding fresh engagement</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {sortedVideos.length > 50 && (
                <div className="mt-4 text-center text-gray-600">
                  Showing top 50 of {sortedVideos.length} videos
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Understanding The Metrics
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-blue-600 mb-2">Comments Per Day (CPD)</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Total Comments ÷ Days Since Published</p>
                    <p className="text-gray-600">Shows ongoing discussion velocity. A video with 100 comments in 10 days (CPD=10) is more actively discussed than one with 100 comments in 100 days (CPD=1).</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-purple-600 mb-2">Comments Per View (CPV)</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Total Comments ÷ Total Views</p>
                    <p className="text-gray-600">Measures discussion intensity. Typical values are 0.001-0.01 (0.1%-1%). Higher means viewers are compelled to discuss.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-green-600 mb-2">Likes Per View (LPV)</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Total Likes ÷ Total Views</p>
                    <p className="text-gray-600">Virality indicator. Typical values are 0.02-0.08 (2%-8%). Higher means content resonates strongly.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-600 mb-2">Engagement Rate</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> (Likes + Comments) ÷ Views</p>
                    <p className="text-gray-600">Overall engagement combining both actions. Shows what percentage of viewers interacted.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-yellow-600 mb-2">💎 Hidden Gems Score</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Engagement Ratio - Views Ratio</p>
                    <p className="text-gray-600 mb-2">Finds underrated videos. Videos with high engagement relative to the channel average, but lower views.</p>
                    <p className="text-gray-700"><strong>Tagged when:</strong> Score &gt; 0.5 (engagement significantly exceeds view count)</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red-600 mb-2">🔥 Viral Score</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Views Ratio × Engagement Ratio</p>
                    <p className="text-gray-600 mb-2">Identifies the channel's biggest hits. Videos that have both exceptional views AND exceptional engagement.</p>
                    <p className="text-gray-700"><strong>Tagged when:</strong> Score &gt; 2 (both metrics well above average)</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-indigo-600 mb-2">Velocity Score</h4>
                    <p className="text-gray-700 mb-1"><strong>Formula:</strong> Engagement Rate ÷ ln(Days + 2)</p>
                    <p className="text-gray-600">Age-adjusted engagement. Uses logarithm to give newer videos a boost while not penalizing older videos too much. Shows which content maintains engagement over time.</p>
                  </div>

                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="text-xs text-blue-900"><strong>Note on Ratios:</strong> All "ratio" metrics compare a video's performance to the channel average. A ratio of 2.0 means the video is 2x better than average for that metric.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default YouTubeAnalyzer;