// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

const core = globalThis.Deno.core;
const ops = core.ops;
import { Conn, Listener } from "ext:deno_net/01_net.js";
const primordials = globalThis.__bootstrap.primordials;
const { Number, TypeError } = primordials;

function opStartTls(args) {
  return core.opAsync("op_tls_start", args);
}

async function opTlsHandshake(rid) {
  console.trace("opTlsHandshake.... rid", rid);
  let x = await core.opAsync("op_tls_handshake", rid);
  console.log("opTlsHandshake.... DONE! rid", rid);
  return x;
}

class TlsConn extends Conn {
  async handshake() {
    return opTlsHandshake(this.rid);
  }
}

async function connectTls({
  port,
  hostname = "127.0.0.1",
  transport = "tcp",
  certFile = undefined,
  caCerts = [],
  certChain = undefined,
  privateKey = undefined,
  alpnProtocols = undefined,
}) {
  if (transport !== "tcp") {
    throw new TypeError(`Unsupported transport: '${transport}'`);
  }

  console.log("js: connectTls: op_net_connect_tls GO");
  //let x = setInterval(() => console.log("op_net_connect_tls still running..."), 1000);

  const { 0: rid, 1: localAddr, 2: remoteAddr } = await core.opAsync(
    "op_net_connect_tls",
    { hostname, port },
    { certFile, caCerts, certChain, privateKey, alpnProtocols },
  );

  //clearInterval(x);
  console.log("js: connectTls: op_net_connect_tls DONE!");

  localAddr.transport = "tcp";
  remoteAddr.transport = "tcp";
  const tlsConn = new TlsConn(rid, remoteAddr, localAddr);
  
  // console.trace("js: connectTls: handshake... rid", rid);
  // await tlsConn.handshake(); // DEADLOCK!
  // console.trace("js: connectTls: handshake... DONE! rid", rid);
  
  return tlsConn;
}

class TlsListener extends Listener {
  constructor(rid, localAddr, alpnProtocols, resolveCertificate) {
    super(rid, localAddr);
    this.alpnProtocols = alpnProtocols;
    this.resolveCertificate = resolveCertificate;
  }

  async accept() {
    // try
    // {
    console.log("js: TlsListener.accept: ######## TlsListener: this.rid", this.rid);

    console.log("js: TlsListener.accept: op_net_accept_tls_client_hello_start GO");
    //let x = setInterval(() => console.log("op_net_accept_tls_client_hello_start still running..."), 1000);

    const { 0: serverName, 1: localAddr, 2: remoteAddr } = await core.opAsync(
      "op_net_accept_tls_client_hello_start",
      this.rid,
    );

    console.log("js: TlsListener.accept: op_net_accept_tls_client_hello_start DONE!");
    //clearInterval(x);

    console.log("js: TlsListener.accept: ######## TlsListener: serverName", serverName);

    let resolveCertificateCallback = ("resolveCertificate" in this) ? this["resolveCertificate"] : undefined;
    const { cert, key } = (resolveCertificateCallback && typeof(resolveCertificateCallback) === "function") 
      ? await resolveCertificateCallback(serverName)
      : { cert: undefined, key: undefined };
    
    console.log("js: TlsListener.accept: op_net_accept_tls_client_hello_end GO");
    const newRid = ops.op_net_accept_tls_client_hello_end(
      cert, key, this.rid, this.alpnProtocols, 
    );
    console.log("js: TlsListener.accept: op_net_accept_tls_client_hello_end DONE!");

    console.log("js: TlsListener.accept: ######## TlsListener: newRid", newRid, "cert", cert, "key", key);

    localAddr.transport = "tcp";
    remoteAddr.transport = "tcp";
    console.log("js: TlsListener.accept: ######## TlsListener: remoteAddr", remoteAddr, "localAddr", localAddr);
    let tlsConn = new TlsConn(newRid, remoteAddr, localAddr);
    
    // console.log("js: TlsListener.accept: handshake...");
    // await tlsConn.handshake();
    // console.log("js: TlsListener.accept: handshake... DONE!");
    
    console.log("js: TlsListener.accept: returning!");
    return tlsConn;
    //}catch(e) { console.log("????", e); return null; } 
  }

  //resolveCertificate(serverName) = null
}

function listenTls({
  port,
  cert,
  certFile,
  key,
  keyFile,
  resolveCertificate,
  hostname = "0.0.0.0",
  transport = "tcp",
  alpnProtocols = undefined,
  reusePort = false,
}) {
  if (transport !== "tcp") {
    throw new TypeError(`Unsupported transport: '${transport}'`);
  }
  const { 0: rid, 1: localAddr } = ops.op_net_listen_tls(
    { hostname, port: Number(port) },
    { cert, certFile, key, keyFile, reusePort },
  );
  console.log("js: listenTls: ######## listenTls: rid", rid);
  return new TlsListener(rid, localAddr, alpnProtocols, resolveCertificate);
}

async function startTls(
  conn,
  {
    hostname = "127.0.0.1",
    certFile = undefined,
    caCerts = [],
    alpnProtocols = undefined,
  } = {},
) {
  const { 0: rid, 1: localAddr, 2: remoteAddr } = await opStartTls({
    rid: conn.rid,
    hostname,
    certFile,
    caCerts,
    alpnProtocols,
  });
  return new TlsConn(rid, remoteAddr, localAddr);
}

export { connectTls, listenTls, startTls, TlsConn, TlsListener };
