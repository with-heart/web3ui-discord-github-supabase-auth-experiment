import {serialize} from 'cookie'
import {sign} from 'jsonwebtoken'
import {NextApiRequest, NextApiResponse} from 'next'
import {assign, createMachine} from 'xstate'
import {
  fetchGitHubAccessToken,
  fetchGitHubUser,
  fetchGitHubUserEmail,
  FetchGitHubUserResponse,
} from './api'

export interface UserData {
  id: number
  email: string
  avatar: string
}

export interface GitHubAuthContext {
  /** GitHub client ID for OAuth app */
  client_id: string
  /** GitHub client secret for OAuth app */
  client_secret: string
  /**
   * The type of access our OAuth app needs
   *
   * @see https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
   */
  scope: string
  /** The NextJS Request object */
  request: NextApiRequest
  /** The NextJS Response object */
  response: NextApiResponse
  /** Temporary code for requesting an access token */
  code?: string
  /** GitHub OAuth access token */
  access_token?: string
  /** The type of the access token */
  token_type?: string
  /** The signed access token */
  token?: string
  /** The user data received from */
  user?: UserData
}

export type GitHubAuthEvent =
  | {type: 'initialize'; request: NextApiRequest; response: NextApiResponse}
  | {type: 'methodInvalid'}
  | {type: 'codeMissing'}
  | {type: 'error'; message: string}
  | {type: 'valid'}
  | {type: 'tokenReceived'; access_token: string; token_type: string}
  | {type: 'tokenMissing'}
  | {type: 'userReceived'; user: UserData}
  | {type: 'userEmailMissing'; user: FetchGitHubUserResponse}
  | {type: 'userIdMissing'}
  | {type: 'userPrimaryEmailReceived'; email: string}
  | {type: 'invalidClientId'; message: string}
  | {type: 'invalidClientSecret'; message: string}
  | {type: 'done'}

