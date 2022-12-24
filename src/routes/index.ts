import { FastifyInstance } from "fastify";
import leaderboardsRoute from "./leaderboards";
import rankRoute from "./rank";
import utilRoute from "./util";

const routeHandlers: ((fastify: FastifyInstance) => void)[] = [
    rankRoute, utilRoute, leaderboardsRoute
]

export default function registerRoutes(fastify: FastifyInstance) {
    routeHandlers.forEach((handler) => handler(fastify))
}