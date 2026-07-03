import { hello } from "../src/index";

if (hello("atlas") !== "hello atlas") {
  throw new Error("fixture failed");
}
