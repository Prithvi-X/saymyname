const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const OUTPUT_DIR = 'C:\\Users\\Prith\\.gemini\\antigravity\\brain\\d128fe15-1432-4ba6-b32c-ec8285fc2dcc\\screenshots_phase3_1';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let jwtSecret = 'dev-synthetic-access-secret-do-not-use-in-prod';
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const match = envContent.match(/JWT_ACCESS_SECRET=["']?([^"'\r\n]+)["']?/);
  if (match && match[1]) {
    jwtSecret = match[1];
  }
} catch (e) {}

function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const mockUser = {
  id: 'acc-synthetic-01',
  email: 'aditya.k@study.iitm.ac.in',
  displayName: 'Aditya Kumar',
  accountStatus: 'active',
  lifecycleState: 'ACTIVE_MEMBER',
  eligibility: {
    ageStatus: 'approved',
    studentStatus: 'approved',
    programmeFamily: 'data_science_applications',
    discoveryEligible: true,
  },
  profile: {
    id: 'prof-synthetic-01',
    displayName: 'Aditya Kumar',
    profileStatus: 'published',
    isPublished: true,
    isPaused: false,
  },
};

const mockProfile = {
  id: 'prof-synthetic-01',
  accountId: 'acc-synthetic-01',
  displayName: 'Aditya Kumar',
  programmeFamily: 'data_science_applications',
  termOrYear: 'Degree Level (Term 6)',
  locationCity: 'Chennai',
  locationState: 'Tamil Nadu',
  intention: 'Long-term intentional relationship',
  bio: 'Data science learner and open-source enthusiast. Passionate about machine learning, astronomy, and Carnatic instrumental music. Looking to connect with someone equally curious about research, literature, and quiet coffee spots.',
  ageDisplayMode: 'show_calculated_age',
  isPublished: true,
  isPaused: false,
  profileStatus: 'published',
  photos: [
    {
      id: 'p-1',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      displayOrder: 0,
      isPrimary: true,
    },
    {
      id: 'p-2',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
      displayOrder: 1,
      isPrimary: false,
    },
    {
      id: 'p-3',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
      displayOrder: 2,
      isPrimary: false,
    },
  ],
  interests: [
    { id: 'i-1', name: 'Machine Learning', category: 'Academic' },
    { id: 'i-2', name: 'Classical Music', category: 'Arts & Culture' },
    { id: 'i-3', name: 'Astronomy', category: 'Science' },
    { id: 'i-4', name: 'Filter Coffee', category: 'Lifestyle' },
    { id: 'i-5', name: 'Hiking', category: 'Outdoors' },
  ],
  prompts: [
    {
      id: 'pa-1',
      promptId: 'prompt-1',
      promptText: 'My ideal weekend involves...',
      answerText: 'Early morning filter coffee, reading research papers on attention mechanisms, and taking an evening walk along Marina beach.',
    },
    {
      id: 'pa-2',
      promptId: 'prompt-2',
      promptText: 'The best project I have built so far...',
      answerText: 'A real-time acoustic bird detection model for campus biodiversity tracking in Chennai.',
    },
  ],
};

const mockCatalog = {
  interests: [
    { id: 'i-1', name: 'Machine Learning', category: 'Academic' },
    { id: 'i-2', name: 'Classical Music', category: 'Arts & Culture' },
    { id: 'i-3', name: 'Astronomy', category: 'Science' },
    { id: 'i-4', name: 'Filter Coffee', category: 'Lifestyle' },
    { id: 'i-5', name: 'Hiking', category: 'Outdoors' },
    { id: 'i-6', name: 'Literature', category: 'Arts & Culture' },
    { id: 'i-7', name: 'Robotics', category: 'Tech' },
    { id: 'i-8', name: 'Badminton', category: 'Sports' },
  ],
  prompts: [
    { id: 'prompt-1', promptText: 'My ideal weekend involves...', category: 'Lifestyle' },
    { id: 'prompt-2', promptText: 'The best project I have built so far...', category: 'Academic' },
    { id: 'prompt-3', promptText: 'A topic I could talk about for hours is...', category: 'Passions' },
  ],
};

const mockPreferences = {
  minAge: 20,
  maxAge: 26,
  allowedProgrammes: [
    'data_science_applications',
    'electronic_systems',
    'aeronautics_space',
    'management_data_science',
  ],
  maxDistanceKm: null,
  showInDiscovery: true,
};

