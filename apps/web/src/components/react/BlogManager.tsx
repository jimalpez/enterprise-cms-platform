import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface BlogPost {
  id: number;
  title: string;
  author: string;
  status: "Draft" | "Published";
  date: string;
  category: string;
}

interface FormData {
  title: string;
  author: string;
  status: "Draft" | "Published";
  category: string;
  date: string;
}

const BlogManager = () => {
  const [posts, setPosts] = useState<BlogPost[]>([
    {
      id: 1,
      title: "Getting Started with Enterprise CMS",
      author: "John Doe",
      status: "Published",
      date: "2025-10-15",
      category: "Tutorial",
    },
    {
      id: 2,
      title: "Best Practices for Content Management",
      author: "Jane Smith",
      status: "Draft",
      date: "2025-10-20",
      category: "Guide",
    },
    {
      id: 3,
      title: "Security Features in Modern CMS",
      author: "Mike Johnson",
      status: "Published",
      date: "2025-10-22",
      category: "Security",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    author: "",
    status: "Draft",
    category: "",
    date: new Date().toISOString().split("T")[0],
  });

  const handleOpenModal = (post: BlogPost | null = null) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        author: post.author,
        status: post.status,
        category: post.category,
        date: post.date,
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: "",
        author: "",
        status: "Draft",
        category: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      status: value as "Draft" | "Published",
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (editingPost) {
      setPosts(
        posts.map((post) =>
          post.id === editingPost.id ? { ...post, ...formData } : post,
        ),
      );
    } else {
      const newPost: BlogPost = {
        id: Math.max(...posts.map((p) => p.id), 0) + 1,
        ...formData,
      };
      setPosts([...posts, newPost]);
    }

    handleCloseModal();
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      setPosts(posts.filter((post) => post.id !== id));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your blog content
            </p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add New Post
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Author</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="text-right font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{post.title}</TableCell>
                <TableCell>{post.author}</TableCell>
                <TableCell>{post.category}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      post.status === "Published" ? "default" : "secondary"
                    }
                    className={
                      post.status === "Published"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                    }>
                    {post.status}
                  </Badge>
                </TableCell>
                <TableCell>{post.date}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenModal(post)}
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(post.id)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingPost ? "Edit Post" : "Add New Post"}
            </DialogTitle>
            <DialogDescription>
              {editingPost
                ? "Update the blog post information below."
                : "Fill in the details to create a new blog post."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter post title"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="author">Author *</Label>
                  <Input
                    id="author"
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    placeholder="Author name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="e.g., Tutorial, Guide"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="submit">
                {editingPost ? "Update Post" : "Create Post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogManager;
