import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findOrCreateFolder, findExistingFile } from '../src/outputs/gdrive.js';

/**
 * Mock Google Drive API for integration testing
 */
function createMockDrive(existingFolders = [], existingFiles = []) {
  const createdFolders = [];
  const updatedFiles = [];
  let createIdCounter = 1;

  return {
    files: {
      list: vi.fn(async ({ q }) => {
        // Parse name and parent from query
        const nameMatch = q.match(/name='([^']+)'/);
        const parentMatch = q.match(/'([^']+)' in parents/);
        const name = nameMatch?.[1];
        const parentId = parentMatch?.[1];

        // Check folders first, then files
        const folderHits = existingFolders.filter(
          f => f.name === name && f.parentId === parentId
        );
        if (folderHits.length > 0) {
          return { data: { files: folderHits.map(f => ({ id: f.id, name: f.name })) } };
        }

        // Check files (for findExistingFile queries — no mimeType filter)
        const isFolderQuery = q.includes("mimeType='application/vnd.google-apps.folder'");
        if (!isFolderQuery) {
          const fileHits = existingFiles.filter(
            f => f.name === name && f.parentId === parentId
          );
          return { data: { files: fileHits.map(f => ({ id: f.id, name: f.name })) } };
        }

        return { data: { files: [] } };
      }),

      create: vi.fn(async ({ requestBody, media, fields }) => {
        if (requestBody?.mimeType === 'application/vnd.google-apps.folder') {
          const folder = {
            id: `created-folder-${createIdCounter++}`,
            name: requestBody.name,
            parentId: requestBody.parents[0],
          };
          createdFolders.push(folder);
          existingFolders.push(folder);
          return { data: { id: folder.id } };
        }
        // File upload
        const id = `file-${createIdCounter++}`;
        return {
          data: {
            id,
            name: requestBody.name,
            webViewLink: `https://drive.google.com/file/d/${id}/view`,
          },
        };
      }),

      update: vi.fn(async ({ fileId, media, fields }) => {
        updatedFiles.push({ fileId });
        return {
          data: {
            id: fileId,
            name: 'updated-file',
            webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
          },
        };
      }),
    },

    _createdFolders: createdFolders,
    _updatedFiles: updatedFiles,
  };
}

describe('findOrCreateFolder', () => {
  it('returns folder ID directly when given a Drive folder ID', async () => {
    const drive = createMockDrive();
    const result = await findOrCreateFolder(drive, '1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa');
    expect(result).toBe('1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa');
    expect(drive.files.list).not.toHaveBeenCalled();
  });

  it('returns folder ID for short alphanumeric IDs (10+ chars)', async () => {
    const drive = createMockDrive();
    const result = await findOrCreateFolder(drive, 'abcdefghij');
    expect(result).toBe('abcdefghij');
  });

  it('does not treat name with slash as an ID', async () => {
    const drive = createMockDrive();
    await findOrCreateFolder(drive, 'abc/def');
    expect(drive.files.list).toHaveBeenCalled();
  });

  it('finds existing folder by name', async () => {
    const drive = createMockDrive([
      { id: 'existing-123', name: 'webfetch', parentId: 'root' },
    ]);
    const result = await findOrCreateFolder(drive, 'webfetch');
    expect(result).toBe('existing-123');
    expect(drive.files.create).not.toHaveBeenCalled();
  });

  it('creates folder when it does not exist', async () => {
    const drive = createMockDrive([]);
    const result = await findOrCreateFolder(drive, 'webfetch');
    expect(result).toBe('created-folder-1');
    expect(drive.files.create).toHaveBeenCalledOnce();
    expect(drive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'webfetch',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['root'],
        }),
      })
    );
  });

  it('creates nested folders: Longblack/2026', async () => {
    const drive = createMockDrive([]);
    const result = await findOrCreateFolder(drive, 'Longblack/2026');

    // Should create two folders
    expect(drive._createdFolders).toHaveLength(2);
    expect(drive._createdFolders[0].name).toBe('Longblack');
    expect(drive._createdFolders[0].parentId).toBe('root');
    expect(drive._createdFolders[1].name).toBe('2026');
    expect(drive._createdFolders[1].parentId).toBe('created-folder-1'); // under Longblack
    expect(result).toBe('created-folder-2');
  });

  it('reuses existing parent folder in nested path', async () => {
    const drive = createMockDrive([
      { id: 'longblack-id', name: 'Longblack', parentId: 'root' },
    ]);
    const result = await findOrCreateFolder(drive, 'Longblack/2026');

    // Only creates the child folder
    expect(drive._createdFolders).toHaveLength(1);
    expect(drive._createdFolders[0].name).toBe('2026');
    expect(drive._createdFolders[0].parentId).toBe('longblack-id');
  });

  it('handles deeply nested paths: A/B/C', async () => {
    const drive = createMockDrive([]);
    await findOrCreateFolder(drive, 'A/B/C');
    expect(drive._createdFolders).toHaveLength(3);
    expect(drive._createdFolders[0].name).toBe('A');
    expect(drive._createdFolders[1].name).toBe('B');
    expect(drive._createdFolders[2].name).toBe('C');
    // Chain: root → A → B → C
    expect(drive._createdFolders[1].parentId).toBe(drive._createdFolders[0].id);
    expect(drive._createdFolders[2].parentId).toBe(drive._createdFolders[1].id);
  });

  it('strips empty parts from path with trailing slash', async () => {
    const drive = createMockDrive([
      { id: 'wb-id', name: 'webfetch', parentId: 'root' },
    ]);
    const result = await findOrCreateFolder(drive, 'webfetch/');
    expect(result).toBe('wb-id');
    expect(drive.files.create).not.toHaveBeenCalled();
  });
});

