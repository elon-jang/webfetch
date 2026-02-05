import { describe, it, expect } from 'vitest';
import { getSourceFolder, routeOutputOptions, SOURCE_FOLDER_NAMES } from '../src/utils/routing.js';

describe('getSourceFolder', () => {
  it('maps longblack to LongBlack', () => {
    expect(getSourceFolder('longblack')).toBe('LongBlack');
  });

  it('maps livewiki to YouTube', () => {
    expect(getSourceFolder('livewiki')).toBe('YouTube');
  });

  it('maps themiilk to TheMiilk', () => {
    expect(getSourceFolder('themiilk')).toBe('TheMiilk');
  });

  it('maps medium to Medium', () => {
    expect(getSourceFolder('medium')).toBe('Medium');
  });

  it('maps substack to Substack', () => {
    expect(getSourceFolder('substack')).toBe('Substack');
  });

  it('maps naver to NaverBlog', () => {
    expect(getSourceFolder('naver')).toBe('NaverBlog');
  });

  it('maps generic to General', () => {
    expect(getSourceFolder('generic')).toBe('General');
  });

  it('returns null for unknown adapter', () => {
    expect(getSourceFolder('unknown')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getSourceFolder(undefined)).toBeNull();
  });
});

describe('routeOutputOptions', () => {
  const year = new Date().getFullYear().toString();

  it('appends source/year to outputDir for longblack', () => {
    const result = routeOutputOptions(
      { outputDir: '/out', driveFolder: 'Webfetch' },
      'longblack',
    );
    expect(result.outputDir).toBe(`/out/LongBlack/${year}`);
  });

  it('appends source/year to driveFolder when it is a name', () => {
    const result = routeOutputOptions(
      { outputDir: '/out', driveFolder: 'Webfetch' },
      'livewiki',
    );
    expect(result.driveFolder).toBe(`Webfetch/YouTube/${year}`);
  });

  it('skips driveFolder routing when it looks like a Drive ID', () => {
    const driveId = '1NrzlShHPwlsvxMAKgmGqIBK6C8tnDioa';
    const result = routeOutputOptions(
      { outputDir: '/out', driveFolder: driveId },
      'longblack',
    );
    expect(result.driveFolder).toBe(driveId);
    // outputDir should still be routed
    expect(result.outputDir).toBe(`/out/LongBlack/${year}`);
  });

  it('returns options unchanged when adapterName is unknown', () => {
    const opts = { outputDir: '/out', driveFolder: 'Webfetch' };
    const result = routeOutputOptions(opts, 'nope');
    expect(result).toEqual(opts);
  });

  it('returns options unchanged when adapterName is undefined', () => {
    const opts = { outputDir: '/out', driveFolder: 'Webfetch' };
    const result = routeOutputOptions(opts, undefined);
    expect(result).toEqual(opts);
  });

  it('preserves other options like driveOverwrite', () => {
    const result = routeOutputOptions(
      { outputDir: '/out', driveFolder: 'Webfetch', driveOverwrite: true },
      'themiilk',
    );
    expect(result.driveOverwrite).toBe(true);
    expect(result.outputDir).toBe(`/out/TheMiilk/${year}`);
  });

  it('does not mutate the original options object', () => {
    const original = { outputDir: '/out', driveFolder: 'Webfetch' };
    routeOutputOptions(original, 'longblack');
    expect(original.outputDir).toBe('/out');
    expect(original.driveFolder).toBe('Webfetch');
  });
});
