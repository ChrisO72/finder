import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config!.dimensions})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return (value as string).slice(1, -1).split(",").map(Number);
  },
});
