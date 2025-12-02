/**
 * Schema Helper Functions Tests
 * Tests for dirty tracking and sync helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markDirty, markDeleted, markSynced, type SyncTrackingFields } from '../schema';

// Mock the isGuestUser function
vi.mock('../../offline-proxy/utils', () => ({
  isGuestUser: vi.fn(() => false),
}));

import { isGuestUser } from '../../offline-proxy/utils';

// Test entity type that extends SyncTrackingFields with additional properties
type TestEntity = SyncTrackingFields & {
  id: string;
  name?: string;
  description?: string;
};

describe('markDirty', () => {
  beforeEach(() => {
    vi.mocked(isGuestUser).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should mark entity as dirty for authenticated user', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDirty(entity);
    
    expect(result._isDirty).toBe(true);
    expect(result._lastModifiedAt).toBeDefined();
    expect(typeof result._lastModifiedAt).toBe('number');
  });

  it('should NOT mark entity as dirty for guest user', () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDirty(entity);
    
    expect(result._isDirty).toBe(false);
  });

  it('should set _isLocalOnly=true when isNew=true for auth user', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDirty(entity, true);
    
    expect(result._isLocalOnly).toBe(true);
    expect(result._isDirty).toBe(true);
  });

  it('should NOT set _isLocalOnly for guest user even when isNew=true', () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDirty(entity, true);
    
    expect(result._isLocalOnly).toBe(false);
    expect(result._isDirty).toBe(false);
  });

  it('should preserve existing _isLocalOnly when isNew=false', () => {
    const entity: TestEntity = { id: '1', _isLocalOnly: true };
    const result = markDirty(entity, false);
    
    expect(result._isLocalOnly).toBe(true);
  });

  it('should preserve other entity properties', () => {
    const entity: TestEntity = { id: '1', name: 'Test', description: 'Desc' };
    const result = markDirty(entity);
    
    expect(result.id).toBe('1');
    expect(result.name).toBe('Test');
    expect(result.description).toBe('Desc');
  });
});

describe('markDeleted', () => {
  beforeEach(() => {
    vi.mocked(isGuestUser).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should mark entity as deleted and dirty for auth user', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDeleted(entity);
    
    expect(result._isDeleted).toBe(true);
    expect(result._isDirty).toBe(true);
    expect(result._lastModifiedAt).toBeDefined();
  });

  it('should mark _isDeleted but NOT _isDirty for guest user', () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDeleted(entity);
    
    expect(result._isDeleted).toBe(true);
    expect(result._isDirty).toBe(false);
  });

  it('should preserve other entity properties', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markDeleted(entity);
    
    expect(result.id).toBe('1');
    expect(result.name).toBe('Test');
  });
});

describe('markSynced', () => {
  it('should clear all sync flags', () => {
    const entity: TestEntity = {
      id: '1',
      _isDirty: true,
      _isDeleted: true,
      _isLocalOnly: true,
      _lastModifiedAt: 1000,
    };
    
    const result = markSynced(entity);
    
    expect(result._isDirty).toBe(false);
    expect(result._isDeleted).toBe(false);
    expect(result._isLocalOnly).toBe(false);
    expect(result._lastModifiedAt).toBeGreaterThan(1000);
  });

  it('should work on entity with no sync flags', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = markSynced(entity);
    
    expect(result._isDirty).toBe(false);
    expect(result._isDeleted).toBe(false);
    expect(result._isLocalOnly).toBe(false);
  });

  it('should preserve other entity properties', () => {
    const entity: TestEntity = { id: '1', name: 'Test', _isDirty: true };
    const result = markSynced(entity);
    
    expect(result.id).toBe('1');
    expect(result.name).toBe('Test');
  });
});
