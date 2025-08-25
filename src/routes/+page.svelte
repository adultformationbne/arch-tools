<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>AHWGP XML Viewer</title>
</svelte:head>

<div class="landing-page min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
  <div class="max-w-2xl mx-auto text-center p-8">
    <h1 class="text-4xl font-bold text-gray-800 mb-4">
      AHWGP Content Viewer
    </h1>
    <p class="text-xl text-gray-600 mb-8">
      At Home With God's People: Our Catholic Faith
    </p>
    <p class="text-gray-500 mb-8 max-w-lg mx-auto">
      A modern interface to view and navigate the structured XML content of the religious education book, 
      featuring chapter navigation, content search, and detailed block-level analysis.
    </p>
    
    <div class="space-y-4">
      <button 
        onclick={() => goto('/viewer')}
        class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
      >
        Open Content Viewer
      </button>
      
      <button 
        onclick={() => goto('/builder')}
        class="inline-block bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-lg"
      >
        Document Builder
      </button>
      
      <button 
        onclick={() => goto('/editor')}
        class="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
      >
        Document Editor
      </button>
      
      <button 
        onclick={() => goto('/analytics')}
        class="inline-block bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors shadow-lg"
      >
        📊 Analytics Dashboard
      </button>
      
      <div class="text-sm text-gray-500">
        <p>View content, build new documents, edit blocks, or analyze with LLM scoring</p>
      </div>
    </div>
    
    <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
      <div class="bg-white p-6 rounded-lg shadow-sm">
        <div class="text-2xl font-bold text-blue-600 mb-2">56</div>
        <div class="text-sm text-gray-600">Chapters</div>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-sm">
        <div class="text-2xl font-bold text-green-600 mb-2">3,052</div>
        <div class="text-sm text-gray-600">Content Blocks</div>
      </div>
      <div class="bg-white p-6 rounded-lg shadow-sm">
        <div class="text-2xl font-bold text-purple-600 mb-2">3,708</div>
        <div class="text-sm text-gray-600">XML Lines</div>
      </div>
    </div>
  </div>
</div>