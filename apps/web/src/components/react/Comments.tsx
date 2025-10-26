import { useState, useEffect } from "react";
import type { Comment } from "@cms/shared";

interface CommentsProps {
  articleId: string;
  apiUrl: string;
}

export default function Comments({ articleId, apiUrl }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // In a real app, you'd fetch comments here
    // For now, we'll simulate with empty array
    setTimeout(() => {
      setComments([]);
      setIsLoading(false);
    }, 500);
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);

    // Simulate comment submission
    setTimeout(() => {
      const comment: Comment = {
        id: Date.now().toString(),
        contentId: articleId,
        userId: "user-1",
        text: newComment,
        likes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-1",
          name: "Guest User",
          email: "guest@example.com",
          role: "viewer",
          avatar: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      setComments([comment, ...comments]);
      setNewComment("");
      setIsSubmitting(false);
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-500">Loading comments...</div>
    );
  }

  return (
    <div className="mt-12 border-t border-gray-200 pt-8">
      <h2 className="text-2xl font-bold mb-6">Comments ({comments.length})</h2>

      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          rows={4}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="mt-3 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? "Posting..." : "Post Comment"}
        </button>
      </form>

      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-4">
              <div className="flex-shrink-0">
                {comment.user?.avatar ? (
                  <img
                    src={comment.user.avatar}
                    alt={comment.user.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                    {comment.user?.name[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{comment.user?.name}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed">{comment.text}</p>
                <div className="mt-2 flex items-center gap-4">
                  <button className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
                    👍 {comment.likes}
                  </button>
                  <button className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
                    Reply
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