const mockPreview = {
  id: 'prof-synthetic-01',
  displayName: 'Aditya',
  age: 22,
  programmeFamily: 'data_science_applications',
  termOrYear: 'Degree Level (Term 6)',
  locationCity: 'Chennai',
  locationState: 'Tamil Nadu',
  intention: 'Long-term intentional relationship',
  bio: mockProfile.bio,
  photos: mockProfile.photos,
  interests: ['Machine Learning', 'Classical Music', 'Astronomy', 'Filter Coffee', 'Hiking'],
  promptAnswers: mockProfile.prompts,
  isVerified: true,
};

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  if (url === '/api/v1/identity/me') {
    res.writeHead(200);
    res.end(JSON.stringify(mockUser));
    return;
  }

  if (url === '/api/v1/profiles/me') {
    res.writeHead(200);
    res.end(JSON.stringify(mockProfile));
    return;
  }

  if (url === '/api/v1/profiles/catalog') {
    res.writeHead(200);
    res.end(JSON.stringify(mockCatalog));
    return;
  }

  if (url === '/api/v1/profiles/preferences') {
    res.writeHead(200);
    res.end(JSON.stringify(mockPreferences));
    return;
  }

  if (url === '/api/v1/profiles/me/preview' || url === '/api/v1/profiles/preview') {
    res.writeHead(200);
    res.end(JSON.stringify(mockPreview));
    return;
  }

  res.writeHead(200);
  res.end(JSON.stringify({ ok: true }));
});

server.listen(4000, async () => {
  const accessToken = signJwt(
    {
      sub: 'acc-synthetic-01',
      accountId: 'acc-synthetic-01',
      email: 'aditya.k@study.iitm.ac.in',
      discoveryEligible: true,
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    jwtSecret,
  );

  const userDataDir = path.join(process.env.TEMP || 'C:\\Temp', 'edge_review_cdp_' + Date.now());
  const edgeProcess = spawn(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  async function waitForCdp(retries = 30) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9222/json');
        if (res.ok) {
          const list = await res.json();
          const page = list.find((t) => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('Timeout waiting for Edge CDP');
  }

  try {
    const wsUrl = await waitForCdp();
    const ws = new WebSocket(wsUrl);
    let idCounter = 1;
    const pending = new Map();

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg.result || msg.error);
      }
    });

    await new Promise((r) => ws.on('open', r));

    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = idCounter++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Network.enable');
    await sendCommand('Network.setCookie', {
      name: 'smn_access_token',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    });
    await sendCommand('Network.setCookie', {
      name: 'smn_refresh_token',
      value: 'synthetic-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    });

    async function capture(filename, width, height, customScript) {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });

      if (customScript) {
        await sendCommand('Runtime.evaluate', {
          expression: customScript,
          awaitPromise: true,
        });
        await new Promise((r) => setTimeout(r, 800));
      }

      const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
      if (res && res.data) {
        const filePath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
        console.log(`Saved screenshot: ${filename} (${width}x${height})`);
      }
    }

    console.log('Navigating to http://localhost:3000/profile...');
    await sendCommand('Page.navigate', { url: 'http://localhost:3000/profile' });
    await new Promise((r) => setTimeout(r, 3000));

    // 1. Overview Desktop (1280x950)
    await capture('01_profile_overview_desktop.png', 1280, 950);

    // 2. Edit Profile - Identity & Bio (1280x950)
    await capture(
      '02_edit_identity_bio_desktop.png',
      1280,
      950,
      `(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const tab = tabs.find(b => b.textContent && b.textContent.trim() === 'Edit Profile');
        if (tab) tab.click();
      })()`,
    );

    // 3. Edit Profile - Scrolled to Interests & Prompts (1280x950)
    await capture(
      '03_interests_prompts_desktop.png',
      1280,
      950,
      `(() => {
        window.scrollTo({ top: 480, behavior: 'instant' });
      })()`,
    );

    // 4. Photo Manager Desktop (1280x950)
    await capture(
      '04_photo_manager_desktop.png',
      1280,
      950,
      `(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        const tabs = Array.from(document.querySelectorAll('button'));
        const tab = tabs.find(b => b.textContent && b.textContent.includes('Photographs'));
        if (tab) tab.click();
      })()`,
    );

    // 5. Dating Preferences Desktop (1280x950)
    await capture(
      '05_dating_preferences_desktop.png',
      1280,
      950,
      `(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const tab = tabs.find(b => b.textContent && b.textContent.trim() === 'Dating Preferences');
        if (tab) tab.click();
      })()`,
    );

    // 6. Privacy & Visibility Desktop (1280x950)
    await capture(
      '06_privacy_visibility_desktop.png',
      1280,
      950,
      `(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const tab = tabs.find(b => b.textContent && b.textContent.trim() === 'Privacy & Visibility');
        if (tab) tab.click();
      })()`,
    );

    // 7. Peer Public Preview Modal (1280x950)
    await capture(
      '07_peer_preview_modal_desktop.png',
      1280,
      950,
      `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const previewBtn = buttons.find(b => b.textContent && b.textContent.includes('Peer Preview'));
        if (previewBtn) previewBtn.click();
      })()`,
    );

    // 8. Tablet View (768x1024) - Reload fresh to close modal and show Overview on tablet
    await sendCommand('Page.navigate', { url: 'http://localhost:3000/profile' });
    await new Promise((r) => setTimeout(r, 2000));
    await capture('08_tablet_view_768px.png', 768, 1024);

    // 9. Mobile View (375x812) - Overview
    await capture('09_mobile_view_375px.png', 375, 812);

    ws.close();
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    edgeProcess.kill();
    server.close();
    console.log('Capture workflow completed.');
    process.exit(0);
  }
});
