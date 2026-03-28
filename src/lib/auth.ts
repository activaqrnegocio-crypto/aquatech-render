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

        const usernameInput = credentials.username.trim()
        const password = credentials.password

        console.log('--- Intentando Login ---');
        console.log('Username:', usernameInput);

        const user = await prisma.user.findFirst({
          where: { 
            username: usernameInput
          },
        })

        if (!user) {
          console.log('Login Fallido: Usuario no encontrado');
          return null
        }

        if (!user.isActive) {
          console.log('Login Fallido: Usuario inactivo');
          return null
        }

        console.log('Usuario encontrado, comparando password...');
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        
        if (!isValid) {
          console.log('Login Fallido: Contraseña incorrecta');
          return null
        }

        console.log('Login Exitoso para:', user.username);

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          username: user.username,
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any
        u.role = token.role
        u.id = token.userId
        u.username = token.username
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
