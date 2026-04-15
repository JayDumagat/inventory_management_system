import { config } from "./index";

export const corsOptions = {
  origin: config.frontendUrl,
  credentials: true,
};
