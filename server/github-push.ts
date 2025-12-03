// GitHub Push Script - Uses Replit GitHub Integration
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
  '.cache',
  '.replit',
  'replit.nix',
  '.config',
  'dist',
  '.upm',
  'package-lock.json',
  'attached_assets',
  '.breakpoints',
  'generated-icon.png'
];

function shouldInclude(filePath: string): boolean {
  const parts = filePath.split('/');
  return !parts.some(part => EXCLUDE_PATTERNS.includes(part));
}

function getAllFiles(dir: string, baseDir: string = ''): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = baseDir ? `${baseDir}/${item}` : item;
      
      if (!shouldInclude(relativePath)) continue;
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else if (stat.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          // Check if file is binary
          const isBinary = content.includes(0);
          if (!isBinary) {
            files.push({
              path: relativePath,
              content: content.toString('base64')
            });
          }
        } catch (e) {
          console.log(`Skipping file ${relativePath}: ${e}`);
        }
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${dir}: ${e}`);
  }
  
  return files;
}

async function pushToGitHub() {
  const owner = 'zspldev';
  const repo = 'NotesMateMD';
  const branch = 'main';
  const commitMessage = 'Update NotesMate MD - Audio playback fixes and improvements';

  console.log('Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  console.log('Getting current repository state...');
  
  // Get the current commit SHA
  let currentCommitSha: string;
  let currentTreeSha: string;
  
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    currentCommitSha = ref.object.sha;
    
    const { data: commit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha
    });
    currentTreeSha = commit.tree.sha;
    console.log(`Current commit: ${currentCommitSha}`);
  } catch (e: any) {
    if (e.status === 404) {
      console.log('Branch not found, will create initial commit');
      currentCommitSha = '';
      currentTreeSha = '';
    } else {
      throw e;
    }
  }

  console.log('Collecting files...');
  const files = getAllFiles('.');
  console.log(`Found ${files.length} files to push`);

  // Create blobs for each file
  console.log('Creating blobs...');
  const treeItems: any[] = [];
  
  for (const file of files) {
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: 'base64'
      });
      
      treeItems.push({
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha
      });
      
      process.stdout.write('.');
    } catch (e) {
      console.error(`\nError creating blob for ${file.path}: ${e}`);
    }
  }
  console.log('\nBlobs created');

  // Create new tree
  console.log('Creating tree...');
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: currentTreeSha || undefined
  });
  console.log(`New tree SHA: ${newTree.sha}`);

  // Create commit
  console.log('Creating commit...');
  const commitData: any = {
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha
  };
  
  if (currentCommitSha) {
    commitData.parents = [currentCommitSha];
  }
  
  const { data: newCommit } = await octokit.git.createCommit(commitData);
  console.log(`New commit SHA: ${newCommit.sha}`);

  // Update branch reference
  console.log('Updating branch reference...');
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });
  } catch (e: any) {
    if (e.status === 422) {
      // Branch doesn't exist, create it
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha
      });
    } else {
      throw e;
    }
  }

  console.log(`\n✅ Successfully pushed to https://github.com/${owner}/${repo}`);
  console.log(`Commit: ${newCommit.sha}`);
}

pushToGitHub().catch(console.error);
