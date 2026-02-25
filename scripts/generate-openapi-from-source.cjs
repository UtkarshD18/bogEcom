/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const parser = require(path.join(root, "frontend", "client", "node_modules", "@babel", "parser"));
const traverse = require(path.join(root, "frontend", "client", "node_modules", "@babel", "traverse")).default;

const serverDir = path.join(root, "server");
const routesDir = path.join(serverDir, "routes");
const controllersDir = path.join(serverDir, "controllers");
const METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const parse = (code, file) => {
  try {
    return parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "classProperties", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator", "dynamicImport"],
      errorRecovery: true,
      sourceFilename: file,
    });
  } catch {
    return null;
  }
};
const files = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files(full, out);
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
};
const prop = (n) => (n?.type === "Identifier" ? n.name : n?.type === "StringLiteral" ? n.value : null);
const lit = (n) => {
  if (!n) return null;
  if (n.type === "StringLiteral") return n.value;
  if (n.type === "TemplateLiteral" && n.expressions.length === 0) return n.quasis.map((q) => q.value.cooked).join("");
  return null;
};
const norm = (p) => String(p || "").replace(/\/+/g, "/").replace(/\/$/, "") || "/";
const apiPath = (p) => norm(p).replace(/:([A-Za-z0-9_]+)/g, "{$1}");
const title = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase());

const expr = (n) => {
  if (!n) return "unknown";
  if (n.type === "Identifier") return n.name;
  if (n.type === "MemberExpression" || n.type === "OptionalMemberExpression") return `${expr(n.object)}.${prop(n.property) || expr(n.property)}`;
  if (n.type === "CallExpression") return `${expr(n.callee)}(...)`;
  if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") return "inlineHandler";
  return n.type;
};

const reqAccessor = (n, k) =>
  (n?.type === "MemberExpression" || n?.type === "OptionalMemberExpression") &&
  prop(n.property) === k &&
  n.object?.type === "Identifier" &&
  n.object.name === "req";

const collectPattern = (id, set) => {
  if (!id || id.type !== "ObjectPattern") return;
  for (const p of id.properties || []) {
    if (p.type === "ObjectProperty") {
      if (p.key.type === "Identifier") set.add(p.key.name);
      if (p.key.type === "StringLiteral") set.add(p.key.value);
    }
  }
};

