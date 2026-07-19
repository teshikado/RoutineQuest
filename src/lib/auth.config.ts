import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config shared by the full server-side auth (lib/auth.ts) and the
 * middleware (proxy.ts). Must stay free of Node-only code (Prisma, bcrypt) because
 * Next.js compiles middleware for the Edge runtime, which cannot load Prisma's
 * native query engine.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
