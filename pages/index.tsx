import {Text} from '@chakra-ui/react'
import type {NextPage} from 'next'
import Head from 'next/head'

const Home: NextPage = () => {
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
        <Text>Hello world!</Text>
      </main>
    </div>
  )
}

export default Home
