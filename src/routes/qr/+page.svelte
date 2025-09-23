<script lang="ts">
	import QRCode from 'qrcode';
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	
	let url = $state('');
	let qrCodeDataUrl = $state('');
	let debounceTimer: number | undefined;
	
	$effect(() => {
		if (url.trim()) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				generateQRCode();
			}, 300);
		} else {
			qrCodeDataUrl = '';
		}
	});
	
	async function generateQRCode() {
		if (!url.trim()) {
			qrCodeDataUrl = '';
			return;
		}
		
		try {
			qrCodeDataUrl = await QRCode.toDataURL(url, {
				width: 400,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				}
			});
		} catch (err) {
			toast.error({
				title: 'Generation Failed',
				message: 'Failed to generate QR code',
				duration: 3000
			});
			console.error(err);
		}
	}
	
	function downloadQRCode() {
		if (!qrCodeDataUrl) return;
		
		const link = document.createElement('a');
		link.href = qrCodeDataUrl;
		link.download = 'qrcode.png';
		link.click();
		
		toast.success({
			title: 'Downloaded!',
			message: 'QR code saved to your device',
			duration: 2000
		});
	}
	
	async function copyToClipboard() {
		if (!qrCodeDataUrl) return;
		
		try {
			const blob = await (await fetch(qrCodeDataUrl)).blob();
			const item = new ClipboardItem({ 'image/png': blob });
			await navigator.clipboard.write([item]);
			
			toast.success({
				title: 'Copied!',
				message: 'QR code copied to clipboard',
				duration: 2000
			});
		} catch (err) {
			console.error('Failed to copy image:', err);
			try {
				await navigator.clipboard.writeText(url);
				toast.info({
					title: 'URL Copied',
					message: 'Copied URL instead of image',
					duration: 2000
				});
			} catch (e) {
				toast.error({
					title: 'Copy Failed',
					message: 'Could not access clipboard',
					duration: 3000
				});
				console.error('Failed to copy URL:', e);
			}
		}
	}
	
	function clearAll() {
		url = '';
		qrCodeDataUrl = '';
	}
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4">
	<div class="max-w-2xl mx-auto">
		<h1 class="text-3xl font-bold text-gray-900 text-center mb-8">QR Code Generator</h1>
		
		<div class="bg-white rounded-lg shadow-sm p-6">
			<div class="space-y-4">
				<div>
					<label for="url" class="block text-sm font-medium text-gray-700 mb-2">
						Enter URL
					</label>
					<input
						id="url"
						type="text"
						bind:value={url}
						placeholder="https://example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>
				
				{#if qrCodeDataUrl}
					<div class="flex gap-2">
						<button
							onclick={clearAll}
							class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
						>
							Clear
						</button>
					</div>
				{/if}
			</div>
			
			{#if qrCodeDataUrl}
				<div class="mt-8 text-center">
					<div class="inline-block bg-white p-4 border border-gray-200 rounded-lg">
						<img src={qrCodeDataUrl} alt="QR Code" class="max-w-full" />
					</div>
					<div class="mt-4 flex gap-2 justify-center">
						<button
							onclick={downloadQRCode}
							class="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 transition-colors"
						>
							Download
						</button>
						<button
							onclick={copyToClipboard}
							class="bg-purple-600 text-white py-2 px-6 rounded-md hover:bg-purple-700 transition-colors"
						>
							Copy to Clipboard
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ToastContainer />