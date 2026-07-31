import { StorageService } from './StorageService';

describe('StorageService', () => {
  const key = 'test.key';

  afterEach(() => {
    StorageService.removeItem(key);
  });

  it('returns null when key is missing', () => {
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('round-trips an object through setItem/getItem', () => {
    const value = { a: 1, b: 'two' };
    StorageService.setItem(key, value);
    expect(StorageService.getItem(key)).toEqual(value);
  });

  it('removeItem clears the key', () => {
    StorageService.setItem(key, { a: 1 });
    StorageService.removeItem(key);
    expect(StorageService.getItem(key)).toBeNull();
  });
});
