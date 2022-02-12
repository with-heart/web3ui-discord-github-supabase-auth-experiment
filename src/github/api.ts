export interface GitHubAuthorization {
  accessToken: string
  tokenType: string
}

export interface FetchGitHubUserResponse {
  id?: number
  email?: string
  avatar_url: string
}

export type FetchGitHubUserEmailsResponse = {email: string; primary?: boolean}[]

export interface FetchGitHubAccessTokenParams {
  clientId: string
  clientSecret: string
  code: string
}

export interface FetchGitHubAccessTokenResponse {
  access_token?: string
  token_type?: string
}

export const fetchGitHubUser = async ({
  accessToken,
  tokenType,
}: GitHubAuthorization): Promise<FetchGitHubUserResponse> =>
  (
    await fetch('https://api.github.com/user', {
      headers: {Authorization: `${tokenType} ${accessToken}`},
    })
  ).json()

export const fetchGitHubUserEmail = async ({
  accessToken,
  tokenType,
}: GitHubAuthorization) => {
  const emails: FetchGitHubUserEmailsResponse = await (
    await fetch('https://api.github.com/user/emails', {
      headers: {Authorization: `${tokenType} ${accessToken}`},
    })
  ).json()

  // get the primary email
  let email = emails.find((email) => email.primary)?.email

  // if it doesn't exist for some reason, use the first email
  if (!email) {
    email = emails[0].email
  }

  return email
}

export const fetchGitHubAccessToken = async ({
  clientId,
  clientSecret,
  code,
}: FetchGitHubAccessTokenParams): Promise<FetchGitHubAccessTokenResponse> =>
  (
    await fetch('https://github.com/login/oauth/access_token', {
      headers: {
        // we want json returned to us
        Accept: 'application/json',
      },
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })
  ).json()
