import { environment as development } from './environment.development';

describe('web environments', () => {
  it('uses the local API during development', () => {
    expect(development).toEqual({
      apiBaseUrl: 'http://localhost:3000/api',
      production: false,
    });
  });
});
