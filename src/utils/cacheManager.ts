/**
 * Cache Manager for Home posts and stories.
 * Mirrors web/src/utils/cacheManager.js using AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  HOME_POSTS: 'cached_home_posts',
  HOME_POSTS_TIMESTAMP: 'home_posts_timestamp',
  CACHE_VERSION: 'cache_version',
};

const CACHE_VERSION = '1.0';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const storiesCacheKey = (profileId?: string | null) =>
  `homeStories_${profileId || 'guest'}`;

type CachedPost = Record<string, any> & { _id?: string };

class CacheManager {
  static async initialize() {
    try {
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.CACHE_VERSION);
      if (cachedVersion !== CACHE_VERSION) {
        await this.clearCache();
        await AsyncStorage.setItem(CACHE_KEYS.CACHE_VERSION, CACHE_VERSION);
      }
    } catch (error) {
      console.warn('Cache initialization error:', error);
    }
  }

  static async getCachedPosts(): Promise<CachedPost[] | null> {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.HOME_POSTS);
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return null;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      if (timeSinceCache > CACHE_DURATION) {
        await this.clearCache();
        return null;
      }

      const posts = JSON.parse(cachedData);
      return Array.isArray(posts) ? posts : null;
    } catch (error) {
      console.error('Error retrieving cached posts:', error);
      return null;
    }
  }

  static async setCachedPosts(posts: CachedPost[]) {
    try {
      if (!Array.isArray(posts)) {
        return false;
      }

      await AsyncStorage.setItem(CACHE_KEYS.HOME_POSTS, JSON.stringify(posts));
      await AsyncStorage.setItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP, Date.now().toString());
      return true;
    } catch (error) {
      console.error('Error caching posts:', error);
      return false;
    }
  }

  static async isCacheValid() {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.HOME_POSTS);
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.HOME_POSTS_TIMESTAMP);

      if (!cachedData || !timestamp) {
        return false;
      }

      const timeSinceCache = Date.now() - parseInt(timestamp, 10);
      return timeSinceCache <= CACHE_DURATION;
    } catch (error) {
      return false;
    }
  }

  static async clearCache() {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.HOME_POSTS,
        CACHE_KEYS.HOME_POSTS_TIMESTAMP,
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  static mergePosts(newPosts: CachedPost[], oldPosts: CachedPost[] = []) {
    try {
      if (!Array.isArray(newPosts)) return oldPosts;
      if (!Array.isArray(oldPosts)) return newPosts;

      const newPostIds = new Set(newPosts.map((p) => p._id));
      const uniqueOldPosts = oldPosts.filter((p) => !newPostIds.has(p._id));
      return [...newPosts, ...uniqueOldPosts];
    } catch (error) {
      console.error('Error merging posts:', error);
      return newPosts;
    }
  }

  static async prependCachedPost(post: CachedPost) {
    try {
      if (!post) return false;
      const cachedPosts = (await this.getCachedPosts()) || [];
      const updatedPosts = [
        post,
        ...cachedPosts.filter((cachedPost) => cachedPost?._id !== post?._id),
      ];
      return this.setCachedPosts(updatedPosts);
    } catch (error) {
      console.error('Error prepending cached post:', error);
      return false;
    }
  }

  static async removeCachedPost(postId: string) {
    try {
      if (!postId) return false;
      const cachedPosts = (await this.getCachedPosts()) || [];
      const updatedPosts = cachedPosts.filter((post) => post?._id !== postId);
      return this.setCachedPosts(updatedPosts);
    } catch (error) {
      console.error('Error removing cached post:', error);
      return false;
    }
  }

  static async updateCachedPost(updatedPost: CachedPost) {
    try {
      if (!updatedPost?._id) return false;
      const cachedPosts = (await this.getCachedPosts()) || [];
      const nextPosts = cachedPosts.map((post) => {
        if (post?._id !== updatedPost._id) return post;
        return {
          ...post,
          ...updatedPost,
          author:
            updatedPost?.author && typeof updatedPost.author === 'object'
              ? updatedPost.author
              : post?.author,
          parentPost:
            updatedPost?.parentPost && typeof updatedPost.parentPost === 'object'
              ? updatedPost.parentPost
              : post?.parentPost,
          comments:
            Array.isArray(updatedPost?.comments) &&
            updatedPost.comments.some((comment: any) => comment && typeof comment === 'object')
              ? updatedPost.comments
              : post?.comments,
        };
      });
      return this.setCachedPosts(nextPosts);
    } catch (error) {
      console.error('Error updating cached post:', error);
      return false;
    }
  }

  static async getCachedStories(profileId?: string | null): Promise<any[] | null> {
    try {
      const raw = await AsyncStorage.getItem(storiesCacheKey(profileId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      console.error('Error reading cached stories:', error);
      return null;
    }
  }

  static async setCachedStories(profileId: string | null | undefined, stories: any[]) {
    try {
      await AsyncStorage.setItem(storiesCacheKey(profileId), JSON.stringify(stories || []));
      return true;
    } catch (error) {
      console.error('Error caching stories:', error);
      return false;
    }
  }
}

CacheManager.initialize();

export default CacheManager;