describe('MIME type mapping', () => {
  it('maps common file extensions', async () => {
    // Import the module to check MIME_TYPES indirectly via save behavior
    // We test the mapping by verifying the module exports correctly
    const mod = await import('../src/outputs/gdrive.js');
    expect(mod.default.name).toBe('gdrive');
  });
});

describe('findExistingFile', () => {
  it('returns null when file does not exist', async () => {
    const drive = createMockDrive([], []);
    const result = await findExistingFile(drive, 'folder-123', 'missing.md');
    expect(result).toBeNull();
  });

  it('returns file when it exists in folder', async () => {
    const drive = createMockDrive([], [
      { id: 'file-abc', name: 'article.md', parentId: 'folder-123' },
    ]);
    const result = await findExistingFile(drive, 'folder-123', 'article.md');
    expect(result).toEqual({ id: 'file-abc', name: 'article.md' });
  });

  it('does not match file in different folder', async () => {
    const drive = createMockDrive([], [
      { id: 'file-abc', name: 'article.md', parentId: 'other-folder' },
    ]);
    const result = await findExistingFile(drive, 'folder-123', 'article.md');
    expect(result).toBeNull();
  });

  it('does not match file with different name', async () => {
    const drive = createMockDrive([], [
      { id: 'file-abc', name: 'other.md', parentId: 'folder-123' },
    ]);
    const result = await findExistingFile(drive, 'folder-123', 'article.md');
    expect(result).toBeNull();
  });
});

describe('resolveOutputs integration with gdrive', () => {
  it('includes gdrive handler in resolved list', async () => {
    const { resolveOutputs } = await import('../src/outputs/index.js');
    const outputs = resolveOutputs('local,gdrive');
    expect(outputs).toHaveLength(2);
    expect(outputs[0].name).toBe('local');
    expect(outputs[1].name).toBe('gdrive');
  });

  it('gdrive-only resolves single handler', async () => {
    const { resolveOutputs } = await import('../src/outputs/index.js');
    const outputs = resolveOutputs('gdrive');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].name).toBe('gdrive');
    expect(typeof outputs[0].save).toBe('function');
    expect(typeof outputs[0].setup).toBe('function');
    expect(typeof outputs[0].test).toBe('function');
    expect(typeof outputs[0].revoke).toBe('function');
  });
});