const collectFnMeta = (fnNode) => {
  const body = new Set();
  const query = new Set();
  const params = new Set();
  const statuses = new Set();
  const responseKeys = new Set();

  const walk = (node) => {
    if (!node || typeof node !== "object") return;

    if (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") {
      if ((node.object?.type === "MemberExpression" || node.object?.type === "OptionalMemberExpression") && reqAccessor(node.object, "body")) {
        const k = prop(node.property);
        if (k) body.add(k);
      }
      if ((node.object?.type === "MemberExpression" || node.object?.type === "OptionalMemberExpression") && reqAccessor(node.object, "query")) {
        const k = prop(node.property);
        if (k) query.add(k);
      }
      if ((node.object?.type === "MemberExpression" || node.object?.type === "OptionalMemberExpression") && reqAccessor(node.object, "params")) {
        const k = prop(node.property);
        if (k) params.add(k);
      }
    }

    if (node.type === "VariableDeclarator") {
      const init = node.init;
      if (reqAccessor(init, "body")) collectPattern(node.id, body);
      if (reqAccessor(init, "query")) collectPattern(node.id, query);
      if (reqAccessor(init, "params")) collectPattern(node.id, params);
      if (init?.type === "LogicalExpression") {
        if (reqAccessor(init.left, "body")) collectPattern(node.id, body);
        if (reqAccessor(init.left, "query")) collectPattern(node.id, query);
        if (reqAccessor(init.left, "params")) collectPattern(node.id, params);
      }
    }

    if (node.type === "CallExpression") {
      if (node.callee?.type === "MemberExpression" && prop(node.callee.property) === "status" && node.callee.object?.type === "Identifier" && node.callee.object.name === "res") {
        if (node.arguments?.[0]?.type === "NumericLiteral") statuses.add(node.arguments[0].value);
      }
      if (node.callee?.type === "MemberExpression" && prop(node.callee.property) === "json") {
        if (node.callee.object?.type === "Identifier" && node.callee.object.name === "res") statuses.add(200);
        if (node.callee.object?.type === "CallExpression" && node.callee.object.callee?.type === "MemberExpression" && prop(node.callee.object.callee.property) === "status") {
          const s = node.callee.object.arguments?.[0];
          if (s?.type === "NumericLiteral") statuses.add(s.value);
        }
        const payload = node.arguments?.[0];
        if (payload?.type === "ObjectExpression") {
          for (const p of payload.properties || []) {
            if (p.type === "ObjectProperty") {
              if (p.key.type === "Identifier") responseKeys.add(p.key.name);
              if (p.key.type === "StringLiteral") responseKeys.add(p.key.value);
            }
          }
        }
      }
      if (node.callee?.type === "Identifier" && node.callee.name === "sendSuccess") {
        if (node.arguments?.[3]?.type === "NumericLiteral") statuses.add(node.arguments[3].value);
        else statuses.add(200);
      }
      if (node.callee?.type === "Identifier" && node.callee.name === "sendError") {
        if (node.arguments?.[2]?.type === "NumericLiteral") statuses.add(node.arguments[2].value);
        else {
          statuses.add(400);
          statuses.add(500);
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (["start", "end", "loc"].includes(key)) continue;
      const c = node[key];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };

  walk(fnNode.body || fnNode);
  return {
    body: [...body].sort(),
    query: [...query].sort(),
    params: [...params].sort(),
    statuses: [...statuses].sort((a, b) => a - b),
    responseKeys: [...responseKeys].sort(),
  };
};

const fnFromInit = (init) => {
  if (!init) return null;
  if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") return init;
  if (init.type === "CallExpression") {
    const f = init.arguments?.[0];
    if (f && (f.type === "ArrowFunctionExpression" || f.type === "FunctionExpression")) return f;
  }
  return null;
};

const controllerMeta = {};
for (const file of files(controllersDir)) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const ast = parse(fs.readFileSync(file, "utf8"), rel);
  if (!ast) continue;
  controllerMeta[rel] = {};
  traverse(ast, {
    ExportNamedDeclaration(p) {
      const d = p.node.declaration;
      if (!d) return;
      if (d.type === "FunctionDeclaration" && d.id?.name) controllerMeta[rel][d.id.name] = collectFnMeta(d);
      if (d.type === "VariableDeclaration") {
        for (const dec of d.declarations || []) {
          if (dec.id?.type !== "Identifier") continue;
          const f = fnFromInit(dec.init);
          if (f) controllerMeta[rel][dec.id.name] = collectFnMeta(f);
        }
      }
    },
  });
}

const indexCode = fs.readFileSync(path.join(serverDir, "index.js"), "utf8");
const routeVarToFile = {};
for (const m of indexCode.matchAll(/import\s+([A-Za-z0-9_$]+)\s+from\s+["']\.\/routes\/([^"']+)["'];/g)) routeVarToFile[m[1]] = `server/routes/${m[2]}`;
const mount = {};
for (const m of indexCode.matchAll(/app\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_$]+)\s*,\s*([A-Za-z0-9_$]+)\s*,?\s*\)/g)) {
  if (routeVarToFile[m[3]]) mount[routeVarToFile[m[3]]] = { base: m[1], limiter: m[2] };
}

const getRouteFromChain = (n, routers) => {
  if (!n || n.type !== "CallExpression") return null;
  const c = n.callee;
  if (c?.type !== "MemberExpression") return null;
  if (prop(c.property) === "route" && c.object?.type === "Identifier" && routers.has(c.object.name)) return lit(n.arguments[0]);
  return getRouteFromChain(c.object, routers);
};

