import { ApolloServer, PubSub } from "apollo-server";
import mongoose from "mongoose";
import MongoMemoryServer from 'mongodb-memory-server';

import { GraphQLSchema } from "graphql";
import { mergeSchemas } from "graphql-tools";

const { OAuth2Client } = require("google-auth-library");
const mongoServer = new MongoMemoryServer();

import dotenv from "dotenv";
import {
	CLIENT_ID,
} from "./common/util/secrets";
import { userController } from "./user/user.controller";
import schemas from "./schema";
import resolvers from "./resolvers";

export const pubsub = new PubSub();

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({ path: ".env" });

export const client = new OAuth2Client(CLIENT_ID);
// help to debug mongoose
mongoose.set("debug", true);

mongoose.Promise = Promise;

mongoServer.getConnectionString().then((mongoUri) => {
  const mongooseOpts = {
    autoReconnect: true,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 1000,
  };
 
  mongoose.connect(mongoUri, mongooseOpts);
 
  mongoose.connection.on('error', (e) => {
    if (e.message.code === 'ETIMEDOUT') {
      console.log(e);
      mongoose.connect(mongoUri, mongooseOpts);
    }
    console.log(e);
  });
 
  mongoose.connection.once('open', () => {
    console.log(`MongoDB successfully connected to ${mongoUri}`);
	});
	
	// mongoose.connect(`mongodb://${MONGO_URL}:${MONGO_PORT}/${DB_NAME}`);

	const schema: GraphQLSchema = mergeSchemas({
		schemas,
		resolvers
	});
	
	// GraphQL
	const server = new ApolloServer({
		schema,
		context: async ({ req }: any) => {
			if (!req || !req.headers) {
				return;
			}
	
			const token = req.headers.authorization || "";
			const checkToken = await userController.findOrCreateUser(token);
			if (!checkToken.hasOwnProperty("authorized")) {
				return { user: checkToken, authorized: true };
			}
			return checkToken;
		},
		tracing: true
	});
	
	server.listen().then(({ url }) => {
		console.log(`🚀 Server ready at ${url}`);
	});
	
})