export const githubAuthMachine = createMachine(
  {
    id: 'github-auth',
    tsTypes: {} as import('./auth.machine.typegen').Typegen0,
    schema: {
      context: {} as GitHubAuthContext,
      events: {} as GitHubAuthEvent,
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          initialize: {
            target: 'validatingClient',
            actions: 'storeRequestResponse',
          },
        },
      },
      validatingClient: {
        invoke: {
          src: 'validateClient',
        },
        on: {
          invalidClientId: 'redirectingToError',
          invalidClientSecret: 'redirectingToError',
          valid: 'validatingRequest',
        },
      },
      validatingRequest: {
        invoke: {
          src: 'validateRequest',
        },
        on: {
          methodInvalid: 'redirectingToHome',
          codeMissing: 'redirectingToAuthorize',
          error: 'redirectingToError',
          valid: 'requestingAccessToken',
        },
      },
      requestingAccessToken: {
        invoke: {
          src: 'requestAccessToken',
        },
        on: {
          tokenReceived: {
            target: 'fetchingUser',
            actions: 'storeToken',
          },
          tokenMissing: 'redirectingToAuthorize',
        },
      },
      fetchingUser: {
        invoke: {
          src: 'fetchUser',
        },
        on: {
          userReceived: {
            target: 'signingToken',
            actions: 'storeUser',
          },
          userIdMissing: 'redirectingToAuthorize',
          userEmailMissing: {
            target: 'fetchingPrimaryEmail',
            actions: 'storeUser',
          },
        },
      },
      fetchingPrimaryEmail: {
        invoke: {
          src: 'fetchPrimaryEmail',
        },
        on: {
          userPrimaryEmailReceived: {
            target: 'signingToken',
            actions: 'storePrimaryEmail',
          },
        },
      },
      signingToken: {
        entry: 'signToken',
        always: 'settingCookie',
      },
      settingCookie: {
        invoke: {
          src: 'setCookie',
        },
        on: {
          done: 'redirectingToHome',
        },
      },
      redirectingToHome: {
        invoke: {
          src: 'redirectToHome',
        },
      },
      redirectingToError: {
        invoke: {
          src: 'redirectToError',
        },
      },
      redirectingToAuthorize: {
        invoke: {
          src: 'redirectToAuthorize',
        },
      },
    },
  },
  {
    actions: {
      storeRequestResponse: assign({
        request: (_context, event) => event.request,
        response: (_context, event) => event.response,
        code: (_context, event) => event.request.query.code as string,
      }),
      storeToken: assign({
        access_token: (_context, event) => {
          return event.access_token
        },
        token_type: (_context, event) => {
          return event.token_type
        },
      }),
      storeUser: assign({
        user: (_context, event) => event.user as UserData,
      }),
      storePrimaryEmail: assign({
        user: (context, event) => {
          return {
            ...context.user!,
            email: event.email,
          }
        },
      }),
      signToken: assign({
        token: (context) => sign(context.user!, 'JWT_SECRET'),
      }),
    },
    services: {
      validateClient: (context) => (send) => {
        const {client_id, client_secret} = context

        if (!client_id) {
          return send({
            type: 'invalidClientId',
            message: 'Invalid GitHub client ID provided',
          })
        }

        if (!client_secret) {
          return send({
            type: 'invalidClientSecret',
            message: 'Invalid GitHub client secret provided',
          })
        }

        return send({type: 'valid'})
      },
      validateRequest: (context) => (send) => {
        const {request} = context

        // initial request and redirects should all be GET requests
        if (request.method !== 'GET') {
          return send({type: 'methodInvalid'})
        }

        const {code, error} = request.query

        // if we have an error, we'll bail
        if (error) {
          return send({
            type: 'error',
            message: Array.isArray(error) ? error.join(' ') : error,
          })
        }

        // if we don't have a code, it likely means this is the initial request,
        // so we'll bail so we can request one
        if (!code || typeof code !== 'string') {
          return send({type: 'codeMissing'})
        }

        // request is good to go!
        return send({type: 'valid'})
      },
      requestAccessToken: (context) => async (send) => {
        const {request, client_id, client_secret} = context
        const code = request.query.code! as string

        // we get back an access token and a token type which we'll use later
        // to authorize fetching user data
        const {access_token, token_type = 'bearer'} =
          await fetchGitHubAccessToken({
            clientId: client_id,
            clientSecret: client_secret,
            code,
          })

        // report if token wasn't received
        if (!access_token) {
          return send({type: 'tokenMissing'})
        }

        // send the tokenReceived event with our token stuff so we can store
        // it in context and re-use it later
        return send({type: 'tokenReceived', access_token, token_type})
      },
      fetchUser: (context) => async (send) => {
        const {access_token, token_type} = context

        // fetch the user's data
        const user = await fetchGitHubUser({
          accessToken: access_token!,
          tokenType: token_type!,
        })

        // report user missing an id
        if (!('id' in user)) {
          return send({type: 'userIdMissing'})
        }

        // report user missing an email
        if (!user.email) {
          return send({type: 'userEmailMissing', user})
        }

        // report the user response
        return send({
          type: 'userReceived',
          user: {
            id: user.id!,
            email: user.email,
            avatar: user.avatar_url,
          },
        })
      },
      fetchPrimaryEmail: (context) => async (send) => {
        const {access_token, token_type} = context

        // fetch the user's primary email
        const primaryEmail = await fetchGitHubUserEmail({
          accessToken: access_token!,
          tokenType: token_type!,
        })

        return send({type: 'userPrimaryEmailReceived', email: primaryEmail})
      },
      setCookie: (context) => (send) => {
        // add our signed token to a cookie
        context.response.setHeader(
          'Set-Cookie',
          serialize('github-token', context.token!, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'lax',
            path: '/',
          }),
        )
        return send({type: 'done'})
      },
      redirectToHome: (context) => () => {
        context.response.redirect('/')
      },
      redirectToAuthorize: (context) => () => {
        const {client_id, scope, response} = context

        const query = new URLSearchParams({
          client_id,
          response_type: 'code',
          scope,
          redirect_uri: 'http://localhost:3000/api/auth/github',
        }).toString()
        const uri = `https://github.com/login/oauth/authorize?${query}`

        response.redirect(uri)
      },
      redirectToError: (context, event) => () => {
        context.response.redirect(`/?error=${event.message}`)
        return
      },
    },
  },
)
