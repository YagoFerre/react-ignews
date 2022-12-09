import { query as q } from 'faunadb';

import NextAuth from 'next-auth';
import GithubProviders from 'next-auth/providers/github';

import { fauna } from '../../../services/fauna';

export default NextAuth({
    providers: [
        GithubProviders({
            clientId: process.env.GITHUB_ID as string,
            clientSecret: process.env.GITHUB_SECRET as string,
            authorization: {
              params: {
                scope: 'read:user',
              },
            },
        })
    ],
    callbacks: { // Salvar dados no faunaDB
      async signIn({user, account, profile}) {
        const { email } = user;

        try {
          await fauna.query(
            q.If(
              q.Not(
                q.Exists(
                  q.Match(
                    q.Index('user_by_email'),
                    q.Casefold(user.email as string)
                  )
                )
              ),
              q.Create(
                q.Collection('users'),
                { data: { email } }
              ),
              q.Get(
                q.Match(
                  q.Index('user_by_email'),
                  q.Casefold(user.email as string)
                )
              )
            )
          )
            
          return true;
        } catch {
          return false;
        }

      },
    }
});