const endpoints = [];
for (const file of files(routesDir)) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const code = fs.readFileSync(file, "utf8");
  const ast = parse(code, rel);
  if (!ast) continue;

  const routers = new Set();
  const imports = {};

  traverse(ast, {
    ImportDeclaration(p) {
      const src = p.node.source.value;
      for (const s of p.node.specifiers || []) {
        if (s.type === "ImportSpecifier") imports[s.local.name] = { src, kind: "named", imported: s.imported?.name || s.local.name };
        if (s.type === "ImportDefaultSpecifier") imports[s.local.name] = { src, kind: "default", imported: "default" };
        if (s.type === "ImportNamespaceSpecifier") imports[s.local.name] = { src, kind: "namespace", imported: "*" };
      }
    },
    VariableDeclarator(p) {
      if (p.node.id?.type !== "Identifier" || p.node.init?.type !== "CallExpression") return;
      const c = p.node.init.callee;
      if (c.type === "Identifier" && c.name === "Router") routers.add(p.node.id.name);
      if (c.type === "MemberExpression" && c.object?.type === "Identifier" && c.object.name === "express" && prop(c.property) === "Router") routers.add(p.node.id.name);
    },
  });

  traverse(ast, {
    CallExpression(p) {
      const n = p.node;
      if (n.callee?.type !== "MemberExpression") return;
      const method = prop(n.callee.property);
      if (!METHODS.has(String(method))) return;

      let sub = null;
      let args = [];
      if (n.callee.object?.type === "Identifier" && routers.has(n.callee.object.name)) {
        sub = lit(n.arguments[0]);
        args = n.arguments.slice(1);
      }
      if (!sub && n.callee.object?.type === "CallExpression") {
        sub = getRouteFromChain(n.callee.object, routers);
        args = n.arguments;
      }
      if (!sub) return;

      const hNode = args[args.length - 1] || null;
      const mids = args.slice(0, -1).map(expr);
      let cFile = null;
      let cFn = null;
      let meta = { body: [], query: [], params: [], statuses: [], responseKeys: [] };

      if (hNode?.type === "Identifier") {
        const i = imports[hNode.name];
        if (i && String(i.src).includes("../controllers/")) {
          cFile = path.relative(root, path.normalize(path.join(path.dirname(file), i.src))).replace(/\\/g, "/");
          cFn = i.kind === "named" ? i.imported : hNode.name;
        }
      }
      if (hNode?.type === "MemberExpression" || hNode?.type === "OptionalMemberExpression") {
        const rootId = (() => {
          let cur = hNode;
          while (cur && (cur.type === "MemberExpression" || cur.type === "OptionalMemberExpression")) cur = cur.object;
          return cur?.type === "Identifier" ? cur.name : null;
        })();
        const i = rootId ? imports[rootId] : null;
        if (i && String(i.src).includes("../controllers/")) {
          cFile = path.relative(root, path.normalize(path.join(path.dirname(file), i.src))).replace(/\\/g, "/");
          cFn = prop(hNode.property) || expr(hNode);
        }
      }
      if (hNode?.type === "ArrowFunctionExpression" || hNode?.type === "FunctionExpression") {
        meta = collectFnMeta(hNode);
      }
      if (cFile && cFn && controllerMeta[cFile]?.[cFn]) meta = controllerMeta[cFile][cFn];

      const m = mount[rel] || { base: "", limiter: null };
      endpoints.push({
        method: String(method).toUpperCase(),
        file: rel,
        line: n.loc?.start?.line || null,
        full: norm(`${m.base}${sub === "/" ? "" : sub}`),
        base: m.base,
        limiter: m.limiter,
        mids,
        handler: expr(hNode),
        cFile,
        cFn,
        meta,
      });
    },
  });
}

endpoints.sort((a, b) => (a.full + a.method).localeCompare(b.full + b.method));

const guess = (k) => {
  const f = String(k || "").toLowerCase();
  if (["page", "limit", "offset"].includes(f)) return { type: "integer", minimum: 0 };
  if (/amount|price|total|tax|shipping|discount|rate|coins|latitude|longitude|quantity|qty/.test(f)) return { type: "number" };
  if (/^(is|has|can|enabled|active|verified)/.test(f)) return { type: "boolean" };
  if (/(products|items|images|files|ids|list|transactions|variants)$/.test(f)) return { type: "array", items: { type: "object" } };
  if (/email/.test(f)) return { type: "string", format: "email" };
  if (/url|link/.test(f)) return { type: "string", format: "uri" };
  if (/id$|_id$|^id$/.test(f)) return { type: "string", pattern: "^[0-9a-fA-F]{24}$" };
  if (/details|payload|meta|location|address|settings|config|guest|coinredeem/.test(f)) return { type: "object", additionalProperties: true };
  return { type: "string" };
};

