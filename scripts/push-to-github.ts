// Script to push code to GitHub repository
// Uses Replit GitHub integration

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Files and directories to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.replit',
  '.config',
  '.cache',
  'dist',
  '.upm',
  'replit.nix',
  'scripts/push-to-github.ts',
  '.breakpoints',
  'generated-icon.png',
  'package-lock.json'
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (shouldExclude(fullPath)) return;
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function pushToGitHub() {
  const owner = 'zspldev';
  const repo = 'NotesMateMD';
  const branch = 'main';
  
  console.log('Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  console.log('Getting current commit SHA...');
  let currentSha: string;
  try {
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    currentSha = refData.object.sha;
    console.log('Current commit:', currentSha);
  } catch (error: any) {
    if (error.status === 404) {
      console.log('Branch not found, will create initial commit');
      currentSha = '';
    } else {
      throw error;
    }
  }

  console.log('Collecting files...');
  const files = getAllFiles('.');
  console.log(`Found ${files.length} files to push`);

  // Create blobs for each file
  console.log('Creating file blobs...');
  const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
  
  for (const file of files) {
    const relativePath = file.startsWith('./') ? file.slice(2) : file;
    const content = fs.readFileSync(file);
    const base64Content = content.toString('base64');
    
    try {
      const { data: blobData } = await octokit.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: 'base64'
      });
      
      treeItems.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
      
      console.log(`  ✓ ${relativePath}`);
    } catch (error) {
      console.error(`  ✗ Failed to upload ${relativePath}:`, error);
    }
  }

  console.log('Creating tree...');
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: currentSha || undefined
  });

  console.log('Creating commit...');
  const commitMessage = `Update from Replit - ${new Date().toISOString()}

- iOS Safari audio playback fix using data URLs
- Audio now works on iOS Safari and Chrome`;

  const commitParams: any = {
    owner,
    repo,
    message: commitMessage,
    tree: treeData.sha
  };
  
  if (currentSha) {
    commitParams.parents = [currentSha];
  }
  
  const { data: commitData } = await octokit.git.createCommit(commitParams);

  console.log('Updating branch reference...');
  if (currentSha) {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commitData.sha
    });
  } else {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: commitData.sha
    });
  }

  console.log(`\n✅ Successfully pushed to https://github.com/${owner}/${repo}`);
  console.log(`   Commit: ${commitData.sha}`);
}

pushToGitHub().catch(console.error);
