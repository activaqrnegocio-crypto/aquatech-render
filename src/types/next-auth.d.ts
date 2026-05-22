import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: string
    username: string
  }
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      username: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    userId: string
    username: string
  }
}
