import jwt from 'jsonwebtoken';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import User from '../models/User.js';
import { typeDefs } from './typeDefs.js';
import { resolvers } from './resolvers.js';
import { createLoaders } from './loaders.js';
import { depthLimit } from './depthLimit.js';

/** Same Bearer token as the REST API; anonymous requests simply get `user: null`. */
async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const { id } = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);
    const user = await User.findById(id).select('name email role isActive').lean();
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

export async function mountGraphQL(app, path = '/graphql') {
  const isProduction = process.env.NODE_ENV === 'production';

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(6)],
    introspection: !isProduction,
    plugins: isProduction ? [ApolloServerPluginLandingPageDisabled()] : [],
    // Never leak stack traces or internal messages for unexpected errors.
    formatError: (formatted, error) => {
      const code = formatted.extensions?.code;
      if (code === 'INTERNAL_SERVER_ERROR' && isProduction) {
        console.error(error);
        return { message: 'Internal server error', extensions: { code } };
      }
      return formatted;
    },
  });

  await server.start();

  app.use(
    path,
    expressMiddleware(server, {
      context: async ({ req }) => ({
        user: await userFromRequest(req),
        loaders: createLoaders(),
      }),
    }),
  );

  return server;
}
