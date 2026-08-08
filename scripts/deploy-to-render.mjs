import https from 'https';

// Retrieve environment parameters
const webhookUrl = process.env.RENDER_DEPLOY_WEBHOOK_URL;
const apiKey = process.env.RENDER_API_KEY;
const githubSha = process.env.GITHUB_SHA || '';

if (!webhookUrl) {
  console.error('Error: RENDER_DEPLOY_WEBHOOK_URL is required.');
  process.exit(1);
}

if (!apiKey) {
  console.error('Error: RENDER_API_KEY is required to poll deployment status.');
  process.exit(1);
}

// 1. Extract service ID from webhook URL
const serviceIdMatch = webhookUrl.match(/(srv-[a-zA-Z0-9]+)/);
if (!serviceIdMatch) {
  console.error('Error: Could not extract Render Service ID from the webhook URL.');
  process.exit(1);
}
const serviceId = serviceIdMatch[1];

// 2. Prepare trigger URL with GITHUB_SHA commit pin
const separator = webhookUrl.includes('?') ? '&' : '?';
const triggerUrl = githubSha 
  ? `${webhookUrl}${separator}ref=${githubSha}`
  : webhookUrl;

console.log(`[Render Deploy] Triggering deploy for Service: ${serviceId}`);
if (githubSha) {
  console.log(`[Render Deploy] Pinning deployment to Git ref (SHA): ${githubSha}`);
}

// Helper HTTPS request wrapper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ text: data });
          }
        } else {
          reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function run() {
  try {
    // A. Trigger Deploy Hook
    console.log('[Render Deploy] Sending webhook trigger request...');
    const triggerResponse = await makeRequest(triggerUrl, { method: 'POST' });
    
    const deployId = triggerResponse?.deploy?.id;
    if (!deployId) {
      console.error('[Render Deploy] Failed: Response did not return a Deploy ID.', triggerResponse);
      process.exit(1);
    }
    
    console.log(`[Render Deploy] Webhook accepted. Deploy ID: ${deployId}`);

    // B. Poll Render REST API for status updates
    const statusUrl = `https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`;
    const pollOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };

    console.log('[Render Deploy] Polling Render API for deployment status...');
    let lastStatus = '';
    
    while (true) {
      const pollResponse = await makeRequest(statusUrl, pollOptions);
      const currentStatus = pollResponse?.status;

      if (currentStatus !== lastStatus) {
        console.log(`[Render Deploy] Status change detected: [${currentStatus.toUpperCase()}]`);
        lastStatus = currentStatus;
      }

      // Check terminal states
      if (currentStatus === 'live') {
        console.log('[Render Deploy] Success: Deployment is live!');
        process.exit(0);
      } else if (['failed', 'canceled', 'deactivated'].includes(currentStatus)) {
        console.error(`[Render Deploy] Failed: Deployment terminated with status: ${currentStatus}`);
        process.exit(1);
      }

      // Wait 10 seconds before next poll
      await new Promise((r) => setTimeout(r, 10000));
    }
  } catch (err) {
    console.error('[Render Deploy] Execution error:', err.message);
    process.exit(1);
  }
}

run();
