import {serialize} from 'cookie'
import {sign} from 'jsonwebtoken'
import {NextApiRequest, NextApiResponse} from 'next'
import {EventFrom} from 'xstate'
import {createModel} from 'xstate/lib/model'
import {
  fetchGitHubAccessToken,
  fetchGitHubUser,
  fetchGitHubUserEmail,
  FetchGitHubUserResponse,
} from '../lib/github.api'

export interface UserData {
  id: number
  email: string
  avatar: string
}

interface ModelData {
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

export const githubAuthModel = createModel(
  {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    scope: ['read:user', 'user:email'].join(' '),
  } as ModelData,
  {
    events: {
      initialize: (request: NextApiRequest, response: NextApiResponse) => ({
        request,
        response,
      }),
      methodInvalid: () => ({}),
      codeMissing: () => ({}),
      error: (error: string) => ({error}),
      valid: () => ({}),
      tokenReceived: (access_token: string, token_type: string) => ({
        access_token,
        token_type,
      }),
      tokenMissing: () => ({}),
      userReceived: (user: UserData) => ({user}),
      userEmailMissing: (user: FetchGitHubUserResponse) => ({user}),
      userIdMissing: () => ({}),
      userPrimaryEmailReceived: (email: string) => ({email}),
      invalidClientId: () => ({error: `Invalid GitHub client ID provided`}),
      invalidClientSecret: () => ({
        error: `Invalid GitHub client secret provided`,
      }),
      done: () => ({}),
    },
  },
)

const {events} = githubAuthModel

export const githubAuthMachine = githubAuthModel.createMachine(
  {
    id: 'github-auth',
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
      // @ts-expect-error
      storeRequestResponse: githubAuthModel.assign(
        {
          request: (_context, event) => event.request,
          response: (_context, event) => event.response,
          code: (_context, event) => event.request.query.code as string,
        },
        'initialize',
      ),
      // @ts-expect-error
      storeToken: githubAuthModel.assign(
        {
          access_token: (_context, event) => {
            return event.access_token
          },
          token_type: (_context, event) => {
            return event.token_type
          },
        },
        'tokenReceived',
      ),
      // @ts-expect-error
      storeUser: githubAuthModel.assign(
        {
          user: (_context, event) => event.user,
        },
        'userReceived',
      ),
      // @ts-expect-error
      storePrimaryEmail: githubAuthModel.assign(
        {
          user: (context, event) => {
            return {
              ...context.user!,
              email: event.email,
            }
          },
        },
        'userPrimaryEmailReceived',
      ),
      // @ts-expect-error
      signToken: githubAuthModel.assign(
        {
          token: (context) => sign(context.user!, 'JWT_SECRET'),
        },
        'tokenReceived',
      ),
    },
    services: {
      validateClient: (context) => (send) => {
        const {client_id, client_secret} = context

        if (!client_id) {
          return send(events.invalidClientId())
        }

        if (!client_secret) {
          return send(events.invalidClientSecret())
        }

        return send(events.valid())
      },
      validateRequest: (context) => (send) => {
        const {request} = context

        // initial request and redirects should all be GET requests
        if (request.method !== 'GET') {
          return send(events.methodInvalid())
        }

        const {code, error} = request.query

        // if we have an error, we'll bail
        if (error) {
          return send(
            events.error(Array.isArray(error) ? error.join(' ') : error),
          )
        }

        // if we don't have a code, it likely means this is the initial request,
        // so we'll bail so we can request one
        if (!code || typeof code !== 'string') {
          return send(events.codeMissing())
        }

        // request is good to go!
        return send(events.valid())
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
          return send(events.tokenMissing())
        }

        // send the tokenReceived event with our token stuff so we can store
        // it in context and re-use it later
        return send(events.tokenReceived(access_token, token_type))
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
          return send(events.userIdMissing())
        }

        // report user missing an email
        if (!user.email) {
          return send(events.userEmailMissing(user))
        }

        // report the user response
        return send(
          events.userReceived({
            id: user.id!,
            email: user.email,
            avatar: user.avatar_url,
          }),
        )
      },
      fetchPrimaryEmail: (context) => async (send) => {
        const {access_token, token_type} = context

        // fetch the user's primary email
        const primaryEmail = await fetchGitHubUserEmail({
          accessToken: access_token!,
          tokenType: token_type!,
        })

        return send(events.userPrimaryEmailReceived(primaryEmail))
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
        return send(events.done())
      },
      // @ts-expect-error
      redirectToHome: (context) => {
        context.response.redirect('/')
        return
      },
      // @ts-expect-error
      redirectToAuthorize: (context) => {
        const {client_id, scope, response} = context

        const query = new URLSearchParams({
          client_id,
          response_type: 'code',
          scope,
          redirect_uri: 'http://localhost:3000/api/auth/github',
        }).toString()
        const uri = `https://github.com/login/oauth/authorize?${query}`

        response.redirect(uri)
        return
      },
      // @ts-expect-error
      redirectToError: (context, _event) => {
        // @ts-expect-error
        const event: Extract<
          EventFrom<typeof githubAuthModel>,
          {type: 'error'}
        > = _event
        context.response.redirect(`/?error=${event.error}`)
        return
      },
    },
  },
)
