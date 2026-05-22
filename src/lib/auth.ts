import { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const usernameInput = (credentials?.username || '').trim()
        const password = credentials?.password || ''

        const user = await prisma.user.findFirst({
          where: { 
            username: usernameInput
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            username: true,
            passwordHash: true,
            isActive: true,
            sessionVersion: true,
            permissions: true,
          } as any
        }) as any

        if (!user) {
          return null
        }

        if (!user.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        
        if (!isValid) {
          return null
        }


        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          username: user.username,
          sessionVersion: user.sessionVersion,
          permissions: user.permissions,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.userId = (user as any).id
        token.username = (user as any).username
        token.sessionVersion = (user as any).sessionVersion
        token.permissions = (user as any).permissions
        token.lastChecked = Date.now()
      }

      // Per-request session validation for 'Force Logout'
      // Throttled: Check DB only every 60 seconds to avoid connection pool saturation
      const now = Date.now()
      const shouldCheck = !token.lastChecked || (now - (token.lastChecked as number)) > 60000

      if (token.userId && shouldCheck) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: Number(token.userId) },
            select: { sessionVersion: true, isActive: true, permissions: true, role: true } as any
          }) as any
          
          if (dbUser) {
            if (!dbUser.isActive || dbUser.sessionVersion !== token.sessionVersion) {
               return { ...token, error: 'SessionRevoked' }
            }
            // Sync permissions and role in the background
            token.permissions = dbUser.permissions
            token.role = dbUser.role
            token.lastChecked = now // Update timestamp on success
          }
        } catch (error) {
          console.error('[Auth JWT Check] Error in session validation (skipping this cycle):', error)
          // On error (e.g. pool timeout), we allow the session to stay valid for another cycle
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.error === 'SessionRevoked') {
        // This will force the client to sign out
        return null as any;
      }

      if (session.user) {
        const u = session.user as any
        u.role = token.role
        u.id = token.userId
        u.username = token.username
        u.sessionVersion = token.sessionVersion
        u.permissions = token.permissions
      }
      return session
    },
  },
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
