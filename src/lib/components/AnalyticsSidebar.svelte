<script>
  import { onMount } from 'svelte';
  
  // State
  let evaluations = $state([]);
  let loading = $state(false);
  let error = $state(null);
  let isExpanded = $state(false);
  
  // Threshold controls - let editors define green/orange/red zones
  let thresholds = $state({
    green_min_relatability: 6,
    green_min_accessibility: 7,
    orange_min_relatability: 4,
    orange_min_accessibility: 5,
    red_max_theological_depth: 8,
    red_max_emotional_resonance: 3
  });
  
  // Props from parent
  let { 
    onAnalyticsReady = null 
  } = $props();
  
  // Export thresholds for use by editor components
  export { thresholds };
  
  // Notify parent when analytics functions are ready
  $effect(() => {
    if (onAnalyticsReady && evaluations.length > 0) {
      onAnalyticsReady({
        getBlockRecommendation,
        getBlockScores
      });
    }
  });
  
  let searchQuery = $state('');
  let sortBy = $state('relatability');
  let sortOrder = $state('desc');
  
  // Computed properties with defensive programming
  let filteredEvaluations = $derived(() => {
    try {
      if (!Array.isArray(evaluations) || evaluations.length === 0) return [];
      
      const filtered = evaluations.filter(evaluation => {
        if (!evaluation || typeof evaluation !== 'object') return false;
        const scores = evaluation.scores;
        if (!scores || typeof scores !== 'object') return false;
        
        // Apply search filter only - no score filtering in sidebar
        const scoresMatch = true;
        
        // Apply search filter
        const searchMatch = !searchQuery || 
          (evaluation.content_full && typeof evaluation.content_full === 'string' && evaluation.content_full.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (evaluation.block_id && typeof evaluation.block_id === 'string' && evaluation.block_id.toLowerCase().includes(searchQuery.toLowerCase()));
        
        return scoresMatch && searchMatch;
      });
      
      // Sort safely
      return filtered.sort((a, b) => {
        try {
          const aScore = (a.scores && typeof a.scores[sortBy] === 'number') ? a.scores[sortBy] : 0;
          const bScore = (b.scores && typeof b.scores[sortBy] === 'number') ? b.scores[sortBy] : 0;
          return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
        } catch {
          return 0;
        }
      });
    } catch (error) {
      console.error('Error in filteredEvaluations:', error);
      return [];
    }
  });
  
  let stats = $derived(() => {
    try {
      if (!Array.isArray(evaluations) || evaluations.length === 0) return null;
      if (!Array.isArray(filteredEvaluations)) return null;
      
      const metrics = ['relatability', 'accessibility', 'emotional_resonance', 'theological_depth'];
      const result = {
        total: evaluations.length,
        filtered: filteredEvaluations.length
      };
      
      metrics.forEach(metric => {
        try {
          const values = evaluations
            .filter(e => e && e.scores && typeof e.scores === 'object' && typeof e.scores[metric] === 'number')
            .map(e => e.scores[metric]);
          
          if (values.length > 0) {
            result[metric] = {
              avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
            };
          }
        } catch (error) {
          console.warn(`Error calculating stats for ${metric}:`, error);
        }
      });
      
      return result;
    } catch (error) {
      console.error('Error in stats calculation:', error);
      return null;
    }
  });
  
  let recommendations = $derived(() => {
    if (!Array.isArray(filteredEvaluations)) return [];
    return filteredEvaluations
      .filter(e => e && e.scores && typeof e.scores === 'object')
      .map(e => getRecommendation(e.scores));
  });
  
  let recommendationCounts = $derived(() => {
    if (!Array.isArray(recommendations)) return { keepCount: 0, editCount: 0, removeCount: 0 };
    const keepCount = recommendations.filter(r => r && r.type === 'keep').length;
    const editCount = recommendations.filter(r => r && r.type === 'edit').length;
    const removeCount = recommendations.filter(r => r && r.type === 'remove').length;
    return { keepCount, editCount, removeCount };
  });
  
  function getRecommendation(scores) {
    if (!scores || typeof scores !== 'object') return { type: 'edit', color: 'gray', label: 'UNKNOWN' };
    
    const relatability = (typeof scores.relatability === 'number') ? scores.relatability : 0;
    const accessibility = (typeof scores.accessibility === 'number') ? scores.accessibility : 0;
    const theological_depth = (typeof scores.theological_depth === 'number') ? scores.theological_depth : 0;
    const emotional_resonance = (typeof scores.emotional_resonance === 'number') ? scores.emotional_resonance : 0;
    
    // Use dynamic thresholds
    if (relatability >= thresholds.green_min_relatability && 
        accessibility >= thresholds.green_min_accessibility && 
        theological_depth <= 6) {
      return { type: 'keep', color: 'green', label: 'KEEP' };
    }
    
    if (relatability <= (thresholds.orange_min_relatability - 1) || 
        emotional_resonance <= thresholds.red_max_emotional_resonance || 
        theological_depth >= thresholds.red_max_theological_depth) {
      return { type: 'remove', color: 'red', label: 'REMOVE' };
    }
    
    return { type: 'edit', color: 'orange', label: 'EDIT' };
  }
  
  // Export function for use by editor
  export function getBlockRecommendation(blockId) {
    const evaluation = evaluations.find(e => e.block_id === blockId);
    if (!evaluation) return null;
    return getRecommendation(evaluation.scores);
  }
  
  export function getBlockScores(blockId) {
    const evaluation = evaluations.find(e => e.block_id === blockId);
    if (!evaluation || !evaluation.scores) return null;
    return evaluation.scores;
  }
  
  function getScoreColor(score) {
    if (!score || typeof score !== 'number') return 'text-gray-600 bg-gray-100';
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-blue-600 bg-blue-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  }
  
  function getSafeScore(evaluation, metric) {
    if (!evaluation || !evaluation.scores || typeof evaluation.scores !== 'object') {
      return null;
    }
    const score = evaluation.scores[metric];
    return (typeof score === 'number') ? score : null;
  }
  
  function getSafeScoreDisplay(evaluation, metric) {
    const score = getSafeScore(evaluation, metric);
    return score !== null ? score : 'N/A';
  }
  
  async function loadEvaluations() {
    loading = true;
    error = null;
    
    try {
      console.log('🔄 Loading evaluations from /evaluation.json...');
      const response = await fetch('/evaluation.json');
      if (!response.ok) {
        throw new Error(`Failed to load evaluations: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('📊 Raw data received:', { hasData: !!data, type: typeof data });
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid evaluation data format');
      }
      
      const rawEvaluations = data.evaluations;
      if (!Array.isArray(rawEvaluations)) {
        throw new Error('Evaluations is not an array');
      }
      
      // Validate and sanitize the data
      const validEvaluations = rawEvaluations.filter(evaluation => {
        return evaluation && 
               typeof evaluation === 'object' && 
               evaluation.scores && 
               typeof evaluation.scores === 'object';
      });
      
      evaluations = validEvaluations;
      console.log(`✅ Loaded ${evaluations.length} valid evaluations out of ${rawEvaluations.length} total`);
      
    } catch (err) {
      error = err.message;
      evaluations = []; // Ensure it's always an array
      console.error('❌ Error loading evaluations:', err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    loadEvaluations();
  });
</script>

<!-- Analytics Sidebar -->
<div class="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-lg transition-all duration-300 z-40 {isExpanded ? 'w-96' : 'w-12'}">
  <!-- Toggle Button -->
  <button 
    onclick={() => isExpanded = !isExpanded}
    class="absolute left-0 top-4 transform -translate-x-full bg-orange-600 text-white p-2 rounded-l-lg hover:bg-orange-700 transition-colors"
    title={isExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
  >
    {#if isExpanded}
      📊 ✕
    {:else}
      📊
    {/if}
  </button>
  
  {#if isExpanded}
    <div class="h-full overflow-y-auto p-4">
      <!-- Header -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-1">📊 Analytics</h3>
        <p class="text-xs text-gray-500">LLM Content Analysis</p>
      </div>
      
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
            <p class="text-xs text-gray-600">Loading...</p>
          </div>
        </div>
      {:else if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div class="text-xs text-red-800 font-medium">Error loading data</div>
          <p class="text-xs text-red-700 mt-1">{error}</p>
        </div>
      {:else}
        <!-- Quick Stats -->
        {#if stats}
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="bg-blue-50 rounded-lg p-2 text-center">
              <div class="text-lg font-bold text-blue-600">{stats.total}</div>
              <div class="text-xs text-blue-600">Total</div>
            </div>
            <div class="bg-green-50 rounded-lg p-2 text-center">
              <div class="text-lg font-bold text-green-600">{stats.filtered}</div>
              <div class="text-xs text-green-600">Filtered</div>
            </div>
          </div>
          
          <!-- Key Metrics -->
          <div class="space-y-2 mb-4">
            <div class="text-xs font-medium text-gray-700">Avg Scores</div>
            {#each ['relatability', 'accessibility', 'emotional_resonance', 'theological_depth'] as metric}
              {#if stats[metric]}
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600 capitalize">{metric.replace('_', ' ')}</span>
                  <span class="font-medium">{stats[metric].avg}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        
        <!-- Recommendations Summary -->
        {#if recommendationCounts}
          <div class="mb-4">
            <div class="text-xs font-medium text-gray-700 mb-2">Recommendations</div>
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-green-600">🟢 Keep</span>
                <span class="font-medium">{recommendationCounts.keepCount}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-orange-600">🟡 Edit</span>
                <span class="font-medium">{recommendationCounts.editCount}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-red-600">🔴 Remove</span>
                <span class="font-medium">{recommendationCounts.removeCount}</span>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Threshold Controls -->
        <div class="mb-4">
          <div class="text-xs font-medium text-gray-700 mb-2">🎯 Traffic Light Thresholds</div>
          <div class="text-xs text-gray-500 mb-3">Set your own criteria for green/orange/red recommendations</div>
          
          <!-- Green Thresholds -->
          <div class="mb-3 p-2 bg-green-50 rounded">
            <div class="text-xs font-medium text-green-700 mb-1">🟢 Green (Keep) Minimums</div>
            
            <div class="mb-2">
              <label class="block text-xs text-green-600 mb-1">
                Relatability: {thresholds.green_min_relatability}+
              </label>
              <input type="range" 
                     bind:value={thresholds.green_min_relatability}
                     min="1" max="10" 
                     class="w-full h-1 bg-green-200 rounded appearance-none cursor-pointer">
            </div>
            
            <div class="mb-2">
              <label class="block text-xs text-green-600 mb-1">
                Accessibility: {thresholds.green_min_accessibility}+
              </label>
              <input type="range" 
                     bind:value={thresholds.green_min_accessibility}
                     min="1" max="10" 
                     class="w-full h-1 bg-green-200 rounded appearance-none cursor-pointer">
            </div>
          </div>
          
          <!-- Orange Thresholds -->
          <div class="mb-3 p-2 bg-orange-50 rounded">
            <div class="text-xs font-medium text-orange-700 mb-1">🟡 Orange (Edit) Minimums</div>
            
            <div class="mb-2">
              <label class="block text-xs text-orange-600 mb-1">
                Relatability: {thresholds.orange_min_relatability}+
              </label>
              <input type="range" 
                     bind:value={thresholds.orange_min_relatability}
                     min="1" max="10" 
                     class="w-full h-1 bg-orange-200 rounded appearance-none cursor-pointer">
            </div>
            
            <div class="mb-2">
              <label class="block text-xs text-orange-600 mb-1">
                Accessibility: {thresholds.orange_min_accessibility}+
              </label>
              <input type="range" 
                     bind:value={thresholds.orange_min_accessibility}
                     min="1" max="10" 
                     class="w-full h-1 bg-orange-200 rounded appearance-none cursor-pointer">
            </div>
          </div>
          
          <!-- Red Thresholds -->
          <div class="mb-3 p-2 bg-red-50 rounded">
            <div class="text-xs font-medium text-red-700 mb-1">🔴 Red (Remove) Maximums</div>
            
            <div class="mb-2">
              <label class="block text-xs text-red-600 mb-1">
                Emotional Resonance: {thresholds.red_max_emotional_resonance} or below
              </label>
              <input type="range" 
                     bind:value={thresholds.red_max_emotional_resonance}
                     min="1" max="10" 
                     class="w-full h-1 bg-red-200 rounded appearance-none cursor-pointer">
            </div>
            
            <div class="mb-2">
              <label class="block text-xs text-red-600 mb-1">
                Theological Depth: {thresholds.red_max_theological_depth}+ (too complex)
              </label>
              <input type="range" 
                     bind:value={thresholds.red_max_theological_depth}
                     min="1" max="10" 
                     class="w-full h-1 bg-red-200 rounded appearance-none cursor-pointer">
            </div>
          </div>
          
          <!-- Search -->
          <input
            bind:value={searchQuery}
            placeholder="Search content..."
            class="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-2 focus:ring-1 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        
        <!-- Content List -->
        <div class="text-xs font-medium text-gray-700 mb-2">Content Blocks ({Array.isArray(filteredEvaluations) ? filteredEvaluations.length : 0})</div>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          {#each (Array.isArray(filteredEvaluations) ? filteredEvaluations.slice(0, 20) : []) as evaluation}
            {@const recommendation = getRecommendation(evaluation?.scores)}
            <div class="border border-gray-200 rounded p-2 text-xs">
              <div class="flex items-center justify-between mb-1">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium 
                             bg-{recommendation.color}-100 text-{recommendation.color}-800">
                  {recommendation.label}
                </span>
                <div class="flex gap-1">
                  {#each ['relatability', 'accessibility'] as metric}
                    {@const score = getSafeScore(evaluation, metric)}
                    <span class="text-xs font-medium {getScoreColor(score)} px-1 py-0.5 rounded">
                      {getSafeScoreDisplay(evaluation, metric)}
                    </span>
                  {/each}
                </div>
              </div>
              <p class="text-gray-700 leading-tight">
                {(evaluation.content_full && typeof evaluation.content_full === 'string') ? evaluation.content_full.substring(0, 80) + '...' : 'No content available'}
              </p>
            </div>
          {/each}
          
          {#if Array.isArray(filteredEvaluations) && filteredEvaluations.length > 20}
            <div class="text-center py-2 text-xs text-gray-500">
              +{filteredEvaluations.length - 20} more blocks
            </div>
          {/if}
        </div>
        
        <!-- Full Analytics Link -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <a href="/analytics" 
             target="_blank"
             class="block w-full text-center bg-orange-600 text-white py-2 rounded text-xs font-medium hover:bg-orange-700 transition-colors">
            📈 Full Analytics Dashboard
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Custom scrollbar for content list */
  .max-h-64::-webkit-scrollbar {
    width: 4px;
  }
  
  .max-h-64::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 2px;
  }
  
  .max-h-64::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
  
  .max-h-64::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>