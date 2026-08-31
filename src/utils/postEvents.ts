import { DeviceEventEmitter } from 'react-native';

export const POST_UPDATED_EVENT = 'post:updated';

export const emitPostUpdated = (post: any) => {
  if (!post?._id) return;
  DeviceEventEmitter.emit(POST_UPDATED_EVENT, post);
};

export const mergeUpdatedPost = (list: any[], updatedPost: any) => {
  if (!updatedPost?._id || !Array.isArray(list)) return list;
  return list.map((post) => {
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
};
