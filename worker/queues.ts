import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const defaultQueue = new Queue("default", { connection: redisConnection });
