/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export interface Env {
	URL_MAPPINGS: KVNamespace;
}
export default {


	async fetch(request, env: Env, ctx): Promise<Response> {

		async function create(request: Request, env: Env) {
			try {
				// The issue is that the result of `request.json()` is of type `unknown`,
				// so TypeScript doesn't know if it has `key` and `value` properties.
				// We can assert the type to a more specific one to fix this.
				const jsonData = await request.json() as { key: string; value: string };
				const { key, value } = jsonData;

				// Validate input
				if (!key || !value) {
					return new Response('Key and value are required', { status: 400 });
				}

				// Validate URL
				try {
					new URL(value);
				} catch {
					return new Response('Invalid URL format', { status: 400 });
				}

				// Check if key already exists
				const existing = await env.URL_MAPPINGS.get(key);
				if (existing) {
					return new Response('Key already exists', { status: 409 });
				}

				// Store the mapping
				await env.URL_MAPPINGS.put(key, value);

				return new Response(JSON.stringify({
					message: 'created',
					shortUrl: `https://yourdomain.com/${key}`
				}), {
					status: 201,
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(`Error: ${error}`, { status: 500 });
			}
		}
		async function list(){
			try {
				const listResult  = await env.URL_MAPPINGS.list();
				const mappings = await Promise.all(
					listResult.keys.map(async (key) => ({
					  key: key.name,
					  value: await env.URL_MAPPINGS.get(key.name)
					}))
				  );
				return new Response(JSON.stringify(mappings), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}catch (error) {
				return new Response(`Error: ${error}`, { status: 500 });
			}
		}
		const url = new URL(request.url);
		const path = url.pathname.slice(1); // Remove leading '/'
		if (request.method === 'POST' && path === 'create') {
			// Handle URL creation
			return await create(request, env);
		}
		if(path=='list'){
			return await list()
		}

		// Handle root domain or management paths
		if (path === '') {
			return new Response('URL Shortener Service', { status: 200 });
		}

		// Check if path exists in KV store
		const targetUrl = await env.URL_MAPPINGS.get(path);

		if (targetUrl) {
			// Redirect to the original URL
			return Response.redirect(targetUrl, 301);
		}

		// If no mapping found, return a 404
		return new Response('not found', { status: 404 });
	}

} satisfies ExportedHandler<Env>;
