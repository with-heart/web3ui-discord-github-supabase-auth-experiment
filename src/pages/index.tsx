import {Button, Link, Text} from '@chakra-ui/react'
import type {GetServerSideProps, NextPage} from 'next'
import Head from 'next/head'
import {parseUser, UserData} from '../github'

interface Props {
  user?: UserData
}

const Home: NextPage<Props> = ({user}) => {
  return (
    <div>
      <Head>
        <title>web3-ui+discord+github+supabase auth experiment</title>
        <meta
          name="description"
          content="A learning experiment by with-heart"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        {user ? (
          <Text>Hello {user.email}!</Text>
        ) : (
          <Button as={Link} href="/api/auth/github">
            Connect GitHub Account
          </Button>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async function (ctx) {
  const user = parseUser(ctx)
  return {props: {user}}
}

export default Home
