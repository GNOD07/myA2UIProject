import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import dotenv from "dotenv";

dotenv.config();

const app = new Koa();
const router = new Router();

router.get("/health", (ctx) => {
  ctx.body = { status: "ok" };
});

app.use(cors());
app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`a2ui-playground-server running on http://localhost:${port}`);
});
