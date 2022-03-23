"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_list_endpoints_1 = __importDefault(require("express-list-endpoints"));
const server_1 = __importDefault(require("./routes/server"));
const user_1 = __importDefault(require("./routes/user"));
const errorHandler_1 = __importDefault(require("./errorHandler"));
const product_1 = __importDefault(require("./routes/product"));
const customers_1 = __importDefault(require("./routes/customers"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const server = (0, express_1.default)();
server.use((0, cors_1.default)({
    origin: "http://localhost:3000",
    credentials: true,
}));
server.use((0, cookie_parser_1.default)());
server.use(express_1.default.json());
const port = process.env.PORT || 8080;
server.use("/", server_1.default);
server.use("/users", user_1.default);
server.use("/products", product_1.default);
server.use("/customers", customers_1.default);
server.use("/invoices", invoices_1.default);
server.use("/subscriptions", subscriptions_1.default);
server.use(errorHandler_1.default);
server.listen(port, () => {
    console.table((0, express_list_endpoints_1.default)(server));
    console.log(`Server is listening at port ${port}`);
});
