import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    role: string; // or a more specific type like 'admin' | 'user' | 'editor' if you have specific roles
  }

  interface Session {
    user: {
      id: string;
      role: string;
      permissions: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    permissions: string[];
  }
}
