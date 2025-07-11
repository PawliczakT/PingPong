module.exports = {
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ data: [], error: null }),
      delete: jest.fn().mockResolvedValue({ data: [], error: null }),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
      subscribe: jest.fn(),
    })),
    auth: {
      signIn: jest.fn(),
      signOut: jest.fn(),
      user: jest.fn(),
    },
  })),
};
