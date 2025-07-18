module.exports = {
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'success', url: 'test://url' })),
};
