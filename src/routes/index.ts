import { FastifyInstance } from "fastify";
import rankRoute from "./rank";
import utilRoute from "./util";

const routeHandlers: ((fastify: FastifyInstance) => void)[] = [rankRoute, utilRoute]

export default function registerRoutes(fastify: FastifyInstance) {
    routeHandlers.forEach((handler) => handler(fastify))
}