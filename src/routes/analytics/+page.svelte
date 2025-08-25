<script>
  import { onMount } from 'svelte';
  
  let evaluations = $state([]);
  let loading = $state(false);
  let error = $state(null);
  
  // Filter controls
  let filters = $state({
    relatability: [1, 10],
    historical_focus: [1, 10],
    theological_depth: [1, 10],
    practical_application: [1, 10],
    accessibility: [1, 10],
    emotional_resonance: [1, 10]
  });
  
  // Display options
  let viewMode = $state('cards'); // 'cards', 'table', 'charts'
  let sortBy = $state('relatability');
  let sortOrder = $state('desc');
  let searchQuery = $state('');
  
  // Computed properties
  let filteredEvaluations = $derived(() => {
    try {
      if (!Array.isArray(evaluations) || evaluations.length === 0) return [];
      
      return evaluations.filter(evaluation => {
        // More defensive checks
        if (!evaluation || typeof evaluation !== 'object') return false;
        const scores = evaluation.scores;
        if (!scores || typeof scores !== 'object') return false;
        
        // Apply score filters - be very defensive about missing metrics
        const scoresMatch = Object.keys(filters).every(metric => {
          const score = scores[metric];
          // Allow missing metrics to pass through (don't filter them out)
          if (score === undefined || score === null || typeof score !== 'number') return true;
          const [min, max] = filters[metric];
          return score >= min && score <= max;
        });
        
        // Apply search filter - be defensive about all properties
        const searchMatch = !searchQuery || 
          (evaluation.content_full && typeof evaluation.content_full === 'string' && evaluation.content_full.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (evaluation.block_id && typeof evaluation.block_id === 'string' && evaluation.block_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (scores && scores.key_themes && Array.isArray(scores.key_themes) && scores.key_themes.some(theme => 
            theme && typeof theme === 'string' && theme.toLowerCase().includes(searchQuery.toLowerCase())));
        
        return scoresMatch && searchMatch;
      }).sort((a, b) => {
        try {
          // Defensive sorting
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
      
      const metrics = ['relatability', 'historical_focus', 'theological_depth', 
                      'practical_application', 'accessibility', 'emotional_resonance'];
      
      const result = {
        total: evaluations.length,
        filtered: filteredEvaluations.length,
        metrics: {}
      };
      
      metrics.forEach(metric => {
        try {
          const values = evaluations
            .filter(e => e && e.scores && typeof e.scores === 'object' && typeof e.scores[metric] === 'number')
            .map(e => e.scores[metric]);
          
          if (values.length > 0) {
            result.metrics[metric] = {
              avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
              min: Math.min(...values),
              max: Math.max(...values),
              distribution: getDistribution(values)
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
    try {
      if (!Array.isArray(filteredEvaluations)) return [];
      return filteredEvaluations
        .filter(e => e && e.scores && typeof e.scores === 'object')
        .map(e => getRecommendation(e.scores));
    } catch (error) {
      console.error('Error in recommendations:', error);
      return [];
    }
  });
  
  let recommendationCounts = $derived(() => {
    try {
      if (!Array.isArray(recommendations)) return { keepCount: 0, editCount: 0, removeCount: 0 };
      const keepCount = recommendations.filter(r => r && r.type === 'keep').length;
      const editCount = recommendations.filter(r => r && r.type === 'edit').length;
      const removeCount = recommendations.filter(r => r && r.type === 'remove').length;
      return { keepCount, editCount, removeCount };
    } catch (error) {
      console.error('Error in recommendationCounts:', error);
      return { keepCount: 0, editCount: 0, removeCount: 0 };
    }
  });
  
  function getDistribution(values) {
    const bins = [0, 0, 0, 0, 0]; // 1-2, 3-4, 5-6, 7-8, 9-10
    values.forEach(v => {
      const bin = Math.min(Math.floor((v - 1) / 2), 4);
      bins[bin]++;
    });
    return bins;
  }
  
  function getRecommendation(scores) {
    if (!scores || typeof scores !== 'object') return { type: 'edit', color: 'gray', label: 'UNKNOWN' };
    
    const relatability = (typeof scores.relatability === 'number') ? scores.relatability : 0;
    const accessibility = (typeof scores.accessibility === 'number') ? scores.accessibility : 0;
    const theological_depth = (typeof scores.theological_depth === 'number') ? scores.theological_depth : 0;
    const emotional_resonance = (typeof scores.emotional_resonance === 'number') ? scores.emotional_resonance : 0;
    
    // Keep: High relatability + accessibility, low complexity
    if (relatability >= 6 && accessibility >= 7 && theological_depth <= 6) {
      return { type: 'keep', color: 'green', label: 'KEEP' };
    }
    // Remove: Low engagement or very high complexity
    if (relatability <= 3 || emotional_resonance <= 2 || 
        (theological_depth >= 8 && accessibility <= 4)) {
      return { type: 'remove', color: 'red', label: 'REMOVE' };
    }
    // Edit: Everything else
    return { type: 'edit', color: 'orange', label: 'EDIT' };
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
  
  function exportFilteredData() {
    const data = {
      metadata: {
        exported_at: new Date().toISOString(),
        filters_applied: filters,
        search_query: searchQuery,
        total_results: filteredEvaluations.length,
        total_available: evaluations.length
      },
      evaluations: filteredEvaluations.map(evaluation => ({
        block_id: evaluation.block_id,
        content_preview: evaluation.content_full?.substring(0, 200),
        scores: evaluation.scores,
        recommendation: getRecommendation(evaluation.scores),
        key_themes: (evaluation.scores && evaluation.scores.key_themes) ? evaluation.scores.key_themes : []
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  async function loadEvaluations() {
    loading = true;
    error = null;
    
    try {
      const response = await fetch('/evaluation.json');
      if (!response.ok) {
        throw new Error(`Failed to load evaluations: ${response.statusText}`);
      }
      const data = await response.json();
      // Extra defensive check for data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid evaluation data format');
      }
      evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];
      console.log('📊 Loaded evaluations:', evaluations.length);
    } catch (err) {
      error = err.message;
      console.error('❌ Error loading evaluations:', err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    loadEvaluations();
  });
</script>

<svelte:head>
  <title>Content Analytics Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Content Analytics Dashboard</h1>
          <p class="text-sm text-gray-500">LLM-powered content analysis and filtering</p>
        </div>
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <input bind:value={searchQuery}
                   placeholder="Search content, themes, or block IDs..."
                   class="border border-gray-300 rounded-lg px-3 py-2 w-64 text-sm">
            <button onclick={() => exportFilteredData()} 
                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
              📁 Export
            </button>
          </div>
          <button onclick={() => loadEvaluations()} 
                  class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            🔄 Refresh
          </button>
          <select bind:value={viewMode} class="border border-gray-300 rounded-lg px-3 py-2">
            <option value="cards">Card View</option>
            <option value="table">Table View</option>
            <option value="charts">Charts View</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center h-64">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading evaluations...</p>
      </div>
    </div>
  {:else if error}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex">
          <div class="text-red-400">⚠️</div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading evaluations</h3>
            <p class="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Stats Overview -->
      {#if stats}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-2xl font-bold text-blue-600">{stats?.total || 0}</div>
            <div class="text-sm text-gray-600">Total Evaluations</div>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-2xl font-bold text-green-600">{stats?.filtered || 0}</div>
            <div class="text-sm text-gray-600">Filtered Results</div>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-2xl font-bold text-purple-600">
              {(stats && stats.metrics && stats.metrics.relatability && stats.metrics.relatability.avg) || 'N/A'}
            </div>
            <div class="text-sm text-gray-600">Avg Relatability</div>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-2xl font-bold text-orange-600">
              {(stats && stats.metrics && stats.metrics.accessibility && stats.metrics.accessibility.avg) || 'N/A'}
            </div>
            <div class="text-sm text-gray-600">Avg Accessibility</div>
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <!-- Filters Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow p-6 sticky top-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">📊 Score Filters</h3>
            
            {#each Object.keys(filters) as metric}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2 capitalize">
                  {metric.replace('_', ' ')}
                  <span class="text-gray-500">
                    ({filters[metric][0]} - {filters[metric][1]})
                  </span>
                </label>
                <div class="flex items-center space-x-2">
                  <input type="range" 
                         bind:value={filters[metric][0]}
                         min="1" max="10" 
                         class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                  <input type="range" 
                         bind:value={filters[metric][1]}
                         min="1" max="10" 
                         class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                </div>
                {#if stats?.metrics?.[metric]}
                  <div class="text-xs text-gray-500 mt-1">
                    Avg: {(stats?.metrics?.[metric]?.avg) || 'N/A'} 
                    (Range: {(stats?.metrics?.[metric]?.min) || 'N/A'}-{(stats?.metrics?.[metric]?.max) || 'N/A'})
                  </div>
                {/if}
              </div>
            {/each}
            
            <div class="border-t pt-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select bind:value={sortBy} class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="relatability">Relatability</option>
                <option value="accessibility">Accessibility</option>
                <option value="emotional_resonance">Emotional Resonance</option>
                <option value="theological_depth">Theological Depth</option>
                <option value="practical_application">Practical Application</option>
                <option value="historical_focus">Historical Focus</option>
              </select>
              
              <label class="block text-sm font-medium text-gray-700 mt-3 mb-2">Order</label>
              <select bind:value={sortOrder} class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="lg:col-span-3">
          {#if viewMode === 'cards'}
            <!-- Card View -->
            <div class="space-y-4">
              {#each filteredEvaluations as evaluation}
                {@const recommendation = getRecommendation(evaluation.scores)}
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                      <div class="text-sm text-gray-500 mb-1">
                        Block ID: {evaluation.block_id || 'Unknown'}
                      </div>
                      <p class="text-gray-800 leading-relaxed">
                        {(evaluation.content_full && typeof evaluation.content_full === 'string') ? evaluation.content_full.substring(0, 200) + '...' : 'No content available'}
                      </p>
                    </div>
                    <div class="ml-4">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium 
                                   bg-{recommendation.color}-100 text-{recommendation.color}-800">
                        {recommendation.label}
                      </span>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-3 gap-4">
                    {#if evaluation.scores && typeof evaluation.scores === 'object'}
                      {#each ['relatability', 'accessibility', 'emotional_resonance', 'theological_depth', 'practical_application', 'historical_focus'] as metric}
                        {@const score = getSafeScore(evaluation, metric)}
                        {#if score !== null}
                          <div class="text-center">
                            <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">
                              {metric.replace('_', ' ')}
                            </div>
                            <div class="text-lg font-semibold {getScoreColor(score)} px-2 py-1 rounded">
                              {score}
                            </div>
                          </div>
                        {:else}
                          <div class="text-center">
                            <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">
                              {metric.replace('_', ' ')}
                            </div>
                            <div class="text-lg font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                              N/A
                            </div>
                          </div>
                        {/if}
                      {/each}
                    {:else}
                      <div class="col-span-3 text-center text-gray-500">
                        No scores available
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else if viewMode === 'table'}
            <!-- Table View -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rel
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acc
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Emo
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Theo
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prac
                    </th>
                    <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hist
                    </th>
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rec
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each filteredEvaluations as evaluation}
                    {@const recommendation = getRecommendation(evaluation.scores)}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-900 max-w-md">
                          {(evaluation.content_full && typeof evaluation.content_full === 'string') ? evaluation.content_full.substring(0, 100) + '...' : 'No content'}
                        </div>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'relatability'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'relatability')}
                        </span>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'accessibility'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'accessibility')}
                        </span>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'emotional_resonance'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'emotional_resonance')}
                        </span>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'theological_depth'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'theological_depth')}
                        </span>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'practical_application'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'practical_application')}
                        </span>
                      </td>
                      <td class="px-3 py-4 text-center">
                        <span class="text-sm font-medium {getScoreColor(getSafeScore(evaluation, 'historical_focus'))} px-2 py-1 rounded">
                          {getSafeScoreDisplay(evaluation, 'historical_focus')}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                                     bg-{recommendation.color}-100 text-{recommendation.color}-800">
                          {recommendation.label}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else if viewMode === 'charts'}
            <!-- Charts View -->
            <div class="space-y-8">
              <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">📈 Score Distribution</h3>
                {#if stats}
                  <div class="grid grid-cols-2 gap-6">
                    {#each Object.entries(stats?.metrics || {}) as [metric, data]}
                      <div>
                        <h4 class="text-sm font-medium text-gray-700 mb-2 capitalize">
                          {metric.replace('_', ' ')}
                        </h4>
                        <div class="flex items-end space-x-1 h-24">
                          {#each data.distribution as count, i}
                            <div class="flex-1 bg-blue-200 rounded-t" 
                                 style="height: {(count / Math.max(...data.distribution)) * 100}%"
                                 title="{['1-2', '3-4', '5-6', '7-8', '9-10'][i]}: {count} blocks">
                            </div>
                          {/each}
                        </div>
                        <div class="flex justify-between text-xs text-gray-500 mt-1">
                          <span>1-2</span>
                          <span>3-4</span>
                          <span>5-6</span>
                          <span>7-8</span>
                          <span>9-10</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              
              <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">🎯 Content Recommendations</h3>
                <div class="grid grid-cols-3 gap-4">
                  <div class="text-center p-4 bg-green-50 rounded-lg">
                    <div class="text-3xl font-bold text-green-600">{recommendationCounts.keepCount}</div>
                    <div class="text-sm text-green-700">Keep</div>
                    <div class="text-xs text-green-600">{filteredEvaluations.length > 0 ? ((recommendationCounts.keepCount/filteredEvaluations.length)*100).toFixed(1) : 0}%</div>
                  </div>
                  <div class="text-center p-4 bg-orange-50 rounded-lg">
                    <div class="text-3xl font-bold text-orange-600">{recommendationCounts.editCount}</div>
                    <div class="text-sm text-orange-700">Edit</div>
                    <div class="text-xs text-orange-600">{filteredEvaluations.length > 0 ? ((recommendationCounts.editCount/filteredEvaluations.length)*100).toFixed(1) : 0}%</div>
                  </div>
                  <div class="text-center p-4 bg-red-50 rounded-lg">
                    <div class="text-3xl font-bold text-red-600">{recommendationCounts.removeCount}</div>
                    <div class="text-sm text-red-700">Remove</div>
                    <div class="text-xs text-red-600">{filteredEvaluations.length > 0 ? ((recommendationCounts.removeCount/filteredEvaluations.length)*100).toFixed(1) : 0}%</div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
          
          {#if filteredEvaluations.length === 0 && evaluations.length > 0}
            <div class="bg-white rounded-lg shadow p-8 text-center">
              <div class="text-gray-400 text-4xl mb-4">🔍</div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p class="text-gray-600">Try adjusting your filters to see more content.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>