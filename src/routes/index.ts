import { FastifyInstance } from "fastify";
import rankRoute from "./rank";

const routeHandlers: [(fastify: FastifyInstance) => void] = [rankRoute]

export default function registerRoutes(fastify: FastifyInstance) {
    routeHandlers.forEach((handler) => handler(fastify))
}