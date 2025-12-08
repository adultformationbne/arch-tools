/**
 * Mux Video Client
 *
 * Server-side client for Mux video upload and management.
 * Uses Mux Direct Upload for client-side uploads up to 2GB.
 */

import Mux from '@mux/mux-node';
import { MUX_TOKEN_ID, MUX_TOKEN_SECRET } from '$env/static/private';

// Initialize Mux client
const muxClient = new Mux({
	tokenId: MUX_TOKEN_ID,
	tokenSecret: MUX_TOKEN_SECRET
});

// Export video API for direct upload management
export const { video } = muxClient;

// Export full client for advanced operations
export { muxClient };
