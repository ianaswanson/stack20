import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Detect if we are in a "Mock-Safe" environment
const useMockProvider =
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "development";

// Build providers array
const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

// Inject Mock Provider for dev/preview environments
if (useMockProvider) {
  providers.push(
    CredentialsProvider({
      id: "mock-login",
      name: "Mock Login",
      credentials: {},
      async authorize() {
        // Return a mock user for instant dev/preview login
        return {
          id: "mock-user-preview",
          name: "Preview Developer",
          email: "dev@preview.local",
          image: "https://api.dicebear.com/7.x/avataaars/svg?seed=preview",
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  // Use database adapter for real OAuth, JWT for mock
  adapter: PrismaAdapter(prisma) as any,
  // Use JWT strategy when mock provider is available (supports both flows)
  session: {
    strategy: useMockProvider ? "jwt" : "database",
  },
  providers,
  pages: {
    signIn: "/",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      // Persist user id in JWT token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token, user }) => {
      // Handle both JWT (mock) and database (OAuth) sessions
      if (token) {
        // JWT session (mock provider or dev mode)
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id as string,
          },
        };
      }
      // Database session (production OAuth)
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
      };
    },
  },
};
