import { TextProtoReader } from "./cli/tests/testdata/run/textproto.ts";
import { BufReader, BufWriter } from "./test_util/std/io/mod.ts";


interface Deferred<T> extends Promise<T> {
  readonly state: "pending" | "fulfilled" | "rejected";
  resolve(value?: T | PromiseLike<T>): void;
  // deno-lint-ignore no-explicit-any
  reject(reason?: any): void;
}


function deferred<T>(): Deferred<T> {
  let methods;
  let state = "pending";
  const promise = new Promise<T>((resolve, reject) => {
    methods = {
      async resolve(value: T | PromiseLike<T>) {
        await value;
        state = "fulfilled";
        resolve(value);
      },
      // deno-lint-ignore no-explicit-any
      reject(reason?: any) {
        state = "rejected";
        reject(reason);
      },
    };
  });
  Object.defineProperty(promise, "state", { get: () => state });
  return Object.assign(promise, methods) as Deferred<T>;
}


const encoder = new TextEncoder();
const decoder = new TextDecoder();


const cert = await Deno.readTextFile("cli/tests/testdata/tls/localhost.crt");
const key = await Deno.readTextFile("cli/tests/testdata/tls/localhost.key");
const caCerts = [await Deno.readTextFile("cli/tests/testdata/tls/RootCA.pem")];


async function dialAndListenTLS() {
  const resolvable = deferred();
  const hostname = "localhost";
  const port = 3500;

  const listener = Deno.listenTls({
    hostname,
    port,
    certFile: "cli/tests/testdata/tls/localhost.crt",
    keyFile: "cli/tests/testdata/tls/localhost.key",
  });

  const response = encoder.encode(
    "HTTP/1.1 200 OK\r\nContent-Length: 12\r\n\r\nHello World\n",
  );

  listener.accept().then(
    async (conn) => {
      await conn.write(response);
      // TODO(bartlomieju): this might be a bug
      setTimeout(() => {
        conn.close();
        resolvable.resolve();
      }, 0);
    },
  );

  const conn = await Deno.connectTls({ hostname, port, caCerts });
  const w = new BufWriter(conn);
  const r = new BufReader(conn);
  const body = `GET / HTTP/1.1\r\nHost: ${hostname}:${port}\r\n\r\n`;
  const writeResult = await w.write(encoder.encode(body));
  await w.flush();
  const tpr = new TextProtoReader(r);
  const statusLine = await tpr.readLine();
  const m = statusLine.match(/^(.+?) (.+?) (.+?)$/);
  const [_, proto, status, ok] = m;
  const headers = await tpr.readMimeHeader();
  const contentLength = parseInt(headers.get("content-length")!);
  const bodyBuf = new Uint8Array(contentLength);
  await r.readFull(bodyBuf);
  conn.close();
  listener.close();
  await resolvable;
};


dialAndListenTLS();