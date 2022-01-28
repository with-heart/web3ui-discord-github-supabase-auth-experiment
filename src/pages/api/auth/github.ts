import {NextApiRequest, NextApiResponse} from 'next'
import {interpret} from 'xstate'
import {githubAuthMachine, githubAuthModel} from '../../../machines/github-auth'

async function GitHubAuth(request: NextApiRequest, response: NextApiResponse) {
  return new Promise<void>((resolve) => {
    const authService = interpret(githubAuthMachine)

    authService.onTransition((state, event) => {
      const {client_id, client_secret, request, response, ...context} =
        state.context
      console.log(state.value, event, JSON.stringify(context, null, 2))
    })

    authService.onDone(() => {
      resolve()
    })

    authService.start()

    authService.send(githubAuthModel.events.initialize(request, response))
  })
}

export default GitHubAuth