const tagOf = (base) => {
  const p = norm(base).split("/").filter(Boolean);
  const i = p.indexOf("api");
  const r = i >= 0 ? p.slice(i + 1) : p;
  if (!r.length) return "General";
  if (r[0] === "admin" && r[1]) return `Admin ${title(r[1])}`;
  if (r[0] === "membership" && r[1] === "home-content") return "Membership Home Content";
  return title(r[0]);
};

const reqBody = (ep) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(ep.method)) return null;
  if (ep.full === "/api/upload/single") {
    return { content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" }, folder: { type: "string" } }, required: ["image"] } } } };
  }
  if (ep.full === "/api/upload/multiple") {
    return { content: { "multipart/form-data": { schema: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } }, folder: { type: "string" } }, required: ["images"] } } } };
  }
  if (ep.full === "/api/upload/video") {
    return { content: { "multipart/form-data": { schema: { type: "object", properties: { video: { type: "string", format: "binary" } }, required: ["video"] } } } };
  }

  const f = new Set(ep.meta.body || []);
  const lm = ep.mids.map((m) => m.toLowerCase());
  const hk = ep.handler.toLowerCase();
  if (lm.includes("validatecreateorderrequest")) ["products", "totalAmt", "delivery_address", "couponCode", "discountAmount", "finalAmount", "influencerCode", "notes", "tax", "shipping", "originalAmount", "affiliateCode", "affiliateSource", "guestDetails", "coinRedeem", "purchaseOrderId", "paymentType", "location"].forEach((x) => f.add(x));
  if (lm.includes("validatesaveorderrequest")) ["products", "totalAmt", "delivery_address", "couponCode", "discountAmount", "finalAmount", "influencerCode", "affiliateCode", "affiliateSource", "notes", "guestDetails", "coinRedeem", "purchaseOrderId", "paymentType", "location"].forEach((x) => f.add(x));
  if (lm.includes("validateupdateorderstatusrequest") || hk.includes("updateorderstatus")) {
    f.add("order_status");
    f.add("notes");
  }
  if (hk.includes("loginuser")) {
    f.add("email");
    f.add("password");
  }
  if (hk.includes("registeruser")) {
    f.add("name");
    f.add("email");
    f.add("password");
  }
  if (hk.includes("refreshtoken")) f.add("refreshToken");

  if (!f.size) return ["POST", "PUT", "PATCH"].includes(ep.method) ? { content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } : null;

  const props = {};
  [...f].sort().forEach((k) => (props[k] = guess(k)));
  const req = [];
  if (lm.includes("validatecreateorderrequest") || lm.includes("validatesaveorderrequest")) req.push("products");
  if (lm.includes("validateupdateorderstatusrequest") || hk.includes("updateorderstatus")) req.push("order_status");
  if (hk.includes("loginuser")) req.push("email", "password");
  if (hk.includes("registeruser")) req.push("name", "email", "password");

  return { content: { "application/json": { schema: { type: "object", properties: props, ...(req.length ? { required: [...new Set(req)] } : {}), additionalProperties: true } } } };
};

const responses = (ep) => {
  const s = new Set(ep.meta.statuses || []);
  if (!s.size) s.add(200);
  s.add(400);
  const lm = ep.mids.map((m) => m.toLowerCase());
  if (lm.includes("auth") || lm.includes("admin") || lm.includes("isadmin") || lm.includes("influencerauth")) s.add(401);
  if (lm.includes("admin") || lm.includes("isadmin")) s.add(403);
  s.add(500);

  const keys = new Set(ep.meta.responseKeys || []);
  ["error", "success", "message", "data"].forEach((k) => keys.add(k));

  const out = {};
  [...s].sort((a, b) => a - b).forEach((code) => {
    const ok = code >= 200 && code < 300;
    const p = {};
    [...keys].sort().forEach((k) => {
      if (k === "error" || k === "success") p[k] = { type: "boolean" };
      else if (k === "message") p[k] = { type: "string" };
      else p[k] = { type: "object", additionalProperties: true };
    });
    out[String(code)] = {
      description: ok ? "Successful response" : "Error response",
      content: {
        "application/json": {
          schema: {
            allOf: [
              { $ref: ok ? "#/components/schemas/ApiSuccessEnvelope" : "#/components/schemas/ApiErrorEnvelope" },
              { type: "object", properties: p, additionalProperties: true },
            ],
          },
        },
      },
    };
  });
  return out;
};

