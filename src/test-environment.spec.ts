describe('test environment', () => {
  it('runs without Zone.js', () => {
    expect('Zone' in globalThis).toBeFalse();
  });
});
