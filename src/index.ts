import * as dotenv from 'dotenv'
dotenv.config()

import fastifyFactory from "fastify"
import path from 'path'
import { fetchLeaderboards, fetchRanks, startRegionalLeaderboardsRoutine } from "./client"
import fastifyStatic from '@fastify/static'
import registerRoutes from './routes'

// fetch resources
fetchLeaderboards()
fetchRanks()

// start fetching routine for regional leaderboards
startRegionalLeaderboardsRoutine()

const fastify = fastifyFactory()

// serve static files
fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
})

// register routes
registerRoutes(fastify)

const start = async () => {
    try {
        await fastify.listen({ host: process.env.ADDRESS!, port: parseInt(process.env.PORT!) })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()