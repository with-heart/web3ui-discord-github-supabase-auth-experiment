import {parse} from 'cookie'
import {verify} from 'jsonwebtoken'
import {GetServerSidePropsContext} from 'next'
import {GITHUB_JWT_SECRET} from './secrets'

export function parseUser(ctx: GetServerSidePropsContext) {
  if (!ctx.req.headers.cookie) {
    return null
  }

  const token = parse(ctx.req.headers.cookie)['github-token']

  if (!token) {
    return null
  }

  try {
    const {iat, exp, ...user} = verify(token, GITHUB_JWT_SECRET) as any
    return user
  } catch (error) {
    return null
  }
}
