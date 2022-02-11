// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    storeRequestResponse: 'initialize'
    storeToken: 'tokenReceived'
    storeUser: 'userReceived' | 'userEmailMissing'
    storePrimaryEmail: 'userPrimaryEmailReceived'
    signToken: 'userReceived' | 'userPrimaryEmailReceived'
  }
  internalEvents: {
    '': {type: ''}
    'xstate.init': {type: 'xstate.init'}
  }
  invokeSrcNameMap: {
    validateClient: 'done.invoke.github-auth.validatingClient:invocation[0]'
    validateRequest: 'done.invoke.github-auth.validatingRequest:invocation[0]'
    requestAccessToken: 'done.invoke.github-auth.requestingAccessToken:invocation[0]'
    fetchUser: 'done.invoke.github-auth.fetchingUser:invocation[0]'
    fetchPrimaryEmail: 'done.invoke.github-auth.fetchingPrimaryEmail:invocation[0]'
    setCookie: 'done.invoke.github-auth.settingCookie:invocation[0]'
    redirectToHome: 'done.invoke.github-auth.redirectingToHome:invocation[0]'
    redirectToError: 'done.invoke.github-auth.redirectingToError:invocation[0]'
    redirectToAuthorize: 'done.invoke.github-auth.redirectingToAuthorize:invocation[0]'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    validateClient: 'initialize'
    redirectToError: 'invalidClientId' | 'invalidClientSecret' | 'error'
    validateRequest: 'valid'
    redirectToHome: 'methodInvalid' | 'done'
    redirectToAuthorize: 'codeMissing' | 'tokenMissing' | 'userIdMissing'
    requestAccessToken: 'valid'
    fetchUser: 'tokenReceived'
    fetchPrimaryEmail: 'userEmailMissing'
    setCookie: ''
  }
  eventsCausingGuards: {}
  eventsCausingDelays: {}
  matchesStates:
    | 'idle'
    | 'validatingClient'
    | 'validatingRequest'
    | 'requestingAccessToken'
    | 'fetchingUser'
    | 'fetchingPrimaryEmail'
    | 'signingToken'
    | 'settingCookie'
    | 'redirectingToHome'
    | 'redirectingToError'
    | 'redirectingToAuthorize'
  tags: never
}