const params = (ep, p) => {
  const list = [];
  for (const m of p.matchAll(/\{([^}]+)\}/g)) {
    const name = m[1];
    list.push({ name, in: "path", required: true, schema: /id$/i.test(name) ? { type: "string", pattern: "^[0-9a-fA-F]{24}$" } : { type: "string" }, description: `Path parameter: ${name}` });
  }
  const q = new Set(ep.meta.query || []);
  if (ep.mids.map((m) => m.toLowerCase()).includes("validatepaginationquery")) ["page", "limit", "search", "status"].forEach((x) => q.add(x));
  [...q].sort().forEach((k) => list.push({ name: k, in: "query", required: false, schema: guess(k), description: `Query parameter: ${k}` }));
  return list;
};

const sec = (ep) => {
  const lm = ep.mids.map((m) => m.toLowerCase());
  if (lm.includes("influencerauth")) return [{ influencerBearerAuth: [] }];
  if (lm.includes("auth") || lm.includes("admin") || lm.includes("isadmin")) return [{ bearerAuth: [] }];
  return [];
};

const paths = {};
const tags = new Set();
for (const ep of endpoints) {
  const p = apiPath(ep.full);
  if (!paths[p]) paths[p] = {};
  const t = tagOf(ep.base);
  tags.add(t);
  const opId = `${ep.method.toLowerCase()}_${p.replace(/\{([^}]+)\}/g, "By_$1").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
  const op = {
    tags: [t],
    operationId: opId,
    summary: title(String(ep.handler).split(".").pop().replace(/Controller$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2") || `${ep.method} ${ep.full}`),
    description: [`Generated from: ${ep.file}:${ep.line || "?"}`, `Handler: ${ep.handler}`, `Limiter: ${ep.limiter || "none"}`, `Middleware chain: ${ep.mids.join(", ") || "none"}`, ep.cFile && ep.cFn ? `Controller source: ${ep.cFile}#${ep.cFn}` : null].filter(Boolean).join("\n"),
    parameters: params(ep, p),
    responses: responses(ep),
    "x-route-file": ep.file,
    "x-rate-limiter": ep.limiter || null,
    "x-inferred-request-fields": ep.meta.body,
    "x-inferred-query-fields": ep.meta.query,
  };
  const rb = reqBody(ep);
  if (rb) op.requestBody = rb;
  const s = sec(ep);
  if (s.length) op.security = s;
  paths[p][ep.method.toLowerCase()] = op;
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "bogEcom API (Generated from Source)",
    version: "1.0.0-generated",
    description: "Auto-generated OpenAPI spec from server route/controller code. Request/response schemas are inferred from middleware, handler names, and static code analysis. Validate critical contracts against runtime tests before external publication.",
  },
  servers: [{ url: "{API_BASE_URL}", description: "Runtime API base URL", variables: { API_BASE_URL: { default: "http://localhost:8080", description: "Backend server base URL" } } }],
  tags: [...tags].sort((a, b) => a.localeCompare(b)).map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "JWT bearer token for authenticated/admin endpoints." },
      influencerBearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Influencer portal JWT token." },
    },
    schemas: {
      ApiSuccessEnvelope: { type: "object", properties: { error: { type: "boolean", enum: [false] }, success: { type: "boolean", enum: [true] }, message: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["error", "success"], additionalProperties: true },
      ApiErrorEnvelope: { type: "object", properties: { error: { type: "boolean", enum: [true] }, success: { type: "boolean", enum: [false] }, code: { type: "string" }, message: { type: "string" }, details: { type: "object", additionalProperties: true }, stack: { type: "string" } }, required: ["error", "success", "message"], additionalProperties: true },
    },
  },
  paths,
  "x-generated-at": new Date().toISOString(),
  "x-generated-endpoint-count": endpoints.length,
  "x-generated-path-count": Object.keys(paths).length,
};

const outPath = path.join(root, "OPENAPI_SPEC.generated.json");
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`Generated ${outPath}`);
console.log(`Endpoints: ${endpoints.length}`);
console.log(`Paths: ${Object.keys(paths).length}`);
