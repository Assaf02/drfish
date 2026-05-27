import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    // Admin / Agent login (email + password)
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.active) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    // Partner login (username + referral code as password)
    CredentialsProvider({
      id: 'partner',
      name: 'partner',
      credentials: {
        username: { label: 'Nom utilisateur', type: 'text' },
        code: { label: 'Code parrainage', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.code) return null;

        const ref = await prisma.referralCode.findFirst({
          where: {
            username: credentials.username.toLowerCase(),
            code: credentials.code.toUpperCase(),
            status: true,
          },
        });

        if (!ref) return null;

        return {
          id: ref.id,
          email: `${ref.username}@partner.drfish`,
          name: ref.name,
          role: 'PARTNER',
          referralCodeId: ref.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        const u = user as unknown as { referralCodeId?: string };
        if (u.referralCodeId) token.referralCodeId = u.referralCodeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.referralCodeId) {
          (session.user as unknown as { referralCodeId: string }).referralCodeId =
            token.referralCodeId as string;
        }
      }
      return session;
    },
  },
};
