const redis = require("../config/redis.config");

class CacheService {
  async get(key) {
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key) {
    try {
      await redis.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
      return keys.length;
    } catch {
      return 0;
    }
  }

  async clear() {
    try {
      await redis.flushdb();
      return true;
    } catch {
      return false;
    }
  }
}

const instance = new CacheService();

// Helper cache user profile - TTL 10 phút
instance.getUserProfile = async (userId) => {
  return instance.get(`user:profile:${userId}`);
};
instance.setUserProfile = async (userId, data) => {
  return instance.set(`user:profile:${userId}`, data, 600);
};
instance.invalidateUserProfile = async (userId) => {
  return instance.delete(`user:profile:${userId}`);
};

// Helper cache friends list - TTL 5 phút
instance.getFriendsList = async (userId) => {
  return instance.get(`user:friends:${userId}`);
};
instance.setFriendsList = async (userId, data) => {
  return instance.set(`user:friends:${userId}`, data, 300);
};
instance.invalidateFriendsList = async (userId) => {
  return instance.delete(`user:friends:${userId}`);
};

module.exports = instance;